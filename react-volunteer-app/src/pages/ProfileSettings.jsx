import "./ProfileSettings.css"
import { Link } from "react-router-dom";

import manAvatar from "../assets/images/avatar_man.png"

export default function ProfileSettings() {
  return (
    <>
      <main className="profile-settings-page">
        <section className="profile-cover"></section>

        <section className="profile-summary">
          <div className="container">
            <div className="profile-summary__avatar-wrap">
              <img src={manAvatar} alt="Аватар пользователя" className="profile-summary__avatar" />
            </div>

            <h1 className="profile-summary__name">Иван Иванов</h1>
            <div className="profile-summary__role">Волонтер</div>
          </div>
        </section>

        <section className="profile-settings">
          <div className="container">
            <form className="profile-settings-card" action="#" method="post">
              <div className="profile-settings-card__column profile-settings-card__column--left">
                <h2 className="profile-settings-card__title">Основная информация</h2>
                <div className="profile-settings-card__divider"></div>

                <div className="form-field">
                  <label for="firstName" className="form-field__label">Имя</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    className="form-field__input"
                    placeholder="Введите имя"
                    value="Иван"
                  />
                </div>

                <div className="form-field">
                  <label for="lastName" className="form-field__label">Фамилия</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    className="form-field__input"
                    placeholder="Введите фамилию"
                    value="Иванов"
                  />
                </div>

                <div className="form-field">
                  <label for="email" className="form-field__label">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="form-field__input"
                    placeholder="example@email.com"
                    value="ivanov@mail.com"
                  />
                </div>

                <div className="form-field">
                  <label for="phone" className="form-field__label">Телефон</label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="form-field__input"
                    placeholder="+7 (900) 000-00-00"
                    value="+7 (990) 871-85-73"
                  />
                </div>

                <div className="form-field">
                  <label for="city" className="form-field__label">Город</label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    className="form-field__input"
                    placeholder="Введите город"
                    value="г. Икс"
                  />
                </div>

                <button type="submit" className="profile-settings-card__button profile-settings-card__button--desktop">
                  Сохранить изменения
                </button>
              </div>

              <div className="profile-settings-card__column profile-settings-card__column--right">
                <h2 className="profile-settings-card__title profile-settings-card__title--center">Bio</h2>
                <div className="profile-settings-card__divider"></div>

                <div className="form-field">
                  <label for="bio" className="form-field__label visually-hidden">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    className="form-field__textarea"
                    placeholder="Введите краткую информацию о себе"
                  >Введите краткую информацию о себе</textarea>
                </div>

                <div className="form-field">
                  <label for="vk" className="form-field__label">Вконтакте</label>
                  <input
                    id="vk"
                    name="vk"
                    type="text"
                    className="form-field__input"
                    placeholder="vk.com/example"
                    value="vk.com/example"
                  />
                </div>

                <div className="form-field">
                  <label for="ok" className="form-field__label">Одноклассники</label>
                  <input
                    id="ok"
                    name="ok"
                    type="text"
                    className="form-field__input"
                    placeholder="ok.ru/example"
                    value="ok.ru/example"
                  />
                </div>

                <div className="form-field">
                  <label for="max" className="form-field__label">MAX</label>
                  <input
                    id="max"
                    name="max"
                    type="text"
                    className="form-field__input"
                    placeholder="max.ru/example"
                    value="max.ru/example"
                  />
                </div>

                <button type="submit" className="profile-settings-card__button">
                  Сохранить изменения
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}



/* 



*/ 