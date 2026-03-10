"""Direct Postgres connection for DDL operations (table creation, etc.)."""

import os
import psycopg2
from dotenv import load_dotenv


def get_pg_conn():
    """Get a direct Postgres connection using env vars from .env."""
    load_dotenv()
    return psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=int(os.environ.get("PG_PORT", "5432")),
        dbname=os.environ.get("PG_DB", "postgres"),
        user=os.environ.get("PG_USER", "postgres"),
        password=os.environ["PG_PASS"],
    )
