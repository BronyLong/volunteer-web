import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EventCreatePage from "../src/pages/EventCreatePage";

const mockCreateEvent = vi.fn();
const mockGetCategories = vi.fn();
const mockGetUserFromToken = vi.fn();
const mockGetCoordinatorNotificationVolunteers = vi.fn();
const mockNavigate = vi.fn();

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");

  return {
    ...actual,
    createEvent: (...args) => mockCreateEvent(...args),
    getCategories: (...args) => mockGetCategories(...args),
    getUserFromToken: (...args) => mockGetUserFromToken(...args),
    getCoordinatorNotificationVolunteers: (...args) => mockGetCoordinatorNotificationVolunteers(...args),
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage(route = "/events/create") {
  return render(
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/events/create" element={<EventCreatePage />} />
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

describe("EventCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mockGetUserFromToken.mockReturnValue({
      id: 10,
      role: "coordinator",
    });

    mockGetCategories.mockResolvedValue(categories);
    mockGetCoordinatorNotificationVolunteers.mockResolvedValue([]);

    mockCreateEvent.mockResolvedValue({
      event: {
        id: 99,
      },
    });
  });

  it("loads categories and renders create form", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /новое мероприятие/i })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/название мероприятия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/описание мероприятия/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/категория/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/количество мест/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/место проведения/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/дата проведения/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/время проведения/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/длительность, минут/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetCategories).toHaveBeenCalled();
    });
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

  it("shows categories loading error", async () => {
    mockGetCategories.mockRejectedValue(new Error("Не удалось загрузить категории"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить категории/i)
    ).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    expect(
      await screen.findByText(/заполните все обязательные поля/i)
    ).toBeInTheDocument();

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("adds and removes tasks", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    fireEvent.change(screen.getByPlaceholderText(/новая задача/i), {
      target: {
        value: "Собрать мусор",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    expect(screen.getByDisplayValue("Собрать мусор")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /удалить задачу/i }));

    expect(screen.queryByDisplayValue("Собрать мусор")).not.toBeInTheDocument();
  });

  it("adds task by Enter key", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    const taskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(taskInput, {
      target: {
        value: "Выдать перчатки",
      },
    });

    fireEvent.keyDown(taskInput, { key: "Enter" });

    expect(screen.getByDisplayValue("Выдать перчатки")).toBeInTheDocument();
  });

  it("shows image type error", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

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

  it("shows image loading error when image loading fails", async () => {
    mockCanvasImageError();

    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

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

    await screen.findByRole("heading", { name: /новое мероприятие/i });

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

  it("uploads image and creates event", async () => {
    mockCanvasSuccess();

    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

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
        value: "Субботник",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Описание мероприятия",
      },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: {
        value: "1",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Парк Победы",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-05-10",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "10:30",
      },
    });

    fireEvent.change(screen.getByLabelText(/длительность, минут/i), {
      target: {
        value: "150",
      },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: {
        value: "25",
      },
    });

    fireEvent.change(screen.getByPlaceholderText(/новая задача/i), {
      target: {
        value: "Собрать мусор",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        title: "Субботник",
        image_url: "data:image/jpeg;base64,resized-image",
        description: "Описание мероприятия",
        start_at: "2099-05-10T10:30:00",
        location: "Парк Победы",
        location_latitude: null,
        location_longitude: null,
        tasks: ["Собрать мусор"],
        participant_limit: 25,
        duration_minutes: 150,
        category_id: "1",
        is_urgent: false,
        notify_specific_volunteers: false,
        notify_volunteer_ids: [],
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/99");
  });

  it("creates event without image", async () => {
    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "Субботник",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Описание мероприятия",
      },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: {
        value: "1",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Парк Победы",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-05-10",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "10:30",
      },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: {
        value: "25",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        title: "Субботник",
        image_url: null,
        description: "Описание мероприятия",
        start_at: "2099-05-10T10:30:00",
        location: "Парк Победы",
        location_latitude: null,
        location_longitude: null,
        tasks: [],
        participant_limit: 25,
        duration_minutes: 120,
        category_id: "1",
        is_urgent: false,
        notify_specific_volunteers: false,
        notify_volunteer_ids: [],
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/99");
  });

  it("navigates to events list when response has no created event id", async () => {
    mockCreateEvent.mockResolvedValue({});

    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "Субботник",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Описание мероприятия",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Парк Победы",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-05-10",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "10:30",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/events");
    });
  });

  it("shows create fallback error", async () => {
    mockCreateEvent.mockRejectedValue({});

    renderPage();

    await screen.findByRole("heading", { name: /новое мероприятие/i });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        value: "Субботник",
      },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: {
        value: "Описание мероприятия",
      },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: {
        value: "Парк Победы",
      },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: {
        value: "2099-05-10",
      },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: {
        value: "10:30",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    expect(
      await screen.findByText(/не удалось создать мероприятие/i)
    ).toBeInTheDocument();
  });

  it("loads all category icon branches", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "coordinator",
    });
  
    mockGetCategories.mockResolvedValue([
      { id: 1, name: "Экология" },
      { id: 2, name: "Детям" },
      { id: 3, name: "Животным" },
      { id: 4, name: "Пожилым" },
      { id: 5, name: "Другое" },
    ]);
  
    renderPage();
  
    expect(await screen.findByRole("heading", { name: /новое мероприятие/i })).toBeInTheDocument();
  
    expect(screen.getByRole("option", { name: "Экология" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Детям" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Животным" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Пожилым" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Другое" })).toBeInTheDocument();
  });
  
  it("normalizes empty places and duration on blur", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "coordinator",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    renderPage();
  
    await screen.findByRole("heading", { name: /новое мероприятие/i });
  
    const placesInput = screen.getByLabelText(/количество мест/i);
    const durationInput = screen.getByLabelText(/длительность/i);
  
    fireEvent.change(placesInput, {
      target: {
        name: "places",
        value: "",
      },
    });
  
    expect(placesInput).toHaveValue(null);
  
    fireEvent.blur(placesInput);
  
    expect(placesInput).toHaveValue(1);
  
    fireEvent.change(durationInput, {
      target: {
        name: "durationMinutes",
        value: "",
      },
    });
  
    expect(durationInput).toHaveValue(null);
  
    fireEvent.blur(durationInput);
  
    expect(durationInput).toHaveValue(1);
  });
  
  it("ignores numeric values lower than one", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "coordinator",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    renderPage();
  
    await screen.findByRole("heading", { name: /новое мероприятие/i });
  
    const placesInput = screen.getByLabelText(/количество мест/i);
    const durationInput = screen.getByLabelText(/длительность/i);
  
    expect(placesInput).toHaveValue(20);
    expect(durationInput).toHaveValue(120);
  
    fireEvent.change(placesInput, {
      target: {
        name: "places",
        value: "0",
      },
    });
  
    fireEvent.change(durationInput, {
      target: {
        name: "durationMinutes",
        value: "0",
      },
    });
  
    expect(placesInput).toHaveValue(20);
    expect(durationInput).toHaveValue(120);
  });
  
  it("clears visible error after changing a regular field", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "coordinator",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    renderPage();
  
    await screen.findByRole("heading", { name: /новое мероприятие/i });
  
    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));
  
    expect(screen.getByText(/заполните все обязательные поля/i)).toBeInTheDocument();
  
    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: {
        name: "title",
        value: "Новое название",
      },
    });
  
    expect(screen.queryByText(/заполните все обязательные поля/i)).not.toBeInTheDocument();
  });
  
  it("ignores adding empty task", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "coordinator",
    });
  
    mockGetCategories.mockResolvedValue([{ id: 1, name: "Экология" }]);
  
    renderPage();
  
    await screen.findByRole("heading", { name: /новое мероприятие/i });
  
    fireEvent.change(screen.getByPlaceholderText(/новая задача/i), {
      target: {
        value: "   ",
      },
    });
  
    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));
  
    expect(screen.queryByDisplayValue("   ")).not.toBeInTheDocument();
  });

  it("resizes oversized uploaded image before create request", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const drawImage = vi.fn();
    const toDataURL = vi.fn(() => "data:image/jpeg;base64,resized-large-image");
  
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage,
          }),
          toDataURL,
        };
      }
  
      return originalCreateElement(tagName);
    });
  
    class FileReaderMock {
      constructor() {
        this.result = "data:image/png;base64,original-file";
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
        this.width = 2400;
        this.height = 1800;
      }
  
      set src(_) {
        this.onload?.();
      }
    }
  
    vi.stubGlobal("FileReader", FileReaderMock);
    vi.stubGlobal("Image", ImageMock);
  
    renderPage();
  
    const input = await screen.findByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "large.png", { type: "image/png" });
  
    fireEvent.change(input, {
      target: { files: [file] },
    });
  
    await waitFor(() => {
      expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);
    });
  
    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: { value: "Новое мероприятие" },
    });
  
    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: { value: "Описание мероприятия" },
    });
  
    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { value: "20" },
    });
  
    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: { value: "Парк" },
    });
  
    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: { value: "2099-05-10" },
    });
  
    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: { value: "10:30" },
    });
  
    fireEvent.change(screen.getByLabelText(/длительность/i), {
      target: { value: "120" },
    });
  
    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));
  
    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          image_url: "data:image/jpeg;base64,resized-large-image",
        })
      );
    });
  
    expect(drawImage).toHaveBeenCalled();
  });
  
  it("updates an already added task before submit", async () => {
    renderPage();
  
    const newTaskInput = await screen.findByPlaceholderText(/новая задача/i);
  
    fireEvent.change(newTaskInput, {
      target: { value: "Старая задача" },
    });
  
    fireEvent.keyDown(newTaskInput, { key: "Enter" });
  
    const taskInput = screen.getByDisplayValue("Старая задача");
  
    fireEvent.change(taskInput, {
      target: { value: "Обновленная задача" },
    });
  
    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: { value: "Новое мероприятие" },
    });
  
    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: { value: "Описание мероприятия" },
    });
  
    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { value: "20" },
    });
  
    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: { value: "Парк" },
    });
  
    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: { value: "2099-05-10" },
    });
  
    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: { value: "10:30" },
    });
  
    fireEvent.change(screen.getByLabelText(/длительность/i), {
      target: { value: "120" },
    });
  
    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));
  
    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tasks: ["Обновленная задача"],
        })
      );
    });
  });
});
