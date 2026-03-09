"""Supabase connection and batch insert helpers."""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from config import BATCH_SIZE


def get_client() -> Client:
    load_dotenv()
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_API"]
    return create_client(url, key)


def insert_products(client: Client):
    """Insert the two product records."""
    client.table("products").upsert([
        {"id": 1, "name": "Hotel", "description": "Hotel accommodation coverage"},
        {"id": 2, "name": "Flight", "description": "Air travel coverage"},
    ]).execute()
    print("✓ Products inserted")


def insert_destinations(client: Client, destinations: list[dict]) -> list[dict]:
    """Insert destinations and return them with their assigned IDs."""
    # Clear existing and insert fresh
    client.table("destinations").delete().neq("id", 0).execute()
    result = client.table("destinations").insert(destinations).execute()
    print(f"✓ {len(result.data)} destinations inserted")
    return result.data


def batch_insert(client: Client, table: str, rows: list[dict]) -> list[dict]:
    """Insert rows in batches, returning all inserted records."""
    all_data = []
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        result = client.table(table).insert(chunk).execute()
        all_data.extend(result.data)
    return all_data
