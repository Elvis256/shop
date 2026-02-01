"use client";

import { useState } from "react";

const priceRanges = [
  { label: "Under KES 1,000", min: 0, max: 1000 },
  { label: "KES 1,000 - 3,000", min: 1000, max: 3000 },
  { label: "KES 3,000 - 5,000", min: 3000, max: 5000 },
  { label: "KES 5,000 - 10,000", min: 5000, max: 10000 },
  { label: "Over KES 10,000", min: 10000, max: null },
];

const ratings = [5, 4, 3, 2, 1];

export default function FilterPanel() {
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  return (
    <aside className="space-y-6">
      {/* Price Filter */}
      <div className="card">
        <h4 className="font-semibold mb-4">Price Range</h4>
        <div className="space-y-2">
          {priceRanges.map((range, idx) => (
            <label key={idx} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="price"
                checked={selectedPrice === idx}
                onChange={() => setSelectedPrice(idx)}
              />
              <span className="text-small">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Rating Filter */}
      <div className="card">
        <h4 className="font-semibold mb-4">Rating</h4>
        <div className="space-y-2">
          {ratings.map((rating) => (
            <label key={rating} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="rating"
                checked={selectedRating === rating}
                onChange={() => setSelectedRating(rating)}
              />
              <span className="text-small">{rating}+ Stars</span>
            </label>
          ))}
        </div>
      </div>

      {/* Availability */}
      <div className="card">
        <h4 className="font-semibold mb-4">Availability</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" defaultChecked />
            <span className="text-small">In Stock</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" />
            <span className="text-small">Include Pre-orders</span>
          </label>
        </div>
      </div>

      {/* Clear */}
      <button className="btn-secondary w-full text-small">
        Clear All Filters
      </button>
    </aside>
  );
}
