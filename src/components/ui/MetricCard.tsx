import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

export function MetricCard({ label, value, subtitle, className = '' }: MetricCardProps) {
  return (
    <div className={`card-surface p-5 ${className}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value mt-1">{value}</p>
      {subtitle && <p className="metric-subtitle mt-1">{subtitle}</p>}
    </div>
  );
}

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

export function Badge({ children, variant = 'badge-blue' }: { children: ReactNode; variant?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant}`}>
      {children}
    </span>
  );
}
