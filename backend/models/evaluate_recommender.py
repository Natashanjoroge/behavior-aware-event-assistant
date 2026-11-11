import os
import pandas as pd


# ==============================
# CONFIG
# ==============================

PROJECT_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        ".."
    )
)

DATASET_PATH = os.path.join(
    PROJECT_ROOT,
    "data",
    "eventEyedemo.xlsx"
)

SHEET_NAME = "Eventeye Interactions"
TOP_K = 5


# ==============================
# LOAD DATASET
# ==============================

def load_dataset():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(
            f"Dataset not found: {DATASET_PATH}"
        )

    df = pd.read_excel(
        DATASET_PATH,
        sheet_name=SHEET_NAME,
        engine="openpyxl"
    )

    required_columns = [
        "User ID",
        "Event ID",
        "Event Name",
        "Category",
        "Eventeye Interaction",
        "Weight",
        "Timestamp",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Dataset is missing columns: "
            + ", ".join(missing_columns)
        )

    df["Weight"] = pd.to_numeric(
        df["Weight"],
        errors="coerce"
    ).fillna(0)

    df["Timestamp"] = pd.to_datetime(
        df["Timestamp"],
        errors="coerce"
    )

    df = df.dropna(
        subset=[
            "User ID",
            "Event ID",
            "Category",
        ]
    )

    return df


# ==============================
# DATASET SUMMARY
# ==============================

def print_dataset_summary(df):
    print("\n" + "=" * 60)
    print("EVENTEYE RECOMMENDATION DATASET")
    print("=" * 60)

    print(
        f"Users: {df['User ID'].nunique()}"
    )

    print(
        f"Events: {df['Event ID'].nunique()}"
    )

    print(
        f"Interactions: {len(df)}"
    )

    print("\nInteraction Types:")

    interaction_counts = (
        df["Eventeye Interaction"]
        .value_counts()
    )

    for interaction, count in interaction_counts.items():
        print(
            f"  {interaction}: {count}"
        )


# ==============================
# TRAIN / TEST SPLIT
# ==============================

def create_train_test_split(df):
    train_rows = []
    test_rows = []

    for user_id, group in df.groupby("User ID"):
        group = group.sort_values(
            "Timestamp"
        )

        positive_group = group[
            group["Weight"] > 0
        ]

        if len(positive_group) < 2:
            train_rows.append(group)
            continue

        test_index = (
            positive_group.index[-1]
        )

        test_rows.append(
            df.loc[[test_index]]
        )

        train_rows.append(
            group.drop(
                index=test_index
            )
        )

    train_df = pd.concat(
        train_rows,
        ignore_index=True
    )

    if test_rows:
        test_df = pd.concat(
            test_rows,
            ignore_index=True
        )
    else:
        test_df = pd.DataFrame(
            columns=df.columns
        )

    return train_df, test_df


# ==============================
# USER CATEGORY AFFINITY
# ==============================

def build_user_affinity(train_df):
    return (
        train_df
        .groupby(
            [
                "User ID",
                "Category",
            ]
        )["Weight"]
        .sum()
        .reset_index(
            name="User Affinity"
        )
    )


# ==============================
# EVENT POPULARITY
# ==============================

def build_event_popularity(train_df):
    return (
        train_df
        .groupby(
            [
                "Event ID",
                "Event Name",
                "Category",
            ]
        )["Weight"]
        .sum()
        .reset_index(
            name="Popularity"
        )
    )


# ==============================
# RECOMMENDATIONS
# ==============================

def recommend_for_user(
    user_id,
    train_df,
    top_k=TOP_K
):
    event_popularity = (
        build_event_popularity(
            train_df
        )
    )

    affinity = (
        build_user_affinity(
            train_df
        )
    )

    user_affinity = affinity[
        affinity["User ID"] == user_id
    ][
        [
            "Category",
            "User Affinity",
        ]
    ]

    recommendations = (
        event_popularity.merge(
            user_affinity,
            on="Category",
            how="left"
        )
    )

    recommendations[
        "User Affinity"
    ] = recommendations[
        "User Affinity"
    ].fillna(0)

    seen_events = set(
        train_df[
            train_df["User ID"] == user_id
        ]["Event ID"]
    )

    recommendations = (
        recommendations[
            ~recommendations[
                "Event ID"
            ].isin(
                seen_events
            )
        ]
        .copy()
    )

    if recommendations.empty:
        return recommendations

    max_popularity = (
        recommendations[
            "Popularity"
        ].max()
    )

    max_affinity = (
        recommendations[
            "User Affinity"
        ].max()
    )

    if max_popularity > 0:
        recommendations[
            "Popularity Normalized"
        ] = (
            recommendations[
                "Popularity"
            ]
            / max_popularity
        )
    else:
        recommendations[
            "Popularity Normalized"
        ] = 0

    if max_affinity > 0:
        recommendations[
            "Affinity Normalized"
        ] = (
            recommendations[
                "User Affinity"
            ]
            / max_affinity
        )
    else:
        recommendations[
            "Affinity Normalized"
        ] = 0

    recommendations[
        "Recommendation Score"
    ] = (
        recommendations[
            "Affinity Normalized"
        ] * 0.60
        +
        recommendations[
            "Popularity Normalized"
        ] * 0.40
    )

    recommendations = (
        recommendations
        .sort_values(
            "Recommendation Score",
            ascending=False
        )
        .head(top_k)
        .reset_index(drop=True)
    )

    recommendations["Rank"] = (
        recommendations.index + 1
    )

    return recommendations


# ==============================
# EVALUATION
# ==============================

def evaluate_model(
    train_df,
    test_df,
    top_k=TOP_K
):
    precision_scores = []
    recall_scores = []

    users_evaluated = 0

    for _, test_row in test_df.iterrows():
        user_id = (
            test_row["User ID"]
        )

        actual_event = (
            test_row["Event ID"]
        )

        recommendations = (
            recommend_for_user(
                user_id,
                train_df,
                top_k
            )
        )

        if recommendations.empty:
            continue

        predicted_events = (
            recommendations[
                "Event ID"
            ].tolist()
        )

        hit = (
            1
            if actual_event in predicted_events
            else 0
        )

        precision_scores.append(
            hit / top_k
        )

        recall_scores.append(
            hit
        )

        users_evaluated += 1

    if users_evaluated == 0:
        return {
            "precision": 0,
            "recall": 0,
            "users_evaluated": 0,
        }

    return {
        "precision":
            sum(precision_scores)
            / len(precision_scores),

        "recall":
            sum(recall_scores)
            / len(recall_scores),

        "users_evaluated":
            users_evaluated,
    }


# ==============================
# PRINT RECOMMENDATIONS
# ==============================

def print_demo_recommendations(
    train_df,
    user_id
):
    recommendations = (
        recommend_for_user(
            user_id,
            train_df,
            TOP_K
        )
    )

    print("\n" + "=" * 60)
    print(
        f"TOP {TOP_K} RECOMMENDATIONS FOR {user_id}"
    )
    print("=" * 60)

    if recommendations.empty:
        print(
            "No recommendations available."
        )
        return

    for _, row in recommendations.iterrows():
        print(
            f"\n{int(row['Rank'])}. "
            f"{row['Event Name']}"
        )

        print(
            f"   Category: "
            f"{row['Category']}"
        )

        print(
            f"   Score: "
            f"{row['Recommendation Score']:.3f}"
        )

        print(
            f"   Category affinity: "
            f"{row['User Affinity']:.1f}"
        )

        print(
            f"   Event popularity: "
            f"{row['Popularity']:.1f}"
        )


# ==============================
# MAIN
# ==============================

def main():
    print(
        "\nLoading Eventeye recommendation dataset..."
    )

    df = load_dataset()

    print_dataset_summary(
        df
    )

    train_df, test_df = (
        create_train_test_split(
            df
        )
    )

    print("\n" + "=" * 60)
    print("TRAIN / TEST SPLIT")
    print("=" * 60)

    print(
        f"Training interactions: "
        f"{len(train_df)}"
    )

    print(
        f"Test interactions: "
        f"{len(test_df)}"
    )

    results = evaluate_model(
        train_df,
        test_df,
        TOP_K
    )

    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    print(
        f"Users evaluated: "
        f"{results['users_evaluated']}"
    )

    print(
        f"Precision@{TOP_K}: "
        f"{results['precision']:.3f}"
    )

    print(
        f"Recall@{TOP_K}: "
        f"{results['recall']:.3f}"
    )

    print_demo_recommendations(
        train_df,
        "U006"
    )

    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)

    print(
        "\nEventeye successfully processed "
        "the dataset, generated recommendations "
        "and calculated evaluation metrics.\n"
    )


if __name__ == "__main__":
    main()