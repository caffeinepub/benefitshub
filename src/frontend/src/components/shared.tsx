import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  color = "#2F80ED",
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-3xl font-bold mt-2" style={{ color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    approved: "bg-green-100 text-green-700",
    paid: "bg-green-100 text-green-700",
    validated: "bg-green-100 text-green-700",
    eoi_pending: "bg-yellow-100 text-yellow-700",
    pending: "bg-yellow-100 text-yellow-700",
    draft: "bg-gray-100 text-gray-600",
    in_review: "bg-blue-100 text-blue-700",
    issued: "bg-blue-100 text-blue-700",
    submitted: "bg-blue-100 text-blue-700",
    terminated: "bg-gray-100 text-gray-500",
    declined: "bg-red-100 text-red-700",
    denied: "bg-red-100 text-red-700",
    inactive: "bg-gray-100 text-gray-500",
    list: "bg-purple-100 text-purple-700",
    self: "bg-indigo-100 text-indigo-700",
    retro: "bg-orange-100 text-orange-700",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function PageWrapper({ children }: { children: ReactNode }) {
  return <div className="p-6 max-w-7xl mx-auto">{children}</div>;
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
