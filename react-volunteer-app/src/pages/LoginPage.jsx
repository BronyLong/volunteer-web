import { Link } from "react-router-dom";
import "./LoginPage.css";

export default function LoginPage() {
  return (
    <main>
      <section class="login-hero">
        <div class="container">
          <div class="login-hero__head">
            <h1 class="login-hero__title">Войдите в свой аккаунт</h1>
            <p class="login-hero__subtitle">
              Добро пожаловать! Войдите в свой аккаунт, чтобы продолжить
            </p>
          </div>

          <div class="login-card">
            <h2 class="login-card__title">Вход</h2>

            <form class="login-form" action="#" method="post">
              <div class="login-form__row">
                <div class="form-field">
                  <label for="email" class="form-field__label">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    class="form-field__input"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div class="login-form__row">
                <div class="form-field">
                  <label for="password" class="form-field__label">Пароль</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    class="form-field__input"
                    placeholder="********"
                  />
                </div>
              </div>

              <button type="submit" class="login-form__submit">
                Войти
              </button>

              <p class="login-form__register-text">
                <span> Нет аккаунта? </span>
                <Link to="/register" class="login-form__register-link">Зарегистрироваться</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}