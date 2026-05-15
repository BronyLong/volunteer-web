import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventEditPage from "../src/pages/EventEditPage";

const mockDeleteEvent = vi.fn();
const mockGetCategories = vi.fn();
const mockGetEventById = vi.fn();
const mockGetUserFromToken = vi.fn();
const mockUpdateEvent = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");

  return {
    ...actual,
    deleteEvent: (...args) => mockDeleteEvent(...args),
    getCategories: (...args) => mockGetCategories(...args),
    getEventById: (...args) => mockGetEventById(...args),
    getUserFromToken: (...args) => mockGetUserFromToken(...args),
    updateEvent: (...args) => mockUpdateEvent(...args),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(route = "/events/55/edit") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/events/:id/edit" element={<EventEditPage />} />
        <Route path="/events/:id" element={<div>Event page</div>} />
        <Route path="/events" element={<div>Events page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/" element={<div>Main page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const categories = [
  {
    id: 1,
    name: "Экология",
  },
  {
    id: 2,
    name: "Животные",
  },
];

const event = {
  id: 55,
  title: "Старое название",
  category_id: 1,
  category_name: "Экология",
  image_url: "data:image/jpeg;base64,old-image",
  description: "Старое описание",
  start_at: "2099-05-10T10:30:00.000Z",
  duration_minutes: 90,
  location: "Старый парк",
  tasks: ["Старая задача"],
  participant_limit: 20,
  available_slots: 10,
  creator_id: 10,
};

function mockCanvasSuccess(dataUrl = "data:image/jpeg;base64,resized-image") {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
        }),
        toDataURL: () => dataUrl,
      };
    }

    return originalCreateElement(tagName);
  });

  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      this.onload?.();
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 1200;
      this.height = 800;
    }

    set src(_) {
      this.onload?.();
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

function mockCanvasImageError() {
  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      this.onload?.();
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    set src(_) {
      this.onerror?.();
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

function mockCanvasContextError() {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => null,
        toDataURL: () => "data:image/jpeg;base64,never-used",
      };
    }

    return originalCreateElement(tagName);
  });

  class FileReaderMock {
    constructor() {
      this.result = "data:image/png;base64,file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      this.onload?.();
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 1200;
      this.height = 800;
    }

    set src(_) {
      this.onload?.();
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

describe("EventEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mockGetUserFromToken.mockReturnValue({
      id: 10,
      role: "coordinator",
    });

    mockGetCategories.mockResolvedValue(categories);
    mockGetEventById.mockResolvedValue(event);
    mockUpdateEvent.mockResolvedValue({ success: true });
    mockDeleteEvent.mockResolvedValue({ success: true });

    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("loads event and renders edit form", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Старое название")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Старое описание")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Старый парк")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Старая задача")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("90")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /изменить мероприятие/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetCategories).toHaveBeenCalled();
      expect(mockGetEventById).toHaveBeenCalledWith("55");
    });
  });

  it("shows loading state", () => {
    mockGetEventById.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/загрузка мероприятия/i)).toBeInTheDocument();
  });

  it("redirects guest to login", () => {
    mockGetUserFromToken.mockReturnValue(null);

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("redirects volunteer to main page", () => {
    mockGetUserFromToken.mockReturnValue({
      id: 22,
      role: "volunteer",
    });

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("redirects non-owner coordinator to event page", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 99,
      role: "coordinator",
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/events/55", { replace: true });
    });
  });

  it("allows admin to edit event even if admin is not creator", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 99,
      role: "admin",
    });

    renderPage();

    expect(await screen.findByDisplayValue("Старое название")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /изменить мероприятие/i })
    ).toBeInTheDocument();
  });

  it("shows load error", async () => {
    mockGetEventById.mockRejectedValue(new Error("Не удалось загрузить мероприятие"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("shows categories loading error", async () => {
    mockGetCategories.mockRejectedValue(new Error("Не удалось загрузить категории"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить категории/i)
    ).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    expect(
      await screen.findByText(/заполните все обязательные поля/i)
    ).toBeInTheDocument();

    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it("adds and removes tasks", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.change(screen.getByPlaceholderText(/новая задача/i), {
      target: {
        value: "Выдать перчатки",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    expect(screen.getByDisplayValue("Старая задача")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Выдать перчатки")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /удалить задачу/i })[0]);

    expect(screen.queryByDisplayValue("Старая задача")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Выдать перчатки")).toBeInTheDocument();
  });

  it("adds task by Enter key", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    const taskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(taskInput, {
      target: {
        value: "Принести мешки",
      },
    });

    fireEvent.keyDown(taskInput, { key: "Enter" });

    expect(screen.getByDisplayValue("Принести мешки")).toBeInTheDocument();
  });

  it("shows image type error", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    const input = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["text"], "file.txt", {
      type: "text/plain",
    });

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByText(/выберите изображение/i)).toBeInTheDocument();
  });

  it("shows image loading error", async () => {
    mockCanvasImageError();

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    const input = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "photo.png", {
      type: "image/png",
    });

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(
      await screen.findByText(/не удалось загрузить изображение/i)
    ).toBeInTheDocument();
  });

  it("shows image processing error when canvas context is unavailable", async () => {
    mockCanvasContextError();

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    const input = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "photo.png", {
      type: "image/png",
    });

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(
      await screen.findByText(/не удалось обработать изображение/i)
    ).toBeInTheDocument();
  });

  it("updates event with uploaded image", async () => {
    mockCanvasSuccess();

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    const input = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "photo.png", {
      type: "image/png",
    });

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(await screen.findByAltText(/превью изображения/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "Новое название",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Новое описание",
      },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: {
        value: "2",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Новый парк",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-06-15",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "12:45",
      },
    });

    fireEvent.change(screen.getByLabelText(/длительность, минут/i), {
      target: {
        value: "150",
      },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: {
        value: "35",
      },
    });

    fireEvent.change(screen.getByDisplayValue("Старая задача"), {
      target: {
        value: "Собрать мусор",
      },
    });

    fireEvent.change(screen.getByPlaceholderText(/новая задача/i), {
      target: {
        value: "Выдать перчатки",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith("55", {
        title: "Новое название",
        image_url: "data:image/jpeg;base64,resized-image",
        description: "Новое описание",
        start_at: "2099-06-15T12:45:00",
        location: "Новый парк",
        location_latitude: null,
        location_longitude: null,
        tasks: ["Собрать мусор", "Выдать перчатки"],
        participant_limit: 35,
        duration_minutes: 150,
        category_id: "2",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("updates event without changing image", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "Новое название",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Новое описание",
      },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: {
        value: "2",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Новый парк",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-06-15",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "12:45",
      },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: {
        value: "35",
      },
    });

    fireEvent.change(screen.getByDisplayValue("Старая задача"), {
      target: {
        value: "Обновленная задача",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith("55", {
        title: "Новое название",
        image_url: "data:image/jpeg;base64,old-image",
        description: "Новое описание",
        start_at: "2099-06-15T12:45:00",
        location: "Новый парк",
        location_latitude: null,
        location_longitude: null,
        tasks: ["Обновленная задача"],
        participant_limit: 35,
        duration_minutes: 90,
        category_id: "2",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("shows update fallback error", async () => {
    mockUpdateEvent.mockRejectedValue({});

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    expect(
      await screen.findByText(/не удалось сохранить изменения/i)
    ).toBeInTheDocument();
  });

  it("deletes event after confirmation", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Удалить мероприятие?");
      expect(mockDeleteEvent).toHaveBeenCalledWith("55");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });

  it("does not delete event when confirmation is cancelled", async () => {
    window.confirm.mockReturnValueOnce(false);

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it("shows delete fallback error", async () => {
    mockDeleteEvent.mockRejectedValue({});

    renderPage();

    await screen.findByRole("heading", { name: /изменить мероприятие/i });

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    expect(
      await screen.findByText(/не удалось удалить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("loads all category icon branches and handles fallback event fields", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    mockGetCategories.mockResolvedValue([
      { id: 1, name: "Экология" },
      { id: 2, name: "Детям" },
      { id: 3, name: "Животным" },
      { id: 4, name: "Пожилым" },
      { id: 5, name: "Другое" },
    ]);
  
    mockGetEventById.mockResolvedValue({
      id: 55,
      creator_id: 99,
      title: "",
      description: "",
      category_id: "",
      participant_limit: "",
      location: "",
      start_at: "bad-date",
      duration_minutes: "",
      tasks: null,
      image_url: "",
    });
  
    renderPage();
  
    expect(await screen.findByRole("option", { name: "Экология" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /изменить мероприятие/i })).toBeInTheDocument();
  
    expect(screen.getByRole("option", { name: "Детям" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Животным" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Пожилым" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Другое" })).toBeInTheDocument();
  
    expect(screen.getByLabelText(/дата проведения/i)).toHaveValue("");
    expect(screen.getByLabelText(/время проведения/i)).toHaveValue("");
    expect(screen.getByLabelText(/количество мест/i)).toHaveValue(1);
    expect(screen.getByLabelText(/длительность/i)).toHaveValue(120);
  });
  
  it("normalizes empty places and duration on blur", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    mockGetEventById.mockResolvedValue({
      id: 55,
      creator_id: 99,
      title: "Старое название",
      description: "Старое описание",
      category_id: 1,
      participant_limit: 20,
      location: "Парк",
      start_at: "2099-05-10T10:30:00.000Z",
      duration_minutes: 120,
      tasks: [],
      image_url: "",
    });
  
    renderPage();
  
    await screen.findByRole("heading", { name: /изменить мероприятие/i });
  
    const placesInput = screen.getByLabelText(/количество мест/i);
    const durationInput = screen.getByLabelText(/длительность/i);
  
    fireEvent.change(placesInput, {
      target: {
        name: "places",
        value: "",
      },
    });
  
    fireEvent.blur(placesInput);
  
    expect(placesInput).toHaveValue(1);
  
    fireEvent.change(durationInput, {
      target: {
        name: "durationMinutes",
        value: "",
      },
    });
  
    fireEvent.blur(durationInput);
  
    expect(durationInput).toHaveValue(1);
  });
  
 it("ignores submit while already saving", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    mockGetEventById.mockResolvedValue({
      id: 55,
      creator_id: 99,
      title: "Старое название",
      description: "Старое описание",
      category_id: 1,
      participant_limit: 20,
      location: "Парк",
      start_at: "2099-05-10T10:30:00.000Z",
      duration_minutes: 120,
      tasks: [],
      image_url: "",
    });
  
    mockUpdateEvent.mockImplementation(() => new Promise(() => {}));
  
    renderPage();
  
    await screen.findByRole("heading", { name: /изменить мероприятие/i });
  
    const submitButton = screen.getByRole("button", {
      name: /применить изменения/i,
    });
  
    const form = submitButton.closest("form");
  
    fireEvent.click(submitButton);
  
    expect(await screen.findByRole("button", { name: /сохраняем/i })).toBeDisabled();
  
    fireEvent.submit(form);
  
    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    });
  });
  
  it("ignores delete while saving is active", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    mockGetEventById.mockResolvedValue({
      id: 55,
      creator_id: 99,
      title: "Старое название",
      description: "Старое описание",
      category_id: 1,
      participant_limit: 20,
      location: "Парк",
      start_at: "2099-05-10T10:30:00.000Z",
      duration_minutes: 120,
      tasks: [],
      image_url: "",
    });
  
    mockUpdateEvent.mockImplementation(() => new Promise(() => {}));
  
    renderPage();
  
    await screen.findByRole("heading", { name: /изменить мероприятие/i });
  
    fireEvent.click(
      screen.getByRole("button", {
        name: /применить изменения/i,
      })
    );
  
    expect(await screen.findByRole("button", { name: /сохраняем/i })).toBeDisabled();
  
    const deleteButton = screen.getByRole("button", {
      name: /удалить мероприятие/i,
    });
  
    expect(deleteButton).toBeDisabled();
  
    fireEvent.click(deleteButton);
  
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });
});
