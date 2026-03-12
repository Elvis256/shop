"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductCarouselProps = {
  children: ReactNode;
  className?: string;
};

export default function ProductCarousel({ children, className = "" }: ProductCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width || 300;
    const scrollAmount = cardWidth * 2 + 24;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className={`group/carousel relative ${className}`}>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 sm:gap-6 overflow-x-auto scroll-snap-x pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-0 lg:px-0"
      >
        {children}
      </div>

      {/* Navigation arrows — desktop only */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="hidden lg:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-surface shadow-lg border border-border items-center justify-center hover:shadow-xl hover:scale-110 transition-all duration-200 opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-text" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="hidden lg:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-surface shadow-lg border border-border items-center justify-center hover:shadow-xl hover:scale-110 transition-all duration-200 opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-text" />
        </button>
      )}

      {/* Fade edges to hint at scrollability */}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-4 w-12 bg-gradient-to-r from-bg to-transparent pointer-events-none lg:hidden" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-bg to-transparent pointer-events-none lg:hidden" />
      )}
    </div>
  );
}

export function CarouselItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex-shrink-0 w-[45vw] sm:w-[35vw] md:w-[28vw] lg:w-[22vw] xl:w-[18vw] 2xl:w-[15vw] scroll-snap-item ${className}`}>
      {children}
    </div>
  );
}
