import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2 } from "lucide-react";

import type { CityEvent, CityVenue, CityCoordinate } from "@/lib/api/cities";
import { getCoordinatesForCity } from "@/utils/worldTravel";
import { cn } from "@/lib/utils";

export type CityMapLayerId = "venues" | "events";

interface CityMapProps {
  cityName: string;
  country?: string | null;
  venues: CityVenue[];
  events: CityEvent[];
  activeLayers: CityMapLayerId[];
  className?: string;
  isDataLoading?: boolean;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const ensureCoordinate = (
  coordinate: CityCoordinate | null | undefined,
  fallback: CityCoordinate,
  index: number,
  total: number,
  spread = 0.05,
): CityCoordinate => {
  if (coordinate && Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng)) {
    return coordinate;
  }

  if (total <= 1) {
    return fallback;
  }

  const radius = spread * Math.sqrt((index + 1) / total);
  const angle = index * GOLDEN_ANGLE;

  return {
    lat: fallback.lat + radius * Math.cos(angle),
    lng: fallback.lng + radius * Math.sin(angle),
  };
};

const formatNumber = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) {
    return "—";
  }

  const safe = Number(value);
  if (safe >= 1000) {
    return `${Math.round(safe / 1000)}k`;
  }

  return `${safe}`;
};

const toTitleCase = (value?: string | null) => {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const VENUE_COLOR_MAP: Record<string, string> = {
  arena: "#f97316",
  stadium: "#f97316",
  club: "#22d3ee",
  theatre: "#a855f7",
  hall: "#38bdf8",
  amphitheatre: "#f97316",
};

const getVenueColor = (venue: CityVenue): string => {
  const type = venue.venueType?.toLowerCase().trim() ?? "";
  if (type && VENUE_COLOR_MAP[type]) {
    return VENUE_COLOR_MAP[type];
  }

  if (Number.isFinite(venue.prestigeLevel)) {
    const prestige = Number(venue.prestigeLevel);
    if (prestige >= 8) return "#facc15";
    if (prestige >= 6) return "#22c55e";
    if (prestige >= 4) return "#38bdf8";
  }

  return "#6366f1";
};

const createVenueMarker = (venue: CityVenue) => {
  const color = getVenueColor(venue);
  const element = document.createElement("div");
  element.className = "city-map-marker city-map-marker--venue";
  element.style.cssText = `
    width: 18px;
    height: 18px;
    background: radial-gradient(circle at 30% 30%, ${color}, rgba(15, 23, 42, 0.85));
    border: 2px solid ${color};
    border-radius: 9999px;
    box-shadow: 0 0 14px ${color}55;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;

  element.addEventListener("mouseenter", () => {
    element.style.transform = "scale(1.25)";
    element.style.boxShadow = `0 0 20px ${color}aa`;
  });

  element.addEventListener("mouseleave", () => {
    element.style.transform = "scale(1)";
    element.style.boxShadow = `0 0 14px ${color}55`;
  });

  return element;
};

const createEventMarker = (event: CityEvent) => {
  const color = event.isActive ? "#f97316" : "#94a3b8";
  const element = document.createElement("div");
  element.className = "city-map-marker city-map-marker--event";
  element.style.cssText = `
    width: 16px;
    height: 16px;
    background: radial-gradient(circle at 30% 30%, ${color}, rgba(15, 23, 42, 0.8));
    border: 2px solid ${color};
    border-radius: 8px;
    box-shadow: 0 0 12px ${color}55;
    transform: rotate(45deg);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;

  element.addEventListener("mouseenter", () => {
    element.style.transform = "scale(1.2) rotate(45deg)";
    element.style.boxShadow = `0 0 18px ${color}aa`;
  });

  element.addEventListener("mouseleave", () => {
    element.style.transform = "rotate(45deg)";
    element.style.boxShadow = `0 0 12px ${color}55`;
  });

  return element;
};

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start && !end) {
    return "Timing TBA";
  }

  const format = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  if (start && end) {
    return `${format(start)} – ${format(end)}`;
  }

  if (start) {
    return `Starts ${format(start)}`;
  }

  return `Until ${format(end!)}`;
};

const createPopupContainer = () => {
  const container = document.createElement("div");
  container.style.cssText = "font-family: var(--font-sans, system-ui); min-width: 220px;";
  return container;
};

const appendPopupRow = (container: HTMLDivElement, text: string, styles: string) => {
  const row = document.createElement("div");
  row.style.cssText = styles;
  row.textContent = text;
  container.appendChild(row);
};

const createVenuePopupContent = (venue: CityVenue) => {
  const container = createPopupContainer();

  appendPopupRow(
    container,
    venue.name ?? "Unnamed Venue",
    "font-size: 15px; font-weight: 600; color: hsl(var(--foreground));",
  );

  const venueMeta = `${toTitleCase(venue.venueType) ?? "Venue"}${
    venue.district ? ` · ${venue.district}` : ""
  }`;
  appendPopupRow(
    container,
    venueMeta,
    "font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 4px;",
  );

  appendPopupRow(
    container,
    `Capacity ${formatNumber(venue.capacity)} · Prestige ${formatNumber(venue.prestigeLevel)}`,
    "font-size: 12px; margin-top: 6px; color: hsl(var(--foreground));",
  );

  if (venue.location) {
    appendPopupRow(
      container,
      venue.location,
      "font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 6px;",
    );
  }

  return container;
};

const createEventPopupContent = (event: CityEvent) => {
  const container = createPopupContainer();

  appendPopupRow(
    container,
    event.title ?? "Event",
    "font-size: 15px; font-weight: 600; color: hsl(var(--foreground));",
  );

  appendPopupRow(
    container,
    `${toTitleCase(event.type)} · ${event.isActive ? "Active" : "Past"}`,
    "font-size: 12px; color: hsl(var(--muted-foreground)); margin-top: 4px;",
  );

  if (event.description) {
    appendPopupRow(
      container,
      event.description,
      "font-size: 12px; margin-top: 6px; color: hsl(var(--muted-foreground));",
    );
  }

  appendPopupRow(
    container,
    formatDateRange(event.startDate, event.endDate),
    "font-size: 12px; margin-top: 6px; color: hsl(var(--foreground));",
  );

  return container;
};

export const CityMap = ({
  cityName,
  country,
  venues,
  events,
  activeLayers,
  className,
  isDataLoading,
}: CityMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const baseCoordinates = useMemo(() => {
    const coordinates = getCoordinatesForCity(cityName, country ?? undefined);
    return coordinates ?? { lat: 0, lng: 0 };
  }, [cityName, country]);

  const venueCoordinates = useMemo(() => {
    const total = venues.length || 1;
    return venues.map((venue, index) => ({
      ...venue,
      coordinates: ensureCoordinate(venue.coordinates, baseCoordinates, index, total, 0.06),
    }));
  }, [venues, baseCoordinates]);

  const eventCoordinates = useMemo(() => {
    const total = events.length || 1;
    return events.map((event, index) => ({
      ...event,
      coordinates: ensureCoordinate(event.coordinates, baseCoordinates, index, total, 0.045),
    }));
  }, [events, baseCoordinates]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

    if (!token) {
      setMapError("Mapbox token not configured. Add VITE_MAPBOX_PUBLIC_TOKEN to your environment.");
      setIsInitializing(false);
      return;
    }

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [baseCoordinates.lng, baseCoordinates.lat],
        zoom: 11,
        speed: 0.8,
      });
      return;
    }

    mapboxgl.accessToken = token;

    try {
      setIsInitializing(true);
      setMapError(null);

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [baseCoordinates.lng, baseCoordinates.lat],
        zoom: 11,
        pitch: 35,
        bearing: -10,
      });

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
      map.scrollZoom.disable();

      map.once("load", () => {
        setIsMapReady(true);
        setIsInitializing(false);
      });

      mapRef.current = map;
    } catch (error) {
      console.error("Failed to initialise map", error);
      setMapError("Failed to initialise the city map. Please refresh the page.");
      setIsInitializing(false);
    }
  }, [baseCoordinates.lat, baseCoordinates.lng]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReady || mapError) {
      return;
    }

    const map = mapRef.current;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const points: [number, number][] = [];
    const activeSet = new Set(activeLayers);

    if (activeSet.has("venues")) {
      venueCoordinates.forEach((venue) => {
        if (!venue.coordinates) {
          return;
        }

        const markerElement = createVenueMarker(venue);
        const popupContent = createVenuePopupContent(venue);
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setDOMContent(popupContent);

        const marker = new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
          .setLngLat([venue.coordinates.lng, venue.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        points.push([venue.coordinates.lng, venue.coordinates.lat]);
      });
    }

    if (activeSet.has("events")) {
      eventCoordinates.forEach((event) => {
        if (!event.coordinates) {
          return;
        }

        const markerElement = createEventMarker(event);
        const popupContent = createEventPopupContent(event);
        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setDOMContent(popupContent);

        const marker = new mapboxgl.Marker({ element: markerElement, anchor: "center" })
          .setLngLat([event.coordinates.lng, event.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        points.push([event.coordinates.lng, event.coordinates.lat]);
      });
    }

    if (points.length > 0) {
      const bounds = points.reduce((acc, point) => acc.extend(point), new mapboxgl.LngLatBounds(points[0], points[0]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 1000 });
    } else {
      map.easeTo({ center: [baseCoordinates.lng, baseCoordinates.lat], zoom: 11, duration: 800 });
    }
  }, [activeLayers, eventCoordinates, venueCoordinates, baseCoordinates.lat, baseCoordinates.lng, isMapReady, mapError]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={mapContainerRef} className="h-full w-full" />
      {(isInitializing || isDataLoading) && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Mapping venues and events…
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6 text-center text-sm text-muted-foreground">
          {mapError}
        </div>
      )}
    </div>
  );
};

export default CityMap;
