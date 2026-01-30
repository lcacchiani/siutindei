import type { ReactNode } from 'react';

export interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Card({
  title,
  description,
  children,
  className = '',
}: CardProps) {
  return (
    <section className={`card ${className}`}>
      {(title || description) && (
        <div className="card-header bg-white">
          {title && <h2 className="h6 mb-1">{title}</h2>}
          {description && (
            <p className="mb-0 text-muted small">{description}</p>
          )}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
