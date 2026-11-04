import { useEffect, useMemo, useState } from "react";
import Logo from "../components/logo";
import EventDetails from "./eventDetails";
import MyEvents from "./myEvents";
import Interests from "./interests";
import "../styles/studentDashboard.css";

function StudentDashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [activeView, setActiveView] = useState("home");
  const [savedEventIds, setSavedEventIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [recommendationLoading, setRecommendationLoading] =
    useState(true);

  const [recommendationType, setRecommendationType] =
    useState("");

  const [recommendationModel, setRecommendationModel] =
    useState("");

  const [selectedEventId, setSelectedEventId] =
    useState(null);

  const [showEventDetails, setShowEventDetails] =
    useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [searchMessage, setSearchMessage] =
    useState("");

  /* =========================
     LOAD ALL EVENTS
  ========================= */

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
          console.error(
            "Could not load events:",
            data
          );
        }
      } catch (error) {
        console.error(
          "Could not connect to events API:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  /* =========================
     LOAD HYBRID RECOMMENDATIONS
  ========================= */

  const loadRecommendations = async () => {
    if (!user?.user_id) {
      setRecommendationLoading(false);
      return;
    }

    setRecommendationLoading(true);

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/recommendations/for-you/${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Recommendation error:",
          data
        );

        setRecommendations([]);
        return;
      }

      setRecommendations(
        data.events || []
      );

      setRecommendationType(
        data.recommendation_type || ""
      );

      setRecommendationModel(
        data.recommendation_model || ""
      );
    } catch (error) {
      console.error(
        "Could not load recommendations:",
        error
      );

      setRecommendations([]);
    } finally {
      setRecommendationLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [user]);

  /* =========================
     RELOAD RECOMMENDATIONS
     AFTER INTEREST CHANGES
  ========================= */

  const handleReturnFromInterests = async () => {
    setActiveView("home");
    await loadRecommendations();
  };

  /* =========================
     LOAD BOOKMARKS
  ========================= */

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
            data.map(
              (bookmark) =>
                bookmark.event_id
            )
          );
        } else {
          console.error(
            "Could not load bookmarks:",
            data
          );
        }
      } catch (error) {
        console.error(
          "Bookmark loading error:",
          error
        );
      }
    };

    loadBookmarks();
  }, [user]);

  /* =========================
     TOGGLE BOOKMARK
  ========================= */

  const toggleBookmark = async (
    eventId
  ) => {
    if (!user?.user_id) return;

    const isSaved =
      savedEventIds.includes(eventId);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/bookmarks/",
        {
          method: isSaved
            ? "DELETE"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            user_id: user.user_id,
            event_id: eventId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Bookmark error:",
          data
        );
        return;
      }

      if (isSaved) {
        setSavedEventIds(
          (current) =>
            current.filter(
              (id) => id !== eventId
            )
        );
      } else {
        setSavedEventIds(
          (current) => [
            ...current,
            eventId,
          ]
        );

        try {
          await fetch(
            "http://127.0.0.1:5000/api/interactions/log",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                user_id:
                  user.user_id,

                event_id:
                  eventId,

                interaction_type:
                  "BOOKMARK",

                session_id:
                  null,
              }),
            }
          );

          await loadRecommendations();
        } catch (error) {
          console.error(
            "Could not log bookmark interaction:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Bookmark request failed:",
        error
      );
    }
  };

  /* =========================
     OPEN EVENT DETAILS
  ========================= */

  const openEventDetails = (
    eventId
  ) => {
    setSelectedEventId(eventId);
    setShowEventDetails(true);
  };

  /* =========================
     SEARCH
  ========================= */

  const handleSearchSubmit =
    async (event) => {
      event.preventDefault();

      const cleanedQuery =
        searchQuery.trim();

      if (!cleanedQuery) {
        setSearchMessage("");
        return;
      }

      setSearchMessage(
        `Showing results for "${cleanedQuery}"`
      );

      if (!user?.user_id) return;

      try {
        await fetch(
          "http://127.0.0.1:5000/api/interactions/log",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              user_id:
                user.user_id,

              event_id:
                null,

              interaction_type:
                "SEARCH",

              session_id:
                null,
            }),
          }
        );
      } catch (error) {
        console.error(
          "Could not log search interaction:",
          error
        );
      }
    };

  const clearSearch = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSearchMessage("");
  };

  /* =========================
     CATEGORIES
  ========================= */

  const categories = [
    {
      label: "All",
      databaseName: null,
    },
    {
      label: "Social",
      databaseName:
        "Social & Entertainment",
    },
    {
      label: "Sports",
      databaseName:
        "Sports & Fitness",
    },
    {
      label: "Academic",
      databaseName:
        "Academic & Educational",
    },
    {
      label: "Career",
      databaseName:
        "Career & Professional",
    },
    {
      label: "Arts",
      databaseName:
        "Arts & Culture",
    },
    {
      label: "Technology",
      databaseName:
        "Technology & Innovation",
    },
    {
      label: "Clubs",
      databaseName:
        "Clubs & Societies",
    },
    {
      label: "Wellness",
      databaseName:
        "Wellness & Lifestyle",
    },
    {
      label: "Community",
      databaseName:
        "Community & Volunteering",
    },
    {
      label: "Faith",
      databaseName:
        "Faith & Spirituality",
    },
  ];

  /* =========================
     FILTER EVENTS
  ========================= */

  const filteredEvents = useMemo(
    () => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      const selectedCategoryObject =
        categories.find(
          (category) =>
            category.label ===
            selectedCategory
        );

      return events.filter(
        (event) => {
          const matchesSearch =
            !query ||
            event.event_name
              ?.toLowerCase()
              .includes(query) ||
            event.description
              ?.toLowerCase()
              .includes(query) ||
            event.location
              ?.toLowerCase()
              .includes(query) ||
            event.category_name
              ?.toLowerCase()
              .includes(query);

          const matchesCategory =
            selectedCategory ===
              "All" ||
            event.category_name ===
              selectedCategoryObject
                ?.databaseName;

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );
    },
    [
      events,
      searchQuery,
      selectedCategory,
    ]
  );

  /* =========================
     DATA
  ========================= */

  const featuredEvent =
    filteredEvents.length > 0
      ? filteredEvents[0]
      : null;

  const homepageRecommendations =
    recommendations.slice(0, 3);

  const savedEvents =
    events.filter((event) =>
      savedEventIds.includes(
        event.event_id
      )
    );

  /* =========================
     EVENT DETAILS VIEW
  ========================= */

  if (
    showEventDetails &&
    selectedEventId
  ) {
    return (
      <EventDetails
        eventId={selectedEventId}
        user={user}
        onBack={() => {
          setShowEventDetails(false);
          setSelectedEventId(null);

          loadRecommendations();
        }}
      />
    );
  }

  /* =========================
     MY EVENTS
  ========================= */

  if (
    activeView === "my-events"
  ) {
    return (
      <MyEvents
        user={user}
        onBack={() =>
          setActiveView("home")
        }
      />
    );
  }

  /* =========================
     INTERESTS
  ========================= */

  if (
    activeView === "interests"
  ) {
    return (
      <Interests
        user={user}
        onBack={
          handleReturnFromInterests
        }
      />
    );
  }

  /* =========================
     DASHBOARD
  ========================= */

  return (
    <div className="student-layout">

      {/* SIDEBAR */}

      <aside className="student-sidebar">

        <Logo compact />

        <nav className="student-nav">

          <button
            className={
              activeView === "home"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveView("home")
            }
          >
            🏠 Home
          </button>

          <button
            className={
              activeView === "for-you"
                ? "active"
                : ""
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
              setActiveView("home");
              clearSearch();
            }}
          >
            🔎 Explore
          </button>

          <button
            className={
              activeView ===
              "my-events"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveView(
                "my-events"
              )
            }
          >
            📅 My Events
          </button>

          <button
            className={
              activeView === "saved"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveView("saved")
            }
          >
            ♥ Saved
          </button>

          <button
            className={
              activeView === "interests"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              setActiveView("interests")
            }
          >
            🎯 Interests
          </button>

          <button
            className={
              activeView === "profile"
                ? "active"
                : ""
            }
            type="button"
            onClick={() =>
              setActiveView("profile")
            }
          >
            👤 Profile
          </button>

        </nav>

        <div className="interest-note">
          <strong>
            Your interests power
            better recommendations ✨
          </strong>
        </div>

      </aside>

      {/* MAIN */}

      <main className="student-main">

        {/* HEADER */}

        <header className="student-header">

          <div>
            <h1>
              Hi{" "}
              {user?.full_name ||
                "Student"}{" "}
              👋
            </h1>

            <p>
              Find something worth
              showing up for.
            </p>
          </div>

          <div className="header-actions">

            <form
              onSubmit={
                handleSearchSubmit
              }
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                type="text"
                placeholder="Search events, topics or venues..."
                value={
                  searchQuery
                }
                onChange={(
                  event
                ) => {
                  setSearchQuery(
                    event.target
                      .value
                  );

                  if (
                    !event.target
                      .value.trim()
                  ) {
                    setSearchMessage(
                      ""
                    );
                  }
                }}
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    cursor:
                      "pointer",
                  }}
                >
                  ✕
                </button>
              )}

            </form>

            <button
              className="notification-btn"
              type="button"
            >
              🔔
            </button>

            <button
              type="button"
              className="profile-circle"
              onClick={() =>
                setActiveView("profile")
              }
              style={{
                border: "none",
                cursor: "pointer",
              }}
            >
              {user?.full_name?.charAt(
                0
              ) || "S"}
            </button>

          </div>
        </header>

        {/* =========================
            HOME
        ========================= */}

        {activeView === "home" && (
          <>

            {/* CATEGORY FILTER */}

            <section className="interest-row">

              {categories.map(
                (category) => (
                  <button
                    key={
                      category.label
                    }
                    type="button"
                    className={
                      selectedCategory ===
                      category.label
                        ? "active-interest"
                        : ""
                    }
                    onClick={() =>
                      setSelectedCategory(
                        category.label
                      )
                    }
                  >
                    <span>
                      {getInterestIcon(
                        category.label
                      )}
                    </span>

                    {
                      category.label
                    }
                  </button>
                )
              )}

            </section>

            {(searchQuery ||
              selectedCategory !==
                "All") && (
              <div
                style={{
                  marginBottom:
                    "22px",
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                }}
              >
                <strong>
                  {
                    filteredEvents.length
                  }{" "}
                  event
                  {filteredEvents.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  found
                </strong>

                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    color:
                      "#6558f5",
                    fontWeight:
                      "700",
                    cursor:
                      "pointer",
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}

            {searchMessage && (
              <p
                style={{
                  marginBottom:
                    "16px",
                  color: "#706a78",
                  fontSize: "14px",
                }}
              >
                {searchMessage}
              </p>
            )}

            {loading ? (
              <p>
                Loading events...
              </p>
            ) : filteredEvents.length ===
              0 ? (
              <div className="empty-saved-state">

                <div className="empty-saved-icon">
                  🔎
                </div>

                <h3>
                  No events found
                </h3>

                <p>
                  Try another search or
                  category.
                </p>

                <button
                  type="button"
                  onClick={
                    clearSearch
                  }
                >
                  View All Events
                </button>

              </div>
            ) : (
              <>

                {/* TOP */}

                <section className="dashboard-top-grid">

                  {featuredEvent && (
                    <div className="featured-event">

                      <div className="featured-overlay">

                        <span className="featured-small">
                          DISCOVER SOMETHING
                          NEW
                        </span>

                        <h2>
                          {
                            featuredEvent.event_name
                          }
                        </h2>

                        <p>
                          {
                            featuredEvent.description
                          }
                        </p>

                        <p>
                          📍{" "}
                          {
                            featuredEvent.location
                          }
                        </p>

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

                  {/* PERSONALIZED */}

                  <div className="recommended-panel">

                    <div className="section-title">

                      <h2>
                        Recommended for You
                      </h2>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveView(
                            "for-you"
                          );

                          loadRecommendations();
                        }}
                      >
                        View All →
                      </button>

                    </div>

                    {recommendationLoading ? (
                      <p>
                        Personalizing your
                        events...
                      </p>
                    ) : homepageRecommendations.length ===
                      0 ? (
                      <p>
                        Keep exploring events
                        to improve your
                        recommendations.
                      </p>
                    ) : (
                      homepageRecommendations.map(
                        (event) => (
                          <RecommendedItem
                            key={
                              event.event_id
                            }
                            event={
                              event
                            }
                            isSaved={savedEventIds.includes(
                              event.event_id
                            )}
                            onBookmark={
                              toggleBookmark
                            }
                            onOpen={
                              openEventDetails
                            }
                          />
                        )
                      )
                    )}

                  </div>
                </section>

                {/* ALL EVENTS */}

                <section className="events-section">

                  <div className="section-title">

                    <div>
                      <h2>
                        Events for You
                      </h2>

                      <p>
                        Explore upcoming
                        events across campus.
                      </p>
                    </div>

                  </div>

                  <div className="event-card-grid">

                    {filteredEvents.map(
                      (event) => (
                        <EventCard
                          key={
                            event.event_id
                          }
                          event={
                            event
                          }
                          isSaved={savedEventIds.includes(
                            event.event_id
                          )}
                          onBookmark={
                            toggleBookmark
                          }
                          onOpen={
                            openEventDetails
                          }
                        />
                      )
                    )}

                  </div>

                </section>

              </>
            )}

          </>
        )}

        {/* =========================
            FOR YOU
        ========================= */}

        {activeView ===
          "for-you" && (
          <section className="events-section">

            <div className="section-title">

              <div>
                <h2>
                  For You
                </h2>

                <p>
                  Personalized using your
                  interests and Eventeye
                  activity.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  loadRecommendations
                }
              >
                Refresh
              </button>

            </div>

            <div
              style={{
                marginBottom:
                  "22px",
                padding:
                  "14px 16px",
                background:
                  "#f7f4ff",
                borderRadius:
                  "14px",
                color:
                  "#615b69",
                fontSize:
                  "13px",
              }}
            >
              {recommendationModel ===
              "ALS_WRMF"
                ? "✨ These recommendations were generated from your Eventeye activity using the behavior-aware ALS/WRMF model."
                : recommendationType ===
                  "cold_start"
                ? "✨ Eventeye is currently using the interests you selected because there is not enough behavioral data yet."
                : "✨ Eventeye is learning your preferences and showing the best available recommendations."}
            </div>

            {recommendationLoading ? (
              <p>
                Loading personalized
                recommendations...
              </p>
            ) : recommendations.length ===
              0 ? (
              <div className="empty-saved-state">

                <div className="empty-saved-icon">
                  ✨
                </div>

                <h3>
                  No recommendations yet
                </h3>

                <p>
                  Browse and interact with
                  more events to help
                  Eventeye learn what you
                  like.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActiveView(
                      "home"
                    )
                  }
                >
                  Explore Events
                </button>

              </div>
            ) : (
              <div className="event-card-grid">

                {recommendations.map(
                  (event) => (
                    <EventCard
                      key={
                        event.event_id
                      }
                      event={
                        event
                      }
                      isSaved={savedEventIds.includes(
                        event.event_id
                      )}
                      onBookmark={
                        toggleBookmark
                      }
                      onOpen={
                        openEventDetails
                      }
                      recommendationReason={
                        event.recommendation_reason
                      }
                    />
                  )
                )}

              </div>
            )}

          </section>
        )}

        {/* =========================
            SAVED
        ========================= */}

        {activeView === "saved" && (
          <section className="events-section">

            <div className="section-title">
              <div>
                <h2>
                  Saved Events
                </h2>

                <p>
                  Everything you’ve
                  bookmarked in one place.
                </p>
              </div>
            </div>

            {savedEvents.length ===
            0 ? (
              <div className="empty-saved-state">

                <div className="empty-saved-icon">
                  ♡
                </div>

                <h3>
                  No saved events yet
                </h3>

                <p>
                  Tap the heart on an event
                  to save it.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActiveView(
                      "home"
                    )
                  }
                >
                  Explore Events
                </button>

              </div>
            ) : (
              <div className="event-card-grid">

                {savedEvents.map(
                  (event) => (
                    <EventCard
                      key={
                        event.event_id
                      }
                      event={
                        event
                      }
                      isSaved={
                        true
                      }
                      onBookmark={
                        toggleBookmark
                      }
                      onOpen={
                        openEventDetails
                      }
                    />
                  )
                )}

              </div>
            )}

          </section>
        )}

        {/* =========================
            PROFILE PLACEHOLDER
        ========================= */}

        {activeView === "profile" && (
          <section className="events-section">

            <div className="section-title">
              <div>
                <h2>
                  My Profile
                </h2>

                <p>
                  Your Eventeye student
                  account.
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#ffffff",
                border:
                  "1px solid #e8e4ee",
                borderRadius:
                  "18px",
                padding: "28px",
                maxWidth: "620px",
              }}
            >
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius:
                    "50%",
                  background:
                    "#f0ecff",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "28px",
                  fontWeight: "800",
                  color:
                    "#6558f5",
                  marginBottom:
                    "18px",
                }}
              >
                {user?.full_name?.charAt(
                  0
                ) || "S"}
              </div>

              <h3
                style={{
                  marginBottom:
                    "8px",
                }}
              >
                {user?.full_name ||
                  "Student"}
              </h3>

              <p
                style={{
                  color: "#716b78",
                  marginBottom:
                    "8px",
                }}
              >
                {user?.email ||
                  "No email available"}
              </p>

              <p
                style={{
                  color: "#716b78",
                }}
              >
                Student account
              </p>

              <p
                style={{
                  marginTop:
                    "24px",
                  color: "#8b8492",
                  fontSize: "13px",
                }}
              >
                Profile editing will be
                added next.
              </p>
            </div>

          </section>
        )}

      </main>
    </div>
  );
}

/* =========================
   RECOMMENDED ITEM
========================= */

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
      style={{
        cursor: "pointer",
      }}
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

        {event.recommendation_reason && (
          <small
            style={{
              color: "#6558f5",
              fontWeight: "600",
            }}
          >
            {
              event.recommendation_reason
            }
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
        {isSaved
          ? "♥"
          : "♡"}
      </button>

    </div>
  );
}

/* =========================
   EVENT CARD
========================= */

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
      style={{
        cursor: "pointer",
      }}
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
          <p
            style={{
              marginTop: "10px",
              color: "#6558f5",
              fontSize: "12px",
              fontWeight: "600",
            }}
          >
            ✨ {recommendationReason}
          </p>
        )}

      </div>
    </div>
  );
}

/* =========================
   HELPERS
========================= */

function formatDate(date) {
  if (!date) return "";

  return new Date(
    date
  ).toLocaleDateString(
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

  return new Date(
    date
  ).toLocaleDateString(
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

function getCategoryIcon(
  category
) {
  const icons = {
    "Social & Entertainment":
      "🎉",

    "Sports & Fitness":
      "🏀",

    "Academic & Educational":
      "📚",

    "Career & Professional":
      "💼",

    "Arts & Culture":
      "🎨",

    "Technology & Innovation":
      "💻",

    "Clubs & Societies":
      "👥",

    "Wellness & Lifestyle":
      "🌿",

    "Community & Volunteering":
      "🤝",

    "Faith & Spirituality":
      "✨",
  };

  return (
    icons[category] || "📅"
  );
}

function getInterestIcon(
  interest
) {
  const icons = {
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

  return (
    icons[interest] || "✨"
  );
}

export default StudentDashboard;