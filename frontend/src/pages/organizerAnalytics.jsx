import { useEffect, useMemo, useState } from "react";
import "../styles/organizerAnalytics.css";

function OrganizerAnalytics({ user, onBack }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================
     LOAD ANALYTICS
  ========================= */

  const loadAnalytics = async () => {
    if (!user?.user_id) {
      setLoading(false);
      setError("Organizer account not found.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `http://127.0.0.1:5000/api/events/analytics/organizer/${user.user_id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not load organizer analytics."
        );
      }

      setAnalytics(data);
    } catch (error) {
      console.error(
        "Organizer analytics loading error:",
        error
      );

      setError(
        error.message ||
          "Could not connect to the analytics server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  /* =========================
     TOP EVENTS
  ========================= */

  const topEvents = useMemo(() => {
    if (!analytics?.events) {
      return [];
    }

    return [...analytics.events]
      .sort((a, b) => {
        if (b.bookings !== a.bookings) {
          return b.bookings - a.bookings;
        }

        return b.views - a.views;
      })
      .slice(0, 5);
  }, [analytics]);

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="organizer-analytics-page">
        <div className="analytics-loading">
          Loading analytics...
        </div>
      </div>
    );
  }

  /* =========================
     ERROR
  ========================= */

  if (error) {
    return (
      <div className="organizer-analytics-page">

        <button
          type="button"
          className="analytics-back-button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>

        <div className="analytics-error">
          {error}
        </div>

      </div>
    );
  }

  const summary =
    analytics?.summary || {};

  const topEvent =
    analytics?.top_event;

  const categories =
    analytics?.category_performance || [];

  const events =
    analytics?.events || [];

  return (
    <div className="organizer-analytics-page">

      {/* HEADER */}

      <div className="analytics-header">

        <div>

          <button
            type="button"
            className="analytics-back-button"
            onClick={onBack}
          >
            ← Back to Dashboard
          </button>

          <span className="analytics-eyebrow">
            EVENT INSIGHTS
          </span>

          <h1>
            Analytics
          </h1>

          <p>
            Understand how students discover,
            save, book and attend your events.
          </p>

        </div>

        <button
          type="button"
          className="analytics-refresh-button"
          onClick={loadAnalytics}
        >
          ↻ Refresh Data
        </button>

      </div>

      {/* SUMMARY */}

      <section className="analytics-summary-grid">

        <AnalyticsCard
          label="Total Views"
          value={summary.total_views || 0}
          note="Event discovery activity"
          icon="👁"
        />

        <AnalyticsCard
          label="Bookmarks"
          value={summary.total_bookmarks || 0}
          note="Students who saved events"
          icon="♥"
        />

        <AnalyticsCard
          label="Bookings"
          value={summary.total_bookings || 0}
          note="Confirmed bookings"
          icon="🎟️"
        />

        <AnalyticsCard
          label="Attendance"
          value={summary.total_attended || 0}
          note="Students checked in"
          icon="✓"
        />

      </section>

      {/* RATE CARDS */}

      <section className="analytics-rate-grid">

        <RateCard
          label="Booking Conversion"
          value={summary.conversion_rate || 0}
          description="Percentage of event views that became bookings."
        />

        <RateCard
          label="Bookmark Rate"
          value={summary.bookmark_rate || 0}
          description="Percentage of event views that resulted in a saved event."
        />

        <RateCard
          label="Attendance Rate"
          value={summary.attendance_rate || 0}
          description="Percentage of booked students who attended."
        />

      </section>

      {/* MAIN GRID */}

      <section className="analytics-main-grid">

        {/* TOP EVENT */}

        <div className="analytics-panel">

          <div className="analytics-panel-heading">

            <div>
              <span>
                BEST PERFORMANCE
              </span>

              <h2>
                Top Event
              </h2>
            </div>

          </div>

          {topEvent ? (
            <div className="analytics-top-event">

              <div className="analytics-top-event-icon">
                🏆
              </div>

              <div>

                <span className="analytics-category">
                  {topEvent.category_name ||
                    "Event"}
                </span>

                <h3>
                  {topEvent.event_name}
                </h3>

                <p>
                  {formatDate(
                    topEvent.event_date
                  )}
                </p>

              </div>

              <div className="analytics-top-event-stats">

                <SmallMetric
                  label="Views"
                  value={topEvent.views}
                />

                <SmallMetric
                  label="Bookings"
                  value={topEvent.bookings}
                />

                <SmallMetric
                  label="Attendance"
                  value={topEvent.attended}
                />

              </div>

            </div>
          ) : (
            <EmptyAnalytics
              text="No event performance data yet."
            />
          )}

        </div>

        {/* CATEGORY PERFORMANCE */}

        <div className="analytics-panel">

          <div className="analytics-panel-heading">

            <div>
              <span>
                AUDIENCE INTEREST
              </span>

              <h2>
                Category Performance
              </h2>
            </div>

          </div>

          {categories.length === 0 ? (
            <EmptyAnalytics
              text="No category analytics available yet."
            />
          ) : (
            <div className="category-performance-list">

              {categories.map(
                (category) => {
                  const maximum =
                    Math.max(
                      ...categories.map(
                        (item) =>
                          item.bookings
                      ),
                      1
                    );

                  const width =
                    Math.max(
                      (
                        category.bookings /
                        maximum
                      ) *
                        100,
                      5
                    );

                  return (
                    <div
                      className="category-performance-row"
                      key={
                        category.category_name
                      }
                    >

                      <div className="category-performance-top">

                        <strong>
                          {
                            category.category_name
                          }
                        </strong>

                        <span>
                          {category.bookings} bookings
                        </span>

                      </div>

                      <div className="category-performance-track">

                        <div
                          className="category-performance-bar"
                          style={{
                            width: `${width}%`,
                          }}
                        />

                      </div>

                      <small>
                        {category.views} views ·{" "}
                        {category.event_count} event
                        {category.event_count === 1
                          ? ""
                          : "s"}
                      </small>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

      </section>

      {/* TOP EVENTS */}

      <section className="analytics-panel">

        <div className="analytics-panel-heading">

          <div>
            <span>
              EVENT RANKING
            </span>

            <h2>
              Top Events
            </h2>

            <p>
              Ranked using bookings and student
              engagement.
            </p>
          </div>

        </div>

        {topEvents.length === 0 ? (
          <EmptyAnalytics
            text="No event ranking data yet."
          />
        ) : (
          <div className="analytics-ranking-list">

            {topEvents.map(
              (event, index) => (
                <div
                  className="analytics-ranking-row"
                  key={event.event_id}
                >

                  <div className="analytics-rank-number">
                    {index + 1}
                  </div>

                  <div className="analytics-ranking-info">

                    <strong>
                      {event.event_name}
                    </strong>

                    <span>
                      {event.category_name}
                    </span>

                  </div>

                  <div className="analytics-ranking-metrics">

                    <div>
                      <strong>
                        {event.views}
                      </strong>

                      <span>
                        Views
                      </span>
                    </div>

                    <div>
                      <strong>
                        {event.bookmarks}
                      </strong>

                      <span>
                        Saved
                      </span>
                    </div>

                    <div>
                      <strong>
                        {event.bookings}
                      </strong>

                      <span>
                        Booked
                      </span>
                    </div>

                    <div>
                      <strong>
                        {event.attended}
                      </strong>

                      <span>
                        Attended
                      </span>
                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </section>

      {/* EVENT PERFORMANCE TABLE */}

      <section className="analytics-panel">

        <div className="analytics-panel-heading">

          <div>
            <span>
              DETAILED PERFORMANCE
            </span>

            <h2>
              Event Analytics
            </h2>

            <p>
              Compare engagement and attendance
              across all your events.
            </p>
          </div>

        </div>

        {events.length === 0 ? (
          <EmptyAnalytics
            text="Create events and collect student activity to see detailed analytics."
          />
        ) : (
          <div className="analytics-table-wrap">

            <table className="analytics-table">

              <thead>
                <tr>
                  <th>
                    Event
                  </th>

                  <th>
                    Views
                  </th>

                  <th>
                    Saved
                  </th>

                  <th>
                    Bookings
                  </th>

                  <th>
                    Attended
                  </th>

                  <th>
                    Conversion
                  </th>

                  <th>
                    Attendance
                  </th>
                </tr>
              </thead>

              <tbody>

                {events.map(
                  (event) => (
                    <tr key={event.event_id}>

                      <td>
                        <strong>
                          {event.event_name}
                        </strong>

                        <span>
                          {event.category_name}
                        </span>
                      </td>

                      <td>
                        {event.views}
                      </td>

                      <td>
                        {event.bookmarks}
                      </td>

                      <td>
                        {event.bookings}
                      </td>

                      <td>
                        {event.attended}
                      </td>

                      <td>
                        <PercentBadge
                          value={
                            event.conversion_rate
                          }
                        />
                      </td>

                      <td>
                        <PercentBadge
                          value={
                            event.attendance_rate
                          }
                        />
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
}


/* =========================
   ANALYTICS CARD
========================= */

function AnalyticsCard({
  label,
  value,
  note,
  icon,
}) {
  return (
    <div className="analytics-card">

      <div className="analytics-card-icon">
        {icon}
      </div>

      <div>

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

    </div>
  );
}


/* =========================
   RATE CARD
========================= */

function RateCard({
  label,
  value,
  description,
}) {
  return (
    <div className="analytics-rate-card">

      <div className="analytics-rate-ring">
        <strong>
          {value}%
        </strong>
      </div>

      <div>

        <h3>
          {label}
        </h3>

        <p>
          {description}
        </p>

      </div>

    </div>
  );
}


/* =========================
   SMALL METRIC
========================= */

function SmallMetric({
  label,
  value,
}) {
  return (
    <div>

      <strong>
        {value || 0}
      </strong>

      <span>
        {label}
      </span>

    </div>
  );
}


/* =========================
   PERCENT BADGE
========================= */

function PercentBadge({
  value,
}) {
  const percent =
    Number(value || 0);

  let className =
    "analytics-percent-badge";

  if (percent >= 60) {
    className += " high";
  } else if (percent >= 30) {
    className += " medium";
  } else {
    className += " low";
  }

  return (
    <span className={className}>
      {percent}%
    </span>
  );
}


/* =========================
   EMPTY
========================= */

function EmptyAnalytics({
  text,
}) {
  return (
    <div className="analytics-empty">
      {text}
    </div>
  );
}


/* =========================
   FORMAT DATE
========================= */

function formatDate(date) {
  if (!date) {
    return "No date";
  }

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


export default OrganizerAnalytics;