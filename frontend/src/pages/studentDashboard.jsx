import { useEffect, useState } from "react";
import Logo from "../components/logo";
import "../styles/studentDashboard.css";

function StudentDashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedEventIds, setSavedEventIds] = useState([]);
  const [activeView, setActiveView] = useState("home");

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await fetch(
          "http://127.0.0.1:5000/api/events/"
        );

        const data = await response.json();

        if (response.ok) {
          setEvents(data);
        } else {
          console.error("Could not load events:", data);
        }
      } catch (error) {
        console.error("Server connection error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  useEffect(() => {
    const loadBookmarks = async () => {
      if (!user?.user_id) return;

      try {
        const response = await fetch(
          `http://127.0.0.1:5000/api/bookmarks/${user.user_id}`
        );

        const data = await response.json();

        if (response.ok) {
          setSavedEventIds(
            data.map((bookmark) => bookmark.event_id)
          );
        }
      } catch (error) {
        console.error("Could not load bookmarks:", error);
      }
    };

    loadBookmarks();
  }, [user]);

  const toggleBookmark = async (eventId) => {
    if (!user?.user_id) return;

    const isSaved = savedEventIds.includes(eventId);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/bookmarks/",
        {
          method: isSaved ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.user_id,
            event_id: eventId,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSavedEventIds((current) =>
          isSaved
            ? current.filter((id) => id !== eventId)
            : [...current, eventId]
        );
      } else {
        console.error("Bookmark error:", data);
      }
    } catch (error) {
      console.error("Bookmark request failed:", error);
    }
  };

  const interests = [
    "All",
    "Social",
    "Sports",
    "Academic",
    "Career",
    "Arts",
    "Technology",
    "Wellness",
    "Community",
    "Faith",
  ];

  const featuredEvent =
    events.length > 0 ? events[0] : null;

  const recommendedEvents =
    events.slice(1, 4);

  const savedEvents =
    events.filter((event) =>
      savedEventIds.includes(event.event_id)
    );

  return (
    <div className="student-layout">
      <aside className="student-sidebar">
        <Logo compact />

        <nav className="student-nav">
          <button
            className={
              activeView === "home" ? "active" : ""
            }
            onClick={() => setActiveView("home")}
          >
            🏠 Home
          </button>

          <button>
            ✨ For You
          </button>

          <button>
            🔎 Explore
          </button>

          <button>
            📅 My Events
          </button>

          <button
            className={
              activeView === "saved" ? "active" : ""
            }
            onClick={() => setActiveView("saved")}
          >
            ♥ Saved
          </button>

          <button>
            🎯 Interests
          </button>

          <button>
            👤 Profile
          </button>
        </nav>

        <div className="interest-note">
          <strong>
            Your interests power better recommendations ✨
          </strong>
        </div>
      </aside>

      <main className="student-main">
        <header className="student-header">
          <div>
            <h1>
              Hi {user?.full_name || "Student"} 👋
            </h1>

            <p>
              Here’s what’s happening on campus today.
            </p>
          </div>

          <div className="header-actions">
            <input
              type="text"
              placeholder="Search events, clubs, or topics..."
            />

            <button className="notification-btn">
              🔔
            </button>

            <div className="profile-circle">
              {user?.full_name?.charAt(0) || "S"}
            </div>
          </div>
        </header>

        <section className="interest-row">
          {interests.map((interest, index) => (
            <button
              key={interest}
              className={
                index === 0 ? "active-interest" : ""
              }
            >
              <span>
                {getInterestIcon(interest)}
              </span>

              {interest}
            </button>
          ))}
        </section>

        {loading ? (
          <p>Loading events...</p>
        ) : activeView === "saved" ? (
          <section className="events-section">
            <div className="section-title">
              <div>
                <h2>Saved Events</h2>

                <p>
                  Events you bookmarked for later.
                </p>
              </div>
            </div>

            {savedEvents.length === 0 ? (
              <div className="empty-saved-state">
                <div className="empty-saved-icon">
                  ♡
                </div>

                <h3>No saved events yet</h3>

                <p>
                  Tap the heart on an event you like and
                  it will appear here.
                </p>

                <button
                  onClick={() =>
                    setActiveView("home")
                  }
                >
                  Explore Events
                </button>
              </div>
            ) : (
              <div className="event-card-grid">
                {savedEvents.map((event) => (
                  <div
                    className="event-card"
                    key={event.event_id}
                  >
                    <div className="event-image-placeholder">
                      <span>
                        {getCategoryIcon(
                          event.category_name
                        )}
                      </span>

                      <button
                        onClick={() =>
                          toggleBookmark(
                            event.event_id
                          )
                        }
                      >
                        ♥
                      </button>
                    </div>

                    <div className="event-card-content">
                      <span className="event-category">
                        {event.category_name}
                      </span>

                      <h3>
                        {event.event_name}
                      </h3>

                      <p>
                        📅{" "}
                        {formatDate(
                          event.event_date
                        )}
                      </p>

                      <p>
                        📍 {event.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : events.length === 0 ? (
          <p>No upcoming events available yet.</p>
        ) : (
          <>
            <section className="dashboard-top-grid">
              {featuredEvent && (
                <div className="featured-event">
                  <div className="featured-overlay">
                    <span className="featured-small">
                      YOUR WEEKEND STARTS HERE
                    </span>

                    <h2>
                      {featuredEvent.event_name}
                    </h2>

                    <p>
                      {featuredEvent.description}
                    </p>

                    <p>
                      📍 {featuredEvent.location}
                    </p>

                    <button>
                      View Event
                    </button>
                  </div>

                  <div className="featured-date">
                    <strong>
                      {getDay(
                        featuredEvent.event_date
                      )}
                    </strong>

                    <span>
                      {getMonth(
                        featuredEvent.event_date
                      )}
                    </span>
                  </div>
                </div>
              )}

              <div className="recommended-panel">
                <div className="section-title">
                  <h2>
                    Recommended for You
                  </h2>

                  <button>
                    View All →
                  </button>
                </div>

                {recommendedEvents.map(
                  (event) => (
                    <div
                      className="recommended-item"
                      key={event.event_id}
                    >
                      <div className="recommended-icon">
                        {getCategoryIcon(
                          event.category_name
                        )}
                      </div>

                      <div className="recommended-info">
                        <h3>
                          {event.event_name}
                        </h3>

                        <p>
                          {formatDate(
                            event.event_date
                          )}
                          {" · "}
                          {event.location}
                        </p>
                      </div>

                      <button
                        className="heart-btn"
                        onClick={() =>
                          toggleBookmark(
                            event.event_id
                          )
                        }
                      >
                        {savedEventIds.includes(
                          event.event_id
                        )
                          ? "♥"
                          : "♡"}
                      </button>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="events-section">
              <div className="section-title">
                <div>
                  <h2>
                    Events for You
                  </h2>

                  <p>
                    Discover upcoming events
                    across campus.
                  </p>
                </div>

                <button>
                  View All →
                </button>
              </div>

              <div className="event-card-grid">
                {events.map((event) => (
                  <div
                    className="event-card"
                    key={event.event_id}
                  >
                    <div className="event-image-placeholder">
                      <span>
                        {getCategoryIcon(
                          event.category_name
                        )}
                      </span>

                      <button
                        onClick={() =>
                          toggleBookmark(
                            event.event_id
                          )
                        }
                      >
                        {savedEventIds.includes(
                          event.event_id
                        )
                          ? "♥"
                          : "♡"}
                      </button>
                    </div>

                    <div className="event-card-content">
                      <span className="event-category">
                        {event.category_name}
                      </span>

                      <h3>
                        {event.event_name}
                      </h3>

                      <p>
                        📅{" "}
                        {formatDate(
                          event.event_date
                        )}
                      </p>

                      <p>
                        📍 {event.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function formatDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function getDay(date) {
  if (!date) return "";

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
    }
  );
}

function getMonth(date) {
  if (!date) return "";

  return new Date(date)
    .toLocaleDateString(
      "en-GB",
      {
        month: "short",
      }
    )
    .toUpperCase();
}

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

function getInterestIcon(interest) {
  const icons = {
    All: "✨",
    Social: "🎉",
    Sports: "🏀",
    Academic: "📚",
    Career: "💼",
    Arts: "🎨",
    Technology: "💻",
    Wellness: "🌿",
    Community: "🤝",
    Faith: "⭐",
  };

  return icons[interest] || "✨";
}

export default StudentDashboard;
