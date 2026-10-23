from django.apps import AppConfig


class WeldingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.welding"
    verbose_name = "Производство и телеметрия"
 
    def ready(self):
        # импорт внутри метода, а не в начале файла: на момент
        # чтения файла модели ещё не готовы, и импорт упал бы
        from . import signals  # noqa: F401
