import { useEffect, useMemo, useRef, useState } from "react";
import "./YandexEventMap.css";

const YANDEX_MAPS_SCRIPT_ID = "yandex-maps-api-script";
const DEFAULT_CENTER = [55.751574, 37.573856];
const DEFAULT_ZOOM = 12;

let yandexMapsPromise = null;

function getYandexMapsApiKey() {
  return import.meta.env.VITE_YANDEX_MAPS_API_KEY || "";
}

function loadYandexMaps() {
  if (window.ymaps) {
    return Promise.resolve(window.ymaps);
  }

  if (yandexMapsPromise) {
    return yandexMapsPromise;
  }

  yandexMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(YANDEX_MAPS_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        window.ymaps.ready(() => resolve(window.ymaps));
      });
      existingScript.addEventListener("error", () => {
        reject(new Error("Не удалось загрузить API Яндекс Карт"));
      });
      return;
    }

    const apiKey = getYandexMapsApiKey();

    if (!apiKey) {
      reject(
        new Error(
          "Не указан ключ API Яндекс Карт. Добавьте VITE_YANDEX_MAPS_API_KEY в .env фронтенда."
        )
      );
      return;
    }

    const script = document.createElement("script");
    script.id = YANDEX_MAPS_SCRIPT_ID;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(
      apiKey
    )}&lang=ru_RU`;
    script.async = true;

    script.onload = () => {
      window.ymaps.ready(() => resolve(window.ymaps));
    };

    script.onerror = () => {
      reject(new Error("Не удалось загрузить API Яндекс Карт"));
    };

    document.head.appendChild(script);
  });

  return yandexMapsPromise;
}

function isValidCoordinatePair(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;

  const [latitude, longitude] = coordinates.map(Number);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeCoordinates(coordinates) {
  if (!isValidCoordinatePair(coordinates)) return null;
  return [Number(coordinates[0]), Number(coordinates[1])];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getGeoObjectAddress(geoObject, fallback = "") {
  return (
    geoObject?.getAddressLine?.() ||
    geoObject?.properties?.get("text") ||
    fallback
  );
}

export default function YandexEventMap({
  address = "",
  coordinates = null,
  title = "Место проведения",
  editable = false,
  onCoordinatesChange,
  onAddressChange,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const placemarkRef = useRef(null);
  const clickHandlerRef = useRef(null);
  const initializedRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Загрузка карты...");
  const [geocoding, setGeocoding] = useState(false);

  const normalizedCoordinates = useMemo(
    () => normalizeCoordinates(coordinates),
    [coordinates]
  );

  function setPlacemark(ymaps, nextCoordinates, placemarkAddress = address) {
    if (!mapRef.current || !nextCoordinates) return;

    const balloonContent = `
      <strong>${escapeHtml(title)}</strong><br />
      ${escapeHtml(placemarkAddress || "Место проведения")}
    `;

    if (!placemarkRef.current) {
      placemarkRef.current = new ymaps.Placemark(
        nextCoordinates,
        {
          balloonContent,
          hintContent: placemarkAddress || title,
        },
        {
          preset: "islands#greenDotIcon",
          draggable: editable,
        }
      );

      if (editable) {
        placemarkRef.current.events.add("dragend", () => {
          const next = placemarkRef.current.geometry.getCoordinates();
          handleMapCoordinateSelect(ymaps, next);
        });
      }

      mapRef.current.geoObjects.add(placemarkRef.current);
      return;
    }

    placemarkRef.current.geometry.setCoordinates(nextCoordinates);
    placemarkRef.current.properties.set({
      balloonContent,
      hintContent: placemarkAddress || title,
    });
    placemarkRef.current.options.set("draggable", editable);
  }


  async function reverseGeocodeCoordinates(ymaps, nextCoordinates) {
    try {
      setStatus("loading");
      setMessage("Определяем адрес по выбранной точке...");

      const result = await ymaps.geocode(nextCoordinates, { results: 1 });
      const firstGeoObject = result.geoObjects.get(0);

      if (!firstGeoObject) {
        setStatus("ready");
        setMessage("Метка установлена, но адрес определить не удалось");
        return;
      }

      const foundAddress = getGeoObjectAddress(firstGeoObject, address);

      if (foundAddress) {
        onAddressChange?.(foundAddress);
        setPlacemark(ymaps, nextCoordinates, foundAddress);
      }

      setStatus("ready");
      setMessage("");
    } catch (error) {
      setStatus("ready");
      setMessage("Метка установлена, но адрес определить не удалось");
    }
  }

  function handleMapCoordinateSelect(ymaps, nextCoordinates) {
    onCoordinatesChange?.(nextCoordinates);
    setPlacemark(ymaps, nextCoordinates, "Определяем адрес...");
    reverseGeocodeCoordinates(ymaps, nextCoordinates);
  }

  async function geocodeAddress() {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      setStatus("error");
      setMessage("Сначала укажите место проведения мероприятия");
      return;
    }

    try {
      setGeocoding(true);
      setStatus("loading");
      setMessage("Ищем место на карте...");

      const ymaps = await loadYandexMaps();
      const result = await ymaps.geocode(trimmedAddress, { results: 1 });
      const firstGeoObject = result.geoObjects.get(0);

      if (!firstGeoObject) {
        setStatus("error");
        setMessage("Не удалось найти место по указанному адресу");
        return;
      }

      const nextCoordinates = firstGeoObject.geometry.getCoordinates();
      const foundAddress = getGeoObjectAddress(firstGeoObject, trimmedAddress);

      onCoordinatesChange?.(nextCoordinates);
      onAddressChange?.(foundAddress);
      setPlacemark(ymaps, nextCoordinates, foundAddress);
      mapRef.current?.setCenter(nextCoordinates, 15, { duration: 250 });
      setStatus("ready");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Не удалось определить место на карте");
    } finally {
      setGeocoding(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      try {
        setStatus("loading");
        setMessage("Загрузка карты...");

        const ymaps = await loadYandexMaps();

        if (!isMounted || !mapContainerRef.current || initializedRef.current) {
          return;
        }

        const center = normalizedCoordinates || DEFAULT_CENTER;
        const zoom = normalizedCoordinates ? 15 : DEFAULT_ZOOM;

        mapRef.current = new ymaps.Map(mapContainerRef.current, {
          center,
          zoom,
          controls: ["zoomControl", "fullscreenControl"],
        });

        initializedRef.current = true;

        if (editable) {
          clickHandlerRef.current = (event) => {
            const nextCoordinates = event.get("coords");
            handleMapCoordinateSelect(ymaps, nextCoordinates);
          };

          mapRef.current.events.add("click", clickHandlerRef.current);
        }

        if (normalizedCoordinates) {
          setPlacemark(ymaps, normalizedCoordinates);
          setStatus("ready");
          setMessage("");
          return;
        }

        if (!editable && address.trim()) {
          const result = await ymaps.geocode(address.trim(), { results: 1 });
          const firstGeoObject = result.geoObjects.get(0);

          if (firstGeoObject) {
            const nextCoordinates = firstGeoObject.geometry.getCoordinates();
            const foundAddress = getGeoObjectAddress(firstGeoObject, address);

            setPlacemark(ymaps, nextCoordinates, foundAddress);
            mapRef.current.setCenter(nextCoordinates, 15, { duration: 250 });
            setStatus("ready");
            setMessage("");
            return;
          }
        }

        setStatus(editable ? "ready" : "empty");
        setMessage(editable ? "Нажмите на карту или найдите адрес" : "Координаты места не указаны");
      } catch (error) {
        if (!isMounted) return;
        setStatus("error");
        setMessage(error.message || "Не удалось загрузить карту");
      }
    }

    initMap();

    return () => {
      isMounted = false;

      if (mapRef.current) {
        if (clickHandlerRef.current) {
          mapRef.current.events.remove("click", clickHandlerRef.current);
        }

        mapRef.current.destroy();
        mapRef.current = null;
        placemarkRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.ymaps || !normalizedCoordinates) return;

    setPlacemark(window.ymaps, normalizedCoordinates);
    mapRef.current.setCenter(normalizedCoordinates, 15, { duration: 250 });
    setStatus("ready");
    setMessage("");
  }, [normalizedCoordinates, editable, title]);

  return (
    <div className="yandex-event-map">
      {editable ? (
        <div className="yandex-event-map__toolbar">
          <button
            type="button"
            className="yandex-event-map__button"
            onClick={geocodeAddress}
            disabled={geocoding}
          >
            {geocoding ? "Ищем..." : "Найти адрес на карте"}
          </button>

          <span className="yandex-event-map__hint">
            Можно нажать на карту или перетащить метку
          </span>
        </div>
      ) : null}

      <div
        ref={mapContainerRef}
        className={`yandex-event-map__container yandex-event-map__container--${status}`}
      />

      {message ? <div className="yandex-event-map__message">{message}</div> : null}
    </div>
  );
}
