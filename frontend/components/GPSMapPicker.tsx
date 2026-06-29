"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Loader2 } from "lucide-react";

interface GPSMapPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onChange: (lat: number, lng: number, address: string) => void;
}

export default function GPSMapPicker({
  initialLat,
  initialLng,
  onChange,
}: GPSMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  // Load Leaflet scripts dynamically on client side
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if leaflet is already loaded
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.crossOrigin = "";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.crossOrigin = "";
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize Map when leaflet script is loaded
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const defaultLat = coords?.lat || 0.3476;
    const defaultLng = coords?.lng || 32.5825;

    // Destroy existing map if it exists to avoid re-init error
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 14);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([defaultLat, defaultLng], {
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    const handleLocationUpdate = async (lat: number, lng: number) => {
      setCoords({ lat, lng });
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          const displayName = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onChange(lat, lng, displayName);
        } else {
          onChange(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      } catch {
        onChange(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setLoading(false);
    };

    marker.on("dragend", () => {
      const position = marker.getLatLng();
      handleLocationUpdate(position.lat, position.lng);
    });

    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      handleLocationUpdate(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          markerRef.current.setLatLng([latitude, longitude]);
        }
        setLoading(false);
        // Trigger update
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        )
          .then((r) => r.json())
          .then((data) => {
            onChange(latitude, longitude, data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          })
          .catch(() => {
            onChange(latitude, longitude, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          });
      },
      () => {
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2 border border-border rounded-12 p-3 bg-surface">
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs font-semibold text-text flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-accent" /> Drag the red marker or click the map to pinpoint your location
        </span>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="text-xs py-1.5 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded-lg flex items-center gap-1 transition-all"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          Find Me
        </button>
      </div>

      <div
        ref={mapContainerRef}
        className="w-full h-[250px] rounded-lg overflow-hidden border border-border shadow-inner bg-gray-100 dark:bg-gray-800"
        style={{ minHeight: "250px", position: "relative", zIndex: 1 }}
      />

      {coords && (
        <p className="text-[11px] text-text-muted">
          Selected Coordinates: <strong className="text-text">{coords.lat.toFixed(5)}</strong>,{" "}
          <strong className="text-text">{coords.lng.toFixed(5)}</strong>
        </p>
      )}
    </div>
  );
}
