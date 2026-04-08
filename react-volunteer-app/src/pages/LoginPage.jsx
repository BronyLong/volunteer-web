import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, saveToken } from "../api";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await loginUser({
        email: form.email,
        password: form.password,
      });

      if (data?.token) {
        saveToken(data.token);
      }

      if (data?.user?.id) {
        navigate(`/profiles/${data.user.id}`);
        return;
      }

      setError("Сервер не вернул id пользователя");
    } catch (err) {
      setError(err.message || "Не удалось выполнить вход");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="login-hero">
        <div className="container">
          <div className="login-hero__head">
            <h1 className="login-hero__title">Войдите в свой аккаунт</h1>
            <p className="login-hero__subtitle">
              Добро пожаловать! Войдите в свой аккаунт, чтобы продолжить
            </p>
          </div>

          <div className="login-card">
            <h2 className="login-card__title">Вход</h2>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-form__row">
                <div className="form-field">
                  <label htmlFor="email" className="form-field__label">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-field__input"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="login-form__row">
                <div className="form-field">
                  <label htmlFor="password" className="form-field__label">
                    Пароль
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-field__input"
                    placeholder="********"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {error ? <p className="login-form__error">{error}</p> : null}

              <button
                type="submit"
                className="login-form__submit"
                disabled={loading}
              >
                {loading ? "Входим..." : "Войти"}
              </button>

              <p className="login-form__register-text">
                <span>Нет аккаунта? </span>
                <Link to="/register" className="login-form__register-link">
                  Зарегистрироваться
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}