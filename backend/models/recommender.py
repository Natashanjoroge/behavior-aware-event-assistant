import os

import numpy as np
import psycopg

from scipy.sparse import csr_matrix
from implicit.als import AlternatingLeastSquares


# =========================================
# DATABASE CONNECTION
# =========================================

def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )


# =========================================
# ALS MODEL SETTINGS
# =========================================

ALS_FACTORS = 20
ALS_REGULARIZATION = 0.1
ALS_ITERATIONS = 20
ALS_RANDOM_STATE = 42


# =========================================
# LOAD INTERACTION DATA
# =========================================

def load_interaction_data():
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            user_id,
            event_id,
            SUM(confidence_weight) AS total_weight
        FROM interactions
        WHERE event_id IS NOT NULL
        GROUP BY user_id, event_id
        ORDER BY user_id, event_id;
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows


# =========================================
# CREATE USER-EVENT MATRIX
# =========================================

def build_user_event_matrix(interactions):
    if not interactions:
        return None

    user_ids = sorted(
        set(row[0] for row in interactions)
    )

    event_ids = sorted(
        set(row[1] for row in interactions)
    )

    user_to_index = {
        user_id: index
        for index, user_id in enumerate(user_ids)
    }

    index_to_user = {
        index: user_id
        for user_id, index in user_to_index.items()
    }

    event_to_index = {
        event_id: index
        for index, event_id in enumerate(event_ids)
    }

    index_to_event = {
        index: event_id
        for event_id, index in event_to_index.items()
    }

    row_indices = []
    column_indices = []
    values = []

    for user_id, event_id, total_weight in interactions:
        row_indices.append(
            user_to_index[user_id]
        )

        column_indices.append(
            event_to_index[event_id]
        )

        values.append(
            float(total_weight)
        )

    matrix = csr_matrix(
        (
            np.array(
                values,
                dtype=np.float32
            ),
            (
                np.array(row_indices),
                np.array(column_indices),
            ),
        ),
        shape=(
            len(user_ids),
            len(event_ids),
        ),
    )

    return {
        "matrix": matrix,
        "user_to_index": user_to_index,
        "index_to_user": index_to_user,
        "event_to_index": event_to_index,
        "index_to_event": index_to_event,
    }


# =========================================
# CHECK TRAINING DATA
# =========================================

def has_enough_training_data(matrix_data):
    if not matrix_data:
        return False

    matrix = matrix_data["matrix"]

    number_of_users = matrix.shape[0]
    number_of_events = matrix.shape[1]
    number_of_pairs = matrix.nnz

    # We want more than a trivial dataset.
    if number_of_users < 2:
        return False

    if number_of_events < 3:
        return False

    if number_of_pairs < 5:
        return False

    return True


# =========================================
# TRAIN ALS MODEL
# =========================================

def train_als_model():
    interactions = load_interaction_data()

    matrix_data = build_user_event_matrix(
        interactions
    )

    if not has_enough_training_data(
        matrix_data
    ):
        return {
            "success": False,
            "reason": "not_enough_data",
            "message": (
                "There is not enough diverse "
                "behavioral data to train a "
                "reliable ALS model yet."
            ),
            "model": None,
            "matrix_data": matrix_data,
        }

    matrix = matrix_data["matrix"]

    model = AlternatingLeastSquares(
        factors=ALS_FACTORS,
        regularization=ALS_REGULARIZATION,
        iterations=ALS_ITERATIONS,
        random_state=ALS_RANDOM_STATE,
    )

    model.fit(
        matrix,
        show_progress=False
    )

    return {
        "success": True,
        "reason": None,
        "message":
            "ALS model trained successfully.",
        "model": model,
        "matrix_data": matrix_data,
    }


# =========================================
# GET EVENT DETAILS
# =========================================

def get_event_details(event_ids):
    if not event_ids:
        return {}

    conn = get_db_connection()
    cur = conn.cursor()

    placeholders = ",".join(
        ["%s"] * len(event_ids)
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
        WHERE e.event_id IN ({placeholders})
          AND e.status != 'cancelled'
          AND e.event_date >= CURRENT_TIMESTAMP;
    """

    cur.execute(
        query,
        tuple(event_ids)
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    events = {}

    for row in rows:
        events[row[0]] = {
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

    return events


# =========================================
# SCORE VALIDATION
# =========================================

def is_valid_score(score):
    """
    Rejects NaN, infinity and sentinel values
    such as -3.4028235e+38.
    """

    if score is None:
        return False

    score = float(score)

    if not np.isfinite(score):
        return False

    # Sentinel/extreme values are not meaningful
    # recommendations.
    if score <= -1e20:
        return False

    return True


# =========================================
# GET ALS RECOMMENDATIONS
# =========================================

def recommend_events_for_user(
    user_id,
    limit=10
):
    training_result = train_als_model()

    if not training_result["success"]:
        return {
            "success": False,
            "reason":
                training_result["reason"],
            "message":
                training_result["message"],
            "recommendations": [],
        }

    model = training_result["model"]
    matrix_data = (
        training_result["matrix_data"]
    )

    user_to_index = matrix_data[
        "user_to_index"
    ]

    index_to_event = matrix_data[
        "index_to_event"
    ]

    user_event_matrix = matrix_data[
        "matrix"
    ]

    if user_id not in user_to_index:
        return {
            "success": False,
            "reason": "new_user",
            "message": (
                "This student does not yet "
                "have enough behavioral history "
                "for ALS."
            ),
            "recommendations": [],
        }

    internal_user_id = (
        user_to_index[user_id]
    )

    user_row = (
        user_event_matrix[
            internal_user_id
        ]
    )

    number_of_items = (
        user_event_matrix.shape[1]
    )

    if number_of_items < 2:
        return {
            "success": False,
            "reason":
                "not_enough_candidate_events",
            "message": (
                "There are not enough candidate "
                "events for collaborative filtering."
            ),
            "recommendations": [],
        }

    requested_limit = min(
        limit,
        number_of_items
    )

    try:
        recommended_indices, scores = (
            model.recommend(
                internal_user_id,
                user_row,
                N=requested_limit,
                filter_already_liked_items=True,
            )
        )

    except Exception as error:
        return {
            "success": False,
            "reason": "recommendation_error",
            "message": str(error),
            "recommendations": [],
        }

    candidate_pairs = []

    for event_index, score in zip(
        recommended_indices,
        scores
    ):
        if not is_valid_score(score):
            continue

        event_id = index_to_event.get(
            int(event_index)
        )

        if event_id is None:
            continue

        candidate_pairs.append(
            (
                event_id,
                float(score)
            )
        )

    # No usable recommendation survived
    # validation.
    if not candidate_pairs:
        return {
            "success": False,
            "reason":
                "no_valid_recommendations",
            "message": (
                "ALS trained, but there are "
                "not enough useful unseen events "
                "to generate reliable recommendations."
            ),
            "recommendations": [],
        }

    candidate_event_ids = [
        event_id
        for event_id, _ in candidate_pairs
    ]

    event_details = get_event_details(
        candidate_event_ids
    )

    recommendations = []

    for event_id, score in candidate_pairs:
        event = event_details.get(
            event_id
        )

        if not event:
            continue

        recommendation = event.copy()

        recommendation[
            "recommendation_score"
        ] = round(
            float(score),
            6
        )

        recommendation[
            "recommendation_reason"
        ] = (
            "Recommended from your "
            "Eventeye activity"
        )

        recommendation[
            "recommendation_model"
        ] = "ALS_WRMF"

        recommendations.append(
            recommendation
        )

    if not recommendations:
        return {
            "success": False,
            "reason":
                "no_upcoming_recommendations",
            "message": (
                "ALS found candidates, but none "
                "are currently valid upcoming events."
            ),
            "recommendations": [],
        }

    recommendations.sort(
        key=lambda item:
            item[
                "recommendation_score"
            ],
        reverse=True
    )

    return {
        "success": True,
        "reason": None,

        "message": (
            "Behavior-aware recommendations "
            "generated successfully."
        ),

        "model":
            "ALS_WRMF",

        "user_id":
            user_id,

        "recommendations":
            recommendations[:limit],
    }


# =========================================
# MODEL INFORMATION
# =========================================

def get_model_information():
    interactions = (
        load_interaction_data()
    )

    matrix_data = (
        build_user_event_matrix(
            interactions
        )
    )

    if not matrix_data:
        return {
            "users": 0,
            "events": 0,
            "interaction_pairs": 0,
            "ready_for_training": False,

            "minimum_users": 2,
            "minimum_events": 3,
            "minimum_interaction_pairs": 5,
        }

    matrix = matrix_data[
        "matrix"
    ]

    return {
        "users":
            matrix.shape[0],

        "events":
            matrix.shape[1],

        "interaction_pairs":
            matrix.nnz,

        "ready_for_training":
            has_enough_training_data(
                matrix_data
            ),

        "minimum_users": 2,
        "minimum_events": 3,
        "minimum_interaction_pairs": 5,

        "factors":
            ALS_FACTORS,

        "regularization":
            ALS_REGULARIZATION,

        "iterations":
            ALS_ITERATIONS,
    }