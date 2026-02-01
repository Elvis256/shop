"use client";

import { useState } from "react";
import Image from "next/image";

type ProductGalleryProps = {
  images: string[];
  productName?: string;
};

export default function ProductGallery({ images, productName = "Product" }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Default placeholder images if none provided
  const displayImages = images.length > 0 ? images : [];

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div
        className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-zoom-in relative"
        onClick={() => displayImages.length > 0 && setIsZoomed(true)}
      >
        {displayImages[selectedIndex] ? (
          <Image
            src={displayImages[selectedIndex]}
            alt={productName}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Image counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-2 py-1 rounded">
            {selectedIndex + 1} / {displayImages.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {displayImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition ${
                idx === selectedIndex ? "border-accent" : "border-transparent hover:border-gray-300"
              }`}
            >
              <Image src={img} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {isZoomed && displayImages[selectedIndex] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center cursor-zoom-out"
          onClick={() => setIsZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full z-10"
            onClick={() => setIsZoomed(false)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation arrows */}
          {displayImages.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-full z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-full z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={displayImages[selectedIndex]}
              alt={productName}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
