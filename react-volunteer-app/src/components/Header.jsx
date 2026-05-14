import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import "./Header.css";

import logoHeart from "../assets/SVG/logoHeart.svg";
import logoText from "../assets/SVG/logoText.svg";
import accountOutline from "../assets/SVG/accountOutline.svg";
import defaultAvatar from "../assets/images/avatar_man.png";
import { getProfileAvatar } from "../utils/avatarUtils";
import exitIcon from "../assets/SVG/exit.svg";

import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import locationIcon from "../assets/SVG/location_footer.svg";

import okIcon from "../assets/SVG/odnoklassniki.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";

import { getMyProfile, getToken, getUnreadNotificationsCount, removeToken } from "../api";

function getUserIdFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.id || null;
  } catch {
    return null;
  }
}

export default function Header({
  variant: variantProp,
  avatar = defaultAvatar,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const helpMenuRef = useRef(null);
  const desktopProfileMenuRef = useRef(null);
  const mobileProfileMenuRef = useRef(null);

  const [authVariant, setAuthVariant] = useState("public");
  const [userId, setUserId] = useState(null);
  const [userAvatar, setUserAvatar] = useState(avatar);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  const toggleHelpMenu = () => setHelpMenuOpen((prev) => !prev);
  const closeHelpMenu = () => setHelpMenuOpen(false);

  const toggleProfileMenu = () => setProfileMenuOpen((prev) => !prev);
  const closeProfileMenu = () => setProfileMenuOpen(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target)) {
        closeHelpMenu();
      }

      const clickedInsideDesktopMenu =
        desktopProfileMenuRef.current && desktopProfileMenuRef.current.contains(event.target);
      const clickedInsideMobileMenu =
        mobileProfileMenuRef.current && mobileProfileMenuRef.current.contains(event.target);

      if (!clickedInsideDesktopMenu && !clickedInsideMobileMenu) {
        closeProfileMenu();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeHelpMenu();
        closeProfileMenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    async function syncHeaderAuth() {
      const token = getToken();

      if (!token) {
        setAuthVariant("public");
        setUserId(null);
        setUserAvatar(avatar);
        setUnreadNotificationsCount(0);
        return;
      }

      const tokenUserId = getUserIdFromToken();

      try {
        const profile = await getMyProfile();

        setAuthVariant("private");
        setUserId(profile?.id || tokenUserId);
        setUserAvatar(profile?.avatar_url || getProfileAvatar(profile));

        if (profile?.role === "volunteer" || profile?.role === "coordinator") {
          try {
            const unreadData = await getUnreadNotificationsCount();
            setUnreadNotificationsCount(Number(unreadData?.count || 0));
          } catch {
            setUnreadNotificationsCount(0);
          }
        } else {
          setUnreadNotificationsCount(0);
        }
      } catch {
        removeToken();
        setAuthVariant("public");
        setUserId(null);
        setUserAvatar(avatar);
        setUnreadNotificationsCount(0);
      }
    }

    syncHeaderAuth();
  }, [location.pathname, avatar]);

  function handleLogout() {
    removeToken();
    closeMenu();
    closeHelpMenu();
    closeProfileMenu();
    setAuthVariant("public");
    setUserId(null);
    setUserAvatar(avatar);
    setUnreadNotificationsCount(0);
    navigate("/");
  }

  function handleProfileMenuLinkClick() {
    closeProfileMenu();
    closeMenu();
  }

  const variant = variantProp || authVariant;
  const profileLink = userId ? `/profiles/${userId}` : "/login";
  const notificationsLink = userId ? `/profiles/${userId}/notifications` : "/login";
  const hasUnreadNotifications = unreadNotificationsCount > 0;

  const profileMenu = (
    <div
      className={`header-profile-menu ${profileMenuOpen ? "is-open" : ""}`}
      role="dialog"
      aria-label="Меню профиля"
    >
      <Link
        to={profileLink}
        className="header-profile-menu__item"
        onClick={handleProfileMenuLinkClick}
      >
        <span>Профиль</span>
      </Link>

      <Link
        to={notificationsLink}
        className="header-profile-menu__item"
        onClick={handleProfileMenuLinkClick}
      >
        <span>Уведомления</span>
        <span
          className="header-profile-menu__counter"
          aria-label={`Непрочитанных уведомлений: ${unreadNotificationsCount}`}
        >
          {unreadNotificationsCount}
        </span>
      </Link>

      <div className="header-profile-menu__divider"></div>

      <button
        type="button"
        className="header-profile-menu__item header-profile-menu__item--logout"
        onClick={handleLogout}
      >
        <span>Выйти из аккаунта</span>
        <img src={exitIcon} alt="" className="header-profile-menu__logout-icon" />
      </button>
    </div>
  );

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
                <Link to="/events" className="btn btn--green" onClick={closeMenu}>
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
                to={profileLink}
                className={() =>
                  `header__nav-link ${
                    location.pathname.startsWith("/profiles/") ? "header__nav-link--active" : ""
                  }`
                }
              >
                Профиль
              </NavLink>
            </nav>

            <div className="header__user" ref={desktopProfileMenuRef}>
              <button
                type="button"
                className="header__button-reset header__avatar-link"
                aria-label="Открыть меню профиля"
                aria-haspopup="dialog"
                aria-expanded={profileMenuOpen}
                onClick={toggleProfileMenu}
              >
                <img src={userAvatar || avatar} alt="Аватар пользователя" className="header__avatar" />
                {hasUnreadNotifications ? (
                  <span className="header__notification-badge" aria-label="Есть новые уведомления">
                    <span className="header__notification-mark" aria-hidden="true"></span>
                  </span>
                ) : null}
              </button>

              {profileMenu}
            </div>

            <div className="header__mobile">
              <div className="header__profile-menu-anchor" ref={mobileProfileMenuRef}>
                <button
                  type="button"
                  className="header__button-reset header__avatar-link header__avatar-link--mobile"
                  aria-label="Открыть меню профиля"
                  aria-haspopup="dialog"
                  aria-expanded={profileMenuOpen}
                  onClick={toggleProfileMenu}
                >
                  <img src={userAvatar || avatar} alt="Аватар пользователя" className="header__avatar" />
                  {hasUnreadNotifications ? (
                    <span className="header__notification-badge" aria-label="Есть новые уведомления">
                      <span className="header__notification-mark" aria-hidden="true"></span>
                    </span>
                  ) : null}
                </button>

                {profileMenu}
              </div>

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

              <Link to="/login" className="mobile-menu__link" onClick={closeMenu}>
                Войти
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

              <Link to={profileLink} className="mobile-menu__link" onClick={closeMenu}>
                Профиль
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
