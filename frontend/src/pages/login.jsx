import { useState } from "react";
import Logo from "../components/logo";
import "../styles/auth.css";

function Login({ onSwitch, onLogin }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed");
        return;
      }

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      if (onLogin) {
        onLogin(data.user);
      }
    } catch {
      setMessage("Could not connect to the server");
    }
  };

  return (
    <div className="login-split-page">

      {/* LEFT SIDE - LOGIN FORM */}
      <section className="login-form-side">
        <div className="login-form-container">

          <div className="login-brand">
            <Logo />
          </div>

          <div className="login-heading">
            <h1>Welcome Back</h1>

            <p>
              Log in to your Eventeye account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">
              Email
            </label>

            <div className="login-input-wrapper">
              <span className="input-icon">
                ✉
              </span>

              <input
                id="email"
                type="email"
                name="email"
                placeholder="yourname@gmail.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <label htmlFor="password">
              Password
            </label>

            <div className="login-input-wrapper password-wrapper">
              <span className="input-icon">
                🔑
              </span>

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className="show-password-btn"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) =>
                    setRememberMe(
                      e.target.checked
                    )
                  }
                />

                <span>
                  Remember me
                </span>
              </label>

              <button
                type="button"
                className="forgot-link"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="login-main-button"
            >
              <span>Log In</span>
              <span>→</span>
            </button>
          </form>

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          <div className="login-divider">
            <span></span>
            <p>or continue with</p>
            <span></span>
          </div>

          <div className="social-login-row">
            <button
              type="button"
              className="login-social-button"
            >
              <span className="google-letter">
                G
              </span>
              Continue with Google
            </button>

            <button
              type="button"
              className="login-social-button"
            >
              <span className="microsoft-icon">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>

              Continue with Microsoft
            </button>
          </div>

          <p className="login-switch-text">
            Don&apos;t have an account?{" "}

            <button
              type="button"
              className="login-signup-link"
              onClick={onSwitch}
            >
              Sign up
            </button>
          </p>
        </div>
      </section>

      {/* RIGHT SIDE - KENYA HERO */}
      <section className="login-hero-side">
        <div className="login-hero-overlay"></div>

        <div className="hero-content">
          <div className="hero-main-message">
            <h2>
              More
              <br />
              Than Events.
            </h2>

            <div className="hero-accent"></div>

            <p>
              A stronger campus.
              <br />
              A brighter tomorrow.
            </p>
          </div>

          <div className="hero-features">

            <div className="hero-feature">
              <div className="hero-feature-icon">
                📅
              </div>

              <h3>Discover</h3>

              <p>
                Events that match
                <br />
                your interests.
              </p>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                👥
              </div>

              <h3>Connect</h3>

              <p>
                Meet people.
                <br />
                Join communities.
              </p>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                ✨
              </div>

              <h3>Belong</h3>

              <p>
                Be part of
                <br />
                campus life.
              </p>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}

export default Login;