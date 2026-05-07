import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { supabase, secureInsert } from "@/lib/supabase";
import { useUserNfts } from "@/lib/nft";
import { ArrowLeftRight } from "lucide-react";

const FEE_PCT = 5; // 5% комиссия

export default function TradePage() {
  const { user, updateBalance, refresh } = useAuth();
  const { items, reload } = useUserNfts(user?.username);
  const [toNick, setToNick] = useState("");
  const [amountCr, setAmountCr] = useState("");
  const [nftRowId, setNftRowId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);

  const loadTrades = useCallback(async () => {
    if (!user) return;
    const { data: inc } = await supabase.from("trades").select("*").eq("to_nick", user.username).eq("status", "pending").order("created_at", { ascending: false });
    const { data: out } = await supabase.from("trades").select("*").eq("from_nick", user.username).order("created_at", { ascending: false }).limit(20);
    setIncoming(inc ?? []); setOutgoing(out ?? []);
  }, [user]);
  useEffect(() => { loadTrades(); }, [loadTrades]);

  const send = async () => {
    if (!user || busy) return;
    const cr = Number(amountCr) || 0;
    if (!toNick.trim()) return setMsg("Вкажи нік отримувача");
    if (toNick.trim() === user.username) return setMsg("Не можна собі");
    if (cr <= 0 && !nftRowId) return setMsg("Додай CR або NFT");
    setBusy(true); setMsg("");
    try {
      const { data: target } = await supabase.from("users").select("id").eq("username", toNick.trim()).maybeSingle();
      if (!target) throw new Error("Користувача не знайдено");
      const fee = Math.ceil(cr * FEE_PCT / 100);
      if ((user.balance ?? 0) < cr + fee) throw new Error(`Потрібно ${cr + fee} CR (з комісією ${fee})`);
      // списуємо
      if (cr + fee > 0) await updateBalance(-(cr + fee));
      await secureInsert("trades", {
        from_nick: user.username,
        to_nick: toNick.trim(),
        nft_owner_id: nftRowId || null,
        amount_cr: cr,
        amount_rc: 0,
        fee_cr: fee,
        status: "pending",
      });
      setMsg(`✅ Запит надіслано (комісія ${fee} CR)`);
      setAmountCr(""); setNftRowId(""); setToNick("");
      await loadTrades();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally { setBusy(false); }
  };

  const accept = async (t: any) => {
    if (!user) return;
    setBusy(true);
    try {
      // отримати CR
      if (t.amount_cr > 0) await updateBalance(t.amount_cr);
      // переписати NFT
      if (t.nft_owner_id) {
        await supabase.from("nft_owners").update({ owner_nick: user.username }).eq("id", t.nft_owner_id);
      }
      await supabase.from("trades").update({ status: "accepted", resolved_at: new Date().toISOString() }).eq("id", t.id);
      await loadTrades(); await reload(); await refresh();
    } finally { setBusy(false); }
  };

  const decline = async (t: any) => {
    if (!user) return;
    // повернути CR відправнику
    if (t.amount_cr > 0 || t.fee_cr > 0) {
      const { data: sender } = await supabase.from("users").select("id, balance").eq("username", t.from_nick).maybeSingle();
      if (sender) {
        await supabase.from("users").update({ balance: ((sender as any).balance ?? 0) + t.amount_cr + t.fee_cr }).eq("id", (sender as any).id);
      }
    }
    await supabase.from("trades").update({ status: "declined", resolved_at: new Date().toISOString() }).eq("id", t.id);
    await loadTrades();
  };

  return (
    <div>
      <PageHeader title="Трейд" subtitle={`Обмін NFT та CR · комісія ${FEE_PCT}%`} />

      <div className="glass-strong mb-4 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><ArrowLeftRight className="h-4 w-4 text-primary" /> Новий запит</div>
        <input value={toNick} onChange={e => setToNick(e.target.value)} placeholder="Нік отримувача"
          className="w-full rounded-xl bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input type="number" value={amountCr} onChange={e => setAmountCr(e.target.value)} placeholder="CR (опціонально)"
          className="w-full rounded-xl bg-input px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring" />
        <select value={nftRowId} onChange={e => setNftRowId(e.target.value)}
          className="w-full rounded-xl bg-input px-3 py-2 text-sm outline-none">
          <option value="">— без NFT —</option>
          {items.map(i => <option key={i.ownerRowId} value={i.ownerRowId}>{i.name} ({i.price} CR)</option>)}
        </select>
        <button onClick={send} disabled={busy} className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold">
          {busy ? "..." : "Надіслати запит"}
        </button>
        {msg && <div className="rounded-xl px-3 py-2 text-center text-xs">{msg}</div>}
      </div>

      <div className="glass-strong mb-4 rounded-2xl p-4">
        <div className="mb-3 text-sm font-semibold">Вхідні запити ({incoming.length})</div>
        {incoming.length === 0 ? <p className="text-xs text-muted-foreground">Немає</p> : incoming.map(t => (
          <div key={t.id} className="glass mb-2 flex items-center gap-2 rounded-xl p-3">
            <div className="flex-1 text-xs">
              <div className="font-semibold">{t.from_nick}</div>
              <div className="text-muted-foreground">+{t.amount_cr} CR{t.nft_owner_id ? " + NFT" : ""}</div>
            </div>
            <button onClick={() => accept(t)} disabled={busy} className="btn-primary rounded-lg px-3 py-1.5 text-xs">Прийняти</button>
            <button onClick={() => decline(t)} disabled={busy} className="rounded-lg bg-destructive/15 px-3 py-1.5 text-xs text-destructive">×</button>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-4">
        <div className="mb-3 text-sm font-semibold">Мої запити</div>
        {outgoing.length === 0 ? <p className="text-xs text-muted-foreground">Немає</p> : outgoing.map(t => (
          <div key={t.id} className="glass mb-2 flex items-center gap-2 rounded-xl p-3 text-xs">
            <div className="flex-1">
              <div className="font-semibold">→ {t.to_nick}</div>
              <div className="text-muted-foreground">{t.amount_cr} CR (комісія {t.fee_cr})</div>
            </div>
            <span className={`rounded px-2 py-1 text-[10px] ${t.status === "accepted" ? "bg-primary/15 text-primary" : t.status === "declined" ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>
              {t.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
