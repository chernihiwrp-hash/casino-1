import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { secureSelect } from "@/lib/supabase";
import { Rocket, Dices, CircleDot, Package, Sparkles, Wallet, ArrowRight, Shield, ChevronLeft, ChevronRight, ExternalLink, Ticket } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";

const TILES = [
  { to: "/rocket",    title: "Ракета",       desc: "Краш до x100",         icon: Rocket },
  { to: "/slots",     title: "Слоти",        desc: "Класика 3×3",           icon: Dices },
  { to: "/roulette",  title: "Рулетка",      desc: "Red / Black / Zero",    icon: CircleDot },
  { to: "/cases",     title: "NFT Кейси",    desc: "500 CR за дроп",        icon: Package },
  { to: "/upgrader",  title: "NFT Апгрейд",  desc: "Прокачай свій NFT",     icon: Sparkles },
  { to: "/inventory", title: "Інвентар",     desc: "Твоя колекція",         icon: Wallet },
  { to: "/promo",     title: "Промокоди",    desc: "Активуй бонуси",        icon: Ticket },
];

type Banner = {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  link_url?: string;
  bg_color?: string;
  active: boolean;
};

const BANNER_INTERVAL = 5000;
const FADE_MS = 800;

function BannerSlide({ b, isActive }: { b: Banner; isActive: boolean }) {
  const hasImage = !!b.image_url;
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-2xl"
      style={{
        opacity: isActive ? 1 : 0,
        // Identical smooth fade for EVERY transition (incl. last → first loop)
        transition: `opacity ${FADE_MS}ms ease-in-out`,
        pointerEvents: isActive ? "auto" : "none",
        zIndex: isActive ? 2 : 1,
        background:
          "linear-gradient(135deg, oklch(from var(--primary) l c h / 0.10), oklch(from var(--card) l c h / 0.6))",
        border: "1px solid oklch(from var(--primary) l c h / 0.25)",
      }}
    >
      {hasImage && (
        <img
          src={b.image_url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* Readability overlay — only when there is an image behind the text */}
      {hasImage && (
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, oklch(0 0 0 / 0.75) 0%, oklch(0 0 0 / 0.35) 50%, transparent 100%)",
          }}
        />
      )}

      {/* Content — centered when no image, bottom-aligned when image present */}
      <div
        className={
          hasImage
            ? "absolute inset-x-0 bottom-0 px-5 pb-4 pt-8"
            : "relative flex h-full flex-col justify-center px-5 py-5"
        }
      >
        <div className="text-base font-bold drop-shadow-md">{b.title}</div>
        {b.description && (
          <div className={`mt-0.5 text-xs line-clamp-2 ${hasImage ? "text-white/85 drop-shadow" : "text-muted-foreground"}`}>
            {b.description}
          </div>
        )}
        {b.link_url && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Детальніше <ExternalLink className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  );
}

function BannerSlider({ banners }: { banners: Banner[] }) {
  const [idx, setIdx] = useState(0);
  // Force-remount of progress bar on each change, even when looping back to 0
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setIdx(i => (i + 1) % banners.length);
    setTick(t => t + 1);
  }, [banners.length]);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, BANNER_INTERVAL);
  }, [advance]);

  useEffect(() => {
    if (banners.length <= 1) return;
    reset();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length, reset]);

  if (banners.length === 0) return null;

  const goTo = (i: number) => { setIdx(i); setTick(t => t + 1); reset(); };
  const prev = () => goTo((idx - 1 + banners.length) % banners.length);
  const next = () => goTo((idx + 1) % banners.length);
  const current = banners[idx];

  const wrapper = (
    <div className="glass relative overflow-hidden rounded-2xl" style={{ minHeight: 180 }}>
      <div className="relative h-[180px] sm:h-[200px]">
        {banners.map((b, i) => (
          <BannerSlide key={b.id ?? i} b={b} isActive={i === idx} />
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); prev(); }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg transition hover:scale-110"
            style={{ background: "oklch(0 0 0 / 0.45)" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); next(); }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg transition hover:scale-110"
            style={{ background: "oklch(0 0 0 / 0.45)" }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {banners.length > 1 && (
        <div className="absolute bottom-2 right-3 z-10 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.preventDefault(); e.stopPropagation(); goTo(i); }}
              className="relative overflow-hidden rounded-full transition-all duration-500 ease-out"
              style={{
                width: i === idx ? 28 : 6,
                height: 6,
                background: "oklch(1 0 0 / 0.25)",
              }}
            >
              {i === idx && (
                <span
                  key={`fill-${tick}`}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: "var(--primary)",
                    width: "100%",
                    animation: `bannerProgress ${BANNER_INTERVAL}ms linear forwards`,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
      <style>{`
        @keyframes bannerProgress {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );

  return current.link_url
    ? <a href={current.link_url} target="_blank" rel="noreferrer">{wrapper}</a>
    : <div>{wrapper}</div>;
}

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    secureSelect<Banner>("banners", {
      filters: [{ col: "active", op: "eq", value: true }],
      order: { col: "created_at", asc: false },
    })
      .then((data) => setBanners(data ?? []))
      .catch((e) => console.warn("banners load failed:", e));
  }, []);

  if (loading || !user) return null;

  const isAdmin = user.role === "admin" || user.role === "mayor";

  return (
    <div className="space-y-5">
      <section className="glass-strong relative overflow-hidden rounded-3xl p-7 sm:p-10">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-sm uppercase tracking-widest text-primary">Привіт, {user.username}</p>
        <h1 className="mt-2 font-display text-4xl font-bold sm:text-5xl glow-text">Твій крипто-гаманець</h1>
        <div className="mt-5 flex items-end gap-3">
          <span className="font-mono text-5xl font-bold tabular-nums sm:text-6xl">
            {(user.balance ?? 0).toLocaleString()}
          </span>
          <span className="mb-2 text-lg font-semibold text-primary">CR</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Доступний баланс</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/cases" className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-1.5">
            Відкрити кейс <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/rocket" className="glass rounded-xl px-5 py-2.5 text-sm font-medium transition hover:scale-105 flex items-center gap-1.5">
            <Rocket className="h-4 w-4" /> Запустити ракету
          </Link>
          {isAdmin && (
            <Link to="/admin"
              className="glass rounded-xl px-5 py-2.5 text-sm font-medium transition hover:scale-105 flex items-center gap-2"
              style={{ border: "1px solid oklch(from var(--primary) l c h / 0.4)", color: "var(--primary)" }}>
              <Shield className="h-4 w-4" /> Адмін
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Акції</h2>
        {banners.length > 0 ? (
          <BannerSlider banners={banners} />
        ) : (
          <div
            className="glass flex items-center justify-center rounded-2xl px-5 text-sm text-muted-foreground"
            style={{
              minHeight: 120,
              background: "linear-gradient(135deg, oklch(from var(--primary) l c h / 0.10), oklch(from var(--card) l c h / 0.6))",
              border: "1px solid oklch(from var(--primary) l c h / 0.25)",
            }}
          >
            Акцій поки немає — слідкуй за оновленнями
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ігри</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.to} to={t.to}
                className="glass group relative overflow-hidden rounded-2xl p-5 transition hover:scale-[1.02] hover:border-primary/40">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl transition group-hover:scale-125" />
                <Icon className="relative h-7 w-7 text-primary" />
                <div className="relative mt-4">
                  <div className="text-base font-semibold">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default Index;
