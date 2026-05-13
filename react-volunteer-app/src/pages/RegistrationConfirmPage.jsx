import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmRegistration } from "../api";
import "./LoginPage.css";

export default function RegistrationConfirmPage() {
  const [searchParams] = useSearchParams();

  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const confirmStartedRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Подтверждаем регистрацию...");

  useEffect(() => {
    async function confirm() {
      if (confirmStartedRef.current) {
        return;
      }

      confirmStartedRef.current = true;

      if (!token) {
        setStatus("error");
        setMessage("Ссылка подтверждения некорректна");
        return;
      }

      try {
        const data = await confirmRegistration(token);

        setStatus("success");
        setMessage(
          data?.message ||
            "Регистрация подтверждена. Теперь вы можете войти в аккаунт."
        );
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Не удалось подтвердить регистрацию");
      }
    }

    confirm();
  }, [token]);

  return (
    <main>
      <section className="login-hero">
        <div className="container">
          <div className="login-hero__head">
            <h1 className="login-hero__title">Подтверждение регистрации</h1>
            <p className="login-hero__subtitle">
              Проверяем ссылку подтверждения аккаунта
            </p>
          </div>

          <div className="login-card">
            <h2 className="login-card__title">
              {status === "success"
                ? "Регистрация подтверждена"
                : status === "error"
                  ? "Ошибка подтверждения"
                  : "Подтверждение"}
            </h2>

            <div className="login-form">
              {status === "loading" ? (
                <p className="login-form__info">{message}</p>
              ) : null}

              {status === "success" ? (
                <p className="login-form__success">{message}</p>
              ) : null}

              {status === "error" ? (
                <p className="login-form__error">{message}</p>
              ) : null}

              <Link
                to="/login"
                className="login-form__submit login-form__submit--link"
              >
                Перейти ко входу
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}