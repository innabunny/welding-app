# Сборка exe для демо:  pyinstaller desktop.spec --noconfirm
# Перед сборкой: фронт собран в static/spa, статика админки — collectstatic.
# Собирает GitHub Actions (.github/workflows/build-exe.yml) на Windows.

import os

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# хук PyInstaller для Django заглядывает в настройки — пусть найдёт их без Postgres
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DB_ENGINE", "sqlite")


def no_gis(name):
    # GeoDjango тянет системные библиотеки GDAL, которых нет и которые не нужны
    return ".gis" not in name


# Django подключает приложения, миграции и команды по именам строками —
# анализатор их не видит, перечисляем явно
hiddenimports = (
    collect_submodules("apps")
    + collect_submodules("config")
    + collect_submodules("django.contrib", filter=no_gis)
    + collect_submodules("django.core.management.commands")
    + collect_submodules("rest_framework")
    + collect_submodules("djangorestframework_camel_case")
    + collect_submodules("whitenoise")
    + collect_submodules("waitress")
)

# шаблоны и переводы админки и DRF, база часовых поясов для Windows,
# справочники, собранный фронт и статика админки
datas = (
    collect_data_files("django", excludes=["**/gis/**"])
    + collect_data_files("rest_framework")
    + collect_data_files("tzdata")
    + [
        ("fixtures", "fixtures"),
        ("static/spa", "static/spa"),
        ("staticfiles", "staticfiles"),
    ]
)

a = Analysis(
    ["desktop.py"],
    pathex=["."],
    hiddenimports=hiddenimports,
    datas=datas,
    excludes=["tkinter", "django.contrib.gis"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="WeldingPortal",
    # окно консоли нужно: в нём адрес портала и «не закрывайте окно»
    console=True,
)

# папкой, а не одним файлом: стартует быстрее, антивирусы придираются реже
coll = COLLECT(exe, a.binaries, a.datas, name="WeldingPortal")
