
import os
import sys
import uuid
from collections import Counter

import pandas as pd
import psycopg
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

DATASET = os.path.join(ROOT, "data", "eventEyedemo.xlsx")
SHEET = "Eventeye Interactions"
DEMO_EMAIL_DOMAIN = "eventeye-demo.invalid"
DEMO_SESSION_PREFIX = "EVENTEYE_DATASET_"
REAL_DEMO_USER_ID = 6
REAL_DEMO_PROFILE = "U006"

WEIGHTS = {
    "SEARCH": 0.5,
    "VIEW": 1.0,
    "DETAIL_VIEW": 2.0,
    "BOOKMARK": 3.0,
    "BOOKING_ATTEMPT": 4.0,
    "BOOKING_COMPLETE": 5.0,
}

def connect():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )

def main():
    if not os.path.isfile(DATASET):
        raise FileNotFoundError(DATASET)

    df = pd.read_excel(DATASET, sheet_name=SHEET, engine="openpyxl")
    required = {"User ID", "Category", "Eventeye Interaction"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing Excel columns: {sorted(missing)}")

    df = df.dropna(subset=["User ID", "Category", "Eventeye Interaction"])
    df["User ID"] = df["User ID"].astype(str).str.strip()
    df["Category"] = df["Category"].astype(str).str.strip()
    df["Eventeye Interaction"] = (
        df["Eventeye Interaction"].astype(str).str.strip().str.upper()
    )
    df = df[df["Eventeye Interaction"].isin(WEIGHTS)]

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT user_id, user_type
                FROM users WHERE user_id = %s
            """, (REAL_DEMO_USER_ID,))
            real_user = cur.fetchone()
            if not real_user or str(real_user[1]).lower() != "student":
                raise ValueError("Student user 6 does not exist.")

            cur.execute("""
                SELECT e.event_id, ec.category_name
                FROM events e
                JOIN event_categories ec ON ec.category_id = e.category_id
                WHERE LOWER(e.status) = 'upcoming'
                  AND e.event_date >= CURRENT_TIMESTAMP
                ORDER BY e.event_date, e.event_id
            """)
            events_by_category = {}
            for event_id, category in cur.fetchall():
                events_by_category.setdefault(category.strip().lower(), []).append(event_id)

            if not events_by_category:
                raise ValueError("No upcoming events found. Create future events first.")

            # Discover required user columns before making changes.
            cur.execute("""
                SELECT column_name, is_nullable, column_default,
                       is_identity, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
            """)
            user_columns = {r[0]: r for r in cur.fetchall()}

            demo_ids = sorted(df["User ID"].unique())
            demo_users = {REAL_DEMO_PROFILE: REAL_DEMO_USER_ID}

            for source_id in demo_ids:
                if source_id == REAL_DEMO_PROFILE:
                    continue

                email = f"{source_id.lower()}@{DEMO_EMAIL_DOMAIN}"
                cur.execute("SELECT user_id FROM users WHERE email = %s", (email,))
                existing = cur.fetchone()

                if existing:
                    demo_users[source_id] = existing[0]
                    continue

                # Adapt to common Eventeye user columns.
                values = {
                    "full_name": f"Demo Student {source_id}",
                    "email": email,
                    "user_type": "student",
                    "password_hash": uuid.uuid4().hex,
                    "password": uuid.uuid4().hex,
                }

                columns = [
                    name for name in values
                    if name in user_columns
                ]
                if not {"email", "user_type"}.issubset(columns):
                    raise ValueError("Unexpected users table schema.")

                mandatory = [
                    name for name, meta in user_columns.items()
                    if meta[1] == "NO"
                    and meta[2] is None
                    and meta[3] == "NO"
                    and name not in columns
                ]
                if mandatory:
                    raise ValueError(
                        "Users table has additional required columns: "
                        + ", ".join(mandatory)
                    )

                col_sql = ", ".join(columns)
                placeholders = ", ".join(["%s"] * len(columns))
                cur.execute(
                    f"INSERT INTO users ({col_sql}) VALUES ({placeholders}) RETURNING user_id",
                    tuple(values[name] for name in columns),
                )
                demo_users[source_id] = cur.fetchone()[0]

            # Remove only interactions previously created by this importer.
            cur.execute("""
                DELETE FROM interactions
                WHERE session_id LIKE %s
            """, (DEMO_SESSION_PREFIX + "%",))

            inserted = 0
            skipped = Counter()
            positions = Counter()

            for _, row in df.iterrows():
                source_id = row["User ID"]
                category = row["Category"]
                interaction_type = row["Eventeye Interaction"]
                options = events_by_category.get(category.lower(), [])

                if not options:
                    skipped[category] += 1
                    continue

                key = (source_id, category)
                event_id = options[positions[key] % len(options)]
                positions[key] += 1

                cur.execute("""
                    INSERT INTO interactions
                        (user_id, event_id, interaction_type,
                         confidence_weight, session_id)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    demo_users[source_id],
                    event_id,
                    interaction_type,
                    WEIGHTS[interaction_type],
                    f"{DEMO_SESSION_PREFIX}{source_id}",
                ))
                inserted += 1

            conn.commit()

            print("\n" + "=" * 55)
            print("EVENTEYE LIVE DATASET IMPORT COMPLETE")
            print("=" * 55)
            print("Dataset profiles:", len(demo_users))
            print("Interactions imported:", inserted)
            print("Interactions skipped:", sum(skipped.values()))
            print("Upcoming event categories:", len(events_by_category))
            print("Natasha demo user:", REAL_DEMO_USER_ID)
            if skipped:
                print("Missing categories:", dict(skipped))
            print("=" * 55)

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("\nIMPORT FAILED:", exc)
        sys.exit(1)
