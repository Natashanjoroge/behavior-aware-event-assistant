from flask import Blueprint, jsonify, request
from datetime import datetime
import psycopg
import os


events_bp = Blueprint("events", __name__)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# ==============================
# DATE HELPERS
# ==============================

def parse_event_datetime(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )
    except (ValueError, TypeError):
        return None


def is_date_before_today(value):
    parsed_date = parse_event_datetime(value)

    if not parsed_date:
        return False

    today = datetime.now().date()

    return parsed_date.date() < today


# ==============================
# GET ALL EVENTS
# ==============================

@events_bp.route("/", methods=["GET"])
def get_events():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                e.end_date,
                e.capacity,
                e.status,
                ec.category_name
            FROM events e
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            WHERE e.status != 'cancelled'
            ORDER BY e.event_date ASC;
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        events = []

        for row in rows:
            events.append({
                "event_id": row[0],
                "event_name": row[1],
                "description": row[2],
                "location": row[3],
                "event_date": (
                    row[4].isoformat()
                    if row[4]
                    else None
                ),
                "end_date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),
                "capacity": row[6],
                "status": row[7],
                "category_name": row[8],
            })

        return jsonify(events)

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# CREATE EVENT
# ==============================

@events_bp.route("/", methods=["POST"])
def create_event():
    data = request.get_json() or {}

    event_name = data.get("event_name")
    description = data.get("description")
    category_id = data.get("category_id")
    location = data.get("location")
    event_date = data.get("event_date")
    end_date = data.get("end_date")
    capacity = data.get("capacity")
    organizer_id = data.get("organizer_id")

    # ==============================
    # REQUIRED FIELDS
    # ==============================

    if not event_name:
        return jsonify({
            "message": "Event name is required."
        }), 400

    if not description:
        return jsonify({
            "message": "Description is required."
        }), 400

    if not category_id:
        return jsonify({
            "message": "Event category is required."
        }), 400

    if not location:
        return jsonify({
            "message": "Location is required."
        }), 400

    if not event_date:
        return jsonify({
            "message": "Event date is required."
        }), 400

    if not organizer_id:
        return jsonify({
            "message": "Organizer ID is required."
        }), 400

    # ==============================
    # VALIDATE START DATE
    # ==============================

    parsed_event_date = parse_event_datetime(
        event_date
    )

    if not parsed_event_date:
        return jsonify({
            "message": "The event start date is invalid."
        }), 400

    if is_date_before_today(
        event_date
    ):
        return jsonify({
            "message": (
                "The event date cannot be "
                "before today's date."
            )
        }), 400

    # ==============================
    # VALIDATE END DATE
    # ==============================

    parsed_end_date = None

    if end_date:
        parsed_end_date = (
            parse_event_datetime(
                end_date
            )
        )

        if not parsed_end_date:
            return jsonify({
                "message": (
                    "The event end date is invalid."
                )
            }), 400

        if is_date_before_today(
            end_date
        ):
            return jsonify({
                "message": (
                    "The event end date cannot "
                    "be before today's date."
                )
            }), 400

        if (
            parsed_end_date <=
            parsed_event_date
        ):
            return jsonify({
                "message": (
                    "The event end time must be "
                    "after the start time."
                )
            }), 400

    # ==============================
    # VALIDATE CAPACITY
    # ==============================

    if capacity is not None:
        try:
            capacity = int(capacity)

            if capacity < 1:
                return jsonify({
                    "message": (
                        "Capacity must be at least 1."
                    )
                }), 400

        except (
            ValueError,
            TypeError
        ):
            return jsonify({
                "message": (
                    "Capacity must be a valid number."
                )
            }), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # ==============================
        # CONFIRM ORGANIZER
        # ==============================

        cur.execute("""
            SELECT
                user_id,
                user_type
            FROM users
            WHERE user_id = %s;
        """, (
            organizer_id,
        ))

        organizer = cur.fetchone()

        if not organizer:
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "Organizer account not found."
                )
            }), 404

        if organizer[1] != "organizer":
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "This account is not registered "
                    "as an organizer."
                )
            }), 400

        # ==============================
        # CONFIRM CATEGORY
        # ==============================

        cur.execute("""
            SELECT
                category_id
            FROM event_categories
            WHERE category_id = %s;
        """, (
            category_id,
        ))

        category = cur.fetchone()

        if not category:
            cur.close()
            conn.close()

            return jsonify({
                "message": (
                    "Event category not found."
                )
            }), 404

        # ==============================
        # CREATE EVENT
        # ==============================

        cur.execute("""
            INSERT INTO events (
                event_name,
                description,
                category_id,
                location,
                event_date,
                end_date,
                capacity,
                status,
                organizer_id
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'upcoming',
                %s
            )
            RETURNING event_id;
        """, (
            event_name.strip(),
            description.strip(),
            category_id,
            location.strip(),
            parsed_event_date,
            parsed_end_date,
            capacity,
            organizer_id
        ))

        event_id = (
            cur.fetchone()[0]
        )

        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": (
                "Event created successfully"
            ),
            "event_id": event_id
        }), 201

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# GET ALL EVENTS FOR ONE ORGANIZER
# ==============================

@events_bp.route(
    "/organizer/<int:organizer_id>",
    methods=["GET"]
)
def get_organizer_events(
    organizer_id
):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                e.end_date,
                e.capacity,
                e.status,
                ec.category_name
            FROM events e
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            WHERE e.organizer_id = %s
            ORDER BY e.event_date DESC;
        """, (
            organizer_id,
        ))

        rows = cur.fetchall()

        cur.close()
        conn.close()

        events = []

        for row in rows:
            events.append({
                "event_id": row[0],
                "event_name": row[1],
                "description": row[2],
                "location": row[3],
                "event_date": (
                    row[4].isoformat()
                    if row[4]
                    else None
                ),
                "end_date": (
                    row[5].isoformat()
                    if row[5]
                    else None
                ),
                "capacity": row[6],
                "status": row[7],
                "category_name": row[8],
            })

        return jsonify(events)

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500


# ==============================
# GET SINGLE EVENT
# ==============================

@events_bp.route(
    "/<int:event_id>",
    methods=["GET"]
)
def get_event(event_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.location,
                e.event_date,
                e.end_date,
                e.capacity,
                e.status,
                ec.category_name,
                u.full_name
            FROM events e
            LEFT JOIN event_categories ec
                ON e.category_id = ec.category_id
            LEFT JOIN users u
                ON e.organizer_id = u.user_id
            WHERE e.event_id = %s;
        """, (
            event_id,
        ))

        row = cur.fetchone()

        cur.close()
        conn.close()

        if not row:
            return jsonify({
                "message": (
                    "Event not found"
                )
            }), 404

        return jsonify({
            "event_id": row[0],
            "event_name": row[1],
            "description": row[2],
            "location": row[3],
            "event_date": (
                row[4].isoformat()
                if row[4]
                else None
            ),
            "end_date": (
                row[5].isoformat()
                if row[5]
                else None
            ),
            "capacity": row[6],
            "status": row[7],
            "category_name": row[8],
            "organizer_name": row[9],
        })

    except Exception as e:
        return jsonify({
            "message": str(e)
        }), 500