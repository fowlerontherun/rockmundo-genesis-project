import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { CityWithCoords } from "@/utils/dynamicTravel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Plane } from "lucide-react";

interface TravelMapSelectorProps {
  cities: CityWithCoords[];
  currentCityId: string | null;
  selectedCityId: string | null;
  onCitySelect: (cityId: string) => void;
}

const MAPBOX_TOKEN = "pk.eyJ1IjoibG92YWJsZS1haWRldiIsImEiOiJjbHhkMnRyYWcwNHRqMmpzZXBjOG5hNmVlIn0.iEN5-QEPF6nWAehqGt4XkA";

export function TravelMapSelector({
  cities,
  currentCityId,
  selectedCityId,
  onCitySelect,
}: TravelMapSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const flightLineRef = useRef<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, 30],
        zoom: 1.5,
        projection: "globe",
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.current.on("load", () => {
        if (!map.current) return;
        
        // Add atmosphere
        map.current.setFog({
          color: "rgb(20, 20, 30)",
          "high-color": "rgb(30, 30, 50)",
          "horizon-blend": 0.1,
        });
        
        setMapLoaded(true);
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
        setMapError("Failed to load map");
      });
    } catch (err) {
      setMapError("Failed to initialize map");
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw flight path between cities
  const drawFlightPath = useCallback((fromCity: CityWithCoords, toCity: CityWithCoords) => {
    if (!map.current || !mapLoaded) return;
    
    // Remove existing line
    if (flightLineRef.current && map.current.getLayer(flightLineRef.current)) {
      map.current.removeLayer(flightLineRef.current);
      map.current.removeSource(flightLineRef.current);
    }
    
    if (!fromCity.latitude || !fromCity.longitude || !toCity.latitude || !toCity.longitude) return;
    
    const lineId = `flight-path-${Date.now()}`;
    flightLineRef.current = lineId;
    
    // Create curved line (great circle approximation)
    const points: [number, number][] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lng = fromCity.longitude + (toCity.longitude - fromCity.longitude) * t;
      const lat = fromCity.latitude + (toCity.latitude - fromCity.latitude) * t;
      // Add arc
      const arc = Math.sin(t * Math.PI) * 10;
      points.push([lng, lat + arc * (Math.abs(toCity.longitude - fromCity.longitude) / 180)]);
    }
    
    map.current.addSource(lineId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points,
        },
      },
    });
    
    map.current.addLayer({
      id: lineId,
      type: "line",
      source: lineId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#f97316",
        "line-width": 3,
        "line-dasharray": [2, 1],
        "line-opacity": 0.8,
      },
    });
  }, [mapLoaded]);

  // Add markers for cities
  useEffect(() => {
    if (!map.current || !mapLoaded || cities.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const currentCity = cities.find(c => c.id === currentCityId);
    const selectedCity = cities.find(c => c.id === selectedCityId);

    cities.forEach(city => {
      if (!city.latitude || !city.longitude) return;

      const isCurrent = city.id === currentCityId;
      const isSelected = city.id === selectedCityId;

      const el = document.createElement("div");
      el.className = "city-marker";
      el.style.cssText = `
        width: ${isCurrent ? "20px" : isSelected ? "16px" : "12px"};
        height: ${isCurrent ? "20px" : isSelected ? "16px" : "12px"};
        border-radius: 50%;
        background: ${isCurrent ? "#22c55e" : isSelected ? "#f97316" : "#6366f1"};
        border: 2px solid white;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${isCurrent ? "animation: pulse 2s infinite;" : ""}
      `;

      el.addEventListener("click", () => {
        if (!isCurrent) {
          onCitySelect(city.id);
        }
      });

      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.3)";
      });
      
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div style="padding: 8px; color: #fff; background: #1a1a2e; border-radius: 8px;">
            <strong>${city.name}</strong><br/>
            <span style="opacity: 0.7; font-size: 12px;">${city.country}</span>
            ${city.music_scene ? `<br/><span style="color: #a78bfa; font-size: 11px;">Music Scene: ${city.music_scene}%</span>` : ""}
          </div>
        `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([city.longitude, city.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Draw flight path if both cities selected
    if (currentCity && selectedCity && currentCity.id !== selectedCity.id) {
      drawFlightPath(currentCity, selectedCity);
      
      // Fit bounds to show both cities
      if (currentCity.longitude && currentCity.latitude && selectedCity.longitude && selectedCity.latitude) {
        const bounds = new mapboxgl.LngLatBounds()
          .extend([currentCity.longitude, currentCity.latitude])
          .extend([selectedCity.longitude, selectedCity.latitude]);
        
        map.current.fitBounds(bounds, { padding: 100, duration: 1000 });
      }
    } else if (currentCity?.longitude && currentCity?.latitude) {
      map.current.flyTo({
        center: [currentCity.longitude, currentCity.latitude],
        zoom: 4,
        duration: 1000,
      });
    }

    // Add pulse animation CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
        50% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
      }
      .mapboxgl-popup-content {
        background: transparent !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .mapboxgl-popup-tip { display: none !important; }
    `;
    document.head.appendChild(style);

    return () => {
      style.remove();
    };
  }, [cities, currentCityId, selectedCityId, mapLoaded, onCitySelect, drawFlightPath]);

  if (mapError) {
    return (
      <Card className="h-[400px] flex items-center justify-center bg-muted/50">
        <div className="text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>{mapError}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="h-[400px] rounded-lg overflow-hidden" />
      
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Loading world map...</p>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
          <span>Current Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 border border-white" />
          <span>Selected Destination</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500 border border-white" />
          <span>Available Cities</span>
        </div>
      </div>
      
      {selectedCityId && (
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <Plane className="h-3 w-3 mr-1" />
            Route Selected
          </Badge>
        </div>
      )}
    </div>
  );
}
