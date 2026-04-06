import "./ProfilePage.css"
import { Link } from "react-router-dom";

import locationIcon from "../assets/SVG/location_footer.svg";
import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import okIcon from "../assets/SVG/odnoklassnini.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";
import backgroundImage from "../assets/SVG/background.svg"

import manAvatar from "../assets/images/avatar_man.png"

import ProfileEventCard from "../components/ProfileEventCard";

export default function ProfilePage() {
  return (
    <>
      <main className="profile-page">
        <section className="profile-cover" style={{ backgroundImage: `url(${backgroundImage})` }}></section>
      
        <section className="profile-summary">
          <div className="container">
            <div className="profile-summary__avatar-wrap">
              <img src={manAvatar} alt="Аватар пользователя" className="profile-summary__avatar" />
            </div>
      
            <h1 className="profile-summary__name">Иван Иванов</h1>
      
            <div className="profile-summary__role">Волонтер</div>
          </div>
        </section>
      
        <section className="profile-info">
          <div className="container">
            <div className="profile-card">
              <div className="profile-card__column profile-card__column--left">
                <h2 className="profile-card__title">Основная информация</h2>
      
                <div className="profile-card__divider"></div>
      
                <ul className="profile-contacts">
                  <li className="profile-contacts__item">
                    <img src={phoneIcon} alt="" className="profile-contacts__icon" />
                    <span>8 (800) 555-35-35</span>
                  </li>
      
                  <li className="profile-contacts__item">
                    <img src={emailIcon} alt="" className="profile-contacts__icon" />
                    <span>ivanov@mail.com</span>
                  </li>
      
                  <li className="profile-contacts__item">
                    <img src={locationIcon} alt="" className="profile-contacts__icon" />
                    <span>г. Икс</span>
                  </li>
                </ul>
      
                <div className="profile-card__bottom-divider"></div>
      
                <div className="profile-card__button-wrap">
                  <Link to="#" className="profile-card__button">Изменить</Link>
                </div>
              </div>
      
              <div className="profile-card__column profile-card__column--right">
                <h2 className="profile-card__title profile-card__title--center">Bio</h2>
      
                <div className="profile-card__divider"></div>
      
                <div className="profile-bio">
                  Помогаю в организации мероприятий и координирую волонтеров для помощи местным сообществам!
                </div>
      
                <div className="profile-socials">
                  <Link to="#" className="profile-socials__link" aria-label="Одноклассники">
                    <img src={okIcon} alt="Одноклассники" className="profile-socials__icon" />
                  </Link>
                  <Link to="#" className="profile-socials__link" aria-label="VK">
                    <img src={vkIcon} alt="VK" className="profile-socials__icon" />
                  </Link>
                  <Link to="#" className="profile-socials__link" aria-label="MAX">
                    <img src={maxIcon} alt="MAX" className="profile-socials__icon" />
                  </Link>
                </div>
      
                <div className="profile-card__bottom-divider"></div>
      
                <div className="profile-card__button-wrap">
                  <Link to="#" className="profile-card__button">Изменить</Link>
                </div>
              </div>
            </div>

            <div className="profile-events">
              <h2 className="profile-events__title">Мои мероприятия</h2>

              <div className="profile-events__divider"></div>

              <div className="profile-events__list">
                <ProfileEventCard />
                <ProfileEventCard />
                <ProfileEventCard />
              </div>
            </div>

          </div>
        </section>
      </main>
    </>
  );
}