"""
Eventeye ALS/WRMF Offline Evaluation
------------------------------------
Evaluates the recommendation model using a temporal leave-one-out split.

Metrics:
- Precision@5
- Recall@5
- Precision@10
- Recall@10
- HitRate@5 / HitRate@10
- Catalogue Coverage@5 / @10
- Eligible users
- Cold-start users
- Dataset counts and density

Run from the project root:
    source .venv/Scripts/activate
    python evaluate_recommender.py

The script reads PostgreSQL connection settings from the existing project .env.
"""

import os
from collections import defaultdict
from pathlib import Path

import numpy as np
import psycopg
from dotenv import load_dotenv
from scipy.sparse import csr_matrix

try:
    from implicit.als import AlternatingLeastSquares
except ImportError:
    raise SystemExit(
        "\nERROR: Python package 'implicit' is not installed in this environment.\n"
        "Install it with:\n"
        "    pip install implicit\n"
        "Then rerun:\n"
        "    python evaluate_recommender.py\n"
    )


# ---------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------

FACTORS = 20
ITERATIONS = 20
REGULARIZATION = 0.1
K_VALUES = (5, 10)

# A user must have at least this many DISTINCT interacted events to
# participate in temporal holdout evaluation. Users below this threshold
# are counted as cold-start / insufficient-history users.
MIN_EVENTS_FOR_EVALUATION = 3


# ---------------------------------------------------------------------
# DATABASE CONNECTION
# ---------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")


def connect_db():
    """
    Supports common .env naming styles.
    If DATABASE_URL is available it is preferred.
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg.connect(database_url)

    dbname = (
        os.getenv("DB_NAME")
        or os.getenv("POSTGRES_DB")
        or os.getenv("DATABASE_NAME")
    )
    user = (
        os.getenv("DB_USER")
        or os.getenv("POSTGRES_USER")
        or os.getenv("DATABASE_USER")
    )
    password = (
        os.getenv("DB_PASSWORD")
        or os.getenv("POSTGRES_PASSWORD")
        or os.getenv("DATABASE_PASSWORD")
    )
    host = (
        os.getenv("DB_HOST")
        or os.getenv("POSTGRES_HOST")
        or os.getenv("DATABASE_HOST")
        or "localhost"
    )
    port = (
        os.getenv("DB_PORT")
        or os.getenv("POSTGRES_PORT")
        or os.getenv("DATABASE_PORT")
        or "5432"
    )

    if not dbname or not user:
        raise SystemExit(
            "\nCould not determine PostgreSQL settings from .env.\n"
            "The script looked for DATABASE_URL or DB_NAME/DB_USER/DB_PASSWORD.\n"
            "Do NOT send me your password. If this happens, paste only the variable NAMES "
            "from your .env, not their values.\n"
        )

    return psycopg.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port,
    )


# ---------------------------------------------------------------------
# DATA EXTRACTION
# ---------------------------------------------------------------------

def load_interactions(conn):
    """
    Returns one row per raw interaction:
        user_id, event_id, confidence_weight, timestamp

    Only interactions linked to an event are used.
    """
    sql = """
        SELECT
            i.user_id,
            i.event_id,
            i.confidence_weight,
            i.timestamp
        FROM interactions i
        WHERE i.event_id IS NOT NULL
          AND i.confidence_weight IS NOT NULL
        ORDER BY i.user_id, i.timestamp, i.interaction_id
    """

    with conn.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


# ---------------------------------------------------------------------
# TEMPORAL SPLIT
# ---------------------------------------------------------------------

def build_temporal_split(rows):
    """
    Aggregates repeated actions on the same user-event pair.

    For each eligible user:
      - latest DISTINCT event becomes the test item
      - all earlier distinct events remain in training

    This reflects the project's goal of predicting a future event
    preference from previous behavior and avoids random temporal leakage.
    """
    by_user_event = defaultdict(lambda: defaultdict(lambda: {
        "weight": 0.0,
        "last_timestamp": None
    }))

    for user_id, event_id, confidence_weight, timestamp in rows:
        rec = by_user_event[user_id][event_id]
        rec["weight"] += float(confidence_weight)
        if rec["last_timestamp"] is None or timestamp > rec["last_timestamp"]:
            rec["last_timestamp"] = timestamp

    eligible = {}
    cold_start = {}

    for user_id, events in by_user_event.items():
        ordered = sorted(
            events.items(),
            key=lambda kv: kv[1]["last_timestamp"]
        )

        if len(ordered) < MIN_EVENTS_FOR_EVALUATION:
            cold_start[user_id] = ordered
            continue

        test_event_id, test_meta = ordered[-1]
        train_events = ordered[:-1]

        eligible[user_id] = {
            "train": train_events,
            "test_event_id": test_event_id,
            "test_weight": test_meta["weight"],
        }

    return by_user_event, eligible, cold_start


# ---------------------------------------------------------------------
# MATRIX + ALS
# ---------------------------------------------------------------------

def build_matrix(eligible):
    user_ids = sorted(eligible.keys())

    all_event_ids = sorted({
        event_id
        for user_id in user_ids
        for event_id, meta in eligible[user_id]["train"]
    } | {
        eligible[user_id]["test_event_id"]
        for user_id in user_ids
    })

    user_to_idx = {u: idx for idx, u in enumerate(user_ids)}
    event_to_idx = {e: idx for idx, e in enumerate(all_event_ids)}
    idx_to_event = {idx: e for e, idx in event_to_idx.items()}

    rows = []
    cols = []
    data = []

    for user_id, split in eligible.items():
        uidx = user_to_idx[user_id]
        for event_id, meta in split["train"]:
            rows.append(uidx)
            cols.append(event_to_idx[event_id])
            # Confidence is already represented in the project's stored weight.
            data.append(float(meta["weight"]))

    matrix = csr_matrix(
        (np.asarray(data, dtype=np.float32), (rows, cols)),
        shape=(len(user_ids), len(all_event_ids)),
        dtype=np.float32,
    )

    return matrix, user_to_idx, event_to_idx, idx_to_event


def train_model(user_items):
    print("\nTraining ALS/WRMF...")
    model = AlternatingLeastSquares(
        factors=FACTORS,
        regularization=REGULARIZATION,
        iterations=ITERATIONS,
        random_state=42,
    )
    model.fit(user_items, show_progress=False)
    return model


# ---------------------------------------------------------------------
# METRICS
# ---------------------------------------------------------------------

def evaluate(model, user_items, eligible, user_to_idx, event_to_idx, idx_to_event):
    results = {}

    for k in K_VALUES:
        precision_values = []
        recall_values = []
        hits = []
        recommended_catalogue = set()

        for user_id, split in eligible.items():
            uidx = user_to_idx[user_id]
            test_event_id = split["test_event_id"]

            # If the held-out event was never represented anywhere in the
            # matrix, it cannot be scored by collaborative filtering.
            if test_event_id not in event_to_idx:
                continue

            available = user_items.shape[1]
            n = min(k, available)

            ids, scores = model.recommend(
                uidx,
                user_items[uidx],
                N=n,
                filter_already_liked_items=True,
            )

            recommended_event_ids = [
                idx_to_event[int(item_idx)] for item_idx in ids
            ]

            recommended_catalogue.update(recommended_event_ids)

            hit = 1 if test_event_id in recommended_event_ids else 0

            # One held-out relevant event per user:
            # precision@k = hit / k
            # recall@k = hit / 1
            precision_values.append(hit / float(k))
            recall_values.append(float(hit))
            hits.append(float(hit))

        precision = float(np.mean(precision_values)) if precision_values else 0.0
        recall = float(np.mean(recall_values)) if recall_values else 0.0
        hit_rate = float(np.mean(hits)) if hits else 0.0

        catalogue_size = user_items.shape[1]
        coverage = (
            len(recommended_catalogue) / catalogue_size
            if catalogue_size else 0.0
        )

        results[k] = {
            "precision": precision,
            "recall": recall,
            "hit_rate": hit_rate,
            "coverage": coverage,
            "unique_recommended": len(recommended_catalogue),
            "catalogue_size": catalogue_size,
        }

    return results


# ---------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------

def main():
    print("=" * 68)
    print("EVENTEYE — ALS/WRMF OFFLINE EVALUATION")
    print("=" * 68)

    with connect_db() as conn:
        rows = load_interactions(conn)

    if not rows:
        raise SystemExit("No usable rows found in the interactions table.")

    raw_users = len({r[0] for r in rows})
    raw_events = len({r[1] for r in rows})
    raw_rows = len(rows)

    by_user_event, eligible, cold_start = build_temporal_split(rows)

    distinct_pairs = sum(len(events) for events in by_user_event.values())
    possible_pairs = raw_users * raw_events
    density = distinct_pairs / possible_pairs if possible_pairs else 0.0
    sparsity = 1.0 - density

    print("\nDATASET SUMMARY")
    print("-" * 68)
    print(f"Raw interaction rows           : {raw_rows}")
    print(f"Distinct users                 : {raw_users}")
    print(f"Distinct events                : {raw_events}")
    print(f"Distinct user-event pairs      : {distinct_pairs}")
    print(f"Interaction matrix density     : {density:.4f} ({density*100:.2f}%)")
    print(f"Interaction matrix sparsity    : {sparsity:.4f} ({sparsity*100:.2f}%)")
    print(f"Evaluation users (>=3 events)  : {len(eligible)}")
    print(f"Cold-start/insufficient users  : {len(cold_start)}")

    if len(eligible) < 2:
        raise SystemExit(
            "\nNot enough eligible users for a meaningful offline evaluation.\n"
            "At least 2 users with 3+ distinct event interactions are recommended."
        )

    user_items, user_to_idx, event_to_idx, idx_to_event = build_matrix(eligible)

    print("\nTEMPORAL HOLDOUT")
    print("-" * 68)
    print("Method                         : leave-latest-event-out per user")
    print(f"Training users                 : {user_items.shape[0]}")
    print(f"Model catalogue events         : {user_items.shape[1]}")
    print(f"Training non-zero pairs        : {user_items.nnz}")

    model = train_model(user_items)

    metrics = evaluate(
        model,
        user_items,
        eligible,
        user_to_idx,
        event_to_idx,
        idx_to_event,
    )

    print("\nEVALUATION RESULTS")
    print("-" * 68)

    for k in K_VALUES:
        m = metrics[k]
        print(f"Precision@{k:<2}                  : {m['precision']:.4f}")
        print(f"Recall@{k:<2}                     : {m['recall']:.4f}")
        print(f"HitRate@{k:<2}                    : {m['hit_rate']:.4f}")
        print(
            f"Catalogue Coverage@{k:<2}         : "
            f"{m['coverage']:.4f} ({m['coverage']*100:.2f}%)"
        )
        print()

    total_users = len(eligible) + len(cold_start)
    fallback_rate = len(cold_start) / total_users if total_users else 0.0

    print(f"Cold-start fallback rate       : {fallback_rate:.4f} ({fallback_rate*100:.2f}%)")

    print("\nMODEL CONFIGURATION")
    print("-" * 68)
    print("Algorithm                      : ALS / WRMF")
    print(f"Latent factors                 : {FACTORS}")
    print(f"Iterations                     : {ITERATIONS}")
    print(f"Regularization                 : {REGULARIZATION}")
    print("Random seed                    : 42")

    print("\nCHAPTER 5 TABLE VALUES")
    print("-" * 68)
    print(f"Precision@5  = {metrics[5]['precision']:.4f}")
    print(f"Recall@5     = {metrics[5]['recall']:.4f}")
    print(f"Precision@10 = {metrics[10]['precision']:.4f}")
    print(f"Recall@10    = {metrics[10]['recall']:.4f}")
    print(f"Coverage@5   = {metrics[5]['coverage']:.4f}")
    print(f"Coverage@10  = {metrics[10]['coverage']:.4f}")
    print(f"Cold-start fallback rate = {fallback_rate:.4f}")

    print("\nDone.")


if __name__ == "__main__":
    main()
