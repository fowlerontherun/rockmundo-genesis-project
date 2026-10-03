import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

interface City {
  id: string;
  name: string;
  country: string;
  dominant_genre?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface InteractiveWorldMapProps {
  cities: City[];
  currentCityId?: string | null;
  onCityClick?: (cityId: string) => void;
  routeCityIds?: string[];
  routeCities?: City[];
}

const EMPTY_ROUTE_CITY_IDS: string[] = [];
type MapLibreRuntime = typeof import('mapbox-gl');
const MAPLIBRE_SCRIPT_URL = 'https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS_URL = 'https://unpkg.com/maplibre-gl@5.7.1/dist/maplibre-gl.css';

declare global { interface Window { maplibregl?: MapLibreRuntime } }

let mapLibrePromise: Promise<MapLibreRuntime> | null = null;
function loadMapLibre(): Promise<MapLibreRuntime> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;
  mapLibrePromise = Promise.all([
    new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLLinkElement>('link[data-rockmundo-maplibre]');
      if (existing?.sheet) { resolve(); return; }
      const css = existing ?? document.createElement('link');
      css.addEventListener('load', () => resolve(), { once: true });
      css.addEventListener('error', () => reject(new Error('MapLibre stylesheet failed to load')), { once: true });
      if (!existing) {
        css.rel = 'stylesheet';
        css.href = MAPLIBRE_CSS_URL;
        css.dataset.rockmundoMaplibre = 'true';
        document.head.appendChild(css);
      }
    }),
    new Promise<void>((resolve, reject) => {
      if (window.maplibregl) { resolve(); return; }
      const existing = document.querySelector<HTMLScriptElement>('script[data-rockmundo-maplibre]');
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', () => window.maplibregl ? resolve() : reject(new Error('MapLibre runtime did not initialise')), { once: true });
      script.addEventListener('error', () => reject(new Error('MapLibre runtime failed to load')), { once: true });
      if (!existing) {
        script.src = MAPLIBRE_SCRIPT_URL;
        script.async = true;
        script.dataset.rockmundoMaplibre = 'true';
        document.head.appendChild(script);
      }
    }),
  ]).then(() => {
    if (!window.maplibregl) throw new Error('MapLibre runtime did not initialise');
    return window.maplibregl;
  }).catch(error => {
    mapLibrePromise = null;
    throw error;
  });
  return mapLibrePromise;
}
const OPEN_MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

const InteractiveWorldMap = ({ cities, currentCityId, onCityClick, routeCityIds = EMPTY_ROUTE_CITY_IDS, routeCities }: InteractiveWorldMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const runtime = useRef<MapLibreRuntime | null>(null);
  const map = useRef<InstanceType<MapLibreRuntime['Map']> | null>(null);
  const markers = useRef<Array<InstanceType<MapLibreRuntime['Marker']>>>([]);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const logDiagnostic = (message: string, detail?: unknown) => {
    const suffix = detail instanceof Error ? `: ${detail.message}` : detail ? `: ${String(detail)}` : '';
    const line = `[world-map] ${message}${suffix}`;
    console.info(line, detail ?? '');
    setDiagnostics(previous => [...previous.slice(-11), line]);
  };

  useEffect(() => {
    if (!mapContainer.current) return;
    const container = mapContainer.current;
    let disposed = false;
    let timeoutId: number | undefined;

    const initialize = async () => {
      const rect = container.getBoundingClientRect();
      let webglSupported = false;
      try {
        const canvas = document.createElement('canvas');
        webglSupported = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
      } catch {
        webglSupported = false;
      }
      logDiagnostic(`loading MapLibre; container=${Math.round(rect.width)}x${Math.round(rect.height)}; webgl=${webglSupported}; cities=${cities.length}`);

      try {
        const maplibregl = await loadMapLibre();
        if (disposed) return;
        runtime.current = maplibregl;
        logDiagnostic('MapLibre runtime loaded');
        map.current = new maplibregl.Map({
          container,
          style: OPEN_MAP_STYLE,
          zoom: 1.5,
          center: [0, 20],
          pitch: 0,
        });
        logDiagnostic('MapLibre Map constructor succeeded');
        map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        map.current.scrollZoom.disable();
        map.current.on('style.load', () => logDiagnostic('style.load fired'));
        map.current.on('sourcedata', event => {
          if (event.sourceId === 'osm' && event.isSourceLoaded) logDiagnostic('OSM source loaded');
        });
        map.current.on('idle', () => logDiagnostic('map reached idle'));
        map.current.on('load', () => {
          logDiagnostic('load fired');
          map.current?.resize();
          setIsLoading(false);
          setMapReady(true);
        });
        map.current.on('error', event => {
          const message = event.error instanceof Error ? event.error.message : String(event.error ?? 'unknown map error');
          console.warn('World map resource error:', event.error);
          logDiagnostic('resource error', message);
        });
        timeoutId = window.setTimeout(() => {
          if (!map.current?.loaded()) {
            const currentRect = container.getBoundingClientRect();
            logDiagnostic(`still not loaded after 8s; container=${Math.round(currentRect.width)}x${Math.round(currentRect.height)}; styleLoaded=${map.current?.isStyleLoaded() ?? false}`);
            setIsLoading(false);
          }
        }, 8000);
      } catch (error) {
        console.error('Error initializing MapLibre:', error);
        const message = error instanceof Error ? error.message : String(error);
        logDiagnostic('MapLibre initialization failed', message);
        setMapError(`Failed to initialize MapLibre: ${message}`);
        setIsLoading(false);
      }
    };
    void initialize();

    return () => {
      disposed = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
      runtime.current = null;
    };
  }, []);

  // Update markers when cities change
  useEffect(() => {
    if (!map.current) return;

    // Wait for map to be fully loaded
    const activeMap = map.current;
    if (!activeMap.isStyleLoaded()) {
      activeMap.once('style.load', addMarkers);
    } else {
      addMarkers();
    }

    function addMarkers() {
      if (!map.current || map.current !== activeMap) return;
      // Remove existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      // Add new markers
      cities.forEach((city) => {
        // Never place unknown cities at a guessed coordinate.
        if (city.latitude == null || city.longitude == null ||
            !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) ||
            Math.abs(city.latitude) > 90 || Math.abs(city.longitude) > 180) return;
        const coordinates = { lat: city.latitude, lng: city.longitude };
        const isCurrentCity = city.id === currentCityId;

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'city-marker';
        el.style.cssText = `
          width: ${isCurrentCity ? '12px' : '10px'};
          height: ${isCurrentCity ? '12px' : '10px'};
          background-color: ${isCurrentCity ? '#22c55e' : 'hsl(var(--primary))' };
          border: 2px solid ${isCurrentCity ? '#86efac' : 'hsl(var(--primary) / 0.4)'};
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 ${isCurrentCity ? '12px' : '8px'} ${isCurrentCity ? 'rgba(34, 197, 94, 0.6)' : 'hsl(var(--primary) / 0.4)'};
          transition: all 0.3s ease;
          ${isCurrentCity ? 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;' : ''}
        `;

        // Add hover effect
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
          el.style.boxShadow = isCurrentCity 
            ? '0 0 20px rgba(34, 197, 94, 0.8)' 
            : '0 0 16px hsl(var(--primary) / 0.6)';
        });
        
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
          el.style.boxShadow = isCurrentCity 
            ? '0 0 12px rgba(34, 197, 94, 0.6)' 
            : '0 0 8px hsl(var(--primary) / 0.4)';
        });

        // Build popup with DOM text nodes: city names are database content, not HTML.
        const popupContent = document.createElement('div');
        popupContent.style.cssText = 'font-family:system-ui,sans-serif;padding:4px';
        const heading = document.createElement('div');
        heading.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:4px';
        heading.textContent = city.name + (city.country ? ', ' + city.country : '') + (isCurrentCity ? ' 📍' : '');
        const detail = document.createElement('div');
        detail.style.fontSize = '12px';
        detail.textContent = city.dominant_genre ? 'Genre: ' + city.dominant_genre : 'Click to explore';
        popupContent.append(heading, detail);
        const popup = new runtime.current!.Popup({
          offset: 15,
          closeButton: false,
          className: 'city-popup'
        }).setDOMContent(popupContent);

        // Create marker
        const marker = new runtime.current!.Marker({ element: el })
          .setLngLat([coordinates.lng, coordinates.lat])
          .setPopup(popup)
          .addTo(map.current!);

        // Add click handler
        el.addEventListener('click', () => {
          if (onCityClick) {
            onCityClick(city.id);
          } else {
            navigate(`/cities/${encodeURIComponent(city.id)}`);
          }
        });

        markers.current.push(marker);
      });
    }
    return () => {
      activeMap.off('style.load', addMarkers);
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
    };
  }, [cities, currentCityId, navigate, onCityClick, mapReady]);

  // Draw the player's proposed tour directly on the globe, without changing bookings.
  useEffect(() => {
    const activeMap = map.current;
    if (!activeMap) return;
    const sourceId = 'atlas-draft-route';
    const layerId = 'atlas-draft-route-line';
    const points = routeCityIds.flatMap(id => {
      const city = (routeCities ?? cities).find(item => item.id === id);
      if (!city || city.latitude == null || city.longitude == null ||
          !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) ||
          Math.abs(city.latitude) > 90 || Math.abs(city.longitude) > 180) return [];
      return [[city.longitude, city.latitude]];
    });
    const updateRoute = () => {
      if (!activeMap.isStyleLoaded()) return;
      if (activeMap.getLayer(layerId)) activeMap.removeLayer(layerId);
      if (activeMap.getSource(sourceId)) activeMap.removeSource(sourceId);
      if (points.length < 2) return;
      activeMap.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: points },
        },
      });
      activeMap.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#38bdf8',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [2, 1],
        },
      });
    };
    if (activeMap.isStyleLoaded()) updateRoute();
    activeMap.on('style.load', updateRoute);
    return () => {
      activeMap.off('style.load', updateRoute);
      if (activeMap.isStyleLoaded()) {
        if (activeMap.getLayer(layerId)) activeMap.removeLayer(layerId);
        if (activeMap.getSource(sourceId)) activeMap.removeSource(sourceId);
      }
    };
  }, [cities, routeCities, routeCityIds, mapReady]);

  // Add pulse animation styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
      .maplibregl-popup-content {
        background-color: hsl(var(--popover)) !important;
        border: 1px solid hsl(var(--border)) !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      }
      .maplibregl-popup-tip {
        border-top-color: hsl(var(--popover)) !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (mapError) {
    // Spec §2.6 — never leak a config error to players.
    return (
      <EmptyState
        icon={MapPin}
        title="Map unavailable right now"
        description={`We can't load the interactive world map at the moment. ${mapError}`}
        action={
          <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap text-left text-xs text-muted-foreground">
            {diagnostics.join('\n')}
          </pre>
        }
      />
    );
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Loading interactive map...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="absolute inset-0" />
      <details className="absolute right-3 bottom-3 z-20 max-w-[min(90%,32rem)] rounded-md border border-border bg-card/95 p-2 text-xs shadow-lg">
        <summary className="cursor-pointer font-medium">Map diagnostics ({diagnostics.length})</summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">{diagnostics.join('\n')}</pre>
      </details>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/5 rounded-lg" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/95 backdrop-blur border border-border rounded-lg p-3 text-xs shadow-lg">
        <div className="font-semibold mb-2 text-foreground">Legend</div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-300 animate-pulse" />
          <span className="text-muted-foreground">Current City</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))', border: '2px solid hsl(var(--primary) / 0.4)' }} />
          <span className="text-muted-foreground">Available Cities</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveWorldMap;
