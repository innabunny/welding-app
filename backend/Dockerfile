FROM python:3.12-slim

# не создавать .pyc и не буферизовать вывод — логи видно сразу
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# зависимости отдельным слоем: пока requirements не меняется,
# Docker не переустанавливает пакеты при каждой сборке
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]