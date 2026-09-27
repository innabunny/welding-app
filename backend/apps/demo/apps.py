from django.apps import AppConfig


class DemoConfig(AppConfig):
    """Демо-наполнение: команда seed_demo. Моделей нет."""

    name = "apps.demo"
    verbose_name = "Демо-данные"
