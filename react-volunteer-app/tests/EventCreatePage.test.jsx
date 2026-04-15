import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import EventCreatePage from "../src/pages/EventCreatePage";

const mockNavigate = vi.fn();
const mockCreateEvent = vi.fn();
const mockGetCategories = vi.fn();
const mockGetUserFromToken = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../src/api", async () => {
  const actual = await vi.importActual("../src/api");
  return {
    ...actual,
    createEvent: (...args) => mockCreateEvent(...args),
    getCategories: (...args) => mockGetCategories(...args),
    getUserFromToken: (...args) => mockGetUserFromToken(...args),
  };
});

function renderPage() {
  return render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <EventCreatePage />
    </MemoryRouter>
  );
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
    target: { value: "Субботник" },
  });

  fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
    target: { value: "Описание мероприятия" },
  });

  fireEvent.change(screen.getByLabelText(/место проведения/i), {
    target: { value: "Парк Победы" },
  });

  fireEvent.change(screen.getByLabelText(/дата проведения/i), {
    target: { value: "2099-05-10" },
  });

  fireEvent.change(screen.getByLabelText(/время проведения/i), {
    target: { value: "10:30" },
  });
}

function addTask(taskText = "Собрать мусор") {
  const newTaskInput = screen.getByPlaceholderText(/новая задача/i);

  fireEvent.change(newTaskInput, {
    target: { value: taskText },
  });

  fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));
}

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
      this.result = "data:image/png;base64,original-file";
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      if (this.onload) {
        this.onload();
      }
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.width = 1600;
      this.height = 900;
    }

    set src(_) {
      if (this.onload) {
        this.onload();
      }
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
  vi.stubGlobal("Image", ImageMock);
}

function mockFileReaderError() {
  class FileReaderMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL() {
      if (this.onerror) {
        this.onerror(new Error("read error"));
      }
    }
  }

  vi.stubGlobal("FileReader", FileReaderMock);
}

function mockImageLoadError() {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, "createElement").mockImplementation((tagName) => {
    if (tagName === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
        }),
        toDataURL: () => "data:image/jpeg;base64,never-used",
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
      if (this.onload) {
        this.onload();
      }
    }
  }

  class ImageMock {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }

    set src(_) {
      if (this.onerror) {
        this.onerror(new Error("image load error"));
      }
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
      this.width = 1600;
      this.height = 900;
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

    window.scrollTo = vi.fn();

    mockGetUserFromToken.mockReturnValue({
      id: 10,
      role: "coordinator",
    });

    mockGetCategories.mockResolvedValue([
      { id: 1, name: "Экология" },
      { id: 2, name: "Детям" },
    ]);

    mockCreateEvent.mockResolvedValue({
      event: { id: 55 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to login when user is not authorized", async () => {
    mockGetUserFromToken.mockReturnValue(null);

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("redirects to home when user role is volunteer", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 15,
      role: "volunteer",
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("allows admin to access the page", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /новое мероприятие/i })
    ).toBeInTheDocument();
  });

  it("loads categories and sets the first category by default", async () => {
    renderPage();

    const categorySelect = await screen.findByLabelText(/категория/i);

    expect(mockGetCategories).toHaveBeenCalledTimes(1);
    expect(categorySelect.value).toBe("1");
    expect(screen.getByRole("option", { name: "Экология" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Детям" })).toBeInTheDocument();
  });

  it("shows category loading error", async () => {
    mockGetCategories.mockRejectedValue(new Error("Не удалось загрузить категории"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить категории/i)
    ).toBeInTheDocument();
  });

  it("adds a task by Enter and removes it", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    const newTaskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(newTaskInput, {
      target: { value: "Подготовить инвентарь" },
    });

    fireEvent.keyDown(newTaskInput, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    expect(screen.getByDisplayValue("Подготовить инвентарь")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /удалить задачу/i }));

    expect(
      screen.queryByDisplayValue("Подготовить инвентарь")
    ).not.toBeInTheDocument();
  });

  it("does not add an empty task", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    const newTaskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(newTaskInput, {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    expect(
      screen.queryByRole("button", { name: /удалить задачу/i })
    ).not.toBeInTheDocument();
  });

  it("resets places to 1 on blur when value is empty", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    const placesInput = screen.getByLabelText(/количество мест/i);

    fireEvent.change(placesInput, {
      target: { value: "" },
    });

    expect(placesInput.value).toBe("");

    fireEvent.blur(placesInput);

    expect(placesInput.value).toBe("1");
  });

  it("does not allow places lower than 1", async () => {
    renderPage();
  
    await screen.findByLabelText(/категория/i);
  
    const placesInput = screen.getByLabelText(/количество мест/i);
  
    expect(placesInput.value).toBe("20");
  
    fireEvent.change(placesInput, {
      target: { value: "0" },
    });
  
    expect(placesInput.value).toBe("20");
  });

  it("shows validation error when required fields are empty", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    expect(
      await screen.findByText(/заполните все обязательные поля/i)
    ).toBeInTheDocument();

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it("shows error when a non-image file is selected", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["test"], "doc.txt", { type: "text/plain" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(await screen.findByText(/выберите изображение/i)).toBeInTheDocument();
  });

  it("shows image read error when FileReader fails", async () => {
    mockFileReaderError();

    renderPage();

    await screen.findByLabelText(/категория/i);

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/не удалось прочитать файл/i)
    ).toBeInTheDocument();
  });

  it("shows image processing error when Image fails to load", async () => {
    mockImageLoadError();

    renderPage();

    await screen.findByLabelText(/категория/i);

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/не удалось загрузить изображение/i)
    ).toBeInTheDocument();
  });

  it("resizes valid image and sends image_url in payload", async () => {
    mockCanvasSuccess("data:image/jpeg;base64,resized-image");

    renderPage();

    await screen.findByLabelText(/категория/i);

    fillRequiredFields();
    addTask("Собрать мусор");

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["img"], "poster.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getAllByAltText(/превью изображения/i).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { value: "25" },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        title: "Субботник",
        image_url: "data:image/jpeg;base64,resized-image",
        description: "Описание мероприятия",
        start_at: "2099-05-10T10:30:00",
        location: "Парк Победы",
        tasks: ["Собрать мусор"],
        participant_limit: 25,
        category_id: "2",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("creates event and navigates to created event page", async () => {
    renderPage();

    await screen.findByLabelText(/категория/i);

    fillRequiredFields();
    addTask("Собрать мусор");

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { value: "25" },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: { value: "2" },
    });

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith({
        title: "Субботник",
        image_url: null,
        description: "Описание мероприятия",
        start_at: "2099-05-10T10:30:00",
        location: "Парк Победы",
        tasks: ["Собрать мусор"],
        participant_limit: 25,
        category_id: "2",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("navigates to /events when created event id is missing", async () => {
    mockCreateEvent.mockResolvedValue({});

    renderPage();

    await screen.findByLabelText(/категория/i);

    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });

  it("shows create event error", async () => {
    mockCreateEvent.mockRejectedValue(new Error("Не удалось создать мероприятие"));

    renderPage();

    await screen.findByLabelText(/категория/i);

    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: /создать мероприятие/i }));

    expect(
      await screen.findByText(/не удалось создать мероприятие/i)
    ).toBeInTheDocument();
  });

  it("uses fallback icon for unknown category name", async () => {
    mockGetCategories.mockResolvedValueOnce([{ id: 9, name: "Другое" }]);
  
    const { container } = renderPage();
  
    await screen.findByLabelText(/категория/i);
  
    const selectWrap = container.querySelector(".select-wrap");
    expect(selectWrap).toBeInTheDocument();
  
    const style = selectWrap.getAttribute("style");
    expect(style).toContain("--category-icon:");
    expect(style).toContain("data:image/svg+xml");
  });
  
  it("changes category icon when selected category changes", async () => {
    mockGetCategories.mockResolvedValueOnce([
      { id: 3, name: "Животным" },
      { id: 4, name: "Пожилым" },
    ]);
  
    const { container } = renderPage();
  
    const categorySelect = await screen.findByLabelText(/категория/i);
    const selectWrap = container.querySelector(".select-wrap");
  
    expect(selectWrap).toBeInTheDocument();
  
    const initialStyle = selectWrap.getAttribute("style");
    expect(initialStyle).toContain("--category-icon:");
    expect(initialStyle).toContain("data:image/svg+xml");
  
    fireEvent.change(categorySelect, {
      target: { value: "4" },
    });
  
    const updatedStyle = selectWrap.getAttribute("style");
    expect(updatedStyle).toContain("--category-icon:");
    expect(updatedStyle).toContain("data:image/svg+xml");
    expect(updatedStyle).not.toBe(initialStyle);
  });
  
  it("shows image processing error when canvas context is unavailable", async () => {
    mockCanvasContextError();
  
    renderPage();
  
    const input = await screen.findByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "photo.png", { type: "image/png" });
  
    fireEvent.change(input, {
      target: { files: [file] },
    });
  
    expect(
      await screen.findByText(/не удалось обработать изображение/i)
    ).toBeInTheDocument();
  });

  it("updates an already added task", async () => {
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
  
    expect(screen.getByDisplayValue("Обновленная задача")).toBeInTheDocument();
  });
});