import { useState } from "react";
import Logo from "../components/logo";
import "../styles/auth.css";

function Login({ onSwitch, onLogin }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");

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

      localStorage.setItem("user", JSON.stringify(data.user));

      if (onLogin) {
        onLogin(data.user);
      }
    } catch {
      setMessage("Could not connect to the server");
    }
  };

  return (
    <div className="auth-page">
      {/* LEFT SIDE */}
      <section className="auth-visual">
        <Logo light />

        <div className="visual-message">
          <h3>Your next campus moment starts here.</h3>

          <p className="visual-description">
  Discover events that match your interests, connect with your
  campus community, and find experiences worth showing up for.
</p>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="auth-form-section">
        <div className="auth-card">
          <Logo />

          <div className="auth-tabs">
            <button
              type="button"
              className="active"
            >
              Login
            </button>

            <button
              type="button"
              onClick={onSwitch}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              type="email"
              name="email"
              placeholder="student@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <div className="forgot-password">
              Forgot password?
            </div>

            <button
              type="submit"
              className="auth-button"
            >
              Log in →
            </button>
          </form>

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          <div className="divider">
            <span></span>
            <p>or</p>
            <span></span>
          </div>

          <button
            type="button"
            className="social-button"
          >
            Continue with Google
          </button>

          <button
            type="button"
            className="social-button"
          >
            Continue with Microsoft
          </button>

          <p className="switch-text">
            New to Eventeye?{" "}
            <button
              type="button"
              className="link-button"
              onClick={onSwitch}
            >
              Create an account
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export default Login;