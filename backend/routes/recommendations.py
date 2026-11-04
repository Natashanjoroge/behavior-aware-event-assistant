from flask import Blueprint, jsonify
import psycopg
import os

from models.recommender import (
    recommend_events_for_user,
    get_model_information,
)

recommendations_bp = Blueprint(
    "recommendations",
    __name__
)


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# =========================================
# FORMAT EVENTS
# =========================================

def format_events(rows, reason=None, model=None):
    events = []

    for row in rows:
        event = {
            "event_id": row[0],
            "event_name": row[1],
            "description": row[2],
            "location": row[3],

            "event_date":
                row[4].isoformat()
                if row[4]
                else None,

            "end_date":
                row[5].isoformat()
                if row[5]
                else None,

            "capacity": row[6],
            "status": row[7],
            "category_name": row[8],
        }

        if reason:
            event["recommendation_reason"] = reason

        if model:
            event["recommendation_model"] = model

        events.append(event)

    return events


# =========================================
# GET UPCOMING FALLBACK EVENTS
# =========================================

def get_upcoming_events(limit=10):
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
          AND e.event_date >= CURRENT_TIMESTAMP
        ORDER BY e.event_date ASC
        LIMIT %s;
    """, (limit,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return format_events(
        rows,
        reason="Popular upcoming event",
        model="UPCOMING_FALLBACK"
    )


# =========================================
# COLD START RECOMMENDATIONS
# =========================================

def generate_cold_start_recommendations(
    user_id,
    limit=10
):
    conn = get_db_connection()
    cur = conn.cursor()

    # ---------------------------------
    # GET USER PREFERENCES
    # ---------------------------------

    cur.execute("""
        SELECT category_id
        FROM user_preferences
        WHERE user_id = %s;
    """, (user_id,))

    preference_rows = cur.fetchall()

    category_ids = [
        row[0]
        for row in preference_rows
    ]

    # ---------------------------------
    # NO USER PREFERENCES
    # ---------------------------------

    if not category_ids:
        cur.close()
        conn.close()

        return {
            "success": True,
            "recommendation_type": "fallback",
            "recommendation_model": "UPCOMING_FALLBACK",

            "message": (
                "No onboarding preferences were found. "
                "Showing upcoming events."
            ),

            "user_id": user_id,

            "preferred_category_ids": [],

            "events":
                get_upcoming_events(limit)
        }

    # ---------------------------------
    # FIND EVENTS MATCHING INTERESTS
    # ---------------------------------

    placeholders = ",".join(
        ["%s"] * len(category_ids)
    )

    query = f"""
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
        WHERE e.category_id IN ({placeholders})
          AND e.status != 'cancelled'
          AND e.event_date >= CURRENT_TIMESTAMP
        ORDER BY e.event_date ASC
        LIMIT %s;
    """

    parameters = tuple(
        category_ids
    ) + (limit,)

    cur.execute(
        query,
        parameters
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    # ---------------------------------
    # MATCHES FOUND
    # ---------------------------------

    if rows:
        return {
            "success": True,

            "recommendation_type":
                "cold_start",

            "recommendation_model":
                "CONTENT_PREFERENCE",

            "message":
                "Recommendations generated from onboarding interests.",

            "user_id":
                user_id,

            "preferred_category_ids":
                category_ids,

            "events":
                format_events(
                    rows,
                    reason=(
                        "Matches your selected interests"
                    ),
                    model="CONTENT_PREFERENCE"
                )
        }

    # ---------------------------------
    # NO MATCHING EVENTS
    # ---------------------------------

    return {
        "success": True,

        "recommendation_type":
            "fallback",

        "recommendation_model":
            "UPCOMING_FALLBACK",

        "message": (
            "No upcoming events currently match "
            "your interests. Showing upcoming events."
        ),

        "user_id":
            user_id,

        "preferred_category_ids":
            category_ids,

        "events":
            get_upcoming_events(limit)
    }


# =========================================
# COLD START API
# =========================================

@recommendations_bp.route(
    "/cold-start/<int:user_id>",
    methods=["GET"]
)
def get_cold_start_recommendations(user_id):
    try:
        result = (
            generate_cold_start_recommendations(
                user_id
            )
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


# =========================================
# BEHAVIOR-AWARE API
# =========================================

@recommendations_bp.route(
    "/behavior/<int:user_id>",
    methods=["GET"]
)
def get_behavior_recommendations(user_id):
    """
    Attempts ALS/WRMF first.

    If there is not enough behavioral data
    or the student is new to the ALS model,
    Eventeye automatically falls back to
    onboarding-interest recommendations.
    """

    try:
        als_result = (
            recommend_events_for_user(
                user_id=user_id,
                limit=10
            )
        )

        # ---------------------------------
        # ALS SUCCESS
        # ---------------------------------

        if (
            als_result.get("success")
            and als_result.get(
                "recommendations"
            )
        ):
            return jsonify({
                "success": True,

                "recommendation_type":
                    "behavior",

                "recommendation_model":
                    "ALS_WRMF",

                "message":
                    als_result.get(
                        "message"
                    ),

                "user_id":
                    user_id,

                "events":
                    als_result.get(
                        "recommendations",
                        []
                    )
            })

        # ---------------------------------
        # ALS NOT READY
        # FALL BACK TO COLD START
        # ---------------------------------

        cold_start_result = (
            generate_cold_start_recommendations(
                user_id=user_id,
                limit=10
            )
        )

        cold_start_result[
            "behavior_model_attempted"
        ] = True

        cold_start_result[
            "behavior_model"
        ] = "ALS_WRMF"

        cold_start_result[
            "behavior_model_status"
        ] = als_result.get(
            "reason",
            "fallback"
        )

        cold_start_result[
            "behavior_model_message"
        ] = als_result.get(
            "message"
        )

        return jsonify(
            cold_start_result
        )

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


# =========================================
# SMART / HYBRID RECOMMENDATION API
# =========================================

@recommendations_bp.route(
    "/for-you/<int:user_id>",
    methods=["GET"]
)
def get_for_you_recommendations(user_id):
    """
    Main Eventeye recommendation endpoint.

    1. Try behavior-aware ALS/WRMF.
    2. If ALS is unavailable or insufficient,
       use onboarding preferences.
    3. If no preference matches exist,
       use upcoming events.
    """

    try:
        als_result = (
            recommend_events_for_user(
                user_id=user_id,
                limit=10
            )
        )

        # ---------------------------------
        # USE ALS WHEN AVAILABLE
        # ---------------------------------

        if (
            als_result.get("success")
            and als_result.get(
                "recommendations"
            )
        ):
            return jsonify({
                "success": True,

                "recommendation_type":
                    "behavior",

                "recommendation_model":
                    "ALS_WRMF",

                "message": (
                    "Recommendations generated "
                    "from your Eventeye activity."
                ),

                "user_id":
                    user_id,

                "events":
                    als_result[
                        "recommendations"
                    ]
            })

        # ---------------------------------
        # FALL BACK TO COLD START
        # ---------------------------------

        cold_result = (
            generate_cold_start_recommendations(
                user_id=user_id,
                limit=10
            )
        )

        cold_result[
            "als_status"
        ] = als_result.get(
            "reason"
        )

        return jsonify(
            cold_result
        )

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


# =========================================
# MODEL STATUS API
# =========================================

@recommendations_bp.route(
    "/model/status",
    methods=["GET"]
)
def get_recommendation_model_status():
    try:
        information = (
            get_model_information()
        )

        return jsonify({
            "success": True,

            "model":
                "ALS_WRMF",

            "description": (
                "Implicit-feedback collaborative "
                "filtering model"
            ),

            **information
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500