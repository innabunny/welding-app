# welding-backend

Бэкенд сварочного портала: Django + DRF, база SQLite (файл, без отдельного сервера).
API отдаётся под префиксом `/api/`, авторизация — по токену.

---

## Запуск с нуля на новой машине

Нужен установленный Python 3 (проверить: `python --version` на Windows / `python3 --version` на Ubuntu).

### 1. Клонировать репу
```bash
git clone https://github.com/<логин>/welding-backend.git
cd welding-backend
```

### 2. Создать виртуальное окружение (venv)

Песочница с пакетами только этого проекта. Создаётся заново на каждой машине —
между машинами venv НЕ переносится.

**Ubuntu / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Признак, что окружение включилось — в начале строки появляется `(.venv)`.

> Windows: если PowerShell ругается «выполнение скриптов отключено» —
> один раз выполнить `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (подтвердить `Y`).
> Либо активировать через CMD: `.venv\Scripts\activate.bat`.

### 3. Установить зависимости
```bash
pip install -r requirements.txt
```

### 4. Создать базу (применить миграции)

`db.sqlite3` между машинами НЕ переносится — на каждой машине база создаётся заново
из файлов миграций.
```bash
python manage.py migrate
```

### 5. Создать первого пользователя
```bash
python manage.py createsuperuser
```
(Пароль здесь хешируется правильно — под этим юзером можно логиниться и в портал, и в админку.)

### 6. Запустить сервер
```bash
python manage.py runserver
```
Открыть:
- Админка: http://localhost:8000/admin/
- API: http://localhost:8000/api/users/ (без токена вернёт `401` — так и должно быть)

---

## Повседневные команды

| Что нужно | Команда |
|---|---|
| Активировать venv (Ubuntu) | `source .venv/bin/activate` |
| Активировать venv (Windows) | `.venv\Scripts\Activate.ps1` |
| Запустить сервер | `python manage.py runserver` |
| Создать новое приложение | `python manage.py startapp name-app` |
| Создать/обновить миграции после правки моделей | `python manage.py makemigrations` |
| Применить миграции к базе | `python manage.py migrate` |
| Создать суперюзера | `python manage.py createsuperuser` |
| Django-shell (потыкать данные) | `python manage.py shell` |
| Зафиксировать новый пакет в requirements | `pip freeze > requirements.txt` |

---

## Правило миграций (важно)

- Поменяла **модель** (`models.py`) → `makemigrations` + `migrate`.
- Поменяла только **админку/сериализатор/вьюху** → миграция НЕ нужна (это не про структуру таблиц).
- Файлы миграций (`*/migrations/*.py`) коммитятся в git — это описание схемы БД.
- Установила новый пакет через `pip install` → сразу `pip freeze > requirements.txt`,
  иначе на второй машине его не будет.

---

## Работа на двух машинах

Между машинами ездит ТОЛЬКО код (+ `requirements.txt` + миграции).
НЕ переносятся: `.venv/`, `db.sqlite3` — они локальные, создаются заново.

БД храним в seed.json 
Сохранить (dumpdata):
python3 manage.py dumpdata \
  accounts.Workshop accounts.User \
  equipment.WeldingMethod equipment.Equipment \
  references.GasFlux references.FillerMaterial references.MaterialGroup references.Material \
  welders.Welder \
  attestation.AttestationRule attestation.Attestation attestation.AttestationItem \
  --indent 2 --natural-foreign -o fixtures/seed.json

Там где нужно достать БД ПОСЛЕ migrate!!!!
`python3 manage.py loaddata fixtures/seed.json`


---

## Структура проекта

```
welding-backend/
├── manage.py            # пульт проекта (все команды через него)
├── requirements.txt     # список пакетов (едет между машинами)
├── db.sqlite3           # база (НЕ в git, локальная)
├── config/              # настройки проекта
│   ├── settings.py      # DATABASES, INSTALLED_APPS, REST_FRAMEWORK, AUTH_USER_MODEL
│   └── urls.py          # корневые маршруты (admin/ и api/)
└── accounts/            # приложение: пользователи и цеха
    ├── models.py        # User, Workshop
    ├── serializers.py   # перевод модель <-> JSON (camelCase, пароль write-only)
    ├── views.py         # UserViewSet, login_view, logout_view
    ├── urls.py          # маршруты /api/users/, /api/auth/...
    ├── admin.py         # настройка админки
    └── migrations/      # история изменений схемы БД (в git)
```

---

## Авторизация (как работает)

- Логин: `POST /api/auth/login/` с `{login, password}` → возвращает `{token, user}`.
- Дальше фронт шлёт токен в каждом запросе: заголовок `Authorization: Token <ключ>`
  (именно `Token`, не `Bearer`).
- Все эндпоинты по умолчанию требуют токен (`IsAuthenticated`).
  Открыт только сам логин (`AllowAny`).
- Логаут: `POST /api/auth/logout/` — гасит токен в базе.
