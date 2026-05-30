import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase, DbUser, secureInsertReturning, secureSelect, secureSelectOne, secureUpdate } from "./supabase";

type AuthCtx = {
  user: DbUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, refCode?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateBalance: (delta: number) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "casino_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref зберігає актуальний user, щоб updateBalance не використовував застарілий баланс
  // (інакше при швидких послідовних викликах списання/нарахування губиться).
  const userRef = useRef<DbUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  // Черга, щоб виклики updateBalance виконувались послідовно, без гонок.
  const balanceQueue = useRef<Promise<void>>(Promise.resolve());

  const loadUser = useCallback(async (id: number) => {
    try {
      const data = await secureSelectOne<DbUser>("users", {
        filters: [{ col: "id", op: "eq", value: id }],
      });
      if (!data) { localStorage.removeItem(STORAGE_KEY); setUser(null); return; }
      setUser(data);
    } catch {
      localStorage.removeItem(STORAGE_KEY); setUser(null);
    }
  }, []);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      setLoading(false);
      return;
    }
    loadUser(Number(raw)).finally(() => setLoading(false));
  }, [loadUser]);

  // Apply user theme to <html data-theme="...">
  useEffect(() => {
    if (typeof document === "undefined") return;
    const t = user?.theme || "green";
    document.documentElement.setAttribute("data-theme", t);
  }, [user?.theme]);

  const refresh = useCallback(async () => {
    if (user) await loadUser(user.id);
  }, [user, loadUser]);

  const login = async (username: string, password: string) => {
    const data = await secureSelectOne<DbUser>("users", {
      filters: [{ col: "username", op: "eq", value: username }],
    });
    if (!data) throw new Error("Пользователь не найден");
    if (data.is_banned) throw new Error("Аккаунт заблокирован");
    if ((data.password ?? "") !== password) throw new Error("Неверный пароль");
    localStorage.setItem(STORAGE_KEY, String(data.id));
    setUser(data);
  };

  const register = async (username: string, password: string, refCode?: string) => {
    const existing = await secureSelectOne("users", {
      columns: "id",
      filters: [{ col: "username", op: "eq", value: username }],
    });
    if (existing) throw new Error("Имя занято");

    let referrerNick: string | null = null;
    const code = (refCode ?? "").trim().toUpperCase();
    if (code) {
      const ref = await secureSelectOne<{ username: string }>("users", {
        columns: "username",
        filters: [{ col: "referral_code", op: "eq", value: code }],
      });
      if (ref) referrerNick = ref.username;
    }

    const myCode = (username + Date.now().toString(36))
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8);

    const rows = await secureInsertReturning<DbUser>("users", {
      username,
      password,
      balance: 1000,
      role: "player",
      theme: "green",
      referral_code: myCode,
      referred_by: referrerNick,
    });
    const data = rows[0];
    if (!data) throw new Error("Не удалось создать пользователя");

    // Реферальная награда сразу
    if (referrerNick && referrerNick !== username) {
      try {
        await secureInsertReturning("referrals", {
          referrer_nick: referrerNick,
          referred_nick: username,
          reward_paid: true,
        });
        const refUser = await secureSelectOne<{ id: number; balance: number }>("users", {
          columns: "id, balance",
          filters: [{ col: "username", op: "eq", value: referrerNick }],
        });
        if (refUser) {
          await secureUpdate("users", { balance: (refUser.balance ?? 0) + 1200 }, { id: refUser.id });
        }
      } catch (e) {
        console.warn("referral reward failed:", e);
      }
    }

    localStorage.setItem(STORAGE_KEY, String(data.id));
    setUser(data as DbUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const updateBalance = async (delta: number) => {
    // Послідовна черга + читання актуального значення з ref, щоб уникнути
    // дюпу/втрати списань через застарілі замикання (наприклад у Rocket cashout).
    const run = balanceQueue.current.then(async () => {
      const u = userRef.current;
      if (!u) return;
      const newBal = (u.balance ?? 0) + delta;
      await secureUpdate("users", { balance: newBal }, { id: u.id });
      const updated = { ...u, balance: newBal };
      userRef.current = updated;
      setUser(updated);
    });
    balanceQueue.current = run.catch(() => {});
    await run;
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, updateBalance }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
