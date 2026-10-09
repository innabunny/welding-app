# Один общий клиент ClickHouse для всего Django-приложения.
#
# Зачем отдельный модуль: клиент держит соединение, и создавать его
# на каждый запрос расточительно. Здесь он создаётся один раз
# на процесс и переиспользуется.

import os
import threading

from clickhouse_driver import Client

_local = threading.local()


def get_client() -> Client:
    """Клиент ClickHouse, свой на каждый поток.

    threading.local нужен потому, что daphne обрабатывает запросы
    в нескольких потоках, а соединение clickhouse-driver между
    потоками делить нельзя — получите «Unexpected packet».
    """
    client = getattr(_local, "client", None)
    if client is None:
        client = Client(
            host=os.environ.get("CH_HOST", "clickhouse"),
            port=9000,
            database=os.environ.get("CH_DB", "welding"),
            user=os.environ.get("CH_USER", "welding"),
            password=os.environ.get("CH_PASSWORD", "welding"),
        )
        _local.client = client
    return client