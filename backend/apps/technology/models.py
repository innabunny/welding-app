# ДЕТАЛЬ, ОПЕРАЦИЯ, ШОВ ПО ЧЕРТЕЖУ

# Слой «КАК НАДО» — технология. Пишется один раз на чертёж и живёт
# независимо от того, сколько изделий по нему изготовили.
#
#   Part      деталь по чертежу
#     └── Operation   операция техпроцесса
#           ├── WeldingCard  техкарта — документ операции (в weldingcards)
#           └── SeamSpec     шов по чертежу, который варится в этой операции
#
# Фактические данные — кто варил, когда, что показал контроль —
# живут в приложении welding и ссылаются сюда.

from django.db import models


class Part(models.Model):
    """Деталь или узел по чертежу. Серийная: по одному чертежу
    изготавливают много экземпляров."""

    number = models.CharField("№ по чертежу", max_length=100, unique=True)
    name = models.CharField("Наименование", max_length=200)
    drawing_no = models.CharField("Обозначение чертежа", max_length=100, blank=True)
    note = models.TextField("Примечание", blank=True)
    is_active = models.BooleanField("В производстве", default=True)

    class Meta:
        verbose_name = "Деталь"
        verbose_name_plural = "Детали"
        ordering = ["number"]

    def __str__(self):
        return f"{self.number} — {self.name}"


class Operation(models.Model):
    """Операция техпроцесса. На каждую составляется своя техкарта.

    Пример: шов 13 мм варится в два захода — операция 10 (проходы 1-2
    одним способом) и операция 20 (проходы 3-5 другим). Между ними
    промежуточный контроль.
    """

    part = models.ForeignKey(
        Part, on_delete=models.CASCADE, related_name="operations",
        verbose_name="Деталь",
    )
    seam = models.ForeignKey(
        "SeamSpec", on_delete=models.PROTECT, related_name="operations",
        verbose_name="Шов",
    )
    number = models.CharField("№ операции", max_length=20)
    name = models.CharField("Наименование операции", max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(
        "Порядок выполнения", default=0,
        help_text="По нему операции идут в техпроцессе, а не по номеру",
    )

    # какой контроль назначен ПОСЛЕ этой операции: ['РК'], ['РК', 'МК'] или пусто.
    # Решает технолог: после одной операции контроль нужен, после другой нет
    required_controls = models.JSONField(
        "Контроль после операции", default=list, blank=True,
    )

    class Meta:
        verbose_name = "Операция"
        verbose_name_plural = "Операции"
        ordering = ["part", "order", "number"]
        # в пределах детали номер операции не повторяется
        unique_together = ["part", "number"]

    def __str__(self):
        return f"{self.part.number} · оп. {self.number}"


class SeamSpec(models.Model):
    """Шов по чертежу — описание стыка, а не сваренного изделия.

    Существует до сварки: конструктор нарисовал, технолог расписал.
    Толщина и материалы — свойства стыка, они не меняются от того,
    что варят в два захода.
    """

    part = models.ForeignKey(
        Part, on_delete=models.CASCADE, related_name="seams",
        verbose_name="Деталь",
    )
    number = models.CharField("№ шва по чертежу", max_length=50)

    joint_type = models.CharField("Тип соединения", max_length=50, blank=True)
    material_1 = models.ForeignKey(
        "materials.Material", on_delete=models.PROTECT, related_name="+",
        null=True, blank=True, verbose_name="Материал 1",
    )
    material_2 = models.ForeignKey(
        "materials.Material", on_delete=models.PROTECT, related_name="+",
        null=True, blank=True, verbose_name="Материал 2",
    )
    thickness_1 = models.DecimalField(
        "Толщина позиции 1, мм", max_digits=7, decimal_places=2,
        null=True, blank=True,
    )
    thickness_2 = models.DecimalField(
        "Толщина позиции 2, мм", max_digits=7, decimal_places=2,
        null=True, blank=True,
    )
    pos_1 = models.CharField("Позиция 1", max_length=50, blank=True)
    mass_1 = models.DecimalField(
        "Масса позиции 1, кг", max_digits=10, decimal_places=3,
        null=True, blank=True,
    )
    pos_2 = models.CharField("Позиция 2", max_length=50, blank=True)
    mass_2 = models.DecimalField(
        "Масса позиции 2, кг", max_digits=10, decimal_places=3,
        null=True, blank=True,
    )

    seam_type = models.CharField(
        "Вид шва", max_length=20, blank=True,
        help_text="прямой / кольцевой",
    )
    seam_diameter = models.DecimalField(
        "Диаметр шва, мм", max_digits=9, decimal_places=2, null=True, blank=True,
        help_text="Для кольцевого. Нужен для пересчёта угловых скоростей",
    )
    seam_length = models.DecimalField(
        "Длина шва, мм", max_digits=10, decimal_places=1, null=True, blank=True,
    )

    class Meta:
        verbose_name = "Шов по чертежу"
        verbose_name_plural = "Швы по чертежу"
        ordering = ["part", "number"]
        unique_together = ["part", "number"]
        indexes = [
            models.Index(fields=["material_1", "thickness_1"]),
            models.Index(fields=["thickness_1"]),
        ]

    def __str__(self):
        return f"{self.part.number} · шов {self.number}"