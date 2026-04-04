"use client";

import { useState } from "react";
import Image, { ImageProps } from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function resolveImageUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("/uploads/")) return `${API_URL}${src}`;
  return src;
}

interface ProductImageProps extends Omit<ImageProps, "src"> {
  src: string | null | undefined;
  fallbackClassName?: string;
}

export default function ProductImage({
  src,
  alt,
  fallbackClassName,
  ...props
}: ProductImageProps) {
  const [error, setError] = useState(false);
  const resolvedSrc = resolveImageUrl(src);

  if (!resolvedSrc || error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${fallbackClassName || props.className || ""}`}
        style={
          props.fill
            ? { position: "absolute", inset: 0 }
            : { width: props.width, height: props.height }
        }
      >
        <svg
          className="w-10 h-10 text-gray-300 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      {...props}
      src={resolvedSrc}
      alt={alt || ""}
      onError={() => setError(true)}
    />
  );
}
