function logo({ compact = false, light = false }) {
  return (
    <div className={`eventeye-logo ${compact ? "compact" : ""}`}>
      <svg
        className="eventeye-symbol"
        viewBox="0 0 160 120"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Eventeye logo"
      >
        <defs>
          <linearGradient
            id="eventeyeGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>

        <path
          d="M12 60
             C35 25, 60 15, 80 15
             C105 15, 130 28, 148 60
             C128 92, 105 105, 80 105
             C55 105, 32 92, 12 60Z"
          fill="none"
          stroke="url(#eventeyeGradient)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M80 35
             C62 35, 50 48, 50 63
             C50 83, 80 105, 80 105
             C80 105, 110 83, 110 63
             C110 48, 98 35, 80 35Z"
          fill="url(#eventeyeGradient)"
        />

        <circle
          cx="80"
          cy="61"
          r="10"
          fill="white"
        />

        <line
          x1="80"
          y1="4"
          x2="80"
          y2="14"
          stroke="#6C63FF"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <line
          x1="60"
          y1="8"
          x2="65"
          y2="18"
          stroke="#7C4DFF"
          strokeWidth="6"
          strokeLinecap="round"
        />

        <line
          x1="100"
          y1="8"
          x2="95"
          y2="18"
          stroke="#14B8A6"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>

      {!compact && (
        <div className="logo-text">
          <div className={`brand-name ${light ? "light" : ""}`}>
            Event<span>eye</span>
          </div>

          <div className={`tagline ${light ? "light" : ""}`}>
            Find your crowd. Find your moment.
          </div>
        </div>
      )}
    </div>
  );
}

export default logo;