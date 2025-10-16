import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { getCoordinatesForCity } from '@/utils/worldTravel';

interface City {
  id: string;
  name: string;
  country: string;
  dominant_genre?: string;
}

interface InteractiveWorldMapProps {
  cities: City[];
  currentCityId?: string | null;
  onCityClick?: (cityId: string) => void;
}

const InteractiveWorldMap = ({ cities, currentCityId, onCityClick }: InteractiveWorldMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    
    if (!token) {
      setMapError('Mapbox token not configured. Please add VITE_MAPBOX_PUBLIC_TOKEN to your environment.');
      setIsLoading(false);
      return;
    }

    mapboxgl.accessToken = token;

    try {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: { name: 'globe' },
        zoom: 1.5,
        center: [0, 20],
        pitch: 0,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      // Disable scroll zoom for better UX
      map.current.scrollZoom.disable();

      // Add atmosphere and fog effects
      map.current.on('style.load', () => {
        map.current?.setFog({
          color: 'rgb(25, 25, 40)',
          'high-color': 'rgb(15, 15, 25)',
          'horizon-blend': 0.1,
        });
        setIsLoading(false);
      });

      // Globe rotation animation
      const secondsPerRevolution = 180;
      const maxSpinZoom = 5;
      const slowSpinZoom = 3;
      let userInteracting = false;

      function spinGlobe() {
        if (!map.current) return;
        
        const zoom = map.current.getZoom();
        if (!userInteracting && zoom < maxSpinZoom) {
          let distancePerSecond = 360 / secondsPerRevolution;
          if (zoom > slowSpinZoom) {
            const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
            distancePerSecond *= zoomDif;
          }
          const center = map.current.getCenter();
          center.lng -= distancePerSecond;
          map.current.easeTo({ center, duration: 1000, easing: (n) => n });
        }
      }

      // Event listeners for interaction
      map.current.on('mousedown', () => {
        userInteracting = true;
      });
      
      map.current.on('dragstart', () => {
        userInteracting = true;
      });
      
      map.current.on('mouseup', () => {
        userInteracting = false;
        spinGlobe();
      });
      
      map.current.on('touchend', () => {
        userInteracting = false;
        spinGlobe();
      });

      map.current.on('moveend', () => {
        spinGlobe();
      });

      // Start the globe spinning
      spinGlobe();

    } catch (error) {
      console.error('Error initializing map:', error);
      setMapError('Failed to initialize map. Please refresh the page.');
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, []);

  // Update markers when cities change
  useEffect(() => {
    if (!map.current || !cities.length) return;

    // Wait for map to be fully loaded
    if (!map.current.loaded()) {
      map.current.once('load', () => addMarkers());
    } else {
      addMarkers();
    }

    function addMarkers() {
      // Remove existing markers
      markers.current.forEach(marker => marker.remove());
      markers.current = [];

      // Add new markers
      cities.forEach((city) => {
        const coordinates = getCoordinatesForCity(city.name, city.country);
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

        // Create popup
        const popupContent = `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: hsl(var(--foreground));">
              ${city.name}${city.country ? `, ${city.country}` : ''}
              ${isCurrentCity ? ' 📍' : ''}
            </div>
            <div style="font-size: 12px; color: hsl(var(--muted-foreground));">
              ${city.dominant_genre ? `Genre: ${city.dominant_genre}` : 'Click to explore'}
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 15,
          closeButton: false,
          className: 'city-popup'
        }).setHTML(popupContent);

        // Create marker
        const marker = new mapboxgl.Marker({ element: el })
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
  }, [cities, currentCityId, navigate, onCityClick]);

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
      .mapboxgl-popup-content {
        background-color: hsl(var(--popover)) !important;
        border: 1px solid hsl(var(--border)) !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
      }
      .mapboxgl-popup-tip {
        border-top-color: hsl(var(--popover)) !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (mapError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
        <MapPin className="h-8 w-8 text-destructive" />
        <p className="font-semibold text-destructive">{mapError}</p>
        <p className="text-sm text-muted-foreground">
          Get your free token at{' '}
          <a 
            href="https://mapbox.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            mapbox.com
          </a>
        </p>
      </div>
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
