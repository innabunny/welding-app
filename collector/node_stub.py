# Имитатор узла телеметрии для проверки опроса по HTTP без аппарата.
#
# Отдаёт GET /api/state в том же формате, что прошивка узла,
# и проигрывает по кругу сценарий смены у поста:
#   карты нет → сварщик приложил карту → дуга (корень) → пауза →
#   дуга (заполнение, с короткой просадкой тока) → пауза → карту убрали
#
# Запуск рядом с приёмником, в его контейнере:
#   docker compose exec collector python node_stub.py           порт 8090
#   docker compose exec collector python node_stub.py 8091      другой порт
# Только стандартная библиотека: ставить ничего не нужно.

import json
import random
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
WELDER_UID = "0080A182"

# (секунд, карта приложена, дуга, ток, напряжение)
SCENARIO = [
    (8, False, False, 0, 0),
    (5, True, False, 0, 0),
    (30, True, True, 100, 11.9),
    (10, True, False, 0, 0),
    (40, True, True, 150, 12.2),
    (8, True, False, 0, 0),
]
CYCLE = sum(step[0] for step in SCENARIO)
STARTED = time.monotonic()


class Node:
    """Состояние как у прошивки: счётчики и статистика текущего участка."""

    def __init__(self):
        self.n = 0
        self.na = 0
        self.pc = 0
        self.num = 1
        self.segment = None  # [сумма I, мин I, макс I, сумма U, мин U, макс U, точек]
        self.was_arc = False

    def step(self):
        t = (time.monotonic() - STARTED) % CYCLE
        elapsed = 0.0
        for seconds, allowed, arc, i_base, u_base in SCENARIO:
            if t < elapsed + seconds:
                into = t - elapsed
                break
            elapsed += seconds

        a = v = 0.0
        if arc:
            a = i_base + random.uniform(-4, 4)
            # на 15-й секунде большого участка — просадка на три секунды
            if i_base == 150 and 15 <= into < 18:
                a = 118 + random.uniform(-2, 2)
            v = u_base + random.uniform(-0.3, 0.3)
        else:
            a = random.uniform(0, 0.4)
            v = random.uniform(0, 0.5)

        self.n += 1
        if arc:
            self.na += 1
            self.pc += 1
            if not self.was_arc:
                self.segment = [0.0, a, a, 0.0, v, v, 0]
            seg = self.segment
            seg[0] += a
            seg[1] = min(seg[1], a)
            seg[2] = max(seg[2], a)
            seg[3] += v
            seg[4] = min(seg[4], v)
            seg[5] = max(seg[5], v)
            seg[6] += 1
        elif self.was_arc:
            self.num += 1
        self.was_arc = arc

        seg = self.segment or [0, 0, 0, 0, 0, 0, 1]
        count = max(seg[6], 1)
        return {
            "a": round(a, 1), "v": round(v, 1), "arc": arc,
            "allowed": allowed, "welder": WELDER_UID if allowed else "",
            "measuring": arc, "n": self.n, "na": self.na, "pc": self.pc,
            "t": round(52 + random.uniform(-1, 1), 1), "num": self.num,
            "free": 812000, "full": False,
            "aa": round(seg[0] / count, 1), "amin": round(seg[1], 1), "amax": round(seg[2], 1),
            "va": round(seg[3] / count, 1), "vmin": round(seg[4], 1), "vmax": round(seg[5], 1),
        }


NODE = Node()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/api/state":
            self.send_error(404)
            return
        body = json.dumps(NODE.step()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        # пять запросов в секунду — журнал засорять не нужно
        return


if __name__ == "__main__":
    print(f"имитатор узла: http://0.0.0.0:{PORT}/api/state, сценарий {CYCLE} с по кругу")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
