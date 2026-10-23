# Флаг «рассмотрено» выставляется сам, когда к решению прикрепили
# отклонения.
#
# Почему сигналом, а не строкой в вьюсете: решение создаётся не только
# через API — ещё из админки, из скрипта, из будущего разбора. Если
# ставить флаг вручную в каждом месте, однажды про него забудут,
# и отклонение навсегда останется в очереди при наличии решения.

from django.db.models.signals import m2m_changed, post_delete
from django.dispatch import receiver

from .models import Deviation, WeldDecision


@receiver(m2m_changed, sender=WeldDecision.deviations.through)
def mark_reviewed(sender, instance, action, pk_set, **kwargs):
    """Прикрепили отклонения к решению — значит они рассмотрены.

    m2m_changed срабатывает на изменение связи многие-ко-многим.
    action говорит, что именно произошло: post_add — связи добавлены,
    post_remove — убраны, post_clear — очищены все.
    """
    if action == "post_add" and pk_set:
        Deviation.objects.filter(pk__in=pk_set).update(reviewed=True)

    elif action in ("post_remove", "post_clear"):
        # Отклонение могло остаться прикреплённым к ДРУГОМУ решению.
        # Поэтому не ставим False слепо, а проверяем, есть ли ещё связи
        _recheck(pk_set or [])


@receiver(post_delete, sender=WeldDecision)
def unmark_on_delete(sender, instance, **kwargs):
    """Решение удалили — отклонения возвращаются в очередь.

    На момент post_delete связи уже разорваны, поэтому идентификаторы
    берём из того, что успели запомнить при удалении. Django хранит
    их в instance, пока объект в памяти.
    """
    # pk у удалённого объекта уже None, но связанные идентификаторы
    # можно собрать заранее в pre_delete. Здесь — пересчёт по всем
    # отклонениям сеанса: их немного, а надёжность важнее
    Deviation.objects.filter(
        session=instance.session, reviewed=True
    ).exclude(decisions__isnull=False).update(reviewed=False)


def _recheck(pks) -> None:
    """Сбросить флаг у тех, у кого больше нет ни одного решения."""
    if not pks:
        return
    Deviation.objects.filter(pk__in=pks).exclude(
        decisions__isnull=False
    ).update(reviewed=False)