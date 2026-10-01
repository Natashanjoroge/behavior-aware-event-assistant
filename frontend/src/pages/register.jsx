import { useState } from "react";
import Logo from "../components/logo";
import "../styles/auth.css";

function Register({ onSwitch }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    user_type: "student",
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

    if (form.password !== form.confirm_password) {
      setMessage("Passwords do not match");
      return;
    }

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            password: form.password,
            user_type: form.user_type,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed");
        return;
      }

      setMessage("Account created successfully. You can now log in.");
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
          <h3>Find your crowd. Find your moment.</h3>

          <p className="visual-description">
            Choose what interests you and let Eventeye help you discover
            campus experiences that actually feel relevant.
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
              onClick={onSwitch}
            >
              Login
            </button>

            <button
              type="button"
              className="active"
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="full_name">Full name</label>

            <input
              id="full_name"
              type="text"
              name="full_name"
              placeholder="Enter your full name"
              value={form.full_name}
              onChange={handleChange}
              required
            />

            <label htmlFor="email">Email address</label>

            <input
              id="email"
              type="email"
              name="email"
              placeholder="student@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />

            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <label htmlFor="confirm_password">
              Confirm password
            </label>

            <input
              id="confirm_password"
              type="password"
              name="confirm_password"
              placeholder="Re-enter your password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />

            <label>I am joining as</label>

            <div className="role-options">
              <div className="role-option">
                <input
                  id="student"
                  type="radio"
                  name="user_type"
                  value="student"
                  checked={form.user_type === "student"}
                  onChange={handleChange}
                />

                <label htmlFor="student">
                  Student
                </label>
              </div>

              <div className="role-option">
                <input
                  id="organizer"
                  type="radio"
                  name="user_type"
                  value="organizer"
                  checked={form.user_type === "organizer"}
                  onChange={handleChange}
                />

                <label htmlFor="organizer">
                  Event Organizer
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="auth-button"
            >
              Create account →
            </button>
          </form>

          {message && (
            <div className="auth-message">
              {message}
            </div>
          )}

          <p className="switch-text">
            Already have an account?{" "}
            <button
              type="button"
              className="link-button"
              onClick={onSwitch}
            >
              Log in
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export default Register;