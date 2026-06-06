"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

type AnimateOnScrollProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  variant?: "fadeUp" | "fadeIn" | "scaleIn" | "slideLeft" | "slideRight";
  once?: boolean;
};

export default function AnimateOnScroll({
  children,
  className = "",
  delay = 0,
  duration = 0.5,
  variant = "fadeUp",
  once = true,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin: "-50px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once]);

  const baseStyle: React.CSSProperties = {
    transition: `opacity ${duration}s ease, transform ${duration}s ease`,
    transitionDelay: `${delay}s`,
  };

  const hiddenStyles: Record<string, React.CSSProperties> = {
    fadeUp: { opacity: 0, transform: "translateY(30px)" },
    fadeIn: { opacity: 0 },
    scaleIn: { opacity: 0, transform: "scale(0.9)" },
    slideLeft: { opacity: 0, transform: "translateX(40px)" },
    slideRight: { opacity: 0, transform: "translateX(-40px)" },
  };

  const visibleStyle: React.CSSProperties = { opacity: 1, transform: "none" };

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...baseStyle, ...(isVisible ? visibleStyle : hiddenStyles[variant]) }}
    >
      {children}
    </div>
  );
}

// Staggered container for grid items
type StaggerGridProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
};

export function StaggerGrid({ children, className = "", staggerDelay = 0.06 }: StaggerGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { rootMargin: "-30px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} stagger-grid ${isVisible ? "stagger-visible" : ""}`}
      style={{ "--stagger-delay": `${staggerDelay}s` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`stagger-item ${className}`}>
      {children}
    </div>
  );
}
