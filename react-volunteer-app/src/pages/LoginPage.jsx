import { Link } from "react-router-dom";
import "./LoginPage.css";

export default function LoginPage() {
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

            <form className="login-form" action="#" method="post">
              <div className="login-form__row">
                <div className="form-field">
                  <label for="email" className="form-field__label">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-field__input"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div className="login-form__row">
                <div className="form-field">
                  <label for="password" className="form-field__label">Пароль</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-field__input"
                    placeholder="********"
                  />
                </div>
              </div>

              <button type="submit" className="login-form__submit">
                Войти
              </button>

              <p className="login-form__register-text">
                <span> Нет аккаунта? </span>
                <Link to="/register" className="login-form__register-link">Зарегистрироваться</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}