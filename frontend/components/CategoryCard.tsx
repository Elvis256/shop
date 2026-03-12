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
      <div className="group relative overflow-hidden rounded-24 bg-surface-secondary aspect-[4/5] sm:aspect-square cursor-pointer transition-all duration-500 hover:shadow-lg hover-lift">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 to-violet-500/5">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center shadow-soft">
              <span className="text-3xl font-semibold text-gradient">{title[0]}</span>
            </div>
          </div>
        )}
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 transform group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex items-end justify-between">
            <div>
              <h3 className="font-semibold text-white text-base sm:text-lg tracking-tight">{title}</h3>
              {productCount !== undefined && (
                <p className="text-white/60 text-sm mt-1">{productCount} products</p>
              )}
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center group-hover:bg-white group-hover:text-text transition-all duration-300 group-hover:scale-110">
              <ArrowRight className="w-4 h-4 text-white group-hover:text-text transition-colors" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
