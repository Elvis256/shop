"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

const SEGMENTS = [
  { label: "5% OFF", code: "SPIN5", weight: 30 },
  { label: "10% OFF", code: "SPIN10", weight: 20 },
  { label: "15% OFF", code: "SPIN15", weight: 12 },
  { label: "FREE SHIPPING", code: "FREESHIP", weight: 10 },
  { label: "Try Again", code: "", weight: 20 },
  { label: "20% OFF", code: "SPIN20", weight: 8 },
];

const COLORS = [
  "#6366f1", "#f43f5e", "#f59e0b",
  "#10b981", "#8b5cf6", "#ec4899",
];

function weightedRandom(): number {
  const totalWeight = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

export default function SpinWheel() {
  const [show, setShow] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<(typeof SEGMENTS)[number] | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasTriggered = useRef(false);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4;
    const segAngle = (2 * Math.PI) / SEGMENTS.length;

    ctx.clearRect(0, 0, size, size);

    SEGMENTS.forEach((seg, i) => {
      const start = i * segAngle;
      const end = start + segAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(start + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(seg.label, radius - 16, 5);
      ctx.restore();
    });
  }, []);

  useEffect(() => {
    if (show) drawWheel();
  }, [show, drawWheel]);

  // Trigger logic
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("spin_wheel_used")) return;

    const pageCount = parseInt(sessionStorage.getItem("spin_page_count") || "0", 10) + 1;
    sessionStorage.setItem("spin_page_count", String(pageCount));

    const tryShow = () => {
      if (hasTriggered.current) return;
      if (localStorage.getItem("spin_wheel_used")) return;
      if (sessionStorage.getItem("exit_intent_shown")) return;
      hasTriggered.current = true;
      setShow(true);
    };

    if (pageCount >= 2) {
      tryShow();
      return;
    }

    const timer = setTimeout(tryShow, 30000);
    return () => clearTimeout(timer);
  }, []);

  const handleSpin = () => {
    if (spinning || result) return;
    setSpinning(true);

    const winIndex = weightedRandom();
    const segAngle = 360 / SEGMENTS.length;
    const targetAngle = 360 - (winIndex * segAngle + segAngle / 2);
    const totalRotation = 360 * 5 + targetAngle;

    setRotation(totalRotation);

    setTimeout(() => {
      setSpinning(false);
      setResult(SEGMENTS[winIndex]);
      localStorage.setItem("spin_wheel_used", "1");
    }, 4000);
  };

  const handleCopy = async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleClose = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-8 pb-4 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1">🎰 Spin to Win!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Try your luck for a special discount
          </p>

          {/* Wheel */}
          <div className="relative mx-auto" style={{ width: 260, height: 260 }}>
            {/* Pointer */}
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 z-10 w-0 h-0 border-t-[12px] border-t-transparent border-r-[20px] border-r-red-500 border-b-[12px] border-b-transparent" />

            <div
              className="w-full h-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              }}
            >
              <canvas ref={canvasRef} width={260} height={260} className="w-full h-full" />
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          {!result ? (
            <button
              onClick={handleSpin}
              disabled={spinning}
              className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {spinning ? "Spinning..." : "Spin Now!"}
            </button>
          ) : result.code ? (
            <div className="text-center space-y-3">
              <p className="text-lg font-bold text-green-600">
                🎉 You won {result.label}!
              </p>
              <div className="flex items-center justify-center gap-2">
                <code className="px-4 py-2 bg-gray-100 rounded-lg font-mono text-lg font-bold tracking-wider">
                  {result.code}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              <Link
                href="/category"
                onClick={handleClose}
                className="inline-block w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors text-center"
              >
                Shop Now →
              </Link>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-lg font-semibold text-gray-700">
                😅 Better luck next time!
              </p>
              <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Continue shopping
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
