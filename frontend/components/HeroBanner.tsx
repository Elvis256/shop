"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  buttonText: string | null;
  position: string;
}

interface HeroBannerProps {
  autoPlayInterval?: number;
}

export default function HeroBanner({ autoPlayInterval = 5000 }: HeroBannerProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, autoPlayInterval);
    return () => clearInterval(interval);
  }, [banners.length, autoPlayInterval]);

  const loadBanners = async () => {
    try {
      const res = await fetch(`${API_URL}/api/banners?position=home-hero`);
      if (res.ok) {
        const data = await res.json();
        setBanners(data.banners || []);
      }
    } catch (error) {
      console.error("Failed to load banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  if (loading) {
    return (
      <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh] min-h-[400px] bg-gradient-to-br from-gray-100 to-gray-200 skeleton-shimmer" />
    );
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh] min-h-[400px] bg-gradient-to-br from-primary via-primary-hover to-violet-600 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-300/10 rounded-full blur-3xl animate-pulse [animation-delay:2s]" />
        </div>
        <div className="relative h-full container flex items-center">
          <div className="max-w-2xl animate-fade-in">
            <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium text-white mb-6">
              🔥 New Arrivals
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 text-white leading-[1.1] tracking-tight">
              Explore Your <br />
              <span className="text-white/90">Desires</span>
            </h1>
            <p className="text-lg sm:text-xl mb-8 text-white/80 max-w-lg leading-relaxed">
              Premium intimate products with 100% discreet packaging. Your pleasure, your privacy.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/category"
                className="inline-flex items-center gap-2 bg-white text-primary px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold hover:bg-gray-100 transition-all duration-300 group hover:shadow-glow"
              >
                Shop Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const gradients = [
    "bg-gradient-to-br from-primary via-primary-hover to-violet-600",
    "bg-gradient-to-br from-rose-600 via-pink-600 to-purple-700",
    "bg-gradient-to-br from-violet-700 via-purple-600 to-fuchsia-500",
    "bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600",
  ];

  return (
    <div className="relative w-full h-[60vh] sm:h-[70vh] lg:h-[80vh] min-h-[400px] overflow-hidden group">
      {/* Banner slides with CSS crossfade */}
      {banners.map((banner, index) => {
        const hasValidImage = banner.imageUrl && banner.imageUrl.length > 1 && !banner.imageUrl.includes('/images/banners/');
        const isActive = index === currentIndex;
        return (
          <div
            key={banner.id}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0 }}
          >
            {hasValidImage ? (
              <>
                <Image src={banner.imageUrl} alt={banner.title} fill className="object-cover hidden md:block" priority={index === 0} />
                <Image src={banner.mobileImageUrl || banner.imageUrl} alt={banner.title} fill className="object-cover md:hidden" priority={index === 0} />
              </>
            ) : (
              <div className={`absolute inset-0 ${gradients[index % gradients.length]}`}>
                <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-10 right-20 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          </div>
        );
      })}

      {/* Content */}
      <div className="relative h-full container flex items-center z-10">
        <div className="max-w-xl text-white">
          <h1
            key={`title-${currentIndex}`}
            className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-4 leading-tight tracking-tight animate-fade-in"
          >
            {banners[currentIndex].title}
          </h1>
          {banners[currentIndex].subtitle && (
            <p
              key={`sub-${currentIndex}`}
              className="text-lg sm:text-xl mb-8 text-white/80 leading-relaxed animate-fade-in [animation-delay:0.1s]"
            >
              {banners[currentIndex].subtitle}
            </p>
          )}
          {banners[currentIndex].linkUrl && (
            <Link
              href={banners[currentIndex].linkUrl!}
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-7 sm:px-9 py-3.5 sm:py-4 rounded-full font-semibold hover:bg-gray-100 transition-all duration-300 group hover:shadow-glow animate-fade-in [animation-delay:0.2s]"
            >
              {banners[currentIndex].buttonText || "Shop Now"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>
          )}
        </div>
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110"
            aria-label="Next banner"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Dots */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentIndex ? "bg-white w-10" : "bg-white/40 hover:bg-white/60 w-2"
              }`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
