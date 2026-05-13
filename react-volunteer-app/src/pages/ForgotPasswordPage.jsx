import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api";
import "./LoginPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await requestPasswordReset(email);
      setMessage(
        data?.message ||
          "Если аккаунт с таким email существует, мы отправили письмо со ссылкой для восстановления доступа."
      );
    } catch (err) {
      setError(err.message || "Не удалось отправить письмо для восстановления доступа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="login-hero">
        <div className="container">
          <div className="login-hero__head">
            <h1 className="login-hero__title">Восстановление доступа</h1>
            <p className="login-hero__subtitle">
              Укажите email аккаунта, и мы отправим ссылку для изменения пароля
            </p>
          </div>

          <div className="login-card">
            <h2 className="login-card__title">Забыли пароль?</h2>

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
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
              </div>

              {error ? <p className="login-form__error">{error}</p> : null}
              {message ? <p className="login-form__success">{message}</p> : null}

              <button
                type="submit"
                className="login-form__submit"
                disabled={loading}
              >
                {loading ? "Отправляем..." : "Отправить ссылку"}
              </button>

              <p className="login-form__register-text">
                <Link to="/login" className="login-form__register-link">
                  Вернуться ко входу
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
