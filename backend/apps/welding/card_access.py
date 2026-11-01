# ПОЧЕМУ УЗЕЛ НЕ ПУСТИЛ КАРТУ
#
# Пускать или нет, решает узел по списку карт, который ему прислал
# приёмник (collector/poller.py, CardList). Причину отказа узел не
# сообщает. Здесь она восстанавливается по базе — теми же правилами,
# по которым карта попадает в список:
#
#   1. карта записана за сварщиком
#   2. сварщик активен
#   3. у него есть действующая аттестация
#   4. аттестация — на способ сварки аппарата этого узла
#   (сервисная карта проходит пункты 3 и 4 без аттестации)
#
# Первый нарушенный пункт и есть причина. Если все выполнены, по базе
# карта допущена, и почему узел отказал, отсюда не видно — так
# и пишем, причину не выдумываем.

from datetime import date

from apps.attestation.models import Attestation

NOT_REGISTERED = "карты нет в базе"
INACTIVE = "сварщик не активен"
NO_ATTESTATION = "нет действующей аттестации"
NO_METHOD = "нет допуска на способ сварки этого аппарата"
# узел без аппарата получает список только из сервисных карт:
# способ сварки неизвестен, проверить допуск не на чем
UNKNOWN_EQUIPMENT = "узел не привязан к оборудованию: пускает только сервисные карты"
UNDETERMINED = "не удалось определить: по данным портала карта допущена"


def portal_refusal(welder, method_id) -> str:
    """Почему по базе эту карту пускать нельзя. Пусто — по базе можно.

    welder — сварщик с этой картой или None; method_id — способ сварки
    аппарата узла или None, если узел ни к чему не привязан.
    """
    if welder is None:
        return NOT_REGISTERED
    if not welder.is_active:
        return INACTIVE
    if welder.is_service:
        return ""
    valid = Attestation.objects.filter(welder=welder, status="done", valid_until__gte=date.today())
    if not valid.exists():
        return NO_ATTESTATION
    if method_id is None:
        return UNKNOWN_EQUIPMENT
    if not valid.filter(method_id=method_id).exists():
        return NO_METHOD
    return ""


def tap_reason(accepted: bool, welder, method_id, node_ver: str, portal_ver: str) -> str:
    """Что записать в «причину» прикладывания.

    Отказ — причина по базе, а если по базе карта допущена —
    «не удалось определить». Принятая — пусто, но если по базе её
    пускать было нельзя, это пишем: узел пустил по старому списку
    или ошибся, и через год это надо будет увидеть.
    """
    portal = portal_refusal(welder, method_id)
    stale = node_ver != portal_ver
    lag = f"; на узле был список v={node_ver or '—'}, у портала v={portal_ver or '—'}" if stale else ""
    if not accepted:
        return portal or f"{UNDETERMINED}{lag}"
    if portal:
        return f"принята узлом, хотя по данным портала: {portal}{lag}"
    return ""
