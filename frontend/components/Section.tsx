type SectionProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Section({ title, children, className = "" }: SectionProps) {
  return (
    <section className={`py-16 ${className}`}>
      <div className="container">
        {title && <h2 className="mb-8">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
