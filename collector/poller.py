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
#   cards_ver, cards_n — версия списка разрешённых карт на узле и число карт
#       в нём. cards_ver пустой — списка нет, узел запрещает сварку всем
#   tap_uid, tap_ok, tap_age, tap_seq — последнее прикладывание карты:
#       номер, принята ли, сколько секунд назад, порядковый номер события.
#       Каждое новое прикладывание — строка в журнале CardTap
#
# Список разрешённых карт узел хранит у себя и сам решает, пускать ли
# сварщика. Приёмник собирает для каждого узла свой список из базы —
# с учётом способа сварки его аппарата (см. CardList), сравнивает
# его версию с cards_ver узла и, если разошлись, отправляет новый
# на POST /api/cards.

import hashlib
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import requests
from django.db import close_old_connections, transaction
from django.db.models import Exists, OuterRef, Q

from apps.attestation.models import Attestation
from apps.equipment.models import Equipment
from apps.welders.models import Welder
from apps.welding.broadcast import send_event, send_live
from apps.welding.models import ArcRun, WeldingSession
from apps.welding.card_access import tap_reason
from apps.welding.models import CardTap, NodeState
from apps.welding.watchdog import OFFLINE_AFTER_SECONDS, mark_offline, touch

log = logging.getLogger("poller")

# Сколько раз в секунду опрашивать узел. Веб-сервер на ESP32 держит всего
# несколько соединений и закрывает каждое после ответа: при пяти запросах
# в секунду они не успевают освобождаться, и узел пропускает ответы.
# Для фоновых значений двух раз хватает. Задаётся в .env: POLL_HZ=2
POLL_HZ = float(os.environ.get("POLL_HZ", "2"))
# узел в сети отвечает за десятки миллисекунд; дольше — считаем пропуском
POLL_TIMEOUT = float(os.environ.get("POLL_TIMEOUT", "0.8"))
# сколько без дуги держать сеанс открытым, если карту не убрали
SESSION_IDLE_SECONDS = int(os.environ.get("POLL_SESSION_IDLE_SECONDS", "600"))
# Через сколько секунд без ответа объявлять «нет связи». Опрос видит
# пропажу сразу, тридцать секунд сторожа ему ждать незачем. Не меньше
# нескольких тактов: узел иногда подвисает на пару-тройку секунд.
# Задаётся в .env: POLL_OFFLINE_SECONDS=5
POLL_OFFLINE_SECONDS = float(os.environ.get("POLL_OFFLINE_SECONDS", "5"))
# Узел не сообщает режим. «По техпроцессу» без техкарты не пишем: это
# ушло бы в отчёты как факт. Режим уточняется при привязке к операции.
SESSION_MODE = os.environ.get("POLL_SESSION_MODE", WeldingSession.Mode.UNSPECIFIED)

# диагностика узла не меняется пять раз в секунду, а touch пишет в базу
TOUCH_EVERY_SECONDS = 1.0
# после стольких пропусков подряд опрашиваем реже, чтобы не долбить
# пропавший узел и не засорять журнал
SLOW_AFTER_FAILS = 10
SLOW_PERIOD_SECONDS = 2.0
RESCAN_SECONDS = 30

# Список карт собирается запросом к базе — не на каждом такте опроса,
# а не чаще, чем раз в столько секунд для каждого узла. Новая аттестация
# или карта доедет до узла с такой задержкой
CARDS_REFRESH_SECONDS = 5.0
# куда узел принимает список
CARDS_PATH = "/api/cards"
# список длиннее ответа о состоянии — ждём ответа дольше
CARDS_TIMEOUT = 3.0
# Отправили, а узел всё ещё показывает старую версию — повторяем
# не раньше, чем через столько секунд, чтобы не слать список
# на каждом такте, если узел его не принимает
CARDS_RETRY_SECONDS = 15.0


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def dec(value, places: int = 1) -> Decimal | None:
    """Число из ответа узла → Decimal для DecimalField. None — нет значения."""
    if value is None:
        return None
    return Decimal(str(round(float(value), places)))


class CardList:
    """Списки карт, которым разрешено варить, — свой у каждого узла.

    В список узла входят активные сварщики с привязанной картой, у которых
    есть действующая аттестация на способ сварки аппарата, к которому
    привязан узел: допуск на аргонодуговую не пускает на полуавтомат.
    Сервисные карты (is_service) входят в любой список без аттестации.

    Версия — отпечаток самого списка: первые 8 знаков SHA-1 от
    отсортированных номеров. Одинаковый набор карт — одинаковая версия,
    поменялся хоть один номер — версия другая. Счётчик вручную вести
    не нужно, и после перезапуска приёмника версия та же.
    """

    def __init__(self):
        self.lock = threading.Lock()
        # узел → (когда собран, версия, номера)
        self.cache: dict[str, tuple[float, str, list[str]]] = {}

    def get(self, node_id: str) -> tuple[str, list[str]]:
        """Версия и номера карт для узла. Из базы — не чаще CARDS_REFRESH_SECONDS.

        Потоков опроса несколько (по одному на узел): lock не даёт им
        одновременно править общий кэш.
        """
        with self.lock:
            cached = self.cache.get(node_id)
            if cached is None or time.monotonic() - cached[0] >= CARDS_REFRESH_SECONDS:
                # способ берём заново при каждой сборке: аппарату в
                # справочнике могли поменять способ, и список должен это учесть
                method_id = (
                    Equipment.objects.filter(node_id=node_id)
                    .values_list("method_id", flat=True).first()
                )
                if method_id is None:
                    log.warning("узел %s не привязан к оборудованию — в списке "
                                "только сервисные карты", node_id)
                cached = (time.monotonic(), *self.build(method_id))
                self.cache[node_id] = cached
            return cached[1], cached[2]

    @staticmethod
    def build(method_id: str | None) -> tuple[str, list[str]]:
        """Список для аппарата со способом method_id.

        method_id None — аппарат неизвестен: способ проверить не на чем,
        поэтому пускаем только сервисные карты, а не всех аттестованных.
        """
        allowed = Q(is_service=True)
        if method_id is not None:
            # «есть действующая аттестация на этот способ» — подзапрос,
            # база проверяет его сразу для всех сварщиков одним запросом
            valid = Attestation.objects.filter(
                welder=OuterRef("pk"), method_id=method_id,
                status="done", valid_until__gte=date.today(),
            )
            allowed |= Q(Exists(valid))
        raw = (
            Welder.objects.filter(is_active=True)
            .exclude(rfid_uid__isnull=True).exclude(rfid_uid="")
            .filter(allowed)
            .values_list("rfid_uid", flat=True)
        )
        uids = set()
        for uid in raw:
            uid = uid.strip().lower()
            # в строку списка — только шестнадцатеричный номер: всё прочее
            # узел не разберёт, а перевод строки сломал бы формат
            if uid and all(c in "0123456789abcdef" for c in uid):
                uids.add(uid)
            else:
                log.warning("карта %r не похожа на hex-номер — в список для узлов не включена", uid)
        uids = sorted(uids)
        version = hashlib.sha1("\n".join(uids).encode()).hexdigest()[:8]
        return version, uids

    @staticmethod
    def body(version: str, uids: list[str]) -> str:
        """Текст для узла: первая строка v=<версия>, дальше по номеру на строку."""
        return "\n".join([f"v={version}", *uids]) + "\n"


CARDS = CardList()


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
        # узел отвечает с Connection: close — держать соединение незачем,
        # а попытка переиспользовать уже закрытое кончается пропуском
        self.http.headers["Connection"] = "close"
        self.stopping = threading.Event()

        self.session: WeldingSession | None = None
        self.welder_uid = ""
        self.arc: ArcRun | None = None
        self.arc_last_state: dict | None = None
        self.arc_had_gap = False
        # замеры текущей секунды: в базу — одной точкой (см. add_point)
        self.bucket: dict | None = None
        self.last_arc_at: datetime | None = None
        # после закрытия по простою карта может так и лежать. Сеанс по ней
        # не открываем, пока не загорится дуга, карту не уберут или не
        # приложат другую. None — запрета нет
        self.blocked_uid: str | None = None

        # отправка списка карт: какую версию и когда отправили последней
        self.cards_url = f"http://{ip}{CARDS_PATH}"
        self.cards_sent_ver: str | None = None
        self.cards_sent_at = 0.0
        # версия на узле с прошлого такта — чтобы писать в журнал только смену
        self.cards_node_ver: str | None = None
        # номер последнего прикладывания карты, уже записанного в журнал;
        # хранится в NodeState.last_tap_seq, при запуске читается оттуда
        self.tap_seq = None
        self.tap_seq_loaded = False

        self.fails = 0
        self.last_ok_at: datetime | None = None
        self.last_touch = 0.0
        # когда начались пропуски (monotonic) и объявлен ли уже обрыв
        self.failing_since: float | None = None
        self.reported_offline = False

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
            self.failing_since = time.monotonic()
            log.warning("узел %s не ответил: %s", self.node_id, exc)
        if self.arc is not None:
            self.arc_had_gap = True

        # молчит дольше порога — «нет связи» сразу, событие уйдёт в браузеры
        if not self.reported_offline and time.monotonic() - (self.failing_since or 0) >= POLL_OFFLINE_SECONDS:
            self.reported_offline = True
            state = NodeState.objects.filter(node_id=self.node_id).first()
            if state is not None:
                mark_offline(state, self.last_ok_at or now_utc())

        # молчит дольше, чем сторож считает обрывом — закрываем сеанс
        # на моменте последнего ответа: что было дальше, неизвестно
        if self.session is not None and self.last_ok_at is not None:
            if now_utc() - self.last_ok_at > timedelta(seconds=OFFLINE_AFTER_SECONDS):
                self.close_session(self.last_ok_at, "нет связи с узлом", complete=False)

    # ─────────────────────── есть ответ ───────────────────────

    def on_state(self, st: dict, at: datetime):
        if self.fails:
            log.info("узел %s снова отвечает после %s пропусков", self.node_id, self.fails)
        if self.reported_offline:
            # возврат отмечаем сразу: touch закроет обрыв и известит браузеры
            self.last_touch = 0.0
        self.fails = 0
        self.failing_since = None
        self.reported_offline = False
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
            self.add_point(at, a, v)
        elif not arc and self.arc is not None:
            self.close_arc(at)

        send_live(self.node_id, {
            "i": round(a, 1),
            "u": round(v, 1),
            "arc": arc,
            "sid": self.session.external_id if self.session else "",
            "ts": int(at.timestamp() * 1000),
        })

        # Список карт и журнал прикладываний — в конце такта и каждый
        # в своём try: сбой в них не должен ломать сеанс и точки сварки
        try:
            self.log_tap(st, at)
        except Exception:
            log.exception("узел %s: ошибка записи прикладывания карты", self.node_id)
        try:
            self.sync_cards(st)
        except Exception:
            log.exception("узел %s: ошибка сверки списка карт", self.node_id)

    # ─────────────────────── карты ───────────────────────

    def log_tap(self, st: dict, at: datetime | None = None):
        """Прикладывание карты — в журнал CardTap и в лог, и принятые, и отказы.

        Узел отдаёт только последнее прикладывание, и одно и то же
        приходит в ответе на каждом такте. Новое событие — когда сменился
        tap_seq. После перезагрузки узла счёт начинается заново, поэтому
        сравниваем на «не равно», а не на «больше». Последний записанный
        номер хранится в базе, так что перезапуск приёмника дубля не даст.

        at — момент ответа узла; время события = at − tap_age.
        """
        at = at or now_utc()
        seq = st.get("tap_seq")
        if seq is None:
            return
        if not self.tap_seq_loaded:
            # первый ответ после запуска приёмника: что уже записано
            # до перезапуска — в базе
            self.tap_seq = (
                NodeState.objects.filter(node_id=self.node_id)
                .values_list("last_tap_seq", flat=True).first()
            )
            self.tap_seq_loaded = True
        if seq == self.tap_seq:
            return

        uid = (st.get("tap_uid") or "").strip().lower()
        accepted = bool(st.get("tap_ok"))
        welder = Welder.objects.filter(rfid_uid__iexact=uid).first() if uid else None
        equipment = Equipment.objects.filter(node_id=self.node_id).first()
        node_ver = str(st.get("cards_ver") or "").strip()
        portal_ver = CARDS.get(self.node_id)[0]
        try:
            age = max(0.0, float(st.get("tap_age") or 0))
        except (TypeError, ValueError):
            age = 0.0

        # запись в журнал и номер события — вместе: упадёт одно, не будет
        # и другого, и на следующем такте событие запишется заново
        with transaction.atomic():
            if uid:  # пустой номер — с включения узла карту ещё не прикладывали
                CardTap.objects.create(
                    node_id=self.node_id,
                    equipment=equipment,
                    equipment_name=equipment.name if equipment else "",
                    card_uid=uid,
                    welder=welder,
                    welder_name=welder.fio if welder else "",
                    accepted=accepted,
                    reason=tap_reason(
                        accepted, welder, equipment.method_id if equipment else None,
                        node_ver, portal_ver,
                    ),
                    tapped_at=at - timedelta(seconds=age),
                    node_seq=seq,
                    node_cards_ver=node_ver,
                    portal_cards_ver=portal_ver,
                )
            NodeState.objects.filter(node_id=self.node_id).update(last_tap_seq=seq)
        self.tap_seq = seq

        if uid:
            log.info(
                "узел %s: карта %s (%s) — %s, %s с назад, событие №%s",
                self.node_id, uid,
                welder.fio if welder else "не записана ни за одним сварщиком",
                "ПРИНЯТА" if accepted else "ОТКАЗ",
                st.get("tap_age"), seq,
            )

    def sync_cards(self, st: dict):
        """Сверить версию списка на узле с нашей; разошлись — отправить."""
        if "cards_ver" not in st:
            return  # старая прошивка: списка карт у неё нет
        node_ver = str(st.get("cards_ver") or "").strip()
        ver, uids = CARDS.get(self.node_id)

        if node_ver != self.cards_node_ver:
            self.cards_node_ver = node_ver
            if node_ver == ver:
                log.info("узел %s: список карт v=%s на узле, карт %s — совпадает с порталом",
                         self.node_id, ver, st.get("cards_n"))
                if st.get("cards_n") is not None and st.get("cards_n") != len(uids):
                    log.warning("узел %s: версия совпала, но на узле карт %s, а в списке %s",
                                self.node_id, st.get("cards_n"), len(uids))

        if node_ver == ver:
            return

        # эту же версию недавно отправляли — даём узлу время, не долбим
        if self.cards_sent_ver == ver and time.monotonic() - self.cards_sent_at < CARDS_RETRY_SECONDS:
            return
        self.cards_sent_ver = ver
        self.cards_sent_at = time.monotonic()

        log.info("узел %s: на узле список %s, у портала v=%s (карт %s) — отправляю",
                 self.node_id, f"v={node_ver}" if node_ver else "отсутствует", ver, len(uids))
        try:
            response = self.http.post(
                self.cards_url,
                data=CardList.body(ver, uids).encode(),
                headers={"Content-Type": "text/plain; charset=utf-8"},
                timeout=CARDS_TIMEOUT,
            )
        except requests.RequestException as exc:
            log.warning("узел %s: список карт не отправлен: %s", self.node_id, exc)
            return
        text = response.text.strip()[:200]
        if response.ok:
            log.info("узел %s: список карт v=%s отправлен, ответ %s %s",
                     self.node_id, ver, response.status_code, text)
        else:
            log.warning("узел %s: узел не принял список карт v=%s: %s %s",
                        self.node_id, ver, response.status_code, text)

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
        welder = Welder.objects.filter(rfid_uid__iexact=uid).first() if uid else None
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
        # по оборудованию, а не по префиксу external_id: у узла «node»
        # префикс «node-» совпал бы с сеансами узла «node-01»
        leftovers = WeldingSession.objects.filter(
            finished_at__isnull=True, equipment__node_id=self.node_id,
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

    def add_point(self, at: datetime, a: float, v: float):
        """Замер — в копилку текущей секунды; секунда сменилась — точка в базу.

        В точку идут среднее, минимум и максимум мгновенных a и v за
        секунду: так получается полоса разброса тока. Накопительные
        aa/amin/amax узла не годятся — они за весь участок, и полоса
        росла бы к концу прохода.
        """
        second = at.replace(microsecond=0)
        b = self.bucket
        if b is not None and (b["arc_id"] != self.arc.id or b["at"] != second):
            self.flush_point()
        if self.bucket is None:
            self.bucket = {"arc_id": self.arc.id, "sid": self.session.external_id,
                           "at": second, "a": [], "v": []}
        self.bucket["a"].append(a)
        self.bucket["v"].append(v)

    def flush_point(self):
        """Записать накопленную секунду одной точкой."""
        b, self.bucket = self.bucket, None
        if not b:
            return
        aa, vv = b["a"], b["v"]
        self.sink.add_rows([(
            b["arc_id"], b["sid"], self.node_id, b["at"],
            sum(aa) / len(aa), min(aa), max(aa), sum(vv) / len(vv),
        )])

    def close_arc(self, at: datetime, complete: bool = True):
        """Сводка участка — из накопительной статистики узла на последнем
        ответе с горящей дугой: это и есть итог по всему участку."""
        self.flush_point()
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
