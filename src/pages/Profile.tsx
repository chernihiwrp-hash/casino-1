import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { useUserNfts } from "@/lib/nft";
import { secureUpdate, secureSelect } from "@/lib/supabase";
import { Wallet, Calendar, LogOut, Star, Award, Settings, Palette, Check, Gift, Copy, Link2 } from "lucide-react";
import { useState } from "react";

const THEMES: { key: string; label: string; swatch: string }[] = [
  { key: "green",  label: "Зелена",     swatch: "linear-gradient(135deg, oklch(0.82 0.22 150), oklch(0.68 0.2 160))" },
  { key: "purple", label: "Фіолетова",  swatch: "linear-gradient(135deg, oklch(0.78 0.23 305), oklch(0.62 0.22 295))" },
  { key: "orange", label: "Помаранчева",swatch: "linear-gradient(135deg, oklch(0.82 0.2 65),  oklch(0.68 0.2 50))"  },
  { key: "gold",   label: "Золота",     swatch: "linear-gradient(135deg, oklch(0.88 0.18 95),  oklch(0.74 0.16 80))" },
  { key: "red",    label: "Червона",    swatch: "linear-gradient(135deg, oklch(0.74 0.25 28),  oklch(0.58 0.23 20))" },
  { key: "blue",   label: "Синя",       swatch: "linear-gradient(135deg, oklch(0.72 0.21 265), oklch(0.55 0.2 255))" },
  { key: "cyan",   label: "Блакитна",   swatch: "linear-gradient(135deg, oklch(0.83 0.16 205), oklch(0.68 0.15 195))" },
];

function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const { items } = useUserNfts(user?.username);
  const [activeTab, setActiveTab] = useState<"stats" | "nfts" | "referral" | "themes" | "account">("stats");
  const [savingTheme, setSavingTheme] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  if (!user) return null;

  const totalValue = items.reduce((s, i) => s + i.price, 0);
  const avatarLetter = user.username[0]?.toUpperCase() ?? "?";

  const roleColor = user.role === "admin" || user.role === "mayor"
    ? "var(--primary)" : "var(--muted-foreground)";
  const roleLabel =
    user.role === "mayor" ? "Мер" :
    user.role === "admin" ? "Адміністратор" : "Гравець";

  const joinDate = new Date(user.registered_at);
  const daysAgo = Math.floor((Date.now() - joinDate.getTime()) / 86400000);

  const refCode = (user as any).referral_code || "—";
  const refLink = typeof window !== "undefined" && refCode !== "—"
    ? `${window.location.origin}/login?ref=${refCode}`
    : "";

  const copy = async (what: "code" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {/* noop */}
  };

  return (
    <div>
      <style>{`
        @keyframes avatarGlow {
          0%,100% { box-shadow: 0 0 20px oklch(from var(--primary) l c h / 0.4), 0 0 40px oklch(from var(--primary) l c h / 0.2); }
          50%      { box-shadow: 0 0 35px oklch(from var(--primary) l c h / 0.65), 0 0 65px oklch(from var(--primary) l c h / 0.35); }
        }
        @keyframes profileSlideIn { from {opacity:0; transform:translateY(20px);} to {opacity:1; transform:translateY(0);} }
        @keyframes statCount      { from {opacity:0; transform:scale(0.8);} to {opacity:1; transform:scale(1);} }
        .profile-animate { animation: profileSlideIn 0.4s ease-out; }
        .stat-animate    { animation: statCount 0.5s ease-out; }
      `}</style>

      <PageHeader title="Особистий кабінет" subtitle="Твоя статистика та акаунт" />

      <div className="glass-strong mb-4 rounded-3xl p-6 profile-animate">
        <div className="flex items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold overflow-hidden"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", animation: "avatarGlow 3s ease-in-out infinite" }}>
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="h-20 w-20 object-cover" />
                : avatarLetter}
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 flex items-center justify-center"
              style={{ background: "var(--primary)", borderColor: "var(--background)" }}>
              <div className="h-2 w-2 rounded-full" style={{ background: "var(--primary-foreground)" }} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold truncate">{user.username}</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: roleColor }}>{roleLabel}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {user.is_banned ? "Заблокований" : "Активний"}{" · тема: "}{user.theme}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              З нами {daysAgo} {daysAgo === 1 ? "день" : daysAgo < 5 ? "дні" : "днів"}
            </div>
          </div>

          <button onClick={logout}
            className="glass flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition hover:bg-destructive/20 flex-shrink-0">
            <LogOut className="h-3.5 w-3.5" /> Вийти
          </button>
        </div>

        {/* Balance + Referral quick button row */}
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="rounded-2xl p-4 glass">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Баланс
                </div>
                <div className="font-mono text-3xl font-bold tabular-nums glow-text" style={{ color: "var(--primary)" }}>
                  {(user.balance ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">CR</div>
                <div className="text-xs text-muted-foreground">Crypto Credits</div>
              </div>
            </div>
          </div>

          {/* === REFERRAL QUICK BUTTON === */}
          <button
            onClick={() => {
              if (refCode === "—") { setActiveTab("referral"); return; }
              copy("code", refCode);
              setActiveTab("referral");
            }}
            className="glass-strong rounded-2xl px-5 py-4 flex flex-col items-center justify-center gap-1 hover:scale-[1.02] transition group"
            style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)", boxShadow: "var(--shadow-glow)" }}
            title="Скопіювати реферальний код">
            <div className="flex items-center gap-2">
              {copied === "code"
                ? <><Check className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Скопійовано!</span></>
                : <><Gift className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Реферал</span></>}
            </div>
            <div className="font-mono text-lg font-bold tracking-wider">{refCode}</div>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass mb-4 flex rounded-2xl p-1 gap-1 overflow-x-auto">
        {(["stats", "nfts", "referral", "themes", "account"] as const).map(key => {
          const labels = { stats: "Статистика", nfts: "NFT", referral: "Реферали", themes: "Теми", account: "Акаунт" };
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              className="flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
              style={{
                background: activeTab === key ? "var(--gradient-primary)" : "transparent",
                color: activeTab === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
                boxShadow: activeTab === key ? "var(--shadow-glow)" : "none",
              }}>
              {labels[key]}
            </button>
          );
        })}
      </div>

      {activeTab === "stats" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard icon={<Wallet className="h-5 w-5" />} label="Баланс"
            value={`${(user.balance ?? 0).toLocaleString()} CR`} color="var(--primary)" />
          <StatCard icon={<Award className="h-5 w-5" />} label="NFT у колекції"
            value={String(items.length)} sub={`Цінність: ${totalValue.toLocaleString()} CR`}
            color="oklch(0.7 0.2 270)" />
          <StatCard icon={<Calendar className="h-5 w-5" />} label="Дата реєстрації"
            value={joinDate.toLocaleDateString("uk-UA")}
            sub={`${daysAgo} ${daysAgo === 1 ? "день" : "днів"} тому`}
            color="oklch(0.7 0.15 200)" />
          <StatCard icon={<Star className="h-5 w-5" />} label="Тем розблоковано"
            value={String((user.owned_themes ?? []).length || 1)}
            sub={(user.owned_themes ?? []).join(", ") || user.theme}
            color="oklch(0.82 0.18 75)" />
        </div>
      )}

      {activeTab === "nfts" && (
        <div>
          {items.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-muted-foreground">
              <Palette className="h-10 w-10 text-primary mx-auto mb-3" />
              <div className="font-medium">NFT колекція порожня</div>
              <div className="text-sm mt-1">Відкривай кейси щоб отримати NFT</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="glass rounded-2xl overflow-hidden">
                  <div className="aspect-square" style={{ background: "var(--gradient-card)" }}>
                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm truncate">{item.name}</div>
                    <div className="font-mono text-xs mt-1 text-primary">{item.price.toLocaleString()} CR</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === REFERRAL TAB === */}
      {activeTab === "referral" && (
        <div className="space-y-3">
          {/* Головна картка реферального */}
          <div className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: "linear-gradient(135deg, oklch(0.22 0.08 145 / 0.6), oklch(0.15 0.04 145 / 0.3))", border: "1px solid oklch(0.55 0.18 145 / 0.35)", boxShadow: "0 0 40px oklch(0.55 0.18 145 / 0.1)" }}>
            <div className="absolute top-0 right-0 w-40 h-40 opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, oklch(0.72 0.22 145), transparent)", transform: "translate(30%, -30%)" }} />

            <div className="flex items-center gap-2.5 mb-3 relative">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "oklch(0.55 0.18 145 / 0.2)", border: "1px solid oklch(0.55 0.18 145 / 0.4)" }}>
                <Gift className="h-4.5 w-4.5" style={{ color: "oklch(0.72 0.22 145)" }} />
              </div>
              <div>
                <p className="text-sm font-black text-white">Реферальна програма</p>
                <p className="text-[10px]" style={{ color: "oklch(0.72 0.22 145)" }}>+1200 CR за кожного друга</p>
              </div>
            </div>

            {/* Код */}
            <div className="relative mb-3">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: "oklch(0.55 0.18 145)" }}>Твій код</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl px-4 py-3.5 font-mono text-2xl font-black text-center tracking-[0.3em]"
                  style={{ background: "oklch(0.12 0.03 145)", border: "1px solid oklch(0.55 0.18 145 / 0.3)", color: "oklch(0.72 0.22 145)", letterSpacing: "0.3em" }}>
                  {refCode}
                </div>
                <button onClick={() => copy("code", refCode)} disabled={refCode === "—"}
                  className="flex flex-col items-center justify-center gap-1 px-4 py-3.5 rounded-xl transition-all active:scale-90 disabled:opacity-40"
                  style={{ background: copied === "code" ? "oklch(0.55 0.18 145 / 0.3)" : "oklch(0.55 0.18 145 / 0.15)", border: "1px solid oklch(0.55 0.18 145 / 0.4)", minWidth: 64 }}>
                  {copied === "code"
                    ? <><Check className="h-4 w-4" style={{ color: "oklch(0.72 0.22 145)" }} /><span className="text-[9px] font-bold" style={{ color: "oklch(0.72 0.22 145)" }}>Ок!</span></>
                    : <><Copy className="h-4 w-4" style={{ color: "oklch(0.72 0.22 145)" }} /><span className="text-[9px] font-bold" style={{ color: "oklch(0.72 0.22 145)" }}>Копія</span></>}
                </button>
              </div>
            </div>

            {refLink && (
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: "oklch(0.55 0.18 145)" }}>Посилання</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-xl px-3 py-2.5 font-mono text-[10px] truncate"
                    style={{ background: "oklch(0.12 0.03 145)", border: "1px solid oklch(0.35 0.05 145 / 0.3)", color: "oklch(0.6 0.1 145)" }}>
                    {refLink}
                  </div>
                  <button onClick={() => copy("link", refLink)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all active:scale-90 text-xs font-bold"
                    style={{ background: "oklch(0.55 0.18 145 / 0.12)", border: "1px solid oklch(0.55 0.18 145 / 0.3)", color: "oklch(0.72 0.22 145)" }}>
                    {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Gift className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-foreground mb-1">Як це працює:</div>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Скопіюй код або посилання вище</li>
                  <li>Надішли другу</li>
                  <li>Друг реєструється і вводить твій код</li>
                  <li>Ти отримуєш +1200 CR одразу 🎉</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "themes" && (
        <div className="glass-strong rounded-2xl p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" /> Колірна тема профілю
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Обрана тема змінює акценти по всьому сайту: кнопки, свічення, активні елементи.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEMES.map((t) => {
              const active = user.theme === t.key;
              const saving = savingTheme === t.key;
              return (
                <button key={t.key} disabled={saving}
                  onClick={async () => {
                    if (active) return;
                    setSavingTheme(t.key);
                    try {
                      document.documentElement.setAttribute("data-theme", t.key);
                      await secureUpdate("users", { theme: t.key }, { id: user.id });
                      await refresh();
                    } finally { setSavingTheme(null); }
                  }}
                  className={`relative overflow-hidden rounded-2xl p-3 text-left transition hover:scale-[1.03] ${
                    active ? "ring-2 ring-offset-2 shadow-[var(--shadow-glow)]" : "ring-1 ring-border"
                  }`}
                  style={{ background: t.swatch }}>
                  <div className="h-14 w-full rounded-lg bg-black/25" />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-white/90 drop-shadow">{t.label}</span>
                    {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                    {saving && <span className="text-[10px] text-white/70">...</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground">
            Поточна тема: <span className="font-mono text-primary">{user.theme}</span>
          </div>
        </div>
      )}

      {activeTab === "account" && (
        <div className="glass rounded-2xl p-4 text-sm">
          <div className="mb-3 font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Дані акаунту
          </div>
          <div className="space-y-2">
            <Row k="ID" v={String(user.id)} />
            <Row k="Нікнейм" v={user.username} />
            <Row k="Реф-код" v={refCode} highlight />
            <Row k="Запрошений" v={(user as any).referred_by || "—"} />
            <Row k="Telegram ID" v={user.telegram_id ?? "—"} />
            <Row k="Роль" v={roleLabel} highlight={user.role !== "player"} />
            <Row k="Заблокований" v={user.is_banned ? "Так" : "Ні"} />
            <Row k="Активна тема" v={user.theme} />
            <Row k="Усі теми" v={(user.owned_themes ?? []).join(", ") || "—"} />
            <Row k="Дата реєстрації" v={joinDate.toLocaleString("uk-UA")} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 stat-animate"
      style={{ border: `1px solid ${color}33`, boxShadow: `0 0 20px ${color}11` }}>
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-3" style={{ color }}>
        {icon} {label}
      </div>
      <div className="font-mono text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-semibold" style={{ color: highlight ? "var(--primary)" : "var(--foreground)" }}>
        {v}
      </span>
    </div>
  );
}

export default ProfilePage;
