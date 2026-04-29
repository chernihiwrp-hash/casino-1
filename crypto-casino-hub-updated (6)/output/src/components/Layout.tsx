import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Particles } from "./Particles";
import { Rocket, Dices, CircleDot, Package, Sparkles, LogOut, Wallet, Ticket } from "lucide-react";

const NAV = [
  { to: "/rocket",    label: "Ракета",   icon: Rocket },
  { to: "/slots",     label: "Слоти",    icon: Dices },
  { to: "/roulette",  label: "Рулетка",  icon: CircleDot },
  { to: "/cases",     label: "Кейси",    icon: Package },
  { to: "/upgrader",  label: "Апгрейд",  icon: Sparkles },
  { to: "/inventory", label: "Інвентар", icon: Wallet },
  { to: "/promo",     label: "Промо",    icon: Ticket },
];

export function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();

  return (
    <div className="relative min-h-screen text-foreground">
      <Particles />

      <header className="sticky top-0 z-30 px-4 pt-4">
        <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-bold tracking-tight glow-text sm:text-lg">
              CHERNIHIV<span className="text-primary"> CASINO</span>
            </span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="glass hidden rounded-xl px-3 py-1.5 sm:flex sm:items-center sm:gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-semibold tabular-nums">{(user.balance ?? 0).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">CR</span>
              </div>
              <Link to="/promo"
                className="glass hidden h-9 w-9 items-center justify-center rounded-xl transition hover:scale-105 sm:flex"
                title="Промокоди">
                <Ticket className="h-4 w-4 text-primary" />
              </Link>
              <Link to="/profile"
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition hover:scale-[1.03]"
                style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
                title="Особистий кабінет">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/20 text-sm font-bold">
                  {user.username[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="hidden text-sm font-semibold sm:block">{user.username}</span>
              </Link>
              <button onClick={logout}
                className="glass flex h-9 w-9 items-center justify-center rounded-xl transition hover:scale-105"
                title="Вийти">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn-primary rounded-xl px-4 py-2 text-sm">Увійти</Link>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-32 pt-6">
        <Outlet />
      </main>

      {user && (
        <nav className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2">
          <div className="glass-strong flex items-center justify-around rounded-2xl px-2 py-2">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = loc.pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition ${
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
