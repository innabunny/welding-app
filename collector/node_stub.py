# Имитатор узла телеметрии для проверки опроса по HTTP без аппарата.
#
# Отдаёт GET /api/state в том же формате, что прошивка узла,
# и проигрывает по кругу сценарий смены у поста:
#   холостой ход без карты → карту приложили → дуга полторы минуты
#   около 150 А → пауза → дуга минута, с просадкой тока → простой
#   с картой (проверка закрытия по простою) → карту убрали
#
# Запуск рядом с приёмником, в его контейнере:
#   docker compose exec collector python node_stub.py         порт 80
#   docker compose exec collector python node_stub.py 8091    другой порт
# Адрес узла в справочнике для такого запуска — 127.0.0.1 (порт 80).
# Только стандартная библиотека: ставить ничего не нужно.

import json
import math
import random
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 80
WELDER_UID = "0080A182"

# (секунд, карта приложена, дуга, ток, напряжение, подпись)
SCENARIO = [
    (12, False, False, 0, 0, "холостой ход, карты нет"),
    (6, True, False, 0, 0, "карту приложили"),
    (90, True, True, 150, 12.2, "дуга, корень"),
    (25, True, False, 0, 0, "пауза между проходами"),
    (60, True, True, 150, 12.2, "дуга, заполнение"),
    (45, True, False, 0, 0, "простой с картой"),
    (10, False, False, 0, 0, "карту убрали"),
]
CYCLE = sum(step[0] for step in SCENARIO)
STARTED = time.monotonic()
# просадка тока на втором участке: с 20-й по 23-ю секунду
DIP_FROM, DIP_TO, DIP_CURRENT = 20, 23, 118


def current_step():
    t = (time.monotonic() - STARTED) % CYCLE
    elapsed = 0.0
    for index, step in enumerate(SCENARIO):
        if t < elapsed + step[0]:
            return index, step, t - elapsed
        elapsed += step[0]
    return len(SCENARIO) - 1, SCENARIO[-1], 0.0


class Node:
    """Состояние как у прошивки: счётчики и статистика текущего участка."""

    def __init__(self):
        self.n = 0
        self.na = 0
        self.pc = 0
        self.num = 1
        self.segment = None  # [сумма I, мин I, макс I, сумма U, мин U, макс U, точек]
        self.was_arc = False

    def reading(self, step, into):
        _, _, arc, i_base, u_base, _ = step
        if not arc:
            return random.uniform(0, 0.4), random.uniform(0, 0.3)
        # медленный дрейф руки сварщика и шум источника
        a = i_base + 2.0 * math.sin(into / 7.0) + random.gauss(0, 2.5)
        # поджиг: первые полсекунды ток растёт до рабочего
        if into < 0.5:
            a = 60 + (a - 60) * into / 0.5
        if step[5] == "дуга, заполнение" and DIP_FROM <= into < DIP_TO:
            a = DIP_CURRENT + random.gauss(0, 1.5)
        # редкий короткий выброс — бывает при касании присадкой
        if random.random() < 0.004:
            a += random.choice((-1, 1)) * random.uniform(12, 20)
        v = u_base + (a - i_base) * 0.01 + random.gauss(0, 0.15)
        return a, v

    def step(self):
        index, step, into = current_step()
        _, allowed, arc, _, _, _ = step
        a, v = self.reading(step, into)

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
    print(f"имитатор узла: http://0.0.0.0:{PORT}/api/state, сценарий {CYCLE} с по кругу:")
    for seconds, *_, label in SCENARIO:
        print(f"  {seconds:>3} с  {label}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
