# Имя узла телеметрии подставляется в строки трёх систем:
#   темы MQTT        weld/<узел>/live      — нельзя «/», «+», «#»
#   группы Channels  telemetry.<узел>       — только латиница, цифры, «-», «_», «.»
#   подписи в ClickHouse                    — столбец node у каждой точки
# Поэтому разрешаем общее подмножество: латиница, цифры, дефис и точка.
# Двоеточие (MAC-адрес) и пробел ломают Channels — отправка живых значений падает.

import re

from django.core.validators import RegexValidator

NODE_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9.-]*$"
NODE_ID_RE = re.compile(NODE_ID_PATTERN)

validate_node_id = RegexValidator(
    NODE_ID_PATTERN,
    "Имя узла — латиница, цифры, дефис и точка, например node-01. "
    "Двоеточия и пробелы нельзя: имя идёт в темы MQTT и имена каналов.",
)


def is_valid_node_id(value: str) -> bool:
    return bool(value) and len(value) <= 50 and NODE_ID_RE.match(value) is not None
