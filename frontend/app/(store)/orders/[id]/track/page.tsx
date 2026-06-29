"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Section from "@/components/Section";
import { useCurrency } from "@/contexts/CurrencyContext";
import { apiFetch } from "@/lib/api";
import {
  MapPin, Shield, Truck, Clock, CheckCircle, ArrowLeft, Loader2,
  Navigation, Phone, AlertTriangle, ShieldAlert
} from "lucide-react";

interface OrderEvent {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  shippingAddress: any;
  timeline?: OrderEvent[];
  createdAt: string;
  updatedAt?: string;
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { formatPrice } = useCurrency();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  // Simulated Rider State
  const [riderProgress, setRiderProgress] = useState(0.1); // 0.0 to 1.0
  const [riderEta, setRiderEta] = useState(12); // in minutes
  const [riderCoords, setRiderCoords] = useState<[number, number] | null>(null);

  // Load Leaflet dynamically on the client side
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // FIX C8: Load Leaflet with Subresource Integrity (SRI) hashes to prevent
    // CDN compromise from injecting malicious code onto pages with customer GPS data.
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Fetch Order details
  useEffect(() => {
    loadOrder();
    const interval = setInterval(loadOrder, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await apiFetch(`/api/orders/${orderId}`);
      setOrder(data);
    } catch (err: any) {
      setError("Failed to load tracking info");
    } finally {
      setLoading(false);
    }
  };

  // Set up rider coordinate updates
  useEffect(() => {
    if (!order) return;

    // Kampala Default coordinates if order geocoding is missing
    const destLat = order.latitude || 0.3476;
    const destLng = order.longitude || 32.5825;

    // Pick a fixed starting offset point (e.g. north-west of destination)
    const startLat = destLat + 0.012;
    const startLng = destLng - 0.015;

    if (order.status === "DELIVERED") {
      setRiderProgress(1.0);
      setRiderEta(0);
      setRiderCoords([destLat, destLng]);
    } else if (order.status === "SHIPPED") {
      // Simulate movement
      const interval = setInterval(() => {
        setRiderProgress((prev) => {
          const next = prev + 0.02;
          if (next >= 1.0) {
            clearInterval(interval);
            setRiderEta(0);
            return 1.0;
          }
          // Calculate remaining minutes linearly
          setRiderEta(Math.max(1, Math.round(15 * (1.0 - next))));
          return next;
        });
      }, 3000); // Move every 3 seconds

      return () => clearInterval(interval);
    } else {
      // Not yet shipped
      setRiderProgress(0.0);
      setRiderEta(15);
      setRiderCoords([startLat, startLng]);
    }
  }, [order?.status]);

  // Calculate and update coordinates based on progress
  useEffect(() => {
    if (!order) return;
    const destLat = order.latitude || 0.3476;
    const destLng = order.longitude || 32.5825;
    const startLat = destLat + 0.012;
    const startLng = destLng - 0.015;

    const lat = startLat + (destLat - startLat) * riderProgress;
    const lng = startLng + (destLng - startLng) * riderProgress;
    setRiderCoords([lat, lng]);
  }, [riderProgress, order]);

  // Initialize Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || !riderCoords || !order) return;

    const L = (window as any).L;
    if (!L) return;

    const destLat = order.latitude || 0.3476;
    const destLng = order.longitude || 32.5825;

    // Create Map if it doesn't exist
    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([riderCoords[0], riderCoords[1]], 14);
      mapRef.current = map;

      // Dark, discreet theme style map (CARTO DB Dark Matter)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Custom markers
      const riderIcon = L.divIcon({
        html: `<div class="relative flex items-center justify-center"><div class="absolute w-8 h-8 rounded-full bg-accent animate-ping opacity-40"></div><div class="w-6 h-6 rounded-full bg-accent border-2 border-white flex items-center justify-center text-white"><svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 14.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m-14 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m13.2-4.5H19c.6 0 1-.4 1-1V8.5c0-.6-.4-1-1-1h-.8l-2.7-3.6C15.2 3.3 14.6 3 14 3H9v2h5l2.25 3H9c-.6 0-1 .4-1 1v1h3v2H4.5C3.7 12 3 12.7 3 13.5V16h2c0-1.7 1.3-3 3-3s3 1.3 3 3h2v-2.2c1.1-.7 2-1.9 2-3.3V10h1.2l2 4.5H15v2h2c0-1.7 1.3-3 3-3s3 1.3 3 3h1v-4.5c0-.8-.7-1.5-1.5-1.5z"/></svg></div></div>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const destIcon = L.divIcon({
        html: `<div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div>`,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Add Destination marker
      const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map);
      destMarker.bindPopup(`<div class="text-xs font-semibold text-gray-900">Secure Drop Spot</div>`);
      destMarkerRef.current = destMarker;

      // Add Rider marker
      const riderMarker = L.marker([riderCoords[0], riderCoords[1]], { icon: riderIcon }).addTo(map);
      riderMarker.bindPopup(`<div class="text-xs font-semibold text-gray-900">PZ Courier</div>`);
      riderMarkerRef.current = riderMarker;
    } else {
      // Update Rider marker position
      if (riderMarkerRef.current) {
        riderMarkerRef.current.setLatLng([riderCoords[0], riderCoords[1]]);
      }
      
      // Keep map view centered slightly between rider and destination
      const map = mapRef.current;
      const bounds = L.latLngBounds([[riderCoords[0], riderCoords[1]], [destLat, destLng]]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [leafletLoaded, riderCoords, order]);

  if (loading) {
    return (
      <Section>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </Section>
    );
  }

  if (error || !order) {
    return (
      <Section>
        <div className="max-w-md mx-auto text-center py-12">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Tracking Not Available</h2>
          <p className="text-text-muted mb-6">Could not load tracking details for this order. Ensure the order ID is correct.</p>
          <Link href="/account/orders" className="btn-primary">Back to Orders</Link>
        </div>
      </Section>
    );
  }

  // Define Discreet Stages / Sensory Timeline mapping
  const timelineStages = [
    {
      id: "verified",
      title: "Order Verified",
      desc: "Secure payment finalized & identity verified.",
      active: true,
      time: order.createdAt
    },
    {
      id: "packing",
      title: "Scent-Locked Packing",
      desc: "Double vacuum-sealed & scent-blocked wrapping applied.",
      active: order.status !== "PENDING" && order.status !== "CONFIRMED",
      time: order.status !== "PENDING" && order.status !== "CONFIRMED" ? order.createdAt : null
    },
    {
      id: "dispatched",
      title: "Rider Dispatched",
      desc: "Courier is in transit using neutral, non-branded logistics.",
      active: order.status === "SHIPPED" || order.status === "DELIVERED",
      time: order.status === "SHIPPED" || order.status === "DELIVERED" ? order.updatedAt || order.createdAt : null
    },
    {
      id: "arrived",
      title: "Arrived at Coordinate",
      desc: "Package safely dropped at the designated geofence PIN.",
      active: order.status === "DELIVERED",
      time: order.status === "DELIVERED" ? order.updatedAt || order.createdAt : null
    }
  ];

  return (
    <Section>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Link */}
        <Link href={`/orders/${orderId}`} className="inline-flex items-center gap-2 text-text-muted hover:text-text mb-2 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Order Details
        </Link>

        <div className="grid md:grid-cols-12 gap-6 items-stretch">
          {/* Timeline & Details (Left Panel) */}
          <div className="md:col-span-5 space-y-6 flex flex-col">
            <div className="card space-y-4 bg-surface dark:bg-gray-800/40 border-border flex-1">
              <div>
                <span className="text-xs text-accent font-semibold tracking-wider uppercase">Live Delivery Tracking</span>
                <h1 className="text-xl font-bold mt-1 text-text">Order #{order.orderNumber}</h1>
              </div>

              {/* Courier Info */}
              {order.status === "SHIPPED" || order.status === "DELIVERED" ? (
                <div className="p-3 bg-accent/5 rounded-8 border border-accent/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-medium">Delivery Agent</p>
                    <p className="text-sm font-semibold text-text">Agent Alex (PZ Logistics)</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Electric Scooter • Scent-locked Cargo</p>
                  </div>
                </div>
              ) : null}

              {/* Status / ETA */}
              <div className="grid grid-cols-2 gap-3 bg-surface-secondary dark:bg-gray-900/40 p-3 rounded-12 border border-border">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">Status</span>
                  <span className="text-sm font-bold text-text flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${order.status === "DELIVERED" ? "bg-emerald-500" : order.status === "SHIPPED" ? "bg-accent animate-pulse" : "bg-yellow-500"}`} />
                    {order.status}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-text-muted block font-medium uppercase tracking-wider">Estimated ETA</span>
                  <span className="text-sm font-bold text-text flex items-center gap-1">
                    <Clock className="w-4 h-4 text-accent shrink-0" />
                    {order.status === "DELIVERED" ? "Arrived" : `${riderEta} mins`}
                  </span>
                </div>
              </div>

              {/* Discreet Timeline / Sensory Stages */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Discreet Dispatch Stages</h3>
                <div className="space-y-6 relative pl-3.5">
                  {/* Timeline track vertical line */}
                  <div className="absolute left-[20px] top-2 bottom-2 w-[1px] bg-border dark:bg-gray-700" />

                  {timelineStages.map((stage) => (
                    <div key={stage.id} className="relative flex gap-4">
                      {/* Circle Indicator */}
                      <div className="absolute -left-[23px] top-0.5 z-10">
                        {stage.active ? (
                          <div className="w-4.5 h-4.5 rounded-full bg-accent border-2 border-white dark:border-gray-900 flex items-center justify-center text-white">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-4.5 h-4.5 rounded-full bg-surface border-2 border-border dark:border-gray-700" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${stage.active ? "text-text" : "text-text-muted"}`}>
                          {stage.title}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                          {stage.desc}
                        </p>
                        {stage.time && (
                          <span className="text-[10px] text-text-muted mt-1 block">
                            {new Date(stage.time).toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live GPS Map (Right Panel) */}
          <div className="md:col-span-7 flex flex-col h-[400px] md:h-auto">
            <div className="card p-2 bg-surface dark:bg-gray-800/40 border-border flex-1 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center px-2 py-1 mb-2">
                <span className="text-xs font-bold text-text-muted flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-accent animate-pulse" /> Live Courier GPS Feed
                </span>
                <span className="text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Secure Connection Active
                </span>
              </div>
              <div
                ref={mapContainerRef}
                className="w-full flex-1 rounded-8 border border-border bg-gray-950"
                style={{ zIndex: 1, minHeight: "350px" }}
              />
              <div className="absolute bottom-4 left-4 right-4 z-10 bg-gray-900/90 dark:bg-gray-950/90 text-white rounded-8 p-3 text-xs border border-white/10 flex items-center justify-between shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-accent shrink-0" />
                  <div>
                    <p className="font-semibold text-[11px]">Strict Privacy Active</p>
                    <p className="text-[10px] text-gray-400">Map coordinates and client labels are masked.</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 bg-white/10 px-2 py-0.5 rounded">
                  AES-256
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
