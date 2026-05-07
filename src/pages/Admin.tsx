import { useAuth } from "@/lib/auth";
import { RequireAuth, PageHeader } from "@/components/RequireAuth";
import { supabase, DbUser, secureInsert, secureInsertReturning } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import {
  Shield, Users, Megaphone, Plus, Trash2, Save, X,
  Crown, User, AlertTriangle, CheckCircle, Ban, Search, RefreshCw, Image, Gift,
  ToggleLeft, ToggleRight, Eye, EyeOff, Ticket, Hash, Clock, Tag, Coins, TrendingUp
} from "lucide-react";

function AdminGuard() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "mayor") {
    return (
      <div className="glass-strong rounded-3xl p-10 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <div className="text-2xl font-bold mb-2">Доступ заборонено</div>
        <div className="text-muted-foreground">У тебе немає прав адміністратора</div>
      </div>
    );
  }
  return <AdminPanel />;
}

type Banner = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  active: boolean;
  bg_color: string;
  created_at: string;
};

type Promo = {
  id: string;
  title: string;
  description: string;
  bonus_cr: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

type AdminTab = "users" | "banners" | "promotions" | "promocodes" | "crypto";

type PromoCode = {
  id: string;
  code: string;
  bonus_cr: number;
  max_uses: number;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
};

function Msg({ text, isError }: { text: string; isError?: boolean }) {
  if (!text) return null;
  return (
    <div className="mb-3 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2"
      style={{
        background: isError
          ? "oklch(0.65 0.24 25 / 0.15)"
          : "oklch(from var(--primary) l c h / 0.12)",
        border: `1px solid ${isError ? "oklch(0.65 0.24 25 / 0.4)" : "oklch(from var(--primary) l c h / 0.35)"}`,
        color: isError ? "var(--destructive)" : "var(--primary)",
      }}>
      {isError ? <AlertTriangle className="h-4 w-4 flex-shrink-0" /> : <CheckCircle className="h-4 w-4 flex-shrink-0" />}
      {text}
    </div>
  );
}

function AdminPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");
  const isMayor = user?.role === "mayor";

  return (
    <div>
      <style>{`
        @keyframes adminSlide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-animate { animation: adminSlide 0.25s ease-out; }
      `}</style>

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--gradient-primary)" }}>
          <Shield className="h-5 w-5" style={{ color: "var(--primary-foreground)" }} />
        </div>
        <div>
          <div className="text-xl font-bold">Панель адміністратора</div>
          <div className="text-xs text-muted-foreground">
            {user?.role === "mayor" ? "Мер" : "Адміністратор"} · {user?.username}
          </div>
        </div>
      </div>

      <div className="glass mb-4 flex rounded-2xl p-1 gap-1">
        {([
          { key: "users" as const, label: "Користувачі", icon: Users },
          { key: "banners" as const, label: "Банери", icon: Image },
          { key: "promotions" as const, label: "Акції", icon: Gift },
          { key: "promocodes" as const, label: "Промокоди", icon: Ticket },
          { key: "crypto" as const, label: "Крипто", icon: Coins },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.key ? "var(--gradient-primary)" : "transparent",
              color: tab === t.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              boxShadow: tab === t.key ? "0 2px 10px oklch(from var(--primary) l c h / 0.3)" : "none",
            }}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-animate" key={tab}>
        {tab === "users" && <UsersTab isMayor={isMayor} currentUser={user!} />}
        {tab === "banners" && <BannersTab />}
        {tab === "promotions" && <PromotionsTab />}
        {tab === "promocodes" && <PromoCodesTab />}
        {tab === "crypto" && <CryptoTab />}
      </div>
    </div>
  );
}

// ─── USERS TAB ────────────────────────────────────────────────────────────────

function UsersTab({ isMayor, currentUser }: { isMayor: boolean; currentUser: DbUser }) {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [editNick, setEditNick] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("users").select("*").order("id");
    if (error) { setMsg("Помилка завантаження: " + error.message); setMsgErr(true); }
    setUsers((data as DbUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const showMsg = (text: string, err = false) => {
    setMsg(text); setMsgErr(err);
    setTimeout(() => setMsg(""), 4000);
  };

  const grantAdmin = async (username: string) => {
    const { error } = await supabase.from("users").update({ role: "admin" }).eq("username", username);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    showMsg(`Роль admin видана @${username}`);
    load();
  };

  const revokeAdmin = async (username: string) => {
    const { error } = await supabase.from("users").update({ role: "player" }).eq("username", username);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    showMsg(`Роль admin знята з @${username}`);
    load();
  };

  const toggleBan = async (u: DbUser) => {
    const { error } = await supabase.from("users").update({ is_banned: !u.is_banned }).eq("id", u.id);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    showMsg(`${u.is_banned ? "Розбанений" : "Забанений"}: @${u.username}`);
    load();
  };

  const grantByNick = async () => {
    if (!editNick.trim()) return;
    await grantAdmin(editNick.trim());
    setEditNick("");
  };

  return (
    <div>
      {isMayor && (
        <div className="glass mb-4 rounded-2xl p-4">
          <div className="mb-2 text-sm font-semibold flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" /> Видати права по ніку
          </div>
          <div className="flex gap-2">
            <input value={editNick} onChange={e => setEditNick(e.target.value)}
              placeholder="Нікнейм" onKeyDown={e => e.key === "Enter" && grantByNick()}
              className="flex-1 rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            <button onClick={grantByNick}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" /> Видати
            </button>
          </div>
        </div>
      )}

      <div className="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Пошук по ніку..."
          className="flex-1 bg-transparent text-sm outline-none" />
        <button onClick={load} className="text-muted-foreground hover:text-foreground transition">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <Msg text={msg} isError={msgErr} />

      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Завантаження...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <UserRow key={u.id} u={u} isMayor={isMayor}
              isCurrentUser={u.id === currentUser.id}
              onGrantAdmin={() => grantAdmin(u.username)}
              onRevokeAdmin={() => revokeAdmin(u.username)}
              onToggleBan={() => toggleBan(u)} />
          ))}
          {filtered.length === 0 && (
            <div className="glass rounded-2xl p-6 text-center text-muted-foreground text-sm">
              Користувачі не найдены
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ u, isMayor, isCurrentUser, onGrantAdmin, onRevokeAdmin, onToggleBan }: {
  u: DbUser; isMayor: boolean; isCurrentUser: boolean;
  onGrantAdmin: () => void; onRevokeAdmin: () => void; onToggleBan: () => void;
}) {
  const roleColor =
    u.role === "mayor" ? "oklch(0.82 0.22 75)" :
    u.role === "admin" ? "var(--primary)" :
    "var(--muted-foreground)";

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ border: u.is_banned ? "1px solid oklch(0.65 0.24 25 / 0.35)" : "1px solid var(--border)" }}>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-bold text-sm"
        style={{ background: `oklch(from ${roleColor} l c h / 0.15)`, color: roleColor }}>
        {u.username[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{u.username}</span>
          {isCurrentUser && <span className="text-xs text-muted-foreground">(ты)</span>}
        </div>
        <div className="text-xs flex items-center gap-2 mt-0.5">
          <span style={{ color: roleColor }}>{u.role}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground">{(u.balance ?? 0).toLocaleString()} CR</span>
          {u.is_banned && <span className="text-destructive font-semibold">забанений</span>}
        </div>
      </div>
      {!isCurrentUser && isMayor && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {u.role === "player" && (
            <button onClick={onGrantAdmin} title="Видати admin"
              className="glass rounded-lg p-1.5 hover:bg-primary/20 transition">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </button>
          )}
          {u.role === "admin" && (
            <button onClick={onRevokeAdmin} title="Зняти admin"
              className="glass rounded-lg p-1.5 hover:bg-warning/20 transition">
              <User className="h-3.5 w-3.5" style={{ color: "oklch(0.82 0.18 75)" }} />
            </button>
          )}
          <button onClick={onToggleBan} title={u.is_banned ? "Розбанити" : "Забанити"}
            className="glass rounded-lg p-1.5 hover:bg-destructive/20 transition">
            {u.is_banned
              ? <CheckCircle className="h-3.5 w-3.5 text-primary" />
              : <Ban className="h-3.5 w-3.5 text-destructive" />
            }
          </button>
        </div>
      )}
    </div>
  );
}

// ─── BANNERS TAB ──────────────────────────────────────────────────────────────

const EMPTY_BANNER = (): Omit<Banner, "id" | "created_at"> => ({
  title: "",
  description: "",
  image_url: "",
  link_url: "",
  active: true,
  bg_color: "",
});

function BannersTab() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_BANNER());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMsg = (text: string, err = false) => {
    setMsg(text); setMsgErr(err);
    if (!err) setTimeout(() => setMsg(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) showMsg("Помилка завантаження: " + error.message, true);
    setBanners((data as Banner[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) { showMsg("Введіть заголовок", true); return; }
    setSaving(true);
    setMsg("");
    // Build the object without empty optional fields
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      active: form.active,
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.image_url.trim()) payload.image_url = form.image_url.trim();
    if (form.link_url.trim()) payload.link_url = form.link_url.trim();
    if (form.bg_color.trim()) payload.bg_color = form.bg_color.trim();

    let error: { message: string; details?: string } | null = null;
    try { await secureInsert("banners", payload); } catch (e) { error = { message: (e as Error).message }; }
    setSaving(false);
    if (error) {
      showMsg("Помилка збереження: " + error.message + (error.details ? " | " + error.details : ""), true);
      return;
    }
    showMsg("Банер успішно додано!");
    setCreating(false);
    setForm(EMPTY_BANNER());
    load();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    load();
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("banners").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      showMsg("Помилка видалення: " + error.message, true);
      return;
    }
    load();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" /> Банери на главной
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="glass rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setCreating(v => !v); setMsg(""); }}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? "Скасування" : "Додати"}
          </button>
        </div>
      </div>

      <Msg text={msg} isError={msgErr} />

      {creating && (
        <div className="glass mb-4 rounded-2xl p-4 space-y-3"
          style={{ border: "1px solid oklch(from var(--primary) l c h / 0.35)" }}>
          <div className="font-semibold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Новий банер
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Заголовок *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Введіть заголовок"
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Опис</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Короткий опис банера" rows={2}
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">URL зображення</label>
            <input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              placeholder="https://..." type="url"
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">URL посилання</label>
            <input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
              placeholder="https://... (необов'язково)" type="url"
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              <div className="w-10 h-5 rounded-full transition-colors"
                style={{ background: form.active ? "var(--primary)" : "var(--muted)" }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: form.active ? "translateX(20px)" : "translateX(0)" }} />
            </div>
            <span className="text-sm">Показувати на головній</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 flex-1">
              <Save className="h-4 w-4" /> {saving ? "Зберігаю..." : "Зберегти"}
            </button>
            <button onClick={() => { setCreating(false); setMsg(""); }}
              className="glass rounded-xl px-4 py-2.5 text-sm hover:bg-destructive/10 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Завантаження...</div>
      ) : banners.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Image className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <div className="text-muted-foreground">Немає банерів. Додайте перший!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(b => (
            <div key={b.id} className="glass rounded-2xl overflow-hidden transition-all"
              style={{
                border: b.active ? "1px solid oklch(from var(--primary) l c h / 0.3)" : "1px solid var(--border)",
                opacity: b.active ? 1 : 0.55,
              }}>
              <div className="flex items-start gap-3 p-4">
                {b.image_url ? (
                  <img src={b.image_url} alt="" className="h-16 w-24 rounded-xl object-cover flex-shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="h-16 w-24 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: "var(--muted)" }}>
                    <Image className="h-6 w-6 text-muted-foreground opacity-40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{b.title}</div>
                  {b.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.description}</div>}
                  {b.link_url && <div className="text-xs text-primary mt-1 truncate">{b.link_url}</div>}
                  <div className="flex items-center gap-1.5 mt-2">
                    {b.active
                      ? <><Eye className="h-3 w-3 text-primary" /><span className="text-xs text-primary font-medium">Активний</span></>
                      : <><EyeOff className="h-3 w-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">Прихований</span></>
                    }
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(b)}
                    className="glass rounded-lg p-1.5 hover:bg-primary/20 transition"
                    title={b.active ? "Прихованийь" : "Показати"}>
                    {b.active
                      ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Eye className="h-3.5 w-3.5 text-primary" />
                    }
                  </button>
                  <button onClick={() => remove(b.id)}
                    disabled={deletingId === b.id}
                    className="glass rounded-lg p-1.5 hover:bg-destructive/20 transition disabled:opacity-40">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PROMOTIONS TAB ───────────────────────────────────────────────────────────

const EMPTY_PROMO = (): Omit<Promo, "id" | "created_at"> => ({
  title: "",
  description: "",
  bonus_cr: 0,
  active: true,
  expires_at: null,
});

function PromotionsTab() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_PROMO());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMsg = (text: string, err = false) => {
    setMsg(text); setMsgErr(err);
    if (!err) setTimeout(() => setMsg(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promotions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) showMsg("Помилка завантаження: " + error.message, true);
    setPromos((data as Promo[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) { showMsg("Введіть заголовок", true); return; }
    setSaving(true);
    setMsg("");
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      active: form.active,
      bonus_cr: form.bonus_cr || 0,
    };
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.expires_at) payload.expires_at = form.expires_at;

    let error: { message: string; details?: string } | null = null;
    try { await secureInsert("promotions", payload); } catch (e) { error = { message: (e as Error).message }; }
    setSaving(false);
    if (error) {
      showMsg("Помилка: " + error.message + (error.details ? " | " + error.details : ""), true);
      return;
    }
    showMsg("Акцію додано!");
    setCreating(false);
    setForm(EMPTY_PROMO());
    load();
  };

  const toggleActive = async (p: Promo) => {
    const { error } = await supabase.from("promotions").update({ active: !p.active }).eq("id", p.id);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    load();
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("promotions").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      showMsg("Помилка видалення: " + error.message, true);
      return;
    }
    load();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Gift className="h-4 w-4 text-primary" /> Акції и бонусы
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="glass rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setCreating(v => !v); setMsg(""); }}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? "Скасування" : "Додати"}
          </button>
        </div>
      </div>

      <Msg text={msg} isError={msgErr} />

      {creating && (
        <div className="glass mb-4 rounded-2xl p-4 space-y-3"
          style={{ border: "1px solid oklch(from var(--primary) l c h / 0.35)" }}>
          <div className="font-semibold text-sm flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> Нова акція
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Назва *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Назва акції"
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Опис</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Умови акції..." rows={3}
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Бонус CR</label>
              <input type="number" min={0} value={form.bonus_cr}
                onChange={e => setForm(f => ({ ...f, bonus_cr: Number(e.target.value) }))}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">До (дата)</label>
              <input type="datetime-local"
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value || null }))}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              <div className="w-10 h-5 rounded-full transition-colors"
                style={{ background: form.active ? "var(--primary)" : "var(--muted)" }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: form.active ? "translateX(20px)" : "translateX(0)" }} />
            </div>
            <span className="text-sm">Акція активна</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 flex-1">
              <Save className="h-4 w-4" /> {saving ? "Зберігаю..." : "Зберегти"}
            </button>
            <button onClick={() => { setCreating(false); setMsg(""); }}
              className="glass rounded-xl px-4 py-2.5 text-sm hover:bg-destructive/10 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Завантаження...</div>
      ) : promos.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Gift className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <div className="text-muted-foreground">Немає акцій. Додайте першу!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {promos.map(p => (
            <div key={p.id} className="glass rounded-2xl p-4 transition-all"
              style={{
                border: p.active ? "1px solid oklch(from var(--primary) l c h / 0.3)" : "1px solid var(--border)",
                opacity: p.active ? 1 : 0.55,
              }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{p.title}</div>
                  {p.description && <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</div>}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {p.bonus_cr > 0 && (
                      <span className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>
                        +{p.bonus_cr.toLocaleString()} CR
                      </span>
                    )}
                    {p.expires_at && (
                      <span className="text-xs text-muted-foreground">
                        до {new Date(p.expires_at).toLocaleDateString("ru-RU")}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs">
                      {p.active
                        ? <><Eye className="h-3 w-3 text-primary" /><span className="text-primary font-medium">Активна</span></>
                        : <><EyeOff className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Прихованийа</span></>
                      }
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(p)}
                    className="glass rounded-lg p-1.5 hover:bg-primary/20 transition"
                    title={p.active ? "Прихованийь" : "Показати"}>
                    {p.active
                      ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Eye className="h-3.5 w-3.5 text-primary" />
                    }
                  </button>
                  <button onClick={() => remove(p.id)}
                    disabled={deletingId === p.id}
                    className="glass rounded-lg p-1.5 hover:bg-destructive/20 transition disabled:opacity-40">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PROMO CODES TAB ──────────────────────────────────────────────────────────

const EMPTY_PROMO_CODE = (): Omit<PromoCode, "id" | "created_at" | "used_count"> => ({
  code: "",
  bonus_cr: 100,
  max_uses: 10,
  active: true,
  expires_at: null,
});

function PromoCodesTab() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_PROMO_CODE());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showMsg = (text: string, err = false) => {
    setMsg(text); setMsgErr(err);
    if (!err) setTimeout(() => setMsg(""), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) showMsg("Помилка завантаження: " + error.message, true);
    setCodes((data as PromoCode[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm(f => ({ ...f, code }));
  };

  const save = async () => {
    if (!form.code.trim()) { showMsg("Введіть кодове слово", true); return; }
    if (form.bonus_cr <= 0) { showMsg("Бонус має бути більше 0", true); return; }
    if (form.max_uses <= 0) { showMsg("Ліміт використань має бути більше 0", true); return; }
    setSaving(true);
    setMsg("");
    const payload: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      bonus_cr: form.bonus_cr,
      max_uses: form.max_uses,
      active: form.active,
      used_count: 0,
    };
    if (form.expires_at) payload.expires_at = form.expires_at;

    let error: { message: string; details?: string } | null = null;
    try { await secureInsert("promo_codes", payload); } catch (e) { error = { message: (e as Error).message }; }
    setSaving(false);
    if (error) {
      showMsg("Помилка: " + error.message + (error.details ? " | " + error.details : ""), true);
      return;
    }
    showMsg("Промокод створено!");
    setCreating(false);
    setForm(EMPTY_PROMO_CODE());
    load();
  };

  const toggleActive = async (c: PromoCode) => {
    const { error } = await supabase.from("promo_codes").update({ active: !c.active }).eq("id", c.id);
    if (error) { showMsg("Помилка: " + error.message, true); return; }
    load();
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    setDeletingId(null);
    if (error) { showMsg("Помилка видалення: " + error.message, true); return; }
    load();
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" /> Промокоди
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="glass rounded-xl px-3 py-2 text-sm flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setCreating(v => !v); setMsg(""); }}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? "Скасування" : "Створити"}
          </button>
        </div>
      </div>

      <Msg text={msg} isError={msgErr} />

      {creating && (
        <div className="glass mb-4 rounded-2xl p-4 space-y-3"
          style={{ border: "1px solid oklch(from var(--primary) l c h / 0.35)" }}>
          <div className="font-semibold text-sm flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" /> Новий промокод
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Кодове слово *</label>
            <div className="flex gap-2">
              <input value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="BONUS2024"
                className="flex-1 rounded-xl bg-input px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring uppercase" />
              <button onClick={generateCode}
                className="glass rounded-xl px-3 py-2.5 text-xs font-medium hover:bg-primary/15 transition flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Авто
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Бонус CR</label>
              <input type="number" min={1} value={form.bonus_cr}
                onChange={e => setForm(f => ({ ...f, bonus_cr: Number(e.target.value) }))}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ліміт використань</label>
              <input type="number" min={1} value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Термін дії (дата)</label>
            <input type="datetime-local"
              onChange={e => setForm(f => ({ ...f, expires_at: e.target.value || null }))}
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              <div className="w-10 h-5 rounded-full transition-colors"
                style={{ background: form.active ? "var(--primary)" : "var(--muted)" }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: form.active ? "translateX(20px)" : "translateX(0)" }} />
            </div>
            <span className="text-sm">Промокод активний</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 flex-1">
              <Save className="h-4 w-4" /> {saving ? "Зберігаю..." : "Зберегти"}
            </button>
            <button onClick={() => { setCreating(false); setMsg(""); }}
              className="glass rounded-xl px-4 py-2.5 text-sm hover:bg-destructive/10 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Завантаження...</div>
      ) : codes.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <div className="text-muted-foreground">Немає промокодів. Створіть перший!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map(c => {
            const usagePercent = c.max_uses > 0 ? Math.min(100, (c.used_count / c.max_uses) * 100) : 0;
            const isExpired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
            const isFull = c.used_count >= c.max_uses;
            return (
              <div key={c.id} className="glass rounded-2xl p-4 transition-all"
                style={{
                  border: (c.active && !isExpired && !isFull)
                    ? "1px solid oklch(from var(--primary) l c h / 0.3)"
                    : "1px solid var(--border)",
                  opacity: (c.active && !isExpired && !isFull) ? 1 : 0.55,
                }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-base tracking-widest"
                        style={{ color: "var(--primary)" }}>{c.code}</span>
                      {isExpired && <span className="text-[10px] rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-medium">Протермінований</span>}
                      {isFull && !isExpired && <span className="text-[10px] rounded-full px-2 py-0.5 bg-orange-500/15 text-orange-400 font-medium">Вичерпано</span>}
                      {c.active && !isExpired && !isFull && <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary font-medium">Активний</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-xs font-mono font-bold" style={{ color: "var(--primary)" }}>
                        +{c.bonus_cr.toLocaleString()} CR
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" /> {c.used_count}/{c.max_uses} використань
                      </span>
                      {c.expires_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> до {new Date(c.expires_at).toLocaleDateString("uk-UA")}
                        </span>
                      )}
                    </div>
                    {/* Usage bar */}
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${usagePercent}%`,
                          background: usagePercent >= 100
                            ? "var(--destructive)"
                            : usagePercent >= 70
                            ? "oklch(.78 .22 50)"
                            : "var(--primary)",
                        }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleActive(c)}
                      className="glass rounded-lg p-1.5 hover:bg-primary/20 transition"
                      title={c.active ? "Вимкнути" : "Увімкнути"}>
                      {c.active
                        ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        : <Eye className="h-3.5 w-3.5 text-primary" />
                      }
                    </button>
                    <button onClick={() => remove(c.id)}
                      disabled={deletingId === c.id}
                      className="glass rounded-lg p-1.5 hover:bg-destructive/20 transition disabled:opacity-40">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



// ============= CRYPTO TAB =============
type CryptoCoinAdmin = {
  id: string; symbol: string; name: string; image_url: string;
  price: number; change_24h: number; volatility: number;
  market_cap: number | null; active: boolean; created_at: string;
};

function CryptoTab() {
  const [coins, setCoins] = useState<CryptoCoinAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState(""); const [msgErr, setMsgErr] = useState(false);
  const empty = { symbol: "", name: "", image_url: "", price: 1, change_24h: 0, volatility: 1, market_cap: 0, active: true };
  const [form, setForm] = useState<Omit<CryptoCoinAdmin, "id" | "created_at">>(empty);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("crypto_coins").select("*").order("created_at", { ascending: false });
    setCoins((data ?? []) as CryptoCoinAdmin[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.symbol || !form.name || !form.image_url || form.price <= 0) {
      setMsg("Заповніть symbol, name, image_url, price"); setMsgErr(true); return;
    }
    if (editingId) {
      const { error } = await supabase.from("crypto_coins").update(form).eq("id", editingId);
      if (error) { setMsg(error.message); setMsgErr(true); return; }
    } else {
      let error: { message: string } | null = null;
      try { await secureInsert("crypto_coins", form); } catch (e) { error = { message: (e as Error).message }; }
      if (error) { setMsg(error.message); setMsgErr(true); return; }
    }
    setMsg("Збережено"); setMsgErr(false); setCreating(false); setEditingId(null); setForm(empty); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Видалити монету?")) return;
    await supabase.from("crypto_coins").delete().eq("id", id); load();
  };
  const toggle = async (c: CryptoCoinAdmin) => {
    await supabase.from("crypto_coins").update({ active: !c.active }).eq("id", c.id); load();
  };
  const editStart = (c: CryptoCoinAdmin) => {
    setEditingId(c.id); setCreating(true);
    setForm({ symbol: c.symbol, name: c.name, image_url: c.image_url, price: c.price,
      change_24h: c.change_24h, volatility: c.volatility, market_cap: c.market_cap ?? 0, active: c.active });
  };

  return (
    <div className="admin-animate">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" />
          <div className="text-lg font-bold">Крипто монети</div>
          <span className="text-xs text-muted-foreground">({coins.length})</span></div>
        {!creating && (
          <button onClick={() => { setCreating(true); setEditingId(null); setForm(empty); }}
            className="btn-primary rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Додати</button>
        )}
      </div>
      <Msg text={msg} isError={msgErr} />
      {creating && (
        <div className="glass mb-4 rounded-2xl p-4 space-y-3" style={{ border: "1px solid oklch(from var(--primary) l c h / 0.35)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Symbol *</label>
              <input value={form.symbol} onChange={e=>setForm(f=>({...f,symbol:e.target.value.toUpperCase()}))} placeholder="BTC"
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm uppercase font-mono outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Назва *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Bitcoin"
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" /></div>
          </div>
          <div><label className="text-xs text-muted-foreground mb-1 block">URL зображення *</label>
            <input value={form.image_url} onChange={e=>setForm(f=>({...f,image_url:e.target.value}))} placeholder="https://..."
              className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
            {form.image_url && <img src={form.image_url} alt="" className="mt-2 h-16 w-16 rounded-full object-cover" />}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><label className="text-xs text-muted-foreground mb-1 block">Ціна USD *</label>
              <input type="number" step="0.000001" value={form.price} onChange={e=>setForm(f=>({...f,price:Number(e.target.value)}))}
                className="w-full rounded-xl bg-input px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">24г %</label>
              <input type="number" step="0.01" value={form.change_24h} onChange={e=>setForm(f=>({...f,change_24h:Number(e.target.value)}))}
                className="w-full rounded-xl bg-input px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Волатильність</label>
              <input type="number" step="0.1" value={form.volatility} onChange={e=>setForm(f=>({...f,volatility:Number(e.target.value)}))}
                className="w-full rounded-xl bg-input px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Капіталізація</label>
              <input type="number" value={form.market_cap ?? 0} onChange={e=>setForm(f=>({...f,market_cap:Number(e.target.value)}))}
                className="w-full rounded-xl bg-input px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring" /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))} />
              <div className="w-10 h-5 rounded-full transition-colors" style={{ background: form.active ? "var(--primary)" : "var(--muted)" }} />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: form.active ? "translateX(20px)" : "translateX(0)" }} />
            </div>
            <span className="text-sm">Активна (видна на біржі)</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button onClick={save} className="btn-primary rounded-xl px-5 py-2.5 text-sm flex items-center gap-2 flex-1">
              <Save className="h-4 w-4" /> Зберегти</button>
            <button onClick={() => { setCreating(false); setEditingId(null); setForm(empty); setMsg(""); }}
              className="glass rounded-xl px-4 py-2.5 text-sm hover:bg-destructive/10 transition"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      {loading ? <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Завантаження...</div>
        : coins.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><Coins className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" /><div className="text-muted-foreground">Немає монет</div></div>
        : <div className="space-y-2">{coins.map(c=>(
            <div key={c.id} className="glass rounded-2xl p-3 flex items-center gap-3" style={{ opacity: c.active ? 1 : 0.5 }}>
              <img src={c.image_url} alt={c.symbol} className="h-12 w-12 rounded-full object-cover" />
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap">
                <div className="font-bold text-sm">{c.name}</div>
                <span className="text-[10px] uppercase font-mono text-muted-foreground">{c.symbol}</span>
                {c.active && <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary">Active</span>}
              </div>
              <div className="flex gap-3 text-xs font-mono mt-0.5">
                <span>${c.price < 1 ? c.price.toFixed(6) : c.price.toFixed(2)}</span>
                <span className={c.change_24h >= 0 ? "text-primary" : "text-destructive"}>{c.change_24h >= 0 ? "+" : ""}{c.change_24h.toFixed(2)}%</span>
                <span className="text-muted-foreground">vol {c.volatility}</span>
              </div></div>
              <div className="flex gap-1.5">
                <button onClick={()=>toggle(c)} className="glass rounded-lg p-1.5 hover:bg-primary/20 transition">
                  {c.active ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
                </button>
                <button onClick={()=>editStart(c)} className="glass rounded-lg p-1.5 hover:bg-primary/20 transition"><TrendingUp className="h-3.5 w-3.5 text-primary" /></button>
                <button onClick={()=>remove(c.id)} className="glass rounded-lg p-1.5 hover:bg-destructive/20 transition"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
              </div>
            </div>))}</div>}
    </div>
  );
}

export default AdminGuard;
