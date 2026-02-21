import Link from "next/link";
import { ArrowRight } from "lucide-react";

type SectionProps = {
  title?: string;
  subtitle?: string;
  viewAllLink?: string;
  viewAllText?: string;
  children: React.ReactNode;
  className?: string;
  bgColor?: "white" | "gray";
};

export default function Section({ 
  title, 
  subtitle,
  viewAllLink,
  viewAllText = "View All",
  children, 
  className = "",
  bgColor = "white"
}: SectionProps) {
  return (
    <section className={`py-16 sm:py-20 lg:py-24 ${bgColor === "gray" ? "bg-surface-secondary" : ""} ${className}`}>
      <div className="container">
        {(title || viewAllLink) && (
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 sm:mb-12">
            <div>
              {title && <h2 className="section-title">{title}</h2>}
              {subtitle && <p className="section-subtitle">{subtitle}</p>}
            </div>
            {viewAllLink && (
              <Link 
                href={viewAllLink}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition-colors group"
              >
                {viewAllText}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
