import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

type CategoryCardProps = {
  title: string;
  slug: string;
  imageUrl?: string;
  productCount?: number;
};

export default function CategoryCard({ title, slug, imageUrl, productCount }: CategoryCardProps) {
  return (
    <Link href={`/category?cat=${slug}`}>
      <div className="group relative overflow-hidden rounded-24 bg-surface-secondary aspect-square cursor-pointer transition-all duration-500 hover:shadow-lg">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-secondary to-gray-100">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-soft">
              <span className="text-3xl font-semibold text-primary">{title[0]}</span>
            </div>
          </div>
        )}
        
        {/* Subtle overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="font-semibold text-white text-lg tracking-tight">{title}</h3>
              {productCount !== undefined && (
                <p className="text-white/70 text-sm mt-1">{productCount} products</p>
              )}
            </div>
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-white group-hover:text-text transition-all duration-300 group-hover:scale-110">
              <ArrowRight className="w-4 h-4 text-white group-hover:text-text transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
