import os
import sys

import pandas as pd
import psycopg
from dotenv import load_dotenv


# ==============================
# LOAD ENV
# ==============================

PROJECT_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        ".."
    )
)

load_dotenv(
    os.path.join(
        PROJECT_ROOT,
        ".env"
    )
)


# ==============================
# CONFIG
# ==============================

DATASET_PATH = os.path.join(
    PROJECT_ROOT,
    "data",
    "eventEyedemo.xlsx"
)

SHEET_NAME = "Eventeye Interactions"

SOURCE_USER = "U006"

INTERACTION_WEIGHTS = {
    "SEARCH": 0.5,
    "VIEW": 1.0,
    "DETAIL_VIEW": 2.0,
    "BOOKMARK": 3.0,
    "BOOKING_ATTEMPT": 4.0,
    "BOOKING_COMPLETE": 5.0,
}


# ==============================
# DATABASE
# ==============================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ==============================
# LOAD EXCEL BEHAVIOR
# ==============================

def load_demo_behavior():
    if not os.path.exists(
        DATASET_PATH
    ):
        raise FileNotFoundError(
            f"Dataset not found: "
            f"{DATASET_PATH}"
        )

    df = pd.read_excel(
        DATASET_PATH,
        sheet_name=SHEET_NAME,
        engine="openpyxl"
    )

    required_columns = [
        "User ID",
        "Category",
        "Eventeye Interaction",
        "Weight",
    ]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            "Missing columns: "
            + ", ".join(missing)
        )

    df = df[
        df["User ID"] ==
        SOURCE_USER
    ].copy()

    if df.empty:
        raise ValueError(
            f"No interactions found "
            f"for {SOURCE_USER}."
        )

    return df


# ==============================
# CONFIRM STUDENT
# ==============================

def get_student(
    cur,
    user_id
):
    cur.execute("""
        SELECT
            user_id,
            full_name,
            email,
            user_type
        FROM users
        WHERE user_id = %s;
    """, (
        user_id,
    ))

    student = cur.fetchone()

    if not student:
        raise ValueError(
            f"User {user_id} "
            "does not exist."
        )

    if student[3] != "student":
        raise ValueError(
            f"User {user_id} "
            "is not a student."
        )

    return student


# ==============================
# GET LIVE EVENTS
# ==============================

def get_events_by_category(
    cur
):
    cur.execute("""
        SELECT
            e.event_id,
            e.event_name,
            ec.category_name
        FROM events e

        LEFT JOIN event_categories ec
            ON e.category_id =
               ec.category_id

        WHERE e.status != 'cancelled'

        ORDER BY
            e.event_id;
    """)

    rows = cur.fetchall()

    events = {}

    for row in rows:
        event_id = row[0]
        event_name = row[1]
        category_name = row[2]

        if not category_name:
            continue

        if category_name not in events:
            events[
                category_name
            ] = []

        events[
            category_name
        ].append({
            "event_id":
                event_id,

            "event_name":
                event_name,
        })

    return events


# ==============================
# CLEAR PREVIOUS DEMO BEHAVIOR
# ==============================

def clear_demo_interactions(
    cur,
    user_id
):
    cur.execute("""
        DELETE FROM interactions
        WHERE user_id = %s;
    """, (
        user_id,
    ))


# ==============================
# INSERT INTERACTION
# ==============================

def insert_interaction(
    cur,
    user_id,
    event_id,
    interaction_type,
    confidence_weight
):
    cur.execute("""
        INSERT INTO interactions (
            user_id,
            event_id,
            interaction_type,
            session_id,
            confidence_weight
        )
        VALUES (
            %s,
            %s,
            %s,
            NULL,
            %s
        );
    """, (
        user_id,
        event_id,
        interaction_type,
        confidence_weight,
    ))


# ==============================
# IMPORT
# ==============================

def import_demo_behavior(
    user_id
):
    demo_df = (
        load_demo_behavior()
    )

    conn = None
    cur = None

    try:
        conn = (
            get_db_connection()
        )

        cur = conn.cursor()

        student = get_student(
            cur,
            user_id
        )

        events_by_category = (
            get_events_by_category(
                cur
            )
        )

        if not events_by_category:
            raise ValueError(
                "No usable events "
                "were found in the database."
            )

        print()
        print("=" * 60)
        print("EVENTEYE DEMO BEHAVIOR IMPORT")
        print("=" * 60)

        print(
            f"Student: "
            f"{student[1]}"
        )

        print(
            f"Email: "
            f"{student[2]}"
        )

        print(
            f"User ID: "
            f"{student[0]}"
        )

        print(
            f"Source profile: "
            f"{SOURCE_USER}"
        )

        print()

        clear_demo_interactions(
            cur,
            user_id
        )

        inserted = 0
        skipped = 0

        category_positions = {}

        for _, row in (
            demo_df.iterrows()
        ):
            category = str(
                row["Category"]
            ).strip()

            interaction_type = str(
                row[
                    "Eventeye Interaction"
                ]
            ).strip().upper()

            if (
                interaction_type
                not in
                INTERACTION_WEIGHTS
            ):
                print(
                    f"SKIPPED: "
                    f"{interaction_type} "
                    f"(unknown interaction type)"
                )

                skipped += 1
                continue

            confidence_weight = (
                INTERACTION_WEIGHTS[
                    interaction_type
                ]
            )

            available_events = (
                events_by_category.get(
                    category,
                    []
                )
            )

            if not available_events:
                print(
                    f"SKIPPED: "
                    f"{category} "
                    f"(no live event)"
                )

                skipped += 1
                continue

            current_position = (
                category_positions.get(
                    category,
                    0
                )
            )

            selected_event = (
                available_events[
                    current_position
                    % len(
                        available_events
                    )
                ]
            )

            category_positions[
                category
            ] = (
                current_position + 1
            )

            insert_interaction(
                cur,
                user_id,
                selected_event[
                    "event_id"
                ],
                interaction_type,
                confidence_weight
            )

            inserted += 1

            print(
                f"{interaction_type:<20} "
                f"({confidence_weight}) "
                f"→ "
                f"{selected_event['event_name']}"
            )

        conn.commit()

        print()
        print("=" * 60)
        print("IMPORT COMPLETE")
        print("=" * 60)

        print(
            f"Interactions inserted: "
            f"{inserted}"
        )

        print(
            f"Skipped: "
            f"{skipped}"
        )

        print()
        print(
            "The student's live "
            "Eventeye behavior profile "
            "has been updated."
        )

        print(
            "Log in with this student "
            "and open the For You page."
        )

        print()

    except Exception as error:
        if conn:
            conn.rollback()

        print()
        print(
            "IMPORT FAILED:"
        )

        print(
            str(error)
        )

        print()

    finally:
        if cur:
            cur.close()

        if conn:
            conn.close()


# ==============================
# MAIN
# ==============================

def main():
    if len(sys.argv) != 2:
        print()
        print(
            "Usage:"
        )

        print(
            "python "
            "backend/scripts/"
            "import_demo_behavior.py "
            "<student_user_id>"
        )

        print()

        print(
            "Example:"
        )

        print(
            "python "
            "backend/scripts/"
            "import_demo_behavior.py "
            "6"
        )

        print()

        return

    try:
        user_id = int(
            sys.argv[1]
        )

    except ValueError:
        print(
            "Student user ID "
            "must be a number."
        )

        return

    import_demo_behavior(
        user_id
    )


if __name__ == "__main__":
    main()