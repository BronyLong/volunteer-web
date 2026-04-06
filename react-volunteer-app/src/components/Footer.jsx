import { Link } from "react-router-dom";
import "./Footer.css";

import logoHeart from "../assets/SVG/logoHeart.svg";
import logoText from "../assets/SVG/logoText.svg";

import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import locationIcon from "../assets/SVG/location_footer.svg";

import okIcon from "../assets/SVG/odnoklassnini.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__top">
        <div className="footer__col footer__col--brand">
          <Link to="/" className="logo logo--footer">
            <img src={logoHeart} alt="Логотип" className="logo__icon-img" />
            <img src={logoText} alt="Рука Помощи" className="logo__text-img" />
          </Link>

          <p className="footer__description">
            Платформа волонтёрской помощи людям и организациям, оказавшимся
            в сложной жизненной ситуации.
          </p>
        </div>

        <div className="footer__col footer__col--cta">
          <h3 className="footer__title">Хотите сделать доброе дело?</h3>
          <div className="footer__buttons">
            <Link to="/events" className="btn btn--green btn--small">
              Хочу помочь
            </Link>
            <Link to="/help" className="btn btn--green btn--small">
              Нужна помощь
            </Link>
          </div>
        </div>

        <div className="footer__col">
          <h3 className="footer__title footer__title--green">Аккаунт</h3>
          <ul className="footer__list">
            <li>
              <Link to="/register">Регистрация</Link>
            </li>
            <li>
              <Link to="/login">Войти</Link>
            </li>
            <li>
              <Link to="/profile">Личный кабинет</Link>
            </li>
          </ul>
        </div>

        <div className="footer__col">
          <h3 className="footer__title footer__title--green">Контакты</h3>
          <ul className="footer__list footer__list--contacts">
            <li>
              <img src={emailIcon} alt="" className="footer-icon-svg" />
              <a href="mailto:example@mail.ru">example@mail.ru</a>
            </li>
            <li>
              <img src={phoneIcon} alt="" className="footer-icon-svg" />
              <a href="tel:+78005553535">8 (800) 555-35-35</a>
            </li>
            <li>
              <img src={locationIcon} alt="" className="footer-icon-svg" />
              <span>ул. Пушкина, д. Колотушкина</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="container footer__bottom">
        <div className="footer__socials">
          <span className="footer__socials-title">Мы в социальных сетях</span>

          <div className="footer__icons">
            <a href="#" className="social" aria-label="Одноклассники">
              <img
                src={okIcon}
                alt="Одноклассники"
                className="social-icon-svg"
              />
            </a>

            <a href="#" className="social" aria-label="VK">
              <img src={vkIcon} alt="VK" className="social-icon-svg" />
            </a>

            <a href="#" className="social" aria-label="MAX">
              <img src={maxIcon} alt="MAX" className="social-icon-svg" />
            </a>
          </div>
        </div>

        <p className="footer__copy">© Рука помощи.</p>
      </div>
    </footer>
  );
}