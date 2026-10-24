# Первый администратор портала на чистой машине.
#
#   python manage.py create_admin            логин admin
#   python manage.py create_admin ivanova    свой логин
#
# Пароль спрашивается дважды и на экран не выводится.
#
# Почему не createsuperuser: тот создаёт суперпользователя Django,
# но роль портала оставляет пустой, а разделы портала смотрят именно
# на роль. Эта команда ставит роль «администратор» и даёт вход в админку.
# Если такой логин уже есть — меняет ему пароль и роль, не создаёт второй.

from getpass import getpass

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User


class Command(BaseCommand):
    help = "Создать администратора портала (или сменить пароль существующему)"

    def add_arguments(self, parser):
        parser.add_argument("username", nargs="?", default="admin")

    def handle(self, *args, username, **options):
        password = getpass("Пароль: ")
        if password != getpass("Ещё раз: "):
            raise CommandError("Пароли не совпадают")

        user, created = User.objects.get_or_create(username=username)
        try:
            validate_password(password, user)
        except ValidationError as exc:
            if created:
                user.delete()
            raise CommandError(" ".join(exc.messages)) from exc

        user.set_password(password)
        user.role = User.Role.ADMIN
        user.is_staff = user.is_superuser = user.is_active = True
        if not user.name:
            user.name = "Администратор портала"
        user.save()

        self.stdout.write(self.style.SUCCESS(
            f"{'Создан' if created else 'Обновлён'} администратор «{username}». "
            "Вход в портал и в админку /admin/ с этим паролем."
        ))
