import { useEffect, useState } from "react";
import Logo from "../components/logo";
import "../styles/onboarding.css";

function Onboarding({ user, onComplete }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(
          "http://127.0.0.1:5000/api/preferences/categories"
        );

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Could not load event categories.");
          return;
        }

        setCategories(data);
      } catch {
        setMessage("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const toggleCategory = (categoryId) => {
    setSelected((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const handleContinue = async () => {
    setMessage("");

    if (selected.length === 0) {
      setMessage("Please choose at least one interest.");
      return;
    }

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
            category_ids: selected,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Could not save your interests.");
        return;
      }

      onComplete();
    } catch {
      setMessage("Could not connect to the server.");
    }
  };

  const categoryIcons = {
    "Social & Entertainment": "🎉",
    "Sports & Fitness": "🏃",
    "Academic & Educational": "📚",
    "Career & Professional": "💼",
    "Arts & Culture": "🎨",
    "Technology & Innovation": "💻",
    "Clubs & Societies": "👥",
    "Wellness & Lifestyle": "🌿",
    "Community & Volunteering": "🤝",
    "Faith & Spirituality": "✨",
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-shell">
        <Logo />

        <div className="onboarding-heading">
          <p className="eyebrow">PERSONALIZE YOUR EXPERIENCE</p>

          <h1>What are you interested in?</h1>

          <p>
            Choose the types of campus events you would like Eventeye to
            recommend to you. You can change these later.
          </p>
        </div>

        {loading ? (
          <p className="loading-text">Loading interests...</p>
        ) : (
          <div className="category-grid">
            {categories.map((category) => {
              const isSelected = selected.includes(category.category_id);

              return (
                <button
                  key={category.category_id}
                  type="button"
                  className={`category-card ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() =>
                    toggleCategory(category.category_id)
                  }
                >
                  <span className="category-icon">
                    {categoryIcons[category.category_name] || "✨"}
                  </span>

                  <span className="category-name">
                    {category.category_name}
                  </span>

                  {isSelected && (
                    <span className="selected-check">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {message && (
          <div className="onboarding-message">
            {message}
          </div>
        )}

        <button
          type="button"
          className="continue-button"
          onClick={handleContinue}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

export default Onboarding;