import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, saveToken } from "../api";
import "./RegisterPage.css";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
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

    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser({
        firstName: form.firstName,
        lastName: form.lastName,
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

      navigate("/login");
    } catch (err) {
      setError(err.message || "Не удалось выполнить регистрацию");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="register-hero">
        <div className="container">
          <div className="register-hero__head">
            <h1 className="register-hero__title">Создайте аккаунт волонтера</h1>
            <p className="register-hero__subtitle">
              Присоединяйтесь к сообществу людей, которые делают мир лучше
            </p>
          </div>

          <div className="register-card">
            <h2 className="register-card__title">Регистрация</h2>

            <form className="register-form" onSubmit={handleSubmit}>
              <div className="register-form__row register-form__row--two">
                <div className="form-field">
                  <label htmlFor="firstName" className="form-field__label">
                    Имя
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="form-field__input"
                    placeholder="Введите имя"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="lastName" className="form-field__label">
                    Фамилия
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="form-field__input"
                    placeholder="Введите фамилию"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="register-form__row">
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

              <div className="register-form__row">
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

              <div className="register-form__row">
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

              {error ? <p className="register-form__error">{error}</p> : null}

              <button
                type="submit"
                className="register-form__submit"
                disabled={loading}
              >
                {loading ? "Создаем аккаунт..." : "Создать аккаунт"}
              </button>

              <p className="register-form__login-text">
                <span>Уже есть аккаунт? </span>
                <Link to="/login" className="register-form__login-link">
                  Войти
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}