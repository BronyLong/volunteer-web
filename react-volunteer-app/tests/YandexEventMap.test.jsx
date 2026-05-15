import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapInstances = [];
const placemarkInstances = [];

function createGeoObject({ coordinates = [47.22, 39.72], address = "Ростов-на-Дону, парк" } = {}) {
  return {
    geometry: {
      getCoordinates: vi.fn(() => coordinates),
    },
    getAddressLine: vi.fn(() => address),
    properties: {
      get: vi.fn(() => address),
    },
  };
}

function createGeocodeResult(geoObject) {
  return {
    geoObjects: {
      get: vi.fn(() => geoObject),
    },
  };
}

function installYmaps({ geocodeImpl } = {}) {
  const ymaps = {
    ready: vi.fn((callback) => callback()),
    Map: vi.fn(function Map(container, options) {
      this.container = container;
      this.options = options;
      this.events = {
        add: vi.fn((eventName, handler) => {
          if (eventName === "click") this.clickHandler = handler;
        }),
        remove: vi.fn(),
      };
      this.geoObjects = {
        add: vi.fn(),
      };
      this.setCenter = vi.fn();
      this.destroy = vi.fn();
      mapInstances.push(this);
    }),
    Placemark: vi.fn(function Placemark(coordinates, properties, options) {
      let currentCoordinates = coordinates;

      this.propertiesData = properties;
      this.optionsData = options;
      this.geometry = {
        getCoordinates: vi.fn(() => currentCoordinates),
        setCoordinates: vi.fn((nextCoordinates) => {
          currentCoordinates = nextCoordinates;
        }),
      };
      this.properties = {
        set: vi.fn(),
      };
      this.options = {
        set: vi.fn(),
      };
      this.events = {
        add: vi.fn((eventName, handler) => {
          if (eventName === "dragend") this.dragEndHandler = handler;
        }),
      };
      placemarkInstances.push(this);
    }),
    geocode: vi.fn(
      geocodeImpl ||
        (() => Promise.resolve(createGeocodeResult(createGeoObject())))
    ),
  };

  window.ymaps = ymaps;
  return ymaps;
}

async function importMapComponent() {
  vi.resetModules();
  const module = await import("../src/components/YandexEventMap.jsx");
  return module.default;
}

describe("YandexEventMap", () => {
  beforeEach(() => {
    mapInstances.length = 0;
    placemarkInstances.length = 0;
    document.head.innerHTML = "";
    delete window.ymaps;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete window.ymaps;
    document.head.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("renders editable empty map and selects point by map click", async () => {
    const ymaps = installYmaps();
    const onCoordinatesChange = vi.fn();
    const onAddressChange = vi.fn();
    const YandexEventMap = await importMapComponent();

    render(
      <YandexEventMap
        address=""
        title="Субботник"
        editable
        onCoordinatesChange={onCoordinatesChange}
        onAddressChange={onAddressChange}
      />
    );

    expect(await screen.findByText(/нажмите на карту или найдите адрес/i)).toBeInTheDocument();
    expect(ymaps.Map).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({ center: [55.751574, 37.573856], zoom: 12 })
    );
    expect(mapInstances[0].events.add).toHaveBeenCalledWith("click", expect.any(Function));

    await act(async () => {
      mapInstances[0].clickHandler({
        get: vi.fn(() => [47.22, 39.72]),
      });
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith([47.22, 39.72]);
    expect(ymaps.Placemark).toHaveBeenCalledWith(
      [47.22, 39.72],
      expect.objectContaining({ hintContent: "Определяем адрес..." }),
      expect.objectContaining({ draggable: true })
    );

    await waitFor(() => {
      expect(onAddressChange).toHaveBeenCalledWith("Ростов-на-Дону, парк");
    });

    expect(placemarkInstances[0].events.add).toHaveBeenCalledWith("dragend", expect.any(Function));
  });

  it("updates address after marker drag in editable mode", async () => {
    installYmaps({
      geocodeImpl: () =>
        Promise.resolve(
          createGeocodeResult(
            createGeoObject({ coordinates: [45.03, 38.97], address: "Краснодар, улица Мира" })
          )
        ),
    });
    const onCoordinatesChange = vi.fn();
    const onAddressChange = vi.fn();
    const YandexEventMap = await importMapComponent();

    render(
      <YandexEventMap
        address="Старый адрес"
        coordinates={[47.22, 39.72]}
        editable
        onCoordinatesChange={onCoordinatesChange}
        onAddressChange={onAddressChange}
      />
    );

    await waitFor(() => {
      expect(placemarkInstances).toHaveLength(1);
    });

    placemarkInstances[0].geometry.getCoordinates.mockReturnValue([45.03, 38.97]);

    await act(async () => {
      placemarkInstances[0].dragEndHandler();
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith([45.03, 38.97]);

    await waitFor(() => {
      expect(onAddressChange).toHaveBeenCalledWith("Краснодар, улица Мира");
    });
  });

  it("renders read only map by provided coordinates", async () => {
    const ymaps = installYmaps();
    const YandexEventMap = await importMapComponent();

    render(
      <YandexEventMap
        address="Парк Горького"
        coordinates={[47.25, 39.71]}
        title="Экологическая акция"
      />
    );

    await waitFor(() => {
      expect(ymaps.Placemark).toHaveBeenCalledWith(
        [47.25, 39.71],
        expect.objectContaining({ hintContent: "Парк Горького" }),
        expect.objectContaining({ draggable: false })
      );
    });

    expect(screen.queryByText(/координаты места не указаны/i)).not.toBeInTheDocument();
  });

  it("geocodes read only address when coordinates are not provided", async () => {
    installYmaps({
      geocodeImpl: () =>
        Promise.resolve(
          createGeocodeResult(
            createGeoObject({ coordinates: [55.75, 37.61], address: "Москва, центр" })
          )
        ),
    });
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap address="Москва, центр" title="Мероприятие" />);

    await waitFor(() => {
      expect(placemarkInstances).toHaveLength(1);
    });

    expect(mapInstances[0].setCenter).toHaveBeenCalledWith([55.75, 37.61], 15, {
      duration: 250,
    });
  });

  it("shows empty read only state when address and coordinates are missing", async () => {
    installYmaps();
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap />);

    expect(await screen.findByText(/координаты места не указаны/i)).toBeInTheDocument();
  });

  it("shows validation error when searching map by empty address", async () => {
    installYmaps();
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable address="   " />);

    fireEvent.click(await screen.findByRole("button", { name: /найти адрес на карте/i }));

    expect(
      await screen.findByText(/сначала укажите место проведения мероприятия/i)
    ).toBeInTheDocument();
  });

  it("finds editable address by toolbar button", async () => {
    const ymaps = installYmaps({
      geocodeImpl: () =>
        Promise.resolve(
          createGeocodeResult(
            createGeoObject({ coordinates: [47.23, 39.7], address: "Ростов-на-Дону, Театральная площадь" })
          )
        ),
    });
    const onCoordinatesChange = vi.fn();
    const onAddressChange = vi.fn();
    const YandexEventMap = await importMapComponent();

    render(
      <YandexEventMap
        editable
        address="Театральная площадь"
        onCoordinatesChange={onCoordinatesChange}
        onAddressChange={onAddressChange}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: /найти адрес на карте/i }));

    await waitFor(() => {
      expect(ymaps.geocode).toHaveBeenCalledWith("Театральная площадь", { results: 1 });
      expect(onCoordinatesChange).toHaveBeenCalledWith([47.23, 39.7]);
      expect(onAddressChange).toHaveBeenCalledWith("Ростов-на-Дону, Театральная площадь");
    });

    expect(mapInstances[0].setCenter).toHaveBeenCalledWith([47.23, 39.7], 15, {
      duration: 250,
    });
  });

  it("shows not found message when address geocoding returns empty result", async () => {
    installYmaps({
      geocodeImpl: () => Promise.resolve(createGeocodeResult(null)),
    });
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable address="Несуществующий адрес" />);

    fireEvent.click(await screen.findByRole("button", { name: /найти адрес на карте/i }));

    expect(await screen.findByText(/не удалось найти место по указанному адресу/i)).toBeInTheDocument();
  });

  it("shows geocoding error message from api", async () => {
    installYmaps({
      geocodeImpl: () => Promise.reject(new Error("Геокодер недоступен")),
    });
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable address="Парк" />);

    fireEvent.click(await screen.findByRole("button", { name: /найти адрес на карте/i }));

    expect(await screen.findByText(/геокодер недоступен/i)).toBeInTheDocument();
  });

  it("keeps marker when reverse geocoding cannot find address", async () => {
    installYmaps({
      geocodeImpl: () => Promise.resolve(createGeocodeResult(null)),
    });
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable address="Парк" />);

    await screen.findByText(/нажмите на карту или найдите адрес/i);

    await act(async () => {
      mapInstances[0].clickHandler({
        get: vi.fn(() => [47.22, 39.72]),
      });
    });

    expect(
      await screen.findByText(/метка установлена, но адрес определить не удалось/i)
    ).toBeInTheDocument();
  });

  it("shows script api key error when ymaps is unavailable", async () => {
    vi.stubEnv("VITE_YANDEX_MAPS_API_KEY", "");

    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable address="Парк" />);

    expect(
      await screen.findByText(/не указан ключ api яндекс карт/i)
    ).toBeInTheDocument();
  });

  it("uses existing yandex script load event", async () => {
    const script = document.createElement("script");
    script.id = "yandex-maps-api-script";
    document.head.appendChild(script);
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable />);

    const ymaps = installYmaps();

    await act(async () => {
      script.dispatchEvent(new Event("load"));
    });

    await waitFor(() => {
      expect(ymaps.ready).toHaveBeenCalled();
      expect(ymaps.Map).toHaveBeenCalled();
    });
  });

  it("uses existing yandex script error event", async () => {
    const script = document.createElement("script");
    script.id = "yandex-maps-api-script";
    document.head.appendChild(script);
    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable />);

    await act(async () => {
      script.dispatchEvent(new Event("error"));
    });

    expect(await screen.findByText(/не удалось загрузить api яндекс карт/i)).toBeInTheDocument();
  });

  it("loads map through a newly created yandex script", async () => {
    vi.stubEnv("VITE_YANDEX_MAPS_API_KEY", "test-api-key");

    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable />);

    const script = document.getElementById("yandex-maps-api-script");
    expect(script).toBeInstanceOf(HTMLScriptElement);
    expect(script.src).toContain("apikey=test-api-key");

    const ymaps = installYmaps();

    await act(async () => {
      script.dispatchEvent(new Event("load"));
    });

    await waitFor(() => {
      expect(ymaps.ready).toHaveBeenCalled();
      expect(ymaps.Map).toHaveBeenCalled();
    });
  });

  it("shows error when newly created yandex script fails", async () => {
    vi.stubEnv("VITE_YANDEX_MAPS_API_KEY", "test-api-key");

    const YandexEventMap = await importMapComponent();

    render(<YandexEventMap editable />);

    const script = document.getElementById("yandex-maps-api-script");
    expect(script).toBeInstanceOf(HTMLScriptElement);

    await act(async () => {
      script.dispatchEvent(new Event("error"));
    });

    expect(await screen.findByText(/не удалось загрузить api яндекс карт/i)).toBeInTheDocument();
  });

  it("keeps selected marker when reverse geocoding request fails", async () => {
    installYmaps({
      geocodeImpl: () => Promise.reject(new Error("Reverse geocode failed")),
    });
    const onCoordinatesChange = vi.fn();
    const YandexEventMap = await importMapComponent();

    render(
      <YandexEventMap
        editable
        address="Парк"
        onCoordinatesChange={onCoordinatesChange}
      />
    );

    await screen.findByText(/нажмите на карту или найдите адрес/i);

    await act(async () => {
      mapInstances[0].clickHandler({
        get: vi.fn(() => [47.22, 39.72]),
      });
    });

    expect(onCoordinatesChange).toHaveBeenCalledWith([47.22, 39.72]);
    expect(
      await screen.findByText(/метка установлена, но адрес определить не удалось/i)
    ).toBeInTheDocument();
  });

  it("updates placemark when coordinates prop changes after map initialization", async () => {
    const ymaps = installYmaps();
    const YandexEventMap = await importMapComponent();

    const { rerender } = render(
      <YandexEventMap
        address="Старый адрес"
        coordinates={[47.22, 39.72]}
        title="Старое название"
        editable={false}
      />
    );

    await waitFor(() => {
      expect(placemarkInstances).toHaveLength(1);
    });

    rerender(
      <YandexEventMap
        address="Новый адрес"
        coordinates={[45.03, 38.97]}
        title="Новое название"
        editable
      />
    );

    await waitFor(() => {
      expect(placemarkInstances[0].geometry.setCoordinates).toHaveBeenCalledWith([45.03, 38.97]);
      expect(mapInstances[0].setCenter).toHaveBeenCalledWith([45.03, 38.97], 15, {
        duration: 250,
      });
    });

    expect(placemarkInstances[0].properties.set).toHaveBeenCalledWith(
      expect.objectContaining({ hintContent: "Новый адрес" })
    );
    expect(placemarkInstances[0].options.set).toHaveBeenCalledWith("draggable", true);
    expect(ymaps.Placemark).toHaveBeenCalledTimes(1);
  });


  it("does not create map when component is unmounted before script load resolves", async () => {
    const existingScript = document.createElement("script");
    existingScript.id = "yandex-maps-api-script";
    document.head.appendChild(existingScript);

    const ymaps = {
      ready: vi.fn((callback) => callback()),
      Map: vi.fn(),
      Placemark: vi.fn(),
      geocode: vi.fn(),
    };

    const YandexEventMap = await importMapComponent();

    const { unmount } = render(
      <YandexEventMap
        editable
        address="Парк"
        title="Субботник"
        coordinates={[47.22, 39.72]}
      />
    );

    unmount();

    await act(async () => {
      window.ymaps = ymaps;
      existingScript.dispatchEvent(new Event("load"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ymaps.Map).not.toHaveBeenCalled();
  });
});
