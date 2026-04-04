import { Link } from "react-router-dom";
import "./RegisterPage.css";

export default function RegistrationPage() {
  return (
    <main>
      <section class="register-hero">
        <div class="container">
          <div class="register-hero__head">
            <h1 class="register-hero__title">Создайте аккаунт волонтера</h1>
            <p class="register-hero__subtitle">
              Присоединяйтесь к сообществу людей, которые делают мир лучше
            </p>
          </div>

          <div class="register-card">
            <h2 class="register-card__title">Регистрация</h2>

            <form class="register-form" action="#" method="post">
              <div class="register-form__row register-form__row--two">
                <div class="form-field">
                  <label for="firstName" class="form-field__label">Имя</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    class="form-field__input"
                    placeholder="Введите имя"
                  />
                </div>

                <div class="form-field">
                  <label for="lastName" class="form-field__label">Фамилия</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    class="form-field__input"
                    placeholder="Введите фамилию"
                  />
                </div>
              </div>

              <div class="register-form__row">
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

              <div class="register-form__row">
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

              <div class="register-form__row">
                <div class="form-field">
                  <label for="confirmPassword" class="form-field__label">Подтверждение пароля</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    class="form-field__input"
                    placeholder="********"
                  />
                </div>
              </div>

              <button type="submit" class="register-form__submit">
                Создать аккаунт
              </button>

              <p class="register-form__login-text">
                <span> Уже есть аккаунт? </span>
                <Link to="/login" class="register-form__login-link">Войти</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}