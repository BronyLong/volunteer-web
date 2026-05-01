import "./HelpPage.css";

import emailIcon from "../assets/SVG/email_footer.svg";
import phoneIcon from "../assets/SVG/phone_footer.svg";
import locationIcon from "../assets/SVG/location_footer.svg";

import okIcon from "../assets/SVG/odnoklassnini.svg";
import vkIcon from "../assets/SVG/vkontakte.svg";
import maxIcon from "../assets/SVG/max.svg";

export default function HelpPage() {
  return (
    <main className="help-page">
      <section className="help-section">
        <div className="container">
          <div className="help-card">
            <h1 className="help-card__title">Нужна помощь</h1>
            <p className="help-card__subtitle">
              Свяжитесь с нами любым удобным способом
            </p>

            <div className="help-card__divider"></div>

            <ul className="help-contacts">
              <li className="help-contacts__item">
                <img src={emailIcon} alt="" className="help-contacts__icon" />
                <a href="mailto:example@mail.ru">example@mail.ru</a>
              </li>

              <li className="help-contacts__item">
                <img src={phoneIcon} alt="" className="help-contacts__icon" />
                <a href="tel:+78005553535">8 (800) 555-35-35</a>
              </li>

              <li className="help-contacts__item">
                <img src={locationIcon} alt="" className="help-contacts__icon" />
                <span>ул. Пушкина, д. Колотушкина</span>
              </li>
            </ul>

            <div className="help-card__divider"></div>

            <div className="help-socials">
              <h2 className="help-socials__title">Мы в социальных сетях</h2>

              <div className="help-socials__list">
                <a href="#" className="help-socials__link" aria-label="Одноклассники">
                  <img src={okIcon} alt="Одноклассники" className="help-socials__icon" />
                </a>

                <a href="#" className="help-socials__link" aria-label="VK">
                  <img src={vkIcon} alt="VK" className="help-socials__icon" />
                </a>

                <a href="#" className="help-socials__link" aria-label="MAX">
                  <img src={maxIcon} alt="MAX" className="help-socials__icon" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}