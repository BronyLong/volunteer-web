import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Header.css";

import logoHeart from "../assets/SVG/logoHeart.svg";
import logoText from "../assets/SVG/logoText.svg";
import accountOutline from "../assets/SVG/accountOutline.svg";
import defaultAvatar from "../assets/images/avatar_woman.png";

import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import locationIcon from "../assets/SVG/location_footer.svg";

import okIcon from "../assets/SVG/odnoklassnini.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";

export default function Header({
  variant = "public",
  avatar = defaultAvatar,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const helpMenuRef = useRef(null);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const toggleHelpMenu = () => setHelpMenuOpen((prev) => !prev);
  const closeHelpMenu = () => setHelpMenuOpen(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target)) {
        closeHelpMenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="container header__inner">
        {variant === "public" ? (
          <>
            <div className="header__left">
              <Link to="/" className="logo" onClick={closeMenu}>
                <img src={logoHeart} alt="Логотип" className="logo__icon-img" />
                <img src={logoText} alt="Рука Помощи" className="logo__text-img" />
              </Link>

              <nav className="header__menu">
                <Link to="/events" className="btn btn--green">
                  Хочу помочь
                </Link>

                <div className="header-help" ref={helpMenuRef}>
                  <button
                    type="button"
                    className={`btn btn--green header-help__trigger ${helpMenuOpen ? "is-open" : ""}`}
                    onClick={toggleHelpMenu}
                    aria-expanded={helpMenuOpen}
                    aria-haspopup="true"
                  >
                    Нужна помощь
                  </button>

                  <div className={`header-help__dropdown ${helpMenuOpen ? "is-open" : ""}`}>
                    <div className="header-help__section">
                      <h3 className="header-help__title">Контакты</h3>

                      <ul className="header-help__contacts">
                        <li>
                          <img src={emailIcon} alt="" />
                          <a href="mailto:example@mail.ru">example@mail.ru</a>
                        </li>
                        <li>
                          <img src={phoneIcon} alt="" />
                          <a href="tel:+78005553535">8 (800) 555-35-35</a>
                        </li>
                        <li>
                          <img src={locationIcon} alt="" />
                          <span>ул. Пушкина, д. Колотушкина</span>
                        </li>
                      </ul>
                    </div>

                    <div className="header-help__divider"></div>

                    <div className="header-help__section">
                      <h3 className="header-help__title">Мы в социальных сетях</h3>

                      <div className="header-help__socials">
                        <a href="#" className="header-help__social" aria-label="Одноклассники">
                          <img src={okIcon} alt="Одноклассники" />
                        </a>
                        <a href="#" className="header-help__social" aria-label="VK">
                          <img src={vkIcon} alt="VK" />
                        </a>
                        <a href="#" className="header-help__social" aria-label="MAX">
                          <img src={maxIcon} alt="MAX" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </nav>
            </div>

            <div className="header__right">
              <Link to="/register" className="btn btn--outline">
                Регистрация
              </Link>

              <Link to="/login" className="btn btn--green btn--icon">
                <img src={accountOutline} alt="" className="btn__icon" />
                <span>Войти</span>
              </Link>
            </div>

            <div className="header__mobile">
              <Link
                to="/login"
                className="btn btn--green btn--icon header__login-mobile"
                onClick={closeMenu}
              >
                <img src={accountOutline} alt="" className="btn__icon" />
                <span>Войти</span>
              </Link>

              <button
                className={`menu-toggle ${isOpen ? "is-active" : ""}`}
                type="button"
                aria-label="Открыть меню"
                aria-expanded={isOpen}
                aria-controls="mobileMenu"
                onClick={toggleMenu}
              >
                <span className="menu-toggle__icon" aria-hidden="true">
                  <span className="menu-toggle__line"></span>
                  <span className="menu-toggle__line"></span>
                  <span className="menu-toggle__line"></span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/" className="logo" onClick={closeMenu}>
              <img src={logoHeart} alt="Логотип" className="logo__icon-img" />
              <img src={logoText} alt="Рука Помощи" className="logo__text-img" />
            </Link>

            <nav className="header__nav">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `header__nav-link ${isActive ? "header__nav-link--active" : ""}`
                }
              >
                Главная
              </NavLink>

              <NavLink
                to="/events"
                className={({ isActive }) =>
                  `header__nav-link ${isActive ? "header__nav-link--active" : ""}`
                }
              >
                Мероприятия
              </NavLink>

              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  `header__nav-link ${isActive ? "header__nav-link--active" : ""}`
                }
              >
                Профиль
              </NavLink>
            </nav>

            <div className="header__user">
              <Link
                to="/profile"
                className="header__avatar-link"
                aria-label="Открыть профиль"
              >
                <img src={avatar} alt="Аватар пользователя" className="header__avatar" />
              </Link>
            </div>

            <div className="header__mobile">
              <Link
                to="/profile"
                className="header__avatar-link header__avatar-link--mobile"
                aria-label="Открыть профиль"
              >
                <img src={avatar} alt="Аватар пользователя" className="header__avatar" />
              </Link>

              <button
                className={`menu-toggle ${isOpen ? "is-active" : ""}`}
                type="button"
                aria-label="Открыть меню"
                aria-expanded={isOpen}
                aria-controls="mobileMenu"
                onClick={toggleMenu}
              >
                <span className="menu-toggle__icon" aria-hidden="true">
                  <span className="menu-toggle__line"></span>
                  <span className="menu-toggle__line"></span>
                  <span className="menu-toggle__line"></span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {variant === "public" ? (
        <div className={`mobile-menu ${isOpen ? "is-open" : ""}`} id="mobileMenu">
          <div className="container mobile-menu__inner">
            <nav className="mobile-menu__nav">
              <Link to="/events" className="mobile-menu__link" onClick={closeMenu}>
                Хочу помочь
              </Link>

              <button
                type="button"
                className="mobile-menu__link mobile-menu__link--button"
                onClick={toggleHelpMenu}
              >
                Нужна помощь
              </button>

              {helpMenuOpen && (
                <div className="mobile-help">
                  <ul className="mobile-help__contacts">
                    <li>
                      <img src={emailIcon} alt="" />
                      <a href="mailto:example@mail.ru">example@mail.ru</a>
                    </li>
                    <li>
                      <img src={phoneIcon} alt="" />
                      <a href="tel:+78005553535">8 (800) 555-35-35</a>
                    </li>
                    <li>
                      <img src={locationIcon} alt="" />
                      <span>ул. Пушкина, д. Колотушкина</span>
                    </li>
                  </ul>

                  <div className="mobile-help__socials">
                    <a href="#" aria-label="Одноклассники">
                      <img src={okIcon} alt="Одноклассники" />
                    </a>
                    <a href="#" aria-label="VK">
                      <img src={vkIcon} alt="VK" />
                    </a>
                    <a href="#" aria-label="MAX">
                      <img src={maxIcon} alt="MAX" />
                    </a>
                  </div>
                </div>
              )}

              <Link to="/register" className="mobile-menu__link" onClick={closeMenu}>
                Регистрация
              </Link>
            </nav>
          </div>
        </div>
      ) : (
        <div className={`mobile-menu ${isOpen ? "is-open" : ""}`} id="mobileMenu">
          <div className="container mobile-menu__inner">
            <nav className="mobile-menu__nav">
              <Link to="/" className="mobile-menu__link" onClick={closeMenu}>
                Главная
              </Link>
              <Link to="/events" className="mobile-menu__link" onClick={closeMenu}>
                Мероприятия
              </Link>
              <Link to="/profile" className="mobile-menu__link" onClick={closeMenu}>
                Профиль
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}