
from pathlib import Path
import os

from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Настройки читаются из окружения. Значения по умолчанию — для разработки:
# docker compose up и runserver работают без единой переменной.
# Для продакшена обязательно задать SECRET_KEY, DEBUG=0 и ALLOWED_HOSTS.


def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    """«a.ru, b.ru» → ["a.ru", "b.ru"]; пустые куски выбрасываем."""
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DEBUG", True)

_DEV_SECRET_KEY = 'django-insecure--s%m7erjn^n!*w5lajk*im5jv7zgs0-ubv104(ext=oys9x81c'
SECRET_KEY = os.environ.get("SECRET_KEY", _DEV_SECRET_KEY)
if not DEBUG and SECRET_KEY == _DEV_SECRET_KEY:
    # ключ из репозитория известен всем — с ним подделываются подписи и сессии
    raise ImproperlyConfigured("DEBUG выключен: задайте SECRET_KEY в окружении")

# Пусто — при DEBUG Django сам пускает localhost, 127.0.0.1 и [::1].
# На этом держится прокси Vite: он шлёт Host: localhost
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'apps.accounts',
    'apps.materials',
    'apps.equipment',
    'apps.technology',
    'apps.weldingcards',
    'apps.welding',
    'apps.welders',
    'apps.attestation',
    'apps.workshops',
    'apps.methods',
    "apps.service",
    "apps.demo",
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases

# DB_ENGINE=postgres (по умолчанию) — сервер из DB_HOST/DB_PORT/DB_NAME/...
# DB_ENGINE=sqlite — файл SQLITE_PATH, по умолчанию db.sqlite3 рядом с manage.py
DB_ENGINE = os.environ.get("DB_ENGINE", "postgres").strip().lower()

if DB_ENGINE == "postgres":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "welding"),
            "USER": os.environ.get("DB_USER", "welding"),
            "PASSWORD": os.environ.get("DB_PASSWORD", "welding"),
            "HOST": os.environ.get("DB_HOST", "localhost"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }
elif DB_ENGINE == "sqlite":
    # относительный путь считаем от manage.py, а не от текущей папки,
    # иначе запуск из другого каталога молча создаст пустую базу
    SQLITE_PATH = BASE_DIR / os.environ.get("SQLITE_PATH", "db.sqlite3")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": SQLITE_PATH,
            "OPTIONS": {
                # WAL: читатели не ждут писателя и наоборот. Без него
                # параллельные запросы ловят «database is locked».
                # init_command выполняется на каждом новом соединении
                "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
                # писатель ждёт освободившуюся базу до 20 с, а не падает сразу
                "timeout": 20,
                # запись берёт блокировку в начале транзакции: иначе при
                # переходе чтения в запись SQLite отдаёт «locked» без ожидания
                "transaction_mode": "IMMEDIATE",
            },
        }
    }
else:
    raise ImproperlyConfigured(
        f"DB_ENGINE={DB_ENGINE!r}: допустимы только postgres и sqlite"
    )


# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": (
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
        "djangorestframework_camel_case.render.CamelCaseBrowsableAPIRenderer",
    ),
    "DEFAULT_PARSER_CLASSES": (
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
        "djangorestframework_camel_case.parser.CamelCaseFormParser",
        "djangorestframework_camel_case.parser.CamelCaseMultiPartParser",
    ),
    # только токен. С SessionAuthentication cookie админки (общая для
    # localhost на всех портах) цепляется к запросам фронта без токена —
    # например, ко входу — и DRF требует CSRF: 403 «CSRF token missing»
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.TokenAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = 'static/'


# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}
