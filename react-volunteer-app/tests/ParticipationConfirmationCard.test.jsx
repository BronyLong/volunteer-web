import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ParticipationConfirmationCard from "../src/components/ParticipationConfirmationCard";

function renderCard(props = {}) {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ParticipationConfirmationCard
        id={7}
        userId={15}
        avatar="/avatar.png"
        name="Иван"
        secondName="Петров"
        email="ivan@mail.ru"
        phone="+7 900 000-00-00"
        {...props}
      />
    </MemoryRouter>
  );
}

describe("ParticipationConfirmationCard", () => {
  it("renders pending application without confirmation actions", () => {
    renderCard();

    expect(screen.getByText("Иван Петров")).toBeInTheDocument();
    expect(screen.getByText("Заявка ожидает решения")).toBeInTheDocument();
    expect(screen.getByText("Участие не засчитывается")).toBeInTheDocument();
    expect(screen.getByText("ivan@mail.ru")).toBeInTheDocument();
    expect(screen.getByText("+7 900 000-00-00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /перейти в профиль пользователя иван петров/i })).toHaveAttribute(
      "href",
      "/profiles/15"
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders fallback name and unknown status without profile link", () => {
    renderCard({
      userId: null,
      name: "",
      secondName: "",
      status: "unknown",
    });

    expect(screen.getByText("Пользователь")).toBeInTheDocument();
    expect(screen.getByText("Статус неизвестен")).toBeInTheDocument();
    expect(screen.getByAltText("Пользователь")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("calls confirm handler for approved unconfirmed application", () => {
    const onConfirm = vi.fn();

    renderCard({
      status: "approved",
      participationConfirmed: false,
      onConfirm,
    });

    expect(screen.getByText("Заявка принята")).toBeInTheDocument();
    expect(screen.getByText("Участие не подтверждено")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /подтвердить/i }));

    expect(onConfirm).toHaveBeenCalledWith(7);
  });

  it("shows confirming state", () => {
    renderCard({
      status: "approved",
      participationConfirmed: false,
      isConfirming: true,
    });

    expect(screen.getByRole("button", { name: /подтверждение/i })).toBeDisabled();
  });

  it("calls cancel handler for confirmed application and shows confirmation note", () => {
    const onCancel = vi.fn();

    renderCard({
      status: "approved",
      participationConfirmed: true,
      participationConfirmedAt: "2099-05-10T10:30:00",
      confirmedByName: "Координатор",
      onCancel,
    });

    expect(screen.getByText("Участие подтверждено")).toBeInTheDocument();
    expect(screen.getByText(/подтверждено 10\.05\.2099/i)).toBeInTheDocument();
    expect(screen.getByText(/координатор/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /отменить/i }));

    expect(onCancel).toHaveBeenCalledWith(7);
  });

  it("shows cancelling state and skips invalid confirmation date", () => {
    renderCard({
      status: "approved",
      participationConfirmed: true,
      participationConfirmedAt: "bad-date",
      isCancelling: true,
    });

    expect(screen.getByRole("button", { name: /отмена/i })).toBeDisabled();
    expect(screen.queryByText(/подтверждено \d/i)).not.toBeInTheDocument();
  });

  it("renders rejected status", () => {
    renderCard({ status: "rejected" });

    expect(screen.getByText("Заявка отклонена")).toBeInTheDocument();
    expect(screen.getByText("Участие не засчитывается")).toBeInTheDocument();
  });
});
