import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

conn = psycopg.connect(
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", "5432"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
)

cur = conn.cursor()

tables = [
    "analytics_summaries",
    "bookings",
    "bookmarks",
    "event_categories",
    "events",
    "interactions",
    "model_runs",
    "payments",
    "recommendation_outputs",
    "tickets",
    "user_preferences",
    "users",
]

for table in tables:
    print("\n" + "=" * 80)
    print(table.upper())
    print("=" * 80)

    cur.execute(
        """
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
        ORDER BY ordinal_position;
        """,
        (table,)
    )

    print("\nCOLUMNS:")
    for column_name, data_type, nullable, default in cur.fetchall():
        print(
            f"{column_name:30} "
            f"{data_type:25} "
            f"nullable={nullable:3} "
            f"default={default}"
        )

    cur.execute(
        """
        SELECT
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        LEFT JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = %s
          AND tc.constraint_type IN (
              'PRIMARY KEY',
              'FOREIGN KEY',
              'UNIQUE'
          )
        ORDER BY tc.constraint_type, kcu.column_name;
        """,
        (table,)
    )

    print("\nCONSTRAINTS:")
    for constraint_type, column_name, foreign_table, foreign_column in cur.fetchall():
        if constraint_type == "FOREIGN KEY":
            print(
                f"{constraint_type:12} "
                f"{column_name} -> "
                f"{foreign_table}.{foreign_column}"
            )
        else:
            print(f"{constraint_type:12} {column_name}")

cur.close()
conn.close()
