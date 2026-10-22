# Работа с отрезками времени. Нужна для Кз: все замеры надо
# пересекать с рабочим временем смен, иначе сварка в обед
# или вечером попадёт в расчёт и даст Кз больше ста процентов.
#
# Никакой базы здесь нет — только списки пар «начало, конец».
# Такое легко проверять: подставил отрезки, посчитал секунды.

from datetime import datetime, timedelta

Interval = tuple[datetime, datetime]


def merge(spans: list[Interval]) -> list[Interval]:
    """Склеить пересекающиеся отрезки в непересекающиеся.

    Зачем: сварщик мог открыть два сеанса подряд с наложением,
    а участки дуги внутри сеанса иногда перекрываются на доли
    секунды из-за округления времени на узле. Если такие отрезки
    просто сложить, одно и то же время засчитается дважды.

    [(10:00–10:30), (10:20–11:00)] → [(10:00–11:00)]
    """
    if not spans:
        return []

    # сортируем по началу: тогда достаточно сравнивать
    # каждый следующий отрезок только с последним накопленным
    ordered = sorted(spans, key=lambda s: s[0])
    result: list[Interval] = [ordered[0]]

    for start, end in ordered[1:]:
        last_start, last_end = result[-1]
        if start <= last_end:
            # пересекаются или касаются — расширяем последний
            result[-1] = (last_start, max(last_end, end))
        else:
            result.append((start, end))

    return result


def intersect(a: list[Interval], b: list[Interval]) -> list[Interval]:
    """Пересечение двух наборов отрезков.

    Оба набора должны быть уже склеены через merge.

    дуга [(11:20–11:45)] ∩ смена [(07:15–11:30), (12:30–16:30)]
        → [(11:20–11:30)]

    Проход двумя указателями: оба набора отсортированы, поэтому
    достаточно одного прохода, без перебора всех пар.
    """
    result: list[Interval] = []
    i = j = 0

    while i < len(a) and j < len(b):
        start = max(a[i][0], b[j][0])
        end = min(a[i][1], b[j][1])
        if start < end:
            result.append((start, end))

        # двигаем тот указатель, чей отрезок кончается раньше
        if a[i][1] < b[j][1]:
            i += 1
        else:
            j += 1

    return result


def subtract(a: list[Interval], b: list[Interval]) -> list[Interval]:
    """Вычесть из набора a набор b.

    Нужно для простоя: берём рабочее время и вычитаем всё,
    что уже отнесено к сеансам и обрывам. Остаётся простой.
    """
    result: list[Interval] = []

    for start, end in a:
        pieces = [(start, end)]
        for cut_start, cut_end in b:
            next_pieces: list[Interval] = []
            for p_start, p_end in pieces:
                if cut_end <= p_start or cut_start >= p_end:
                    next_pieces.append((p_start, p_end))   # не задевает
                    continue
                if cut_start > p_start:
                    next_pieces.append((p_start, cut_start))   # хвост слева
                if cut_end < p_end:
                    next_pieces.append((cut_end, p_end))       # хвост справа
            pieces = next_pieces
        result.extend(pieces)

    return result


def total_seconds(spans: list[Interval]) -> int:
    """Суммарная длина набора отрезков."""
    return int(sum((end - start).total_seconds() for start, end in spans))


def clip(spans: list[Interval], frm: datetime, to: datetime) -> list[Interval]:
    """Обрезать отрезки границами периода.

    Обрыв связи мог начаться до начала периода и не кончиться
    до конца — в расчёт берём только попавшую часть.
    """
    out: list[Interval] = []
    for start, end in spans:
        s, e = max(start, frm), min(end, to)
        if s < e:
            out.append((s, e))
    return out