# Сервис-приёмник телеметрии.
#
# Что он делает, в двух словах: постоянно слушает брокер MQTT и всё,
# что присылают узлы, раскладывает по двум базам.
#
#   события (сеанс начался, дуга погасла) → Postgres, через модели Django
#   точки замеров                          → ClickHouse, пачками
#
# Почему это отдельный сервис, а не код внутри Django. Django отвечает
# на запросы: пришёл запрос — ответил — забыл. А приёмник работает
# постоянно, ни на что не отвечая. Это принципиально другой режим,
# и мешать их в одном процессе неправильно.
#
# При этом модели он использует те же, что и Django: подключается
# к проекту и работает с базой через ORM, как обычный скрипт.

import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import django
import paho.mqtt.client as mqtt
from clickhouse_driver import Client as ClickHouseClient

# --- подключаем проект Django, чтобы пользоваться его моделями -------
# Папка backend примонтирована в контейнер, её надо показать Python
sys.path.insert(0, "/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

# импорт моделей ТОЛЬКО после django.setup() — до него они не готовы
from apps.equipment.models import Equipment  # noqa: E402
from apps.welders.models import Welder  # noqa: E402
from apps.welding.models import ArcRun, WeldingSession  # noqa: E402
from apps.welding.broadcast import send_event, send_live  # noqa: E402
from apps.welding.watchdog import check_offline, touch  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("collector")

MQTT_HOST = os.environ.get("MQTT_HOST", "mqtt")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))

# Точки копятся в памяти и пишутся в ClickHouse пачками.
# Вставлять по одной нельзя: ClickHouse создаёт на каждую вставку
# отдельный кусок на диске, и тысяча вставок в секунду его положит.
BATCH_SIZE = 5000
BATCH_SECONDS = 5


class Collector:
    def __init__(self):
        self.ch = ClickHouseClient(
            host=os.environ.get("CH_HOST", "clickhouse"),
            port=9000,
            database=os.environ.get("CH_DB", "welding"),
            user=os.environ.get("CH_USER", "welding"),
            password=os.environ.get("CH_PASSWORD", "welding"),
        )
        # накопитель точек и время последнего сброса
        self.buffer: list[tuple] = []
        self.last_flush = time.monotonic()

        # кэш: идентификатор участка от узла → id строки в Postgres.
        # Чтобы не ходить в базу на каждую порцию замеров
        self.arc_ids: dict[tuple[str, int], int] = {}
        self.last_watch = time.monotonic()

    # ─────────────────────────── MQTT ───────────────────────────

    def run(self):
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        client.on_connect = self.on_connect
        client.on_message = self.on_message

        # если брокер недоступен, пробуем снова, а не падаем
        while True:
            try:
                client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
                break
            except OSError as exc:
                log.warning("брокер недоступен (%s), жду 5 секунд", exc)
                time.sleep(5)

        # loop_start запускает чтение сообщений в отдельном потоке,
        # а основной остаётся свободным — он сбрасывает накопитель
        client.loop_start()
        log.info("приёмник запущен")

        try:
            while True:
                time.sleep(1)
                self.flush_if_due()
                self.watch_if_due()
        except KeyboardInterrupt:
            log.info("остановка, сбрасываю накопитель")
            self.flush()
            client.loop_stop()


    def watch_if_due(self):
        """Раз в пять секунд проверяем, не потерялся ли узел.
 
        Чаще не нужно: таймаут всё равно тридцать секунд.
        """
        if time.monotonic() - self.last_watch < 5:
            return
        self.last_watch = time.monotonic()
        try:
            lost = check_offline()
            if lost:
                log.warning("узлов потеряно: %s", lost)
        except Exception:
            # сторож не должен ронять приём данных
            log.exception("ошибка проверки связи")        


    def on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code != 0:
            log.error("не удалось подключиться к брокеру: %s", reason_code)
            return

        # плюс означает «любой узел»: подписка не меняется,
        # когда появляется второй аппарат
        for topic in ("weld/+/session", "weld/+/arc", "weld/+/samples",
                      "weld/+/access", "weld/+/status", "weld/+/live"):
            client.subscribe(topic, qos=1)
        log.info("подписался на темы узлов")

    def on_message(self, client, userdata, msg):
        """Точка входа: сюда попадает каждое сообщение из брокера."""
        try:
            data = json.loads(msg.payload)
        except json.JSONDecodeError:
            log.warning("не разобрал сообщение в %s", msg.topic)
            return

        kind = msg.topic.rsplit("/", 1)[-1]
        node = data.get("node")
        if node:
            touch(node)

        try:
            if kind == "session":
                self.handle_session(data)
            elif kind == "arc":
                self.handle_arc(data)
            elif kind == "samples":
                self.handle_samples(data)
            elif kind == "access":
                self.handle_access(client, data)
            elif kind == "status":
                self.handle_status(data)
            elif kind == "live":
                self.handle_live(data)    
        except Exception:
            # один кривой пакет не должен ронять приёмник:
            # записали в лог и работаем дальше
            log.exception("ошибка при обработке %s", msg.topic)

    # ──────────────────────── обработчики ────────────────────────

    def handle_session(self, data):
        """Начало и конец сеанса сварки."""
        sid = data["sid"]

        if data.get("event") == "start":
            equipment = self.find_equipment(data["node"])
            if equipment is None:
                log.warning("узел %s не привязан к оборудованию", data["node"])
                return

            welder = None
            uid = data.get("uid")
            if uid:
                welder = Welder.objects.filter(rfid_uid=uid.lower()).first()

            WeldingSession.objects.update_or_create(
                external_id=sid,
                defaults={
                    "equipment": equipment,
                    "welder": welder,
                    "mode": data.get("mode", "по техпроцессу"),
                    "route_code_raw": data.get("route_code", ""),
                    "started_at": ms_to_dt(data["ts"]),
                },
            )

            send_event(data["node"], {
                "event": "session_start",
                "sid": sid,
                "welder": welder.fio if welder else "",
                "mode": data.get("mode", ""),
            })
 


            log.info("сеанс %s начат на %s", sid, equipment.name)

        elif data.get("event") == "stop":
            session = WeldingSession.objects.filter(external_id=sid).first()
            if session:
                session.finished_at = ms_to_dt(data["ts"])
                session.save(update_fields=["finished_at"])
                log.info("сеанс %s закончен", sid)
                # здесь же запускается разбор: проходы, остановки,
                # отклонения, расход. Пока синхронно, потом в Celery
                self.analyze_later(session)
                send_event(data["node"], {"event": "session_stop", "sid": sid})

    def handle_arc(self, data):
        """Участок непрерывного горения дуги."""
        session = WeldingSession.objects.filter(external_id=data["sid"]).first()
        if session is None:
            log.warning("участок дуги для неизвестного сеанса %s", data["sid"])
            return

        key = (data["sid"], data["aid"])

        if data.get("event") == "start":
            arc = ArcRun.objects.create(
                session=session,
                started_at=ms_to_dt(data["ts"]),
            )
            self.arc_ids[key] = arc.id

        elif data.get("event") == "stop":
            arc_id = self.arc_ids.get(key)
            if arc_id is None:
                return
            ArcRun.objects.filter(id=arc_id).update(
                finished_at=ms_to_dt(data["ts"]),
                current_avg=data.get("i_avg"),
                current_min=data.get("i_min"),
                current_max=data.get("i_max"),
                voltage_avg=data.get("u_avg"),
                pulse_freq=data.get("pulse_hz"),
                telemetry_complete=True,
            )

    def handle_samples(self, data):
        """Порция замеров: раскладываем в накопитель.

        Время каждой точки считается из t0 и шага, а не приходит
        с каждой — так сообщение в разы компактнее.
        """
        key = (data["sid"], data["aid"])
        arc_id = self.arc_ids.get(key)
        if arc_id is None:
            # участок ещё не создан или это досылка после обрыва —
            # ищем в базе
            arc_id = self.find_arc_id(data["sid"], data["aid"])
            if arc_id is None:
                log.warning("порция для неизвестного участка %s", key)
                return
            self.arc_ids[key] = arc_id

        t0 = data["t0"]
        dt = data.get("dt", 100)
        node = data["node"]
        sid = data["sid"]

        for index, point in enumerate(data["points"]):
            i_avg, i_min, i_max, u_avg = point
            self.buffer.append((
                arc_id, sid, node,
                ms_to_dt(t0 + index * dt),
                i_avg, i_min, i_max, u_avg,
            ))

        self.flush_if_due()

    def handle_access(self, client, data):
        """Запрос допуска по карте: отвечаем в тему ack.

        Логика fail-closed: если сварщик не найден или допуск
        просрочен — запрет. Узел без ответа тоже запрещает.
        """
        from datetime import date

        uid = (data.get("uid") or "").strip().lower()
        node = data["node"]
        answer = {
            "ts": int(time.time() * 1000),
            "req": data.get("req", ""),
            "allowed": False,
            "welder": "",
            "welder_id": None,
            "methods": [],
            "reason": "",
        }

        welder = Welder.objects.filter(rfid_uid=uid, is_active=True).first()
        if welder is None:
            answer["reason"] = "карта не зарегистрирована"
        else:
            valid = welder.attestations.filter(
                status="done", valid_until__gte=date.today()
            ).select_related("method")

            answer["welder"] = welder.fio
            answer["welder_id"] = welder.id
            answer["methods"] = [a.method_id for a in valid]

            equipment = self.find_equipment(node)
            if not valid.exists():
                answer["reason"] = "нет действующего допуска"
            elif equipment and equipment.method_id not in answer["methods"]:
                answer["reason"] = "нет допуска на этот способ"
            else:
                answer["allowed"] = True

        client.publish(f"weld/{node}/access/ack", json.dumps(answer), qos=1)
        log.info("допуск %s для %s: %s", uid, node, answer["allowed"])

    def handle_status(self, data):
        """Узел жив и рассказывает о своём состоянии.
 
        Эти поля идут на страницу диагностики. Приходят раз в десять
        секунд, поэтому пишем только то, что пришло.
        """
        touch(
            data["node"],
            last_status_at=timezone.now(),
            queued=data.get("queued", 0),
            ip=data.get("ip"),
            firmware=data.get("fw"),
            uptime_seconds=data.get("uptime"),
            free_bytes=data.get("free"),
            temperature=data.get("temp"),
            reset_reason=data.get("reset", ""),
        )
        if data.get("queued", 0) > 0:
            log.info("узел %s досылает %s порций", data["node"], data["queued"])

    def handle_live(self, data):
        """Живой поток: в базу не пишем, сразу в открытые панели.
 
        Эти данные теряются без последствий — они нужны только
        чтобы технолог видел, что происходит прямо сейчас.
        """
        send_live(data["node"], {
            "i": data.get("i"),
            "u": data.get("u"),
            "arc": data.get("arc", False),
            "sid": data.get("sid", ""),
            "ts": data.get("ts"),
        })


    # ───────────────────────── накопитель ─────────────────────────

    def flush_if_due(self):
        """Сбрасываем пачку, когда накопилось достаточно или прошло время."""
        if not self.buffer:
            return
        big = len(self.buffer) >= BATCH_SIZE
        old = time.monotonic() - self.last_flush >= BATCH_SECONDS
        if big or old:
            self.flush()

    def flush(self):
        """Одна вставка в ClickHouse на всю пачку."""
        if not self.buffer:
            return
        rows, self.buffer = self.buffer, []
        try:
            self.ch.execute(
                "INSERT INTO welding.samples "
                "(arc_id, session_id, node, at, i_avg, i_min, i_max, u_avg) VALUES",
                rows,
            )
            log.info("записано точек: %s", len(rows))
        except Exception:
            # не теряем данные: возвращаем в накопитель и пробуем позже
            log.exception("ошибка записи в ClickHouse, оставляю в буфере")
            self.buffer = rows + self.buffer
        finally:
            self.last_flush = time.monotonic()

    # ──────────────────────── вспомогательное ────────────────────────

    @staticmethod
    def find_equipment(node_id):
        return Equipment.objects.filter(node_id=node_id).first()

    @staticmethod
    def find_arc_id(sid, aid):
        """Участок по порядковому номеру внутри сеанса —
        для досылки после обрыва связи."""
        arcs = ArcRun.objects.filter(
            session__external_id=sid
        ).order_by("started_at").values_list("id", flat=True)
        arcs = list(arcs)
        return arcs[aid - 1] if 0 < aid <= len(arcs) else None

    @staticmethod
    def analyze_later(session):
        """Разбор после закрытия сеанса.

        Пока вызывается прямо здесь. Когда появится Celery,
        станет фоновой задачей — разбор получасового шва
        не должен задерживать приём следующих сообщений.
        """
        if session.operation_run_id is None:
            return
        try:
            from apps.welding.analysis import analyze
            analyze(session.operation_run)
        except Exception:
            log.exception("ошибка разбора сеанса %s", session.id)


def ms_to_dt(ms):
    """Миллисекунды от эпохи → время с часовым поясом UTC."""
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


if __name__ == "__main__":
    Collector().run()