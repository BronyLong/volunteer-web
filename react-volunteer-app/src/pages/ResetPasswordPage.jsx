import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api";
import "./LoginPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    setMessage("");

    if (!token) {
      setError("Ссылка восстановления некорректна");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const data = await resetPassword({
        token,
        password: form.password,
      });

      setMessage(data?.message || "Пароль изменен. Теперь вы можете войти в аккаунт.");
      setForm({ password: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message || "Не удалось изменить пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="login-hero">
        <div className="container">
          <div className="login-hero__head">
            <h1 className="login-hero__title">Новый пароль</h1>
            <p className="login-hero__subtitle">
              Придумайте новый пароль для восстановления доступа к аккаунту
            </p>
          </div>

          <div className="login-card">
            <h2 className="login-card__title">Изменить пароль</h2>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-form__row">
                <div className="form-field">
                  <label htmlFor="password" className="form-field__label">
                    Новый пароль
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

              <div className="login-form__row">
                <div className="form-field">
                  <label htmlFor="confirmPassword" className="form-field__label">
                    Подтверждение пароля
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className="form-field__input"
                    placeholder="********"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {error ? <p className="login-form__error">{error}</p> : null}
              {message ? <p className="login-form__success">{message}</p> : null}

              <button
                type="submit"
                className="login-form__submit"
                disabled={loading || !token}
              >
                {loading ? "Сохраняем..." : "Сохранить пароль"}
              </button>

              <p className="login-form__register-text">
                <Link to="/login" className="login-form__register-link">
                  Перейти ко входу
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
