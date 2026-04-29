import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase, DbUser } from "./supabase";

type AuthCtx = {
  user: DbUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateBalance: (delta: number) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "casino_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (id: number) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      return;
    }
    setUser(data as DbUser);
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
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Пользователь не найден");
    if (data.is_banned) throw new Error("Аккаунт заблокирован");
    if ((data.password ?? "") !== password) throw new Error("Неверный пароль");
    localStorage.setItem(STORAGE_KEY, String(data.id));
    setUser(data as DbUser);
  };

  const register = async (username: string, password: string) => {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) throw new Error("Имя занято");
    const { data, error } = await supabase
      .from("users")
      .insert({ username, password, balance: 1000, role: "player", theme: "green" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    localStorage.setItem(STORAGE_KEY, String(data.id));
    setUser(data as DbUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const updateBalance = async (delta: number) => {
    if (!user) return;
    const newBal = (user.balance ?? 0) + delta;
    const { data, error } = await supabase
      .from("users")
      .update({ balance: newBal })
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    setUser(data as DbUser);
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
