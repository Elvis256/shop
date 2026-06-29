"use client";

import { useState, useEffect } from "react";
import Section from "@/components/Section";
import { MapPin, Clock, Phone, Loader2 } from "lucide-react";

const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  county: string;
  hours: string;
  phone: string;
  type: string;
}

export default function PickupPointsPage() {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/pickup-points`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.pickupPoints || []);
        setPoints(list);
      })
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, []);

  const cities = [...new Set(points.map((p) => p.city))];
  const filtered = selectedCity ? points.filter((p) => p.city === selectedCity) : points;

  return (
    <Section>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">Pickup Points</h1>
          <p className="text-text-muted text-lg">
            Collect your order discreetly at a location near you. No questions asked.
          </p>
        </div>

        {/* City Filter */}
        {cities.length > 1 && (
          <div className="flex gap-2 justify-center mb-8 flex-wrap">
            <button
              onClick={() => setSelectedCity("")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                !selectedCity ? "bg-primary text-white" : "bg-surface-secondary text-text-muted hover:text-text"
              }`}
            >
              All Cities
            </button>
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCity === city ? "bg-primary text-white" : "bg-surface-secondary text-text-muted hover:text-text"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-text-muted" />
            <h3 className="mb-2">No pickup points available</h3>
            <p className="text-text-muted">Pickup points will be added soon in your area.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map((point) => (
              <div key={point.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{point.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{point.address}</p>
                    <p className="text-sm text-gray-500">{point.city}, {point.county}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {point.hours}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {point.phone}
                      </span>
                    </div>
                    <span className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {point.type || "Pickup Point"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 p-6 bg-green-50 border border-green-200 rounded-xl text-center">
          <h3 className="font-semibold text-green-900 mb-2">Why use pickup points?</h3>
          <p className="text-sm text-green-700">
            Maximum privacy and discretion. No delivery to your home address.
            Plain packaging with a generic sender name. Collect at your convenience.
          </p>
        </div>
      </div>
    </Section>
  );
}
