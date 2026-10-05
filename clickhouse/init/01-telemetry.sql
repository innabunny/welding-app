-- Выполняется один раз при первом запуске контейнера ClickHouse.
-- Файлы из папки docker-entrypoint-initdb.d он прогоняет сам.

CREATE DATABASE IF NOT EXISTS welding;

-- Точки замеров: окно 100 мс, четыре числа.
--
-- MergeTree — основной движок ClickHouse. Данные лежат отсортированными
-- на диске кусками, которые он периодически объединяет (отсюда имя).
-- Выборка по началу ключа сортировки получается очень быстрой.
CREATE TABLE IF NOT EXISTS welding.samples
(
    -- идентификатор участка дуги из Postgres: по нему связываем
    -- точки с режимом, швом и картой
    arc_id      UInt64,

    -- идентификатор сеанса строкой, как его сформировал узел
    session_id  String,
    node        LowCardinality(String),

    at          DateTime64(3),   -- время окна, миллисекунды

    i_avg       Float32,         -- средний ток  — сравнивается с диапазоном карты
    i_min       Float32,         -- минимум      — ток дежурной дуги в импульсе
    i_max       Float32,         -- максимум     — ток импульса
    u_avg       Float32          -- среднее напряжение
)
ENGINE = MergeTree

-- PARTITION BY режет таблицу по месяцам. Старые месяцы можно удалить
-- одной операцией, не трогая остальное, и запрос за свежими данными
-- не читает старые куски.
PARTITION BY toYYYYMM(at)

-- ORDER BY — ключ сортировки и одновременно индекс. Порядок важен:
-- почти все запросы идут «дай точки такого-то участка за период»,
-- поэтому arc_id первым.
ORDER BY (arc_id, at)

-- Автоудаление через год. Сырые точки за прошлый год не нужны —
-- сводка по участкам остаётся в Postgres навсегда.
TTL toDateTime(at) + INTERVAL 1 YEAR;


-- Готовая сводка по участкам: ClickHouse считает её сам при вставке.
-- Нужна для графиков за длинный период, где 18 000 точек на шов
-- рисовать бессмысленно — всё равно усреднять при показе.
CREATE TABLE IF NOT EXISTS welding.samples_1s
(
    arc_id      UInt64,
    at          DateTime,
    i_avg       AggregateFunction(avg, Float32),
    i_max       AggregateFunction(max, Float32),
    i_min       AggregateFunction(min, Float32),
    u_avg       AggregateFunction(avg, Float32)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(at)
ORDER BY (arc_id, at);

-- Материализованное представление: срабатывает на каждую вставку
-- в samples и дописывает свёрнутые по секундам данные в samples_1s.
-- Писать в неё отдельно не надо, всё происходит само.
CREATE MATERIALIZED VIEW IF NOT EXISTS welding.samples_1s_mv
TO welding.samples_1s
AS SELECT
    arc_id,
    toStartOfSecond(at) AS at,
    avgState(i_avg) AS i_avg,
    maxState(i_max) AS i_max,
    minState(i_min) AS i_min,
    avgState(u_avg) AS u_avg
FROM welding.samples
GROUP BY arc_id, at;