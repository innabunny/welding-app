"""Запуск портала одним файлом — для демо на Windows (сборка в exe).

Что делает:
  1. база SQLite — в папке пользователя (%LOCALAPPDATA%\\WeldingPortal),
     а не рядом с exe: туда может не быть прав на запись;
  2. при первом запуске — миграции, справочники из seed.json
     и демо-производство (seed_demo): учётки admin/admin и demid/demid;
  3. поднимает сервер waitress на свободном порту и открывает браузер.

Локально без сборки:  python desktop.py
"""

import os
import secrets
import socket
import sys
import threading
import webbrowser
from pathlib import Path

APP_NAME = "WeldingPortal"
HOST = "127.0.0.1"
PREFERRED_PORT = 8765

# без реальной консоли (вывод перенаправлен в файл — так делает и проверка
# в CI) Windows подставляет кодировку локали (у английской — cp1252, там нет
# кириллицы) вместо utf-8, и печать русского текста падает с UnicodeEncodeError
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="backslashreplace", line_buffering=True)


def data_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    path = Path(base) / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def free_port(preferred: int) -> int:
    """Свой порт, если свободен; иначе любой свободный."""
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((HOST, port))
                return sock.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("Нет свободного порта")


def configure(data: Path) -> None:
    """Окружение до импорта Django: настройки читают его при загрузке."""
    key_file = data / "secret_key.txt"
    if not key_file.exists():
        key_file.write_text(secrets.token_urlsafe(50), encoding="utf-8")

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    os.environ.setdefault("DB_ENGINE", "sqlite")
    os.environ.setdefault("SQLITE_PATH", str(data / "welding.sqlite3"))
    os.environ.setdefault("SECRET_KEY", key_file.read_text(encoding="utf-8").strip())
    os.environ.setdefault("DEBUG", "0")
    os.environ.setdefault("ALLOWED_HOSTS", f"{HOST},localhost")


def prepare_database() -> None:
    """Миграции и наполнение. Команды вызываем экземплярами, а не по имени:
    в exe нет файлов .py, и Django не найдёт команды поиском по папкам."""
    from django.conf import settings
    from django.core.management import call_command
    from django.core.management.commands import loaddata, migrate

    from apps.demo.management.commands import seed_demo
    from apps.equipment.models import Equipment

    call_command(migrate.Command(), interactive=False, verbosity=0)
    if Equipment.objects.exists():
        return
    print("Первый запуск: заводим справочники и демо-производство…")
    call_command(loaddata.Command(), str(settings.BASE_DIR / "fixtures" / "seed.json"), verbosity=0)
    call_command(seed_demo.Command())


def main() -> None:
    # в exe рядом с кодом лежат данные сборки; в обычном запуске — папка backend
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    sys.path.insert(0, str(base))

    data = data_dir()
    configure(data)

    import django

    django.setup()
    prepare_database()

    from waitress import serve

    from config.wsgi import application

    port = free_port(PREFERRED_PORT)
    url = f"http://{HOST}:{port}/"
    print()
    print("  Портал «Сварочное производство» запущен")
    print(f"  Адрес:  {url}")
    print("  Вход:   admin / admin")
    print(f"  База:   {data}")
    print()
    print("  Не закрывайте это окно, пока работаете с порталом.")
    print()
    threading.Timer(1.5, webbrowser.open, args=[url]).start()
    serve(application, host=HOST, port=port, threads=8)


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 — окно не должно закрыться молча
        import traceback

        print("\nОшибка запуска:")
        traceback.print_exc()
        # input() блокировал бы навсегда там, где нет интерактивного stdin
        # (проверка в CI): тогда окно не закрывается, а зависает
        if sys.stdin.isatty():
            input("\nНажмите Enter, чтобы закрыть окно…")
        raise
