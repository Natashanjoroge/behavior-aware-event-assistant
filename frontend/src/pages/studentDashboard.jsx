import { useEffect, useMemo, useState } from "react";
import Logo from "../components/logo";
import EventDetails from "./eventDetails";
import MyEvents from "./myEvents";
import Interests from "./interests";
import StudentProfile from "./studentProfile";
import "../styles/studentDashboard.css";

const API = "http://127.0.0.1:5000";

const CATEGORIES = [
  { label: "All", databaseName: null },
  { label: "Social", databaseName: "Social & Entertainment" },
  { label: "Sports", databaseName: "Sports & Fitness" },
  { label: "Academic", databaseName: "Academic & Educational" },
  { label: "Career", databaseName: "Career & Professional" },
  { label: "Arts", databaseName: "Arts & Culture" },
  { label: "Technology", databaseName: "Technology & Innovation" },
  { label: "Clubs", databaseName: "Clubs & Societies" },
  { label: "Wellness", databaseName: "Wellness & Lifestyle" },
  { label: "Community", databaseName: "Community & Volunteering" },
  { label: "Faith", databaseName: "Faith & Spirituality" },
];

const CATEGORY_ICONS = {
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

const INTEREST_ICONS = {
  All: "✨",
  Social: "🎉",
  Sports: "🏀",
  Academic: "📚",
  Career: "💼",
  Arts: "🎨",
  Technology: "💻",
  Clubs: "👥",
  Wellness: "🌿",
  Community: "🤝",
  Faith: "⭐",
};

function parseEventDate(value) {
  if (!value) return null;

  const text = String(value);
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isUpcomingEvent(event) {
  if (!event) return false;

  const status = String(
    event.event_status ?? event.status ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    ["cancelled", "canceled", "completed", "past", "ended"].includes(
      status
    )
  ) {
    return false;
  }

  const eventDate = parseEventDate(event.event_date);

  if (!eventDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  eventDate.setHours(0, 0, 0, 0);

  return eventDate >= today;
}

function formatDate(value) {
  const date = parseEventDate(value);

  if (!date) return "";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDay(value) {
  const date = parseEventDate(value);

  if (!date) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
  });
}

function getMonth(value) {
  const date = parseEventDate(value);

  if (!date) return "";

  return date
    .toLocaleDateString("en-GB", {
      month: "short",
    })
    .toUpperCase();
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || "📅";
}

function getInterestIcon(category) {
  return INTEREST_ICONS[category] || "✨";
}

function StudentDashboard({ user, onLogout }) {
  const [events, setEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [savedEventIds, setSavedEventIds] = useState([]);

  const [activeView, setActiveView] = useState("home");

  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] =
    useState(true);

  const [recommendationType, setRecommendationType] = useState("");
  const [recommendationModel, setRecommendationModel] = useState("");

  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchMessage, setSearchMessage] = useState("");

  const loadEvents = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/events/`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not load events.");
      }

      setEvents(Array.isArray(data) ? data : data.events || []);
    } catch (error) {
      console.error("Could not load events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!user?.user_id) {
      setRecommendationLoading(false);
      return;
    }

    setRecommendationLoading(true);

    try {
      const response = await fetch(
        `${API}/api/recommendations/for-you/${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not load recommendations."
        );
      }

      setRecommendations(
        Array.isArray(data.events) ? data.events : []
      );

      setRecommendationType(data.recommendation_type || "");
      setRecommendationModel(data.recommendation_model || "");
    } catch (error) {
      console.error("Recommendation error:", error);
      setRecommendations([]);
    } finally {
      setRecommendationLoading(false);
    }
  };

  const loadBookmarks = async () => {
    if (!user?.user_id) return;

    try {
      const response = await fetch(
        `${API}/api/bookmarks/${user.user_id}`
      );

      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        setSavedEventIds(
          data.map((bookmark) => bookmark.event_id)
        );
      }
    } catch (error) {
      console.error("Bookmark loading error:", error);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadRecommendations();
    loadBookmarks();
  }, [user?.user_id]);

  const toggleBookmark = async (eventId) => {
    if (!user?.user_id) return;

    const isSaved = savedEventIds.includes(eventId);

    try {
      const response = await fetch(`${API}/api/bookmarks/`, {
        method: isSaved ? "DELETE" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          user_id: user.user_id,
          event_id: eventId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Bookmark error:", data);
        return;
      }

      setSavedEventIds((current) =>
        isSaved
          ? current.filter((id) => id !== eventId)
          : [...current, eventId]
      );

      if (!isSaved) {
        try {
          await fetch(`${API}/api/interactions/log`, {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              user_id: user.user_id,
              event_id: eventId,
              interaction_type: "BOOKMARK",
              session_id: null,
            }),
          });

          await loadRecommendations();
        } catch (error) {
          console.error(
            "Interaction logging error:",
            error
          );
        }
      }
    } catch (error) {
      console.error("Bookmark request failed:", error);
    }
  };

  const openEventDetails = (eventId) => {
    setSelectedEventId(eventId);
    setShowEventDetails(true);
  };

  const closeEventDetails = async () => {
    setSelectedEventId(null);
    setShowEventDetails(false);

    await Promise.all([
      loadEvents(),
      loadRecommendations(),
      loadBookmarks(),
    ]);
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();

    const query = searchQuery.trim();

    if (!query) {
      setSearchMessage("");
      return;
    }

    setActiveView("home");
    setSearchMessage(`Showing results for "${query}"`);

    if (!user?.user_id) return;

    try {
      await fetch(`${API}/api/interactions/log`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          user_id: user.user_id,
          event_id: null,
          interaction_type: "SEARCH",
          session_id: null,
        }),
      });
    } catch (error) {
      console.error("Search interaction error:", error);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSearchMessage("");
  };

  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter(isUpcomingEvent)
      .sort((a, b) => {
        const first =
          parseEventDate(a.event_date)?.getTime() ?? Infinity;

        const second =
          parseEventDate(b.event_date)?.getTime() ?? Infinity;

        return first - second;
      });
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const selected = CATEGORIES.find(
      (category) => category.label === selectedCategory
    );

    return upcomingEvents.filter((event) => {
      const matchesSearch =
        !query ||
        [
          event.event_name,
          event.description,
          event.location,
          event.category_name,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesCategory =
        selectedCategory === "All" ||
        event.category_name === selected?.databaseName;

      return matchesSearch && matchesCategory;
    });
  }, [upcomingEvents, searchQuery, selectedCategory]);

  const featuredEvent = filteredEvents[0] || null;

  const upcomingRecommendations = useMemo(() => {
    return recommendations.filter(isUpcomingEvent);
  }, [recommendations]);

  const homepageRecommendations =
    upcomingRecommendations.slice(0, 3);

  const savedEvents = events.filter((event) =>
    savedEventIds.includes(event.event_id)
  );

  if (showEventDetails && selectedEventId) {
    return (
      <EventDetails
        eventId={selectedEventId}
        user={user}
        onBack={closeEventDetails}
      />
    );
  }

  if (activeView === "my-events") {
    return (
      <MyEvents
        user={user}
        onBack={() => setActiveView("home")}
      />
    );
  }

  if (activeView === "interests") {
    return (
      <Interests
        user={user}
        onBack={async () => {
          setActiveView("home");
          await loadRecommendations();
        }}
      />
    );
  }

  return (
    <div className="student-layout">
      <aside className="student-sidebar">
        <Logo compact />

        <nav className="student-nav">
          <button
            type="button"
            className={activeView === "home" ? "active" : ""}
            onClick={() => setActiveView("home")}
          >
            🏠 Home
          </button>

          <button
            type="button"
            className={
              activeView === "for-you" ? "active" : ""
            }
            onClick={() => {
              setActiveView("for-you");
              loadRecommendations();
            }}
          >
            ✨ For You
          </button>

          <button
            type="button"
            onClick={() => {
              clearSearch();
              setActiveView("home");
            }}
          >
            🔎 Explore
          </button>

          <button
            type="button"
            className={
              activeView === "my-events" ? "active" : ""
            }
            onClick={() => setActiveView("my-events")}
          >
            📅 My Events
          </button>

          <button
            type="button"
            className={activeView === "saved" ? "active" : ""}
            onClick={() => setActiveView("saved")}
          >
            ♥ Saved
          </button>

          <button
            type="button"
            className={
              activeView === "interests" ? "active" : ""
            }
            onClick={() => setActiveView("interests")}
          >
            🎯 Interests
          </button>

          <button
            type="button"
            className={
              activeView === "profile" ? "active" : ""
            }
            onClick={() => setActiveView("profile")}
          >
            👤 Profile
          </button>

          <button
            type="button"
            onClick={onLogout}
          >
            ↪ Logout
          </button>
        </nav>

        <div className="interest-note">
          <strong>
            Fuel your feed with the things you love
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
              Tell us what you love, we’ll handle the rest.
            </p>
          </div>

          <div className="header-actions">
            <form
              className="student-search-form"
              onSubmit={handleSearchSubmit}
            >
              <input
                type="text"
                placeholder="Search events, topics or venues..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);

                  if (!event.target.value.trim()) {
                    setSearchMessage("");
                  }
                }}
              />

              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-button"
                  onClick={clearSearch}
                >
                  ✕
                </button>
              )}
            </form>

            <button
              type="button"
              className="profile-circle"
              onClick={() => setActiveView("profile")}
            >
              {user?.full_name?.charAt(0) || "S"}
            </button>
          </div>
        </header>

        {activeView === "home" && (
          <>
            <section className="interest-row">
              {CATEGORIES.map((category) => (
                <button
                  key={category.label}
                  type="button"
                  className={
                    selectedCategory === category.label
                      ? "active-interest"
                      : ""
                  }
                  onClick={() =>
                    setSelectedCategory(category.label)
                  }
                >
                  <span>
                    {getInterestIcon(category.label)}
                  </span>

                  {category.label}
                </button>
              ))}
            </section>

            {(searchQuery ||
              selectedCategory !== "All") && (
              <div className="student-filter-summary">
                <strong>
                  {filteredEvents.length} event
                  {filteredEvents.length === 1 ? "" : "s"} found
                </strong>

                <button
                  type="button"
                  onClick={clearSearch}
                >
                  Clear filters
                </button>
              </div>
            )}

            {searchMessage && (
              <p className="student-search-message">
                {searchMessage}
              </p>
            )}

            {loading ? (
              <p>Loading upcoming events...</p>
            ) : filteredEvents.length === 0 ? (
              <div className="empty-saved-state">
                <div className="empty-saved-icon">
                  🔎
                </div>

                <h3>
                  No upcoming events found
                </h3>

                <p>
                  Try another category or search for a different
                  event.
                </p>

                <button
                  type="button"
                  onClick={clearSearch}
                >
                  View All Events
                </button>
              </div>
            ) : (
              <>
                <section className="dashboard-top-grid">
                  {featuredEvent && (
                    <article className="feature-gradient-card">
                      <div className="feature-gradient-header">
                        <span className="feature-gradient-label">
                          DISCOVER SOMETHING NEW
                        </span>

                        <div className="feature-gradient-date">
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

                      <div className="feature-gradient-body">
                        <h2>
                          {featuredEvent.event_name}
                        </h2>

                        <p>
                          {featuredEvent.description}
                        </p>

                        <p>
                          📍 {featuredEvent.location}
                        </p>
                      </div>

                      <div className="feature-gradient-footer">
                        <button
                          type="button"
                          onClick={() =>
                            openEventDetails(
                              featuredEvent.event_id
                            )
                          }
                        >
                          View Event
                        </button>
                      </div>
                    </article>
                  )}

                  <div className="recommended-panel">
                    <div className="section-title">
                      <h2>
                        Recommended for You
                      </h2>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveView("for-you");
                          loadRecommendations();
                        }}
                      >
                        View All →
                      </button>
                    </div>

                    {recommendationLoading ? (
                      <p>
                        Personalizing your events...
                      </p>
                    ) : homepageRecommendations.length === 0 ? (
                      <p>
                        Keep exploring events to improve your
                        recommendations.
                      </p>
                    ) : (
                      homepageRecommendations.map((event) => (
                        <RecommendedItem
                          key={event.event_id}
                          event={event}
                          isSaved={savedEventIds.includes(
                            event.event_id
                          )}
                          onBookmark={toggleBookmark}
                          onOpen={openEventDetails}
                        />
                      ))
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
                        Explore upcoming events across campus.
                      </p>
                    </div>
                  </div>

                  <div className="event-card-grid">
                    {filteredEvents.map((event) => (
                      <EventCard
                        key={event.event_id}
                        event={event}
                        isSaved={savedEventIds.includes(
                          event.event_id
                        )}
                        onBookmark={toggleBookmark}
                        onOpen={openEventDetails}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {activeView === "for-you" && (
          <section className="events-section">
            <div className="section-title">
              <div>
                <h2>For You</h2>

                <p>
                  Personalized using your interests and Eventeye
                  activity.
                </p>
              </div>

              <button
                type="button"
                onClick={loadRecommendations}
              >
                Refresh
              </button>
            </div>

            <div className="recommendation-explanation">
              {recommendationModel === "ALS_WRMF"
                ? "✨ These recommendations were generated from your Eventeye activity using the behavior-aware ALS/WRMF model."
                : recommendationType === "cold_start"
                ? "✨ Eventeye is currently using your selected interests while learning your preferences."
                : "✨ Eventeye is learning your preferences and showing the best available recommendations."}
            </div>

            {recommendationLoading ? (
              <p>
                Loading personalized recommendations...
              </p>
            ) : upcomingRecommendations.length === 0 ? (
              <div className="empty-saved-state">
                <div className="empty-saved-icon">
                  ✨
                </div>

                <h3>
                  No upcoming recommendations yet
                </h3>

                <p>
                  Browse and interact with more events to help
                  Eventeye learn what you like.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActiveView("home")
                  }
                >
                  Explore Events
                </button>
              </div>
            ) : (
              <div className="event-card-grid">
                {upcomingRecommendations.map((event) => (
                  <EventCard
                    key={event.event_id}
                    event={event}
                    isSaved={savedEventIds.includes(
                      event.event_id
                    )}
                    onBookmark={toggleBookmark}
                    onOpen={openEventDetails}
                    recommendationReason={
                      event.recommendation_reason
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === "saved" && (
          <section className="events-section">
            <div className="section-title">
              <div>
                <h2>
                  Saved Events
                </h2>

                <p>
                  Everything you’ve bookmarked in one place.
                </p>
              </div>
            </div>

            {savedEvents.length === 0 ? (
              <div className="empty-saved-state">
                <div className="empty-saved-icon">
                  ♡
                </div>

                <h3>
                  No saved events yet
                </h3>

                <p>
                  Tap the heart on an event to save it.
                </p>

                <button
                  type="button"
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
                  <EventCard
                    key={event.event_id}
                    event={event}
                    isSaved={true}
                    onBookmark={toggleBookmark}
                    onOpen={openEventDetails}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeView === "profile" && (
          <StudentProfile
            user={user}
            onBack={() =>
              setActiveView("home")
            }
            onEditInterests={() =>
              setActiveView("interests")
            }
          />
        )}
      </main>
    </div>
  );
}

function RecommendedItem({
  event,
  isSaved,
  onBookmark,
  onOpen,
}) {
  return (
    <div
      className="recommended-item"
      onClick={() =>
        onOpen(event.event_id)
      }
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
          {formatDate(event.event_date)}
          {" · "}
          {event.location}
        </p>

        {event.recommendation_reason && (
          <small className="recommendation-reason">
            {event.recommendation_reason}
          </small>
        )}
      </div>

      <button
        className="heart-btn"
        type="button"
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();

          onBookmark(
            event.event_id
          );
        }}
      >
        {isSaved ? "♥" : "♡"}
      </button>
    </div>
  );
}

function EventCard({
  event,
  isSaved,
  onBookmark,
  onOpen,
  recommendationReason,
}) {
  return (
    <div
      className="event-card"
      onClick={() =>
        onOpen(event.event_id)
      }
    >
      <div className="event-image-placeholder">
        <span>
          {getCategoryIcon(
            event.category_name
          )}
        </span>

        <button
          type="button"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();

            onBookmark(
              event.event_id
            );
          }}
        >
          {isSaved ? "♥" : "♡"}
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

        {recommendationReason && (
          <p className="event-recommendation-reason">
            ✨ {recommendationReason}
          </p>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;