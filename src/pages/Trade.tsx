import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { supabase, secureInsert, secureUpdate } from "@/lib/supabase";
import { useUserNfts } from "@/lib/nft";
import {
  ArrowLeftRight, Send, CheckCircle, XCircle, Clock, PackageSearch, Coins, User,
} from "lucide-react";

// 30% комиссия от введённой суммы — снимается "на выходе":
// отправитель платит X, получатель получает X * 0.7, комиссия = X * 0.3
const FEE_PCT = 30;
const MAX_NFTS = 10;

type Trade = {
  id: string;
  from_nick: string;
  to_nick: string;
  nft_owner_id: string | null;          // legacy (одиночный)
  nft_owner_ids: string[] | null;       // новое поле — массив до 10
  amount_cr: number;                    // сумма, которую получит receiver (после комиссии)
  fee_cr: number;                       // комиссия
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Очікує",    cls: "bg-yellow-500/15 text-yellow-400" },
    accepted: { label: "Прийнято",  cls: "bg-primary/15 text-primary" },
    declined: { label: "Відхилено", cls: "bg-destructive/15 text-destructive" },
    cancelled:{ label: "Скасовано", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function TradePage() {
  const { user, updateBalance, refresh } = useAuth();
  const { items, reload } = useUserNfts(user?.username);

  const [toNick, setToNick]     = useState("");
  const [amountCr, setAmountCr] = useState("");
  const [nftIds, setNftIds]     = useState<string[]>([]);  // ↞ до 10
  const [msg, setMsg]           = useState("");
  const [busy, setBusy]         = useState(false);
  const [incoming, setIncoming] = useState<Trade[]>([]);
  const [outgoing, setOutgoing] = useState<Trade[]>([]);
  const [tab, setTab]           = useState<"new" | "inbox" | "sent">("new");

  const loadTrades = useCallback(async () => {
    if (!user) return;
    const { data: inc } = await supabase
      .from("trades").select("*")
      .eq("to_nick", user.username).eq("status", "pending")
      .order("created_at", { ascending: false });
    const { data: out } = await supabase
      .from("trades").select("*")
      .eq("from_nick", user.username)
      .order("created_at", { ascending: false }).limit(30);
    setIncoming((inc ?? []) as Trade[]);
    setOutgoing((out ?? []) as Trade[]);
  }, [user]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const grossCr = Math.max(0, Math.floor(Number(amountCr) || 0)); // вводит отправитель
  const feeCr   = Math.ceil(grossCr * FEE_PCT / 100);
  const netCr   = grossCr - feeCr;                                 // получит получатель

  const toggleNft = (id: string) => {
    setNftIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_NFTS) return prev;
      return [...prev, id];
    });
  };

  const send = async () => {
    if (!user || busy) return;
    if (!toNick.trim())                  return setMsg("Вкажи нік отримувача");
    if (toNick.trim() === user.username) return setMsg("Не можна надіслати самому собі");
    if (grossCr <= 0 && nftIds.length === 0) return setMsg("Додай CR або обери NFT (до 10)");
    if (nftIds.length > MAX_NFTS)        return setMsg(`Максимум ${MAX_NFTS} NFT за раз`);

    setBusy(true); setMsg("");
    try {
      const { data: target } = await supabase
        .from("users").select("id").eq("username", toNick.trim()).maybeSingle();
      if (!target) throw new Error("Користувача не знайдено");

      if ((user.balance ?? 0) < grossCr)
        throw new Error(`Потрібно ${grossCr.toLocaleString()} CR на балансі`);

      if (grossCr > 0) await updateBalance(-grossCr);

      await secureInsert("trades", {
        from_nick:     user.username,
        to_nick:       toNick.trim(),
        nft_owner_id:  nftIds[0] || null,       // legacy
        nft_owner_ids: nftIds,                  // массив
        amount_cr:     netCr,                    // получатель получит чистыми
        amount_rc:     0,
        fee_cr:        feeCr,
        status:        "pending",
      });

      setMsg("✅ Запит надіслано!");
      setAmountCr(""); setNftIds([]); setToNick("");
      await loadTrades();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally { setBusy(false); }
  };

  const accept = async (t: Trade) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (t.amount_cr > 0) await updateBalance(t.amount_cr);

      const ids = (t.nft_owner_ids && t.nft_owner_ids.length)
        ? t.nft_owner_ids
        : (t.nft_owner_id ? [t.nft_owner_id] : []);
      for (const id of ids) {
        await secureUpdate("nft_owners", { owner_nick: user.username }, { id });
      }

      await secureUpdate("trades", { status: "accepted", resolved_at: new Date().toISOString() }, { id: t.id });
      await loadTrades(); await reload(); await refresh();
    } finally { setBusy(false); }
  };

  const decline = async (t: Trade) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      // вернуть отправителю всю удержанную сумму = amount_cr + fee_cr
      const refund = (t.amount_cr || 0) + (t.fee_cr || 0);
      if (refund > 0) {
        const { data: sender } = await supabase
          .from("users").select("id, balance").eq("username", t.from_nick).maybeSingle();
        if (sender) {
          await secureUpdate(
            "users",
            { balance: ((sender as any).balance ?? 0) + refund },
            { id: (sender as any).id },
          );
        }
      }
      await secureUpdate("trades", { status: "declined", resolved_at: new Date().toISOString() }, { id: t.id });
      await loadTrades();
    } finally { setBusy(false); }
  };

  const selectedNfts = items.filter(i => nftIds.includes(i.ownerRowId));

  return (
    <div className="space-y-4">
      <PageHeader title="Трейди" subtitle={`P2P обмін NFT та CR · комісія ${FEE_PCT}% знімається з суми`} />

      <div className="glass-strong flex rounded-2xl p-1 gap-1">
        {([
          { key: "new",   label: "Новий",   icon: <Send className="h-3.5 w-3.5" /> },
          { key: "inbox", label: `Вхідні${incoming.length ? ` (${incoming.length})` : ""}`, icon: <ArrowLeftRight className="h-3.5 w-3.5" /> },
          { key: "sent",  label: "Надіслані", icon: <Clock className="h-3.5 w-3.5" /> },
        ] as const).map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all"
            style={{
              background: tab === key ? "var(--gradient-primary)" : "transparent",
              color:      tab === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              boxShadow:  tab === key ? "var(--shadow-glow)" : "none",
            }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {tab === "new" && (
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Send className="h-4 w-4 text-primary" /> Новий запит
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              <User className="h-3.5 w-3.5" /> Отримувач
            </label>
            <input value={toNick} onChange={e => setToNick(e.target.value)}
              placeholder="Введи нік..."
              className="w-full rounded-xl bg-input px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition" />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <Coins className="h-3.5 w-3.5" /> Сума CR (з тебе спишеться повністю)
              </span>
              <button className="text-[11px] text-primary hover:underline"
                onClick={() => setAmountCr(String(Math.floor(user?.balance ?? 0)))}>
                MAX ({(user?.balance ?? 0).toLocaleString()})
              </button>
            </label>
            <input type="number" min={0} value={amountCr} onChange={e => setAmountCr(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl bg-input px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-ring transition" />
          </div>

          {/* NFT multi-select (до 10) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <PackageSearch className="h-3.5 w-3.5" /> NFT — обрано {nftIds.length}/{MAX_NFTS}
              </label>
              {nftIds.length > 0 && (
                <button onClick={() => setNftIds([])} className="text-[11px] text-muted-foreground hover:text-destructive">
                  Очистити
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                У тебе немає NFT
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-72 overflow-y-auto rounded-xl border border-border/50 p-2 bg-card/40">
                {items.map(i => {
                  const active = nftIds.includes(i.ownerRowId);
                  const disabled = !active && nftIds.length >= MAX_NFTS;
                  return (
                    <button key={i.ownerRowId} type="button"
                      disabled={disabled}
                      onClick={() => toggleNft(i.ownerRowId)}
                      className={`relative rounded-lg overflow-hidden border text-left transition ${
                        active ? "border-primary ring-2 ring-primary/40" : "border-border/50 hover:border-primary/40"
                      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
                      <img src={i.image_url} alt={i.name} className="w-full aspect-square object-cover" />
                      <div className="p-1.5">
                        <div className="text-[10px] font-semibold truncate">{i.name}</div>
                        <div className="text-[10px] font-mono text-primary">{i.price.toLocaleString()}</div>
                      </div>
                      {active && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {(grossCr > 0 || selectedNfts.length > 0) && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Підсумок</div>
              {grossCr > 0 && (
                <>
                  <div className="flex justify-between"><span>Сума з тебе</span><span className="font-mono font-bold">{grossCr.toLocaleString()} CR</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Комісія {FEE_PCT}%</span><span className="font-mono">−{feeCr.toLocaleString()} CR</span></div>
                  <div className="flex justify-between border-t border-border/50 pt-1.5 font-semibold">
                    <span>Отримає {toNick || "адресат"}</span>
                    <span className="font-mono text-primary">{netCr.toLocaleString()} CR</span>
                  </div>
                </>
              )}
              {selectedNfts.length > 0 && (
                <div className="flex justify-between pt-1 border-t border-border/50">
                  <span>NFT</span>
                  <span className="font-semibold text-right">{selectedNfts.length} шт</span>
                </div>
              )}
            </div>
          )}

          <button onClick={send} disabled={busy}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-40">
            <Send className="h-4 w-4" />
            {busy ? "Надсилаємо..." : "Надіслати запит"}
          </button>

          {msg && (
            <div className={`rounded-xl px-4 py-3 text-center text-sm font-medium ${
              msg.startsWith("✅") ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
            }`}>{msg}</div>
          )}
        </div>
      )}

      {tab === "inbox" && (
        <div className="space-y-3">
          {incoming.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
              <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 opacity-30" />
              Вхідних запитів немає
            </div>
          ) : incoming.map(t => {
            const nftCount = (t.nft_owner_ids?.length) || (t.nft_owner_id ? 1 : 0);
            return (
              <div key={t.id} className="glass-strong rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {t.from_nick[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t.from_nick}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("uk-UA")}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>

                <div className="flex flex-wrap gap-2 text-xs rounded-xl bg-muted/30 p-3">
                  {t.amount_cr > 0 && (
                    <div className="flex items-center gap-1.5 text-primary font-semibold">
                      <Coins className="h-3.5 w-3.5" />
                      +{t.amount_cr.toLocaleString()} CR
                    </div>
                  )}
                  {nftCount > 0 && (
                    <div className="flex items-center gap-1.5 text-yellow-400 font-semibold">
                      <PackageSearch className="h-3.5 w-3.5" />
                      + {nftCount} NFT
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => accept(t)} disabled={busy}
                    className="btn-primary flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold disabled:opacity-40">
                    <CheckCircle className="h-3.5 w-3.5" /> Прийняти
                  </button>
                  <button onClick={() => decline(t)} disabled={busy}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-destructive/15 px-4 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/25 disabled:opacity-40 transition">
                    <XCircle className="h-3.5 w-3.5" /> Відхилити
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "sent" && (
        <div className="space-y-2">
          {outgoing.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
              <Clock className="mx-auto mb-3 h-8 w-8 opacity-30" />
              Ти ще не надсилав запитів
            </div>
          ) : outgoing.map(t => {
            const nftCount = (t.nft_owner_ids?.length) || (t.nft_owner_id ? 1 : 0);
            return (
              <div key={t.id} className="glass rounded-2xl p-3.5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {t.to_nick[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">→ {t.to_nick}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.amount_cr > 0 ? `${t.amount_cr.toLocaleString()} CR` : ""}
                    {nftCount > 0 ? ` + ${nftCount} NFT` : ""}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
