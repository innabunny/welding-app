# Чтение точек замеров из ClickHouse для графика.
#
# Главная мысль: сырые точки отдавать браузеру нельзя. Шов на полчаса
# при шаге 100 мс — это 18 000 точек на один участок дуги. График
# такой объём не нарисует осмысленно (у него по ширине 1200 пикселей),
# а передача и разбор JSON займут секунды.
#
# Поэтому прореживаем. Но не «берём каждую сотую» — так пропадут
# выбросы, а именно они интересны: просадка тока, скачок напряжения.
# Вместо этого ClickHouse делит время на равные корзины и для каждой
# считает среднее, минимум и максимум. Получается график со «коридором»:
# линия среднего и полоса разброса вокруг неё. Выброс виден всегда,
# потому что попадает в минимум или максимум своей корзины.

from .clickhouse import get_client

# Границы корзин округляются через toFloat64: замеры хранятся во Float32,
# и round() над Float32 так и остаётся Float32 — в JSON уходило бы
# 104.30000305 вместо 104.3. avg() сам возвращает Float64, ему не нужно.

# Больше точек график всё равно не покажет, а JSON распухнет
MAX_POINTS = 2000


def read_arc_samples(arc_id: int, max_points: int = MAX_POINTS) -> dict:
    """Точки одного участка дуги, прореженные до max_points корзин."""
    client = get_client()

    # сначала узнаём границы и объём — от них зависит ширина корзины
    bounds = client.execute(
        """
        SELECT
            toUnixTimestamp64Milli(min(at)),
            toUnixTimestamp64Milli(max(at)),
            count()
        FROM welding.samples
        WHERE arc_id = %(arc_id)s
        """,
        {"arc_id": arc_id},
    )

    t_from, t_to, total = bounds[0]
    if not total:
        return {"points": [], "total": 0, "step_ms": 0}

    span = max(t_to - t_from, 1)
    # ширина корзины в миллисекундах; минимум 1, иначе деление на ноль
    step = max(span // max_points, 1)

    # intDiv(время в мс, шаг) * шаг — номер корзины, приведённый
    # обратно ко времени её начала. Это и есть прореживание
    rows = client.execute(
        """
        SELECT
            intDiv(toUnixTimestamp64Milli(at), %(step)s) * %(step)s AS bucket,
            round(avg(i_avg), 1),
            round(toFloat64(min(i_min)), 1),
            round(toFloat64(max(i_max)), 1),
            round(avg(u_avg), 2),
            round(toFloat64(min(u_avg)), 1),
            round(toFloat64(max(u_avg)), 1)
        FROM welding.samples
        WHERE arc_id = %(arc_id)s
        GROUP BY bucket
        ORDER BY bucket
        """,
        {"arc_id": arc_id, "step": step},
    )

    return {
        "points": [
            {
                "t": r[0],
                "i": r[1],
                "iMin": r[2],
                "iMax": r[3],
                "u": r[4],
                "uMin": r[5],
                "uMax": r[6],
            }
            for r in rows
        ],
        # total — сколько точек было на самом деле: фронт покажет
        # «18 420 замеров, показано 2 000»
        "total": total,
        "step_ms": step,
        "from": t_from,
        "to": t_to,
    }


def read_session_samples(session_external_id: str, max_points: int = MAX_POINTS) -> dict:
    """То же, но на весь сеанс — все участки дуги подряд.

    Нужно для обзорного графика: видно паузы между проходами
    как разрывы в данных.
    """
    client = get_client()

    bounds = client.execute(
        """
        SELECT
            toUnixTimestamp64Milli(min(at)),
            toUnixTimestamp64Milli(max(at)),
            count()
        FROM welding.samples
        WHERE session_id = %(sid)s
        """,
        {"sid": session_external_id},
    )
    t_from, t_to, total = bounds[0]
    if not total:
        return {"points": [], "total": 0, "step_ms": 0}

    span = max(t_to - t_from, 1)
    step = max(span // max_points, 1)

    rows = client.execute(
        """
        SELECT
            intDiv(toUnixTimestamp64Milli(at), %(step)s) * %(step)s AS bucket,
            any(arc_id),
            round(avg(i_avg), 1),
            round(toFloat64(min(i_min)), 1),
            round(toFloat64(max(i_max)), 1),
            round(avg(u_avg), 2)
        FROM welding.samples
        WHERE session_id = %(sid)s
        GROUP BY bucket
        ORDER BY bucket
        """,
        {"sid": session_external_id, "step": step},
    )

    return {
        "points": [
            {"t": r[0], "arcId": r[1], "i": r[2], "iMin": r[3], "iMax": r[4], "u": r[5]}
            for r in rows
        ],
        "total": total,
        "step_ms": step,
        "from": t_from,
        "to": t_to,
    }