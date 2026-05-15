import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import PrivacyPage from "../src/pages/PrivacyPage";

function renderPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <PrivacyPage />
    </MemoryRouter>
  );
}

describe("PrivacyPage", () => {
  it("renders personal data policy sections", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /политика обработки персональных данных/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /обрабатываемые данные/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /сроки хранения/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /защита данных/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /права пользователя/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /вернуться к регистрации/i })).toHaveAttribute("href", "/register");
  });
});
