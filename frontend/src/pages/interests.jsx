import { useEffect, useState } from "react";
import "../styles/interests.css";

function Interests({ user, onBack }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  /* =========================
     LOAD CATEGORIES + USER INTERESTS
  ========================= */

  useEffect(() => {
    const loadInterests = async () => {
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        const [categoriesResponse, preferencesResponse] =
          await Promise.all([
            fetch(
              "http://127.0.0.1:5000/api/preferences/categories"
            ),

            fetch(
              `http://127.0.0.1:5000/api/preferences/user/${user.user_id}`
            ),
          ]);

        const categoriesData =
          await categoriesResponse.json();

        const preferencesData =
          await preferencesResponse.json();

        if (!categoriesResponse.ok) {
          throw new Error(
            categoriesData.message ||
              "Could not load event categories."
          );
        }

        /* =========================
           SUPPORT COMMON RESPONSE SHAPES
        ========================= */

        const categoryList = Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData.categories || [];

        setCategories(categoryList);

        const preferenceList = Array.isArray(preferencesData)
          ? preferencesData
          : preferencesData.preferences ||
            preferencesData.category_ids ||
            [];

        const ids = preferenceList
          .map((item) => {
            if (typeof item === "number") {
              return item;
            }

            return (
              item.category_id ??
              item.id ??
              null
            );
          })
          .filter((id) => id !== null);

        setSelectedCategoryIds(ids);
      } catch (error) {
        console.error(
          "Could not load interests:",
          error
        );

        setMessage(
          error.message ||
            "Could not load your interests."
        );

        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    loadInterests();
  }, [user]);

  /* =========================
     TOGGLE CATEGORY
  ========================= */

  const toggleCategory = (categoryId) => {
    setMessage("");
    setMessageType("");

    setSelectedCategoryIds((current) => {
      if (current.includes(categoryId)) {
        return current.filter(
          (id) => id !== categoryId
        );
      }

      return [...current, categoryId];
    });
  };

  /* =========================
     SAVE INTERESTS
  ========================= */

  const saveInterests = async () => {
    if (!user?.user_id) {
      setMessage(
        "Student account information is missing."
      );
      setMessageType("error");
      return;
    }

    if (selectedCategoryIds.length === 0) {
      setMessage(
        "Choose at least one interest."
      );
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/preferences/save",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            user_id: user.user_id,
            category_ids: selectedCategoryIds,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Could not save interests."
        );
      }

      setMessage(
        "Your interests have been updated. Your recommendations will now use these preferences."
      );

      setMessageType("success");
    } catch (error) {
      console.error(
        "Could not save interests:",
        error
      );

      setMessage(
        error.message ||
          "Could not save your interests."
      );

      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="interests-page">
        <div className="interests-shell">
          <p>Loading your interests...</p>
        </div>
      </div>
    );
  }

  /* =========================
     PAGE
  ========================= */

  return (
    <div className="interests-page">
      <div className="interests-shell">

        <button
          type="button"
          className="interests-back"
          onClick={onBack}
        >
          ← Back to dashboard
        </button>

        <div className="interests-heading">
          <span className="interests-label">
            PERSONALIZATION
          </span>

          <h1>My Interests</h1>

          <p>
            Choose the types of events you want Eventeye
            to prioritize in your recommendations.
          </p>
        </div>

        {message && (
          <div
            className={`interests-message ${messageType}`}
          >
            {message}
          </div>
        )}

        <div className="interests-grid">
          {categories.map((category) => {
            const categoryId =
              category.category_id ??
              category.id;

            const categoryName =
              category.category_name ??
              category.name;

            const isSelected =
              selectedCategoryIds.includes(
                categoryId
              );

            return (
              <button
                key={categoryId}
                type="button"
                className={`interest-choice ${
                  isSelected ? "selected" : ""
                }`}
                onClick={() =>
                  toggleCategory(categoryId)
                }
              >
                <div className="interest-choice-top">

                  <div className="interest-choice-icon">
                    {getCategoryIcon(
                      categoryName
                    )}
                  </div>

                  <div
                    className={`interest-check ${
                      isSelected
                        ? "selected"
                        : ""
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </div>

                </div>

                <h3>{categoryName}</h3>

                <p>
                  {getCategoryDescription(
                    categoryName
                  )}
                </p>
              </button>
            );
          })}
        </div>

        {categories.length === 0 && (
          <div className="interests-empty">
            No event categories are available.
          </div>
        )}

        <div className="interests-footer">

          <div>
            <strong>
              {selectedCategoryIds.length}
            </strong>{" "}
            selected
          </div>

          <div className="interests-footer-actions">

            <button
              type="button"
              className="interests-cancel"
              onClick={onBack}
            >
              Cancel
            </button>

            <button
              type="button"
              className="interests-save"
              onClick={saveInterests}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Interests"}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}

/* =========================
   CATEGORY ICONS
========================= */

function getCategoryIcon(category) {
  const icons = {
    "Social & Entertainment": "🎉",
    "Sports & Fitness": "🏀",
    "Academic & Educational": "📚",
    "Career & Professional": "💼",
    "Arts & Culture": "🎨",
    "Technology & Innovation": "💻",
    "Clubs & Societies": "👥",
    "Wellness & Lifestyle": "🌿",
    "Community & Volunteering": "🤝",
    "Faith & Spirituality": "✨",
  };

  return icons[category] || "📅";
}

/* =========================
   CATEGORY DESCRIPTIONS
========================= */

function getCategoryDescription(category) {
  const descriptions = {
    "Social & Entertainment":
      "Campus socials, performances and entertainment.",

    "Sports & Fitness":
      "Sports activities, games and fitness sessions.",

    "Academic & Educational":
      "Learning sessions, talks and academic events.",

    "Career & Professional":
      "Career fairs, networking and professional growth.",

    "Arts & Culture":
      "Creative showcases, culture and artistic experiences.",

    "Technology & Innovation":
      "Technology events, innovation and digital communities.",

    "Clubs & Societies":
      "Student clubs, societies and campus communities.",

    "Wellness & Lifestyle":
      "Wellbeing, lifestyle and personal development.",

    "Community & Volunteering":
      "Service, volunteering and community initiatives.",

    "Faith & Spirituality":
      "Faith-based events and spiritual communities.",
  };

  return (
    descriptions[category] ||
    "Discover events that match this interest."
  );
}

export default Interests;