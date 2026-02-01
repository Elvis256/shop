import Link from "next/link";
import { ArrowRight } from "lucide-react";

type CategoryCardProps = {
  title: string;
  slug: string;
  imageUrl?: string;
};

export default function CategoryCard({ title, slug, imageUrl }: CategoryCardProps) {
  return (
    <Link href={`/category?cat=${slug}`}>
      <div className="card group cursor-pointer hover:border-accent transition-colors">
        <div className="aspect-video bg-gray-100 rounded-4 mb-4 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              {title}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
        </div>
      </div>
    </Link>
  );
}
