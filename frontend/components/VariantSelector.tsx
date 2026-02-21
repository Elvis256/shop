"use client";

import { useState } from "react";
import { Check } from "lucide-react";

interface Variant {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  stock: number;
  size?: string;
  color?: string;
  material?: string;
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariant: Variant | null;
  onSelect: (variant: Variant) => void;
  productPrice: number;
}

export default function VariantSelector({
  variants,
  selectedVariant,
  onSelect,
  productPrice,
}: VariantSelectorProps) {
  // Extract unique attribute values
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[];
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[];
  const materials = [...new Set(variants.map((v) => v.material).filter(Boolean))] as string[];

  const [selectedSize, setSelectedSize] = useState<string | null>(
    selectedVariant?.size || sizes[0] || null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    selectedVariant?.color || colors[0] || null
  );
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(
    selectedVariant?.material || materials[0] || null
  );

  // Find matching variant based on selections
  const findVariant = () => {
    return variants.find((v) => {
      const sizeMatch = !sizes.length || v.size === selectedSize;
      const colorMatch = !colors.length || v.color === selectedColor;
      const materialMatch = !materials.length || v.material === selectedMaterial;
      return sizeMatch && colorMatch && materialMatch;
    });
  };

  const handleSelection = (type: "size" | "color" | "material", value: string) => {
    if (type === "size") setSelectedSize(value);
    if (type === "color") setSelectedColor(value);
    if (type === "material") setSelectedMaterial(value);

    // Update parent after state change
    setTimeout(() => {
      const variant = findVariant();
      if (variant) onSelect(variant);
    }, 0);
  };

  // Check if a variant combination is available
  const isOptionAvailable = (type: "size" | "color" | "material", value: string): boolean => {
    return variants.some((v) => {
      if (type === "size") {
        return v.size === value && v.stock > 0;
      }
      if (type === "color") {
        return v.color === value && (!selectedSize || v.size === selectedSize) && v.stock > 0;
      }
      if (type === "material") {
        return (
          v.material === value &&
          (!selectedSize || v.size === selectedSize) &&
          (!selectedColor || v.color === selectedColor) &&
          v.stock > 0
        );
      }
      return false;
    });
  };

  const getOptionStock = (type: "size" | "color" | "material", value: string): number => {
    const matchingVariants = variants.filter((v) => {
      if (type === "size") return v.size === value;
      if (type === "color") return v.color === value && (!selectedSize || v.size === selectedSize);
      if (type === "material")
        return (
          v.material === value &&
          (!selectedSize || v.size === selectedSize) &&
          (!selectedColor || v.color === selectedColor)
        );
      return false;
    });
    return matchingVariants.reduce((sum, v) => sum + v.stock, 0);
  };

  // Color swatches mapping
  const colorSwatches: Record<string, string> = {
    Black: "#000000",
    White: "#FFFFFF",
    Red: "#EF4444",
    Pink: "#EC4899",
    Purple: "#8B5CF6",
    Blue: "#3B82F6",
    Green: "#22C55E",
    Yellow: "#EAB308",
    Orange: "#F97316",
    Brown: "#92400E",
    Gray: "#6B7280",
    Navy: "#1E3A8A",
    Nude: "#E8CEBF",
    Rose: "#FB7185",
    Gold: "#D4AF37",
    Silver: "#C0C0C0",
  };

  return (
    <div className="space-y-6">
      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Size: <span className="font-normal text-gray-600">{selectedSize}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const available = isOptionAvailable("size", size);
              const isSelected = selectedSize === size;
              
              return (
                <button
                  key={size}
                  onClick={() => available && handleSelection("size", size)}
                  disabled={!available}
                  className={`
                    px-4 py-2 border rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? "border-accent bg-accent text-white"
                      : available
                      ? "border-gray-300 hover:border-accent"
                      : "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                    }
                  `}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color Selector */}
      {colors.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Color: <span className="font-normal text-gray-600">{selectedColor}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => {
              const available = isOptionAvailable("color", color);
              const isSelected = selectedColor === color;
              const swatchColor = colorSwatches[color] || "#CCCCCC";
              
              return (
                <button
                  key={color}
                  onClick={() => available && handleSelection("color", color)}
                  disabled={!available}
                  title={color}
                  className={`
                    relative w-10 h-10 rounded-full border-2 transition-all
                    ${isSelected ? "ring-2 ring-offset-2 ring-accent" : ""}
                    ${!available ? "opacity-30 cursor-not-allowed" : "hover:scale-110"}
                  `}
                  style={{ backgroundColor: swatchColor }}
                >
                  {isSelected && (
                    <Check
                      className={`absolute inset-0 m-auto w-5 h-5 ${
                        swatchColor === "#FFFFFF" || swatchColor === "#E8CEBF"
                          ? "text-gray-800"
                          : "text-white"
                      }`}
                    />
                  )}
                  {!available && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 bg-gray-400 rotate-45" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Material Selector */}
      {materials.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Material: <span className="font-normal text-gray-600">{selectedMaterial}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {materials.map((material) => {
              const available = isOptionAvailable("material", material);
              const isSelected = selectedMaterial === material;
              
              return (
                <button
                  key={material}
                  onClick={() => available && handleSelection("material", material)}
                  disabled={!available}
                  className={`
                    px-4 py-2 border rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? "border-accent bg-accent text-white"
                      : available
                      ? "border-gray-300 hover:border-accent"
                      : "border-gray-200 text-gray-300 cursor-not-allowed"
                    }
                  `}
                >
                  {material}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected variant info */}
      {selectedVariant && (
        <div className="text-sm text-gray-600">
          {selectedVariant.stock > 0 ? (
            selectedVariant.stock <= 5 ? (
              <span className="text-orange-600 font-medium">
                Only {selectedVariant.stock} left in stock!
              </span>
            ) : (
              <span className="text-green-600">✓ In stock</span>
            )
          ) : (
            <span className="text-red-600">Out of stock</span>
          )}
        </div>
      )}
    </div>
  );
}
