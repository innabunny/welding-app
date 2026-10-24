# Опрос узлов телеметрии по HTTP.
#
# Узел — HTTP-сервер: сам ничего не отправляет, на GET /api/state
# отвечает текущим состоянием. Прошивку не трогаем, поэтому приёмник
# спрашивает сам, пять раз в секунду, и по ответам ведёт всё то, что
# по MQTT узел присылал бы событиями: сеанс, участки дуги, точки.
#
# Включается переменной POLL_NODES=1. MQTT при этом работает как раньше.
#
# Какие узлы опрашивать — берётся из справочника оборудования: у аппарата
# должны быть заполнены node_id и node_ip. Справочник перечитывается
# раз в 30 секунд, перезапускать приёмник после правки не нужно.
#
# Что в ответе узла:
#   a, v           — ток и напряжение в момент опроса → точки и живые значения
#   arc            — горит ли дуга (ток выше порога прошивки)
#   allowed, welder — карта приложена и разрешена; welder — номер карты
#   aa, amin, amax, va, vmin, vmax — статистика С НАЧАЛА текущего участка
#       дуги, накопительная. В точки её писать нельзя: полоса разброса
#       расширялась бы к концу прохода. Она идёт в участок дуги
#       при его закрытии
#   t, free        — температура и свободная память узла → диагностика

import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import requests
from django.db import close_old_connections

from apps.equipment.models import Equipment
from apps.welders.models import Welder
from apps.welding.broadcast import send_event, send_live
from apps.welding.models import ArcRun, WeldingSession
from apps.welding.watchdog import OFFLINE_AFTER_SECONDS, touch

log = logging.getLogger("poller")

POLL_HZ = float(os.environ.get("POLL_HZ", "5"))
# узел в сети отвечает за десятки миллисекунд; дольше — считаем пропуском
POLL_TIMEOUT = float(os.environ.get("POLL_TIMEOUT", "0.8"))
# сколько без дуги держать сеанс открытым, если карту не убрали
SESSION_IDLE_SECONDS = int(os.environ.get("POLL_SESSION_IDLE_SECONDS", "600"))
# узел не может сообщить режим и код маршрутного листа — режим по умолчанию
SESSION_MODE = os.environ.get("POLL_SESSION_MODE", WeldingSession.Mode.ROUTINE)

# диагностика узла не меняется пять раз в секунду, а touch пишет в базу
TOUCH_EVERY_SECONDS = 1.0
# после стольких пропусков подряд опрашиваем реже, чтобы не долбить
# пропавший узел и не засорять журнал
SLOW_AFTER_FAILS = 10
SLOW_PERIOD_SECONDS = 2.0
RESCAN_SECONDS = 30


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def dec(value, places: int = 1) -> Decimal | None:
    """Число из ответа узла → Decimal для DecimalField. None — нет значения."""
    if value is None:
        return None
    return Decimal(str(round(float(value), places)))


class NodePoller(threading.Thread):
    """Один узел — один поток. Состояние сеанса и дуги живёт здесь."""

    def __init__(self, node_id: str, ip: str, sink):
        super().__init__(name=f"poll-{node_id}", daemon=True)
        self.node_id = node_id
        self.ip = ip
        self.url = f"http://{ip}/api/state"
        # sink — приёмник: общий накопитель точек и разбор сеанса
        self.sink = sink
        self.http = requests.Session()
        self.stopping = threading.Event()

        self.session: WeldingSession | None = None
        self.welder_uid = ""
        self.arc: ArcRun | None = None
        self.arc_last_state: dict | None = None
        self.arc_had_gap = False
        self.last_arc_at: datetime | None = None
        # после закрытия по простою карта может так и лежать. Сеанс по ней
        # не открываем, пока не загорится дуга, карту не уберут или не
        # приложат другую. None — запрета нет
        self.blocked_uid: str | None = None

        self.fails = 0
        self.last_ok_at: datetime | None = None
        self.last_touch = 0.0

    def stop(self):
        self.stopping.set()

    # ─────────────────────────── цикл ───────────────────────────

    def run(self):
        log.info("опрос узла %s: %s, %s раз/с", self.node_id, self.url, POLL_HZ)
        close_old_connections()
        self.close_leftovers()
        period = 1.0 / POLL_HZ
        while not self.stopping.is_set():
            started = time.monotonic()
            # соединения с Postgres умирают по таймауту, а поток живёт
            # часами: проверяем перед каждым тактом, иначе через сутки
            # опрос встанет с InterfaceError
            close_old_connections()
            try:
                self.tick()
            except Exception:
                # один сбойный такт не должен останавливать опрос
                log.exception("узел %s: ошибка обработки ответа", self.node_id)
            pause = SLOW_PERIOD_SECONDS if self.fails >= SLOW_AFTER_FAILS else period
            self.stopping.wait(max(0.0, pause - (time.monotonic() - started)))

        # остановили (узел убрали из справочника или сменили адрес)
        close_old_connections()
        self.close_session(self.last_ok_at or now_utc(), "опрос остановлен", complete=False)

    def tick(self):
        try:
            response = self.http.get(self.url, timeout=POLL_TIMEOUT)
            response.raise_for_status()
            state = response.json()
        except (requests.RequestException, ValueError) as exc:
            self.on_failure(exc)
            return
        self.on_state(state, now_utc())

    # ─────────────────────── нет ответа ───────────────────────

    def on_failure(self, exc):
        self.fails += 1
        if self.fails == 1:
            log.warning("узел %s не ответил: %s", self.node_id, exc)
        if self.arc is not None:
            self.arc_had_gap = True

        # молчит дольше, чем сторож считает обрывом — закрываем сеанс
        # на моменте последнего ответа: что было дальше, неизвестно
        if self.session is not None and self.last_ok_at is not None:
            if now_utc() - self.last_ok_at > timedelta(seconds=OFFLINE_AFTER_SECONDS):
                self.close_session(self.last_ok_at, "нет связи с узлом", complete=False)

    # ─────────────────────── есть ответ ───────────────────────

    def on_state(self, st: dict, at: datetime):
        if self.fails:
            log.info("узел %s снова отвечает после %s пропусков", self.node_id, self.fails)
        self.fails = 0
        self.last_ok_at = at

        a = float(st.get("a") or 0)
        v = float(st.get("v") or 0)
        arc = bool(st.get("arc"))
        allowed = bool(st.get("allowed"))
        # в базе номера карт хранятся в нижнем регистре, узел шлёт в верхнем
        uid = (st.get("welder") or "").strip().lower()

        self.touch_if_due(st)

        if not allowed:
            self.blocked_uid = None

        # ── закрытие сеанса ──
        if self.session is not None:
            if uid and self.welder_uid and uid != self.welder_uid:
                self.close_session(at, "приложили другую карту")
            elif not allowed and not arc:
                self.close_session(at, "карту убрали")
            elif not arc and self.idle_too_long(at):
                self.close_session(at, f"простой больше {SESSION_IDLE_SECONDS} с")
                self.blocked_uid = uid

        # ── открытие сеанса ──
        if self.session is None and (arc or (allowed and uid != self.blocked_uid)):
            self.blocked_uid = None
            self.open_session(at, uid)

        # ── участок дуги ──
        if arc and self.session is not None:
            if self.arc is None:
                self.open_arc(at)
            self.arc_last_state = st
            self.last_arc_at = at
            # в точку — мгновенные значения: накопительные aa/amin/amax
            # дали бы полосу разброса, растущую к концу прохода
            self.sink.add_rows([(
                self.arc.id, self.session.external_id, self.node_id, at, a, a, a, v,
            )])
        elif not arc and self.arc is not None:
            self.close_arc(at)

        send_live(self.node_id, {
            "i": round(a, 1),
            "u": round(v, 1),
            "arc": arc,
            "sid": self.session.external_id if self.session else "",
            "ts": int(at.timestamp() * 1000),
        })

    def idle_too_long(self, at: datetime) -> bool:
        since = self.last_arc_at or self.session.started_at
        return at - since > timedelta(seconds=SESSION_IDLE_SECONDS)

    def touch_if_due(self, st: dict):
        if time.monotonic() - self.last_touch < TOUCH_EVERY_SECONDS:
            return
        self.last_touch = time.monotonic()
        touch(
            self.node_id,
            last_status_at=now_utc(),
            ip=self.ip,
            temperature=dec(st.get("t")),
            free_bytes=st.get("free"),
            # опрос ничего не копит: что узел не отдал сейчас, не придёт
            queued=0,
        )

    # ─────────────────────── сеанс ───────────────────────

    def open_session(self, at: datetime, uid: str):
        equipment = Equipment.objects.filter(node_id=self.node_id).first()
        if equipment is None:
            log.warning("узел %s не привязан к оборудованию", self.node_id)
            return
        welder = Welder.objects.filter(rfid_uid=uid).first() if uid else None
        if uid and welder is None:
            log.warning("узел %s: карта %s не записана ни за одним сварщиком", self.node_id, uid)

        # как у узла: <узел>-<время начала в мс> — уникально и читаемо
        external_id = f"{self.node_id}-{int(at.timestamp() * 1000)}"
        self.session = WeldingSession.objects.create(
            equipment=equipment,
            welder=welder,
            mode=SESSION_MODE,
            external_id=external_id,
            started_at=at,
        )
        self.welder_uid = uid
        self.last_arc_at = None
        log.info("сеанс %s начат на %s, сварщик %s", external_id, equipment.name,
                 welder.fio if welder else "не опознан")
        send_event(self.node_id, {
            "event": "session_start",
            "sid": external_id,
            "welder": welder.fio if welder else "",
            "mode": SESSION_MODE,
        })

    def close_session(self, at: datetime, why: str, complete: bool = True):
        if self.session is None:
            return
        if self.arc is not None:
            self.close_arc(at, complete=complete)
        session = self.session
        session.finished_at = max(at, session.started_at)
        session.save(update_fields=["finished_at"])
        self.session = None
        self.welder_uid = ""
        log.info("сеанс %s закрыт: %s", session.external_id, why)
        send_event(self.node_id, {"event": "session_stop", "sid": session.external_id})
        self.sink.analyze_later(session)

    def close_leftovers(self):
        """Сеансы этого узла, оставшиеся открытыми после прошлого запуска.

        Приёмник перезапустили посреди сварки — что было между остановкой
        и запуском, неизвестно. Закрываем на последнем участке дуги
        и помечаем участки неполными.
        """
        leftovers = WeldingSession.objects.filter(
            finished_at__isnull=True, external_id__startswith=f"{self.node_id}-",
        )
        for session in leftovers:
            last = session.arcs.order_by("-started_at").first()
            end = (last.finished_at or last.started_at) if last else session.started_at
            session.arcs.filter(finished_at__isnull=True).update(
                finished_at=end, telemetry_complete=False,
            )
            session.finished_at = end
            session.save(update_fields=["finished_at"])
            log.info("сеанс %s остался с прошлого запуска — закрыт", session.external_id)

    # ─────────────────────── участок дуги ───────────────────────

    def open_arc(self, at: datetime):
        self.arc = ArcRun.objects.create(session=self.session, started_at=at)
        self.arc_had_gap = False
        self.arc_last_state = None

    def close_arc(self, at: datetime, complete: bool = True):
        """Сводка участка — из накопительной статистики узла на последнем
        ответе с горящей дугой: это и есть итог по всему участку."""
        st = self.arc_last_state or {}
        ArcRun.objects.filter(id=self.arc.id).update(
            finished_at=at,
            current_avg=dec(st.get("aa")),
            current_min=dec(st.get("amin")),
            current_max=dec(st.get("amax")),
            voltage_avg=dec(st.get("va")),
            # пропуски опроса во время дуги — точек не хватает
            telemetry_complete=complete and not self.arc_had_gap,
        )
        self.arc = None
        self.arc_last_state = None


class PollManager(threading.Thread):
    """Держит по потоку на каждый узел из справочника оборудования."""

    def __init__(self, sink):
        super().__init__(name="poll-manager", daemon=True)
        self.sink = sink
        self.pollers: dict[str, NodePoller] = {}

    def run(self):
        log.info("опрос узлов по HTTP включён")
        while True:
            close_old_connections()
            try:
                self.rescan()
            except Exception:
                log.exception("ошибка чтения справочника узлов")
            time.sleep(RESCAN_SECONDS)

    def rescan(self):
        wanted = {
            node_id: str(ip)
            for node_id, ip in Equipment.objects.filter(is_active=True)
            .exclude(node_id__isnull=True).exclude(node_id="")
            .exclude(node_ip__isnull=True)
            .values_list("node_id", "node_ip")
        }
        for node_id, poller in list(self.pollers.items()):
            if wanted.get(node_id) != poller.ip:
                log.info("узел %s убран из справочника или сменил адрес — опрос остановлен", node_id)
                poller.stop()
                poller.join(timeout=5)
                del self.pollers[node_id]
        for node_id, ip in wanted.items():
            if node_id not in self.pollers:
                poller = NodePoller(node_id, ip, self.sink)
                self.pollers[node_id] = poller
                poller.start()
        if not wanted:
            log.info("узлов с адресом в справочнике нет — опрашивать некого")
