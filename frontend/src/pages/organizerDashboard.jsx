import { useEffect, useState } from "react";
import Logo from "../components/logo";
import CreateEvent from "./createEvent";
import "../styles/organizerDashboard.css";

function OrganizerDashboard({ user }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("dashboard");

  /* =========================
     LOAD ORGANIZER EVENTS
  ========================= */

  const loadEvents = async () => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/events/organizer/${user.user_id}`
      );

      const data = await response.json();

      if (response.ok) {
        setEvents(data);
      } else {
        console.error("Could not load organizer events:", data);
      }
    } catch (error) {
      console.error(
        "Could not connect to organizer events API:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user]);

  /* =========================
     CREATE EVENT VIEW
  ========================= */

  if (activeView === "create-event") {
    return (
      <CreateEvent
        user={user}
        onBack={() => setActiveView("dashboard")}
        onEventCreated={() => {
          loadEvents();
          setActiveView("dashboard");
        }}
      />
    );
  }

  /* =========================
     DASHBOARD DATA
  ========================= */

  const now = new Date();

  const upcomingEvents = events
    .filter(
      (event) =>
        event.event_date &&
        new Date(event.event_date) >= now &&
        event.status !== "cancelled"
    )
    .sort(
      (a, b) =>
        new Date(a.event_date) -
        new Date(b.event_date)
    )
    .slice(0, 4);

  const pastEvents = events.filter(
    (event) =>
      event.event_date &&
      new Date(event.event_date) < now &&
      event.status !== "cancelled"
  );

  const cancelledEvents = events.filter(
    (event) => event.status === "cancelled"
  );

  const totalEvents = events.length;

  /* =========================
     DASHBOARD
  ========================= */

  return (
    <div className="organizer-layout">
      {/* SIDEBAR */}

      <aside className="organizer-sidebar">
        <Logo compact />

        <div className="organizer-account">
          <div className="organizer-avatar">
            {user?.full_name?.charAt(0) || "O"}
          </div>

          <div>
            <strong>
              {user?.full_name || "Organizer"}
            </strong>

            <span>Event Organizer</span>
          </div>
        </div>

        <nav className="organizer-nav">
          <button
            className={
              activeView === "dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveView("dashboard")
            }
          >
            Dashboard
          </button>

          <button
            className={
              activeView === "create-event"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveView("create-event")
            }
          >
            Create Event
          </button>

          <button type="button">
            Manage Events
          </button>

          <button type="button">
            Ticket Check-in
          </button>

          <button type="button">
            Analytics
          </button>

          <button type="button">
            Profile
          </button>
        </nav>

        <div className="organizer-sidebar-note">
          <span>
            EVENTEYE FOR ORGANIZERS
          </span>

          <p>
            Create better campus experiences
            and understand your audience.
          </p>
        </div>
      </aside>

      {/* MAIN */}

      <main className="organizer-main">
        {/* HEADER */}

        <header className="organizer-header">
          <div>
            <span className="organizer-eyebrow">
              ORGANIZER SPACE
            </span>

            <h1>
              Welcome back,{" "}
              {user?.full_name || "Organizer"}
            </h1>

            <p>
              Here’s how your events are
              performing.
            </p>
          </div>

          <div className="organizer-header-actions">
            <button
              type="button"
              className="organizer-notification"
            >
              🔔
            </button>

            <button
              type="button"
              className="organizer-create-button"
              onClick={() =>
                setActiveView("create-event")
              }
            >
              + Create Event
            </button>
          </div>
        </header>

        {/* STATISTICS */}

        <section className="organizer-stats-grid">
          <StatCard
            label="Total Events"
            value={totalEvents}
            note="All your events"
          />

          <StatCard
            label="Upcoming"
            value={upcomingEvents.length}
            note="Future events"
          />

          <StatCard
            label="Past Events"
            value={pastEvents.length}
            note="Event history"
          />

          <StatCard
            label="Cancelled"
            value={cancelledEvents.length}
            note="Cancelled events"
          />
        </section>

        {/* CONTENT */}

        <section className="organizer-content-grid">
          {/* UPCOMING EVENTS */}

          <div className="organizer-events-panel">
            <div className="organizer-section-heading">
              <div>
                <span>
                  YOUR EVENTS
                </span>

                <h2>
                  Upcoming Events
                </h2>
              </div>

              <button type="button">
                Manage Events →
              </button>
            </div>

            {loading ? (
              <p
                style={{
                  padding: "0 24px 24px",
                }}
              >
                Loading events...
              </p>
            ) : upcomingEvents.length === 0 ? (
              <div className="organizer-empty-state">
                <h3>
                  No upcoming events
                </h3>

                <p>
                  Create a new event and it
                  will appear here.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActiveView(
                      "create-event"
                    )
                  }
                  style={{
                    marginTop: "16px",
                  }}
                >
                  + Create Event
                </button>
              </div>
            ) : (
              <div className="organizer-event-list">
                {upcomingEvents.map(
                  (event) => (
                    <div
                      className="organizer-event-row"
                      key={event.event_id}
                    >
                      <div className="organizer-date-box">
                        <strong>
                          {getDay(
                            event.event_date
                          )}
                        </strong>

                        <span>
                          {getMonth(
                            event.event_date
                          )}
                        </span>
                      </div>

                      <div className="organizer-event-info">
                        <span className="organizer-event-category">
                          {
                            event.category_name
                          }
                        </span>

                        <h3>
                          {
                            event.event_name
                          }
                        </h3>

                        <p>
                          {formatDate(
                            event.event_date
                          )}
                          {" · "}
                          {
                            event.location
                          }
                        </p>

                        <p>
                          Status:{" "}
                          {formatStatus(
                            event.status
                          )}
                        </p>
                      </div>

                      <div className="organizer-event-actions">
                        <button
                          type="button"
                        >
                          Manage
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}

          <aside className="organizer-side-panel">
            <div className="organizer-quick-action-card">
              <span className="organizer-card-label">
                QUICK ACTION
              </span>

              <h2>
                Create your next campus
                event
              </h2>

              <p>
                Add your event details,
                category, date, venue and
                capacity, then start
                accepting student bookings.
              </p>

              <button
                type="button"
                onClick={() =>
                  setActiveView(
                    "create-event"
                  )
                }
              >
                + Create Event
              </button>
            </div>

            <div className="organizer-checkin-card">
              <span className="organizer-card-label">
                EVENT DAY
              </span>

              <h3>
                Ticket Check-in
              </h3>

              <p>
                Verify student QR tickets
                and record attendance at
                the entrance.
              </p>

              <button type="button">
                Open Check-in
              </button>
            </div>
          </aside>
        </section>

        {/* EVENT HISTORY SUMMARY */}

        <section className="organizer-insights">
          <div className="organizer-section-heading">
            <div>
              <span>
                EVENT HISTORY
              </span>

              <h2>
                Your event activity
              </h2>
            </div>
          </div>

          <div className="organizer-insight-placeholder">
            <div>
              <span>
                Upcoming
              </span>

              <strong>
                {events.filter(
                  (event) =>
                    event.event_date &&
                    new Date(
                      event.event_date
                    ) >= now &&
                    event.status !==
                      "cancelled"
                ).length}
              </strong>
            </div>

            <div>
              <span>
                Past
              </span>

              <strong>
                {pastEvents.length}
              </strong>
            </div>

            <div>
              <span>
                Cancelled
              </span>

              <strong>
                {cancelledEvents.length}
              </strong>
            </div>

            <div>
              <span>
                Total
              </span>

              <strong>
                {totalEvents}
              </strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* =========================
   STAT CARD
========================= */

function StatCard({
  label,
  value,
  note,
}) {
  return (
    <div className="organizer-stat-card">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <p>
        {note}
      </p>
    </div>
  );
}

/* =========================
   HELPERS
========================= */

function formatDate(date) {
  if (!date) return "";

  return new Date(date).toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

function formatStatus(status) {
  if (!status) return "Unknown";

  return (
    status.charAt(0).toUpperCase() +
    status.slice(1)
  );
}

export default OrganizerDashboard;