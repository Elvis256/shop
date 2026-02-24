"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ZoomIn, X } from "lucide-react";

type ProductGalleryProps = {
  images: string[];
  productName?: string;
};

export default function ProductGallery({ images, productName = "Product" }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const displayImages = images.length > 0 ? images : [];
  const hasMultiple = displayImages.length > 1;

  const prev = useCallback(() => {
    setSelectedIndex((i) => (i === 0 ? displayImages.length - 1 : i - 1));
  }, [displayImages.length]);

  const next = useCallback(() => {
    setSelectedIndex((i) => (i === displayImages.length - 1 ? 0 : i + 1));
  }, [displayImages.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? next() : prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div
        className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden group select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {displayImages[selectedIndex] ? (
          <>
            <Image
              src={displayImages[selectedIndex]}
              alt={`${productName} - image ${selectedIndex + 1}`}
              fill
              className="object-cover transition-opacity duration-300"
              priority={selectedIndex === 0}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Zoom button */}
            <button
              onClick={() => setIsZoomed(true)}
              className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              title="Zoom"
            >
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-3">
            <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm text-gray-400">No image available</span>
          </div>
        )}

        {/* Prev / Next arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
            {/* Dot indicators */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {displayImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === selectedIndex ? "bg-white w-4" : "bg-white/60"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {displayImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                idx === selectedIndex
                  ? "border-primary ring-1 ring-primary/30"
                  : "border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100"
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {isZoomed && displayImages[selectedIndex] && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setIsZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full z-10 transition-colors"
            onClick={() => setIsZoomed(false)}
          >
            <X className="w-6 h-6" />
          </button>

          {hasMultiple && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full z-10 transition-colors"
                onClick={(e) => { e.stopPropagation(); prev(); }}
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full z-10 transition-colors"
                onClick={(e) => { e.stopPropagation(); next(); }}
              >
                <ChevronRight className="w-7 h-7" />
              </button>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/60 text-sm">
                {selectedIndex + 1} / {displayImages.length}
              </div>
            </>
          )}

          <div
            className="relative w-full h-full max-w-4xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={displayImages[selectedIndex]}
              alt={productName}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </div>
  );
}
