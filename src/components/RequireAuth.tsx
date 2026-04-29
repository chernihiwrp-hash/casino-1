import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function PageHeader({ title, subtitle, description }: { title: string; subtitle?: string; description?: string }) {
  const sub = subtitle ?? description;
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-bold glow-text sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
