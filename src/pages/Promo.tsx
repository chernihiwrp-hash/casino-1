import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/RequireAuth";
import { Ticket, CheckCircle, AlertTriangle, Sparkles, History, Loader2 } from "lucide-react";

type Redemption = {
  id: string;
  promo_code_id: string;
  amount: number;
  redeemed_at: string;
  promo_codes?: { code: string } | null;
};

type RedeemResult = {
  success: boolean;
  amount?: number;
  new_balance?: number;
  error_code?: string;
  message?: string;
};

// Allowed: A-Z, 0-9, dash, underscore. Length 3..32.
const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

export default function PromoPage() {
  const { user, refresh } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [history, setHistory] = useState<Redemption[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHist(true);
    const { data } = await supabase
      .from("promo_code_redemptions")
      .select("id, promo_code_id, amount, redeemed_at, promo_codes(code)")
      .eq("user_id", user.id)
      .order("redeemed_at", { ascending: false })
      .limit(20);
    setHistory((data as unknown as Redemption[]) ?? []);
    setLoadingHist(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) return;
    const clean = code.trim().toUpperCase();
    if (!CODE_RE.test(clean)) {
      setMsg({ text: "Невірний формат: 3–32 символи, A–Z, 0–9, - або _", ok: false });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    const { data, error } = await supabase.rpc("redeem_promo_code", {
      p_user_id: user.id,
      p_code: clean,
    });
    setSubmitting(false);
    if (error) {
      setMsg({ text: "Помилка: " + error.message, ok: false });
      return;
    }
    const res = (data ?? {}) as RedeemResult;
    if (res.success) {
      setMsg({ text: res.message || `Зараховано ${res.amount} CR`, ok: true });
      setCode("");
      await refresh();
      await loadHistory();
    } else {
      setMsg({ text: res.message || "Не вдалося активувати промокод", ok: false });
    }
  };

  return (
    <div>
      <style>{`
        @keyframes promoGlow {
          0%,100% { box-shadow: 0 0 0 0 oklch(from var(--primary) l c h/.0); }
          50%     { box-shadow: 0 0 35px 6px oklch(from var(--primary) l c h/.35); }
        }
      `}</style>

      <PageHeader title="Промокоди" subtitle="Активуй код — отримай бонус" />

      {/* HERO */}
      <section className="glass-strong relative mb-5 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-10 -bottom-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            <Ticket className="h-6 w-6" style={{ color: "var(--primary-foreground)" }} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-primary">Бонус</p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl glow-text">Активуй промокод</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Введи кодове слово нижче, щоб отримати CR на свій баланс.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="relative mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            placeholder="BONUS2024"
            maxLength={32}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            className="flex-1 rounded-2xl bg-input px-5 py-4 text-center font-mono text-xl font-bold tracking-[0.3em] uppercase outline-none focus:ring-2 focus:ring-ring sm:text-2xl"
            style={{ border: "1px solid oklch(from var(--primary) l c h / 0.35)" }}
          />
          <button
            type="submit"
            disabled={submitting || code.length === 0}
            className="btn-primary flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Активація…</>
            ) : (
              <><Sparkles className="h-5 w-5" /> Активувати</>
            )}
          </button>
        </form>

        {msg && (
          <div
            className="mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            style={{
              background: msg.ok
                ? "oklch(from var(--primary) l c h / 0.12)"
                : "oklch(0.65 0.24 25 / 0.12)",
              border: `1px solid ${msg.ok
                ? "oklch(from var(--primary) l c h / 0.45)"
                : "oklch(0.65 0.24 25 / 0.45)"}`,
              color: msg.ok ? "var(--primary)" : "var(--destructive)",
            }}
          >
            {msg.ok
              ? <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              : <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <span>{msg.text}</span>
          </div>
        )}

        <p className="relative mt-4 text-xs text-muted-foreground">
          Один промокод можна активувати лише один раз. Дозволені символи: A–Z, 0–9, «-», «_».
        </p>
      </section>

      {/* HISTORY */}
      <section>
        <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <History className="h-3.5 w-3.5" /> Мої активації
        </h3>

        {loadingHist ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Завантаження…
          </div>
        ) : history.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Поки що жодного активованого промокоду.
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Код</th>
                  <th className="px-4 py-3 font-medium text-right">Бонус</th>
                  <th className="px-4 py-3 font-medium text-right">Дата</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-mono font-semibold">
                      {r.promo_codes?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-primary">
                      +{Number(r.amount).toLocaleString()} CR
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {new Date(r.redeemed_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
