import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Sparkles } from "lucide-react";

function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password);
      navigate("/");
    } catch (e: any) {
      setErr(e.message || "Помилка");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm rounded-3xl p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-xl font-bold glow-text">CHERNIHIV CASINO</div>
            <div className="text-xs text-muted-foreground">
              {mode === "login" ? "Вхід до акаунту" : "Реєстрація"}
            </div>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Нікнейм</span>
          <input value={username} onChange={e => setUsername(e.target.value)}
            required minLength={2} maxLength={32}
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Пароль</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            required minLength={3}
            className="w-full rounded-xl border border-border bg-input px-4 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring" />
        </label>

        {err && (
          <div className="mb-4 rounded-xl px-4 py-2.5 text-sm text-destructive"
            style={{ background: "oklch(0.65 0.24 25 / 0.12)", border: "1px solid oklch(0.65 0.24 25 / 0.3)" }}>
            {err}
          </div>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold">
          {busy ? "..." : mode === "login" ? "Увійти" : "Створити акаунт"}
        </button>

        <button type="button" onClick={() => { setMode(m => m === "login" ? "register" : "login"); setErr(""); }}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition">
          {mode === "login" ? "Немає акаунту? Зареєструватись" : "Вже є акаунт? Увійти"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
