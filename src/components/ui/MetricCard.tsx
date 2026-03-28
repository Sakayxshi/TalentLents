import { ReactNode, forwardRef } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  ({ label, value, subtitle, className = '' }, ref) => {
    return (
      <div ref={ref} className={`card-surface p-5 ${className}`}>
        <p className="metric-label">{label}</p>
        <p className="metric-value mt-1">{value}</p>
        {subtitle && <p className="metric-subtitle mt-1">{subtitle}</p>}
      </div>
    );
  }
);
MetricCard.displayName = 'MetricCard';

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export const Badge = forwardRef<HTMLSpanElement, { children: ReactNode; variant?: string }>(
  ({ children, variant = 'badge-blue' }, ref) => {
    return (
      <span ref={ref} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant}`}>
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';
