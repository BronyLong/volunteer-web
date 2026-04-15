import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventEditPage from "../src/pages/EventEditPage";

const mockNavigate = vi.fn();
const mockGetCategories = vi.fn();
const mockGetEventById = vi.fn();
const mockGetUserFromToken = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();

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
    getCategories: (...args) => mockGetCategories(...args),
    getEventById: (...args) => mockGetEventById(...args),
    getUserFromToken: (...args) => mockGetUserFromToken(...args),
    updateEvent: (...args) => mockUpdateEvent(...args),
    deleteEvent: (...args) => mockDeleteEvent(...args),
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
      </Routes>
    </MemoryRouter>
  );
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

describe("EventEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    window.scrollTo = vi.fn();
    window.confirm = vi.fn(() => true);

    mockGetUserFromToken.mockReturnValue({
      id: 10,
      role: "coordinator",
    });

    mockGetCategories.mockResolvedValue([
      { id: 1, name: "Экология" },
      { id: 2, name: "Детям" },
    ]);

    mockGetEventById.mockResolvedValue({
      id: 55,
      title: "Субботник",
      description: "Описание мероприятия",
      category_id: 2,
      participant_limit: 20,
      location: "Парк Победы",
      start_at: "2099-05-10T10:30:00.000Z",
      tasks: ["Собрать мусор", "Выдать перчатки"],
      image_url: "data:image/jpeg;base64,test",
      creator_id: 10,
    });

    mockUpdateEvent.mockResolvedValue({ success: true });
    mockDeleteEvent.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading state", () => {
    mockGetCategories.mockImplementation(() => new Promise(() => {}));
    mockGetEventById.mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/загрузка мероприятия/i)).toBeInTheDocument();
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
      id: 11,
      role: "volunteer",
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("redirects coordinator to event page when they are not the owner", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 999,
      role: "coordinator",
    });

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/events/55", { replace: true });
    });
  });

  it("allows admin to edit чужое мероприятие", async () => {
    mockGetUserFromToken.mockReturnValue({
      id: 1,
      role: "admin",
    });

    renderPage();

    expect(await screen.findByDisplayValue("Субботник")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Описание мероприятия")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Парк Победы")).toBeInTheDocument();

    expect(mockNavigate).not.toHaveBeenCalledWith("/events/55", { replace: true });
  });

  it("loads categories and fills form with event data", async () => {
    renderPage();

    expect(await screen.findByDisplayValue("Субботник")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Описание мероприятия")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Парк Победы")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2099-05-10")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10:30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Собрать мусор")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Выдать перчатки")).toBeInTheDocument();
    expect(screen.getByAltText(/превью изображения/i)).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,test"
    );

    const categorySelect = screen.getByLabelText(/категория/i);
    expect(categorySelect.value).toBe("2");
  });

  it("shows loading error when page data fails", async () => {
    mockGetEventById.mockRejectedValue(new Error("Не удалось загрузить мероприятие"));

    renderPage();

    expect(
      await screen.findByText(/не удалось загрузить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("adds task by Enter and removes task", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

    const newTaskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(newTaskInput, {
      target: { value: "Принести мешки" },
    });

    fireEvent.keyDown(newTaskInput, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    expect(screen.getByDisplayValue("Принести мешки")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", {
      name: /удалить задачу/i,
    });

    fireEvent.click(removeButtons[0]);

    expect(screen.queryByDisplayValue("Собрать мусор")).not.toBeInTheDocument();
  });

  it("does not add empty task", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

    const newTaskInput = screen.getByPlaceholderText(/новая задача/i);

    fireEvent.change(newTaskInput, {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: /добавить задачу/i }));

    expect(screen.queryByDisplayValue("   ")).not.toBeInTheDocument();
  });

  it("resets places to 1 on blur when value is empty", async () => {
    renderPage();

    const placesInput = await screen.findByLabelText(/количество мест/i);

    fireEvent.change(placesInput, {
      target: { name: "places", value: "" },
    });

    expect(placesInput.value).toBe("");

    fireEvent.blur(placesInput);

    expect(placesInput.value).toBe("1");
  });

  it("does not allow places lower than 1", async () => {
    renderPage();

    const placesInput = await screen.findByLabelText(/количество мест/i);

    fireEvent.change(placesInput, {
      target: { name: "places", value: "0" },
    });

    expect(placesInput.value).toBe("20");
  });

  it("shows validation error when required fields are empty", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: { name: "title", value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    expect(
      await screen.findByText(/заполните все обязательные поля/i)
    ).toBeInTheDocument();

    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it("shows error for non-image file", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

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

    await screen.findByDisplayValue("Субботник");

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

    await screen.findByDisplayValue("Субботник");

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/не удалось загрузить изображение/i)
    ).toBeInTheDocument();
  });

  it("resizes valid image and sends updated image_url in payload", async () => {
    mockCanvasSuccess("data:image/jpeg;base64,resized-image");

    renderPage();

    await screen.findByDisplayValue("Субботник");

    const fileInput = screen.getByLabelText(/загрузить изображение/i);
    const file = new File(["img"], "poster.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getAllByAltText(/превью изображения/i).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: { name: "title", value: "Обновленный субботник" },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: { name: "description", value: "Новое описание" },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: { name: "location", value: "Новый парк" },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: { name: "date", value: "2099-06-15" },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: { name: "time", value: "12:45" },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { name: "places", value: "35" },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: { name: "category", value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith("55", {
        title: "Обновленный субботник",
        image_url: "data:image/jpeg;base64,resized-image",
        description: "Новое описание",
        start_at: "2099-06-15T12:45:00",
        location: "Новый парк",
        tasks: ["Собрать мусор", "Выдать перчатки"],
        participant_limit: 35,
        category_id: "1",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("submits updated event data without changing image", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.change(screen.getByLabelText(/название мероприятия/i), {
      target: { name: "title", value: "Обновленный субботник" },
    });

    fireEvent.change(screen.getByLabelText(/описание мероприятия/i), {
      target: { name: "description", value: "Новое описание" },
    });

    fireEvent.change(screen.getByLabelText(/место проведения/i), {
      target: { name: "location", value: "Новый парк" },
    });

    fireEvent.change(screen.getByLabelText(/дата проведения/i), {
      target: { name: "date", value: "2099-06-15" },
    });

    fireEvent.change(screen.getByLabelText(/время проведения/i), {
      target: { name: "time", value: "12:45" },
    });

    fireEvent.change(screen.getByLabelText(/количество мест/i), {
      target: { name: "places", value: "35" },
    });

    fireEvent.change(screen.getByLabelText(/категория/i), {
      target: { name: "category", value: "1" },
    });

    const taskInputs = screen.getAllByDisplayValue(/Собрать мусор|Выдать перчатки/i);
    fireEvent.change(taskInputs[0], {
      target: { value: "Обновленная задача" },
    });

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith("55", {
        title: "Обновленный субботник",
        image_url: "data:image/jpeg;base64,test",
        description: "Новое описание",
        start_at: "2099-06-15T12:45:00",
        location: "Новый парк",
        tasks: ["Обновленная задача", "Выдать перчатки"],
        participant_limit: 35,
        category_id: "1",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events/55");
  });

  it("shows update error", async () => {
    mockUpdateEvent.mockRejectedValue(new Error("Не удалось сохранить изменения"));

    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.click(screen.getByRole("button", { name: /применить изменения/i }));

    expect(
      await screen.findByText(/не удалось сохранить изменения/i)
    ).toBeInTheDocument();
  });

  it("deletes event after confirm", async () => {
    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith("Удалить мероприятие?");
      expect(mockDeleteEvent).toHaveBeenCalledWith("55");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/events");
  });

  it("does not delete event when confirm is cancelled", async () => {
    window.confirm = vi.fn(() => false);

    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    expect(window.confirm).toHaveBeenCalledWith("Удалить мероприятие?");
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it("shows delete error", async () => {
    mockDeleteEvent.mockRejectedValue(new Error("Не удалось удалить мероприятие"));

    renderPage();

    await screen.findByDisplayValue("Субботник");

    fireEvent.click(screen.getByRole("button", { name: /удалить мероприятие/i }));

    expect(
      await screen.findByText(/не удалось удалить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("uses fallback icon for unknown category on loaded event", async () => {
    mockGetCategories.mockResolvedValueOnce([{ id: 7, name: "Другое" }]);
  
    mockGetEventById.mockResolvedValueOnce({
      id: 55,
      creator_id: 10,
      title: "Субботник",
      description: "Описание",
      category_id: 7,
      participant_limit: 10,
      location: "Парк",
      start_at: "2099-05-10T10:30:00.000Z",
      tasks: [],
      image_url: "",
    });
  
    const { container } = renderPage();
  
    await screen.findByDisplayValue("Субботник");
  
    const selectWrap = container.querySelector(".select-wrap");
    expect(selectWrap).toBeInTheDocument();
  
    const style = selectWrap.getAttribute("style");
    expect(style).toContain("--category-icon:");
    expect(style).toContain("data:image/svg+xml");
  });
  
  it("changes category icon when selected category changes", async () => {
    mockGetCategories.mockResolvedValueOnce([
      { id: 2, name: "Детям" },
      { id: 4, name: "Пожилым" },
    ]);
  
    mockGetEventById.mockResolvedValueOnce({
      id: 55,
      creator_id: 10,
      title: "Субботник",
      description: "Описание",
      category_id: 2,
      participant_limit: 10,
      location: "Парк",
      start_at: "2099-05-10T10:30:00.000Z",
      tasks: [],
      image_url: "",
    });
  
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

  it("fills empty date and time when event start_at is invalid", async () => {
    mockGetCategories.mockResolvedValueOnce([
      { id: 1, name: "Экология" },
    ]);
  
    mockGetEventById.mockResolvedValueOnce({
      id: 55,
      creator_id: 10,
      title: "Субботник",
      description: "Описание",
      category_id: 1,
      participant_limit: 10,
      location: "Парк",
      start_at: "invalid-date",
      tasks: [],
      image_url: "",
    });
  
    renderPage();
  
    const dateInput = await screen.findByLabelText(/дата проведения/i);
    const timeInput = await screen.findByLabelText(/время проведения/i);
  
    expect(dateInput).toHaveValue("");
    expect(timeInput).toHaveValue("");
  });

  it("uses fallback values for empty event fields on load", async () => {
    mockGetCategories.mockResolvedValueOnce([
      { id: 1, name: "Экология" },
    ]);
  
    mockGetEventById.mockResolvedValueOnce({
      id: 55,
      creator_id: 10,
      title: "",
      description: "",
      category_id: "",
      participant_limit: 0,
      location: "",
      start_at: "",
      tasks: null,
      image_url: "",
    });
  
    renderPage();
  
    expect(await screen.findByLabelText(/название мероприятия/i)).toHaveValue("");
    expect(screen.getByLabelText(/описание/i)).toHaveValue("");
    expect(screen.getByLabelText(/место проведения/i)).toHaveValue("");
    expect(screen.getByLabelText(/количество мест/i)).toHaveValue(1);
    expect(screen.getByLabelText(/дата проведения/i)).toHaveValue("");
    expect(screen.getByLabelText(/время проведения/i)).toHaveValue("");
  });

  it("shows fallback loading error when page data request fails without message", async () => {
    mockGetCategories.mockRejectedValueOnce({});
  
    renderPage();
  
    expect(
      await screen.findByText(/не удалось загрузить мероприятие/i)
    ).toBeInTheDocument();
  });

  it("clears error after changing a field", async () => {
    renderPage();
  
    const titleInput = await screen.findByLabelText(/название мероприятия/i);
  
    fireEvent.change(titleInput, {
      target: { value: "" },
    });
  
    fireEvent.click(
      screen.getByRole("button", { name: /применить изменения/i })
    );
  
    expect(
      await screen.findByText(/заполните все обязательные поля/i)
    ).toBeInTheDocument();
  
    fireEvent.change(titleInput, {
      target: { value: "Новое название" },
    });
  
    expect(
      screen.queryByText(/заполните все обязательные поля/i)
    ).not.toBeInTheDocument();
  });

  it("updates an existing task value", async () => {
    renderPage();
  
    const taskInput = await screen.findByDisplayValue("Собрать мусор");
  
    fireEvent.change(taskInput, {
      target: { value: "Новая задача" },
    });
  
    expect(screen.getByDisplayValue("Новая задача")).toBeInTheDocument();
  });

  it("does nothing when image selection is cancelled", async () => {
    renderPage();
  
    const input = await screen.findByLabelText(/загрузить изображение/i);
  
    fireEvent.change(input, {
      target: { files: [] },
    });
  
    expect(screen.queryByText(/выберите изображение/i)).not.toBeInTheDocument();
  });

  it("shows fallback image error when image processing throws without message", async () => {
    const originalCreateElement = document.createElement.bind(document);
  
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => {
            throw {};
          },
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
        this.width = 400;
        this.height = 300;
      }
  
      set src(_) {
        this.onload?.();
      }
    }
  
    vi.stubGlobal("FileReader", FileReaderMock);
    vi.stubGlobal("Image", ImageMock);
  
    renderPage();
  
    const input = await screen.findByLabelText(/загрузить изображение/i);
    const file = new File(["image"], "photo.png", { type: "image/png" });
  
    fireEvent.change(input, {
      target: { files: [file] },
    });
  
    expect(
      await screen.findByText(/не удалось загрузить изображение/i)
    ).toBeInTheDocument();
  });
});