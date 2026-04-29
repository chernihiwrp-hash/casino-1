// src/components/AdminLockdownPanel.tsx

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLockdown, updateLockdown, type LockdownConfig } from "@/lib/useLockdown";
import { LockdownScreen } from "./LockdownScreen";

const EMBLEMS = ["lock", "shield", "alert", "ban", "wrench", "crown", "skull", "sparkles"];
const ANIM_LABELS: Record<string, string> = {
  pulse: "Пульс",
  orbit: "Орбиты",
  glitch: "Глитч",
  aurora: "Аврора",
};
const ANIMS: LockdownConfig["animation"][] = ["pulse", "orbit", "glitch", "aurora"];

const EMBLEM_ICONS: Record<string, string> = {
  lock: "🔒",
  shield: "🛡️",
  alert: "⚠️",
  ban: "🚫",
  wrench: "🔧",
  crown: "👑",
  skull: "💀",
  sparkles: "✨",
};

export function AdminLockdownPanel() {
  const { user } = useAuth();
  const { lockdown } = useLockdown();
  const [draft, setDraft] = useState<LockdownConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  useEffect(() => {
    if (lockdown && !draft) setDraft(lockdown);
  }, [lockdown, draft]);

  if (!user || (user.role !== "admin" && user.role !== "mayor")) return null;
  if (!draft) return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-5 w-48 rounded bg-white/10 mb-2" />
      <div className="h-3 w-64 rounded bg-white/10" />
    </div>
  );

  const set = <K extends keyof LockdownConfig>(k: K, v: LockdownConfig[K]) =>
    setDraft({ ...draft, [k]: v });

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(null), 3000);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateLockdown(
        {
          enabled: draft.enabled,
          title: draft.title,
          message: draft.message,
          emblem: draft.emblem,
          emblem_url: draft.emblem_url,
          bg_from: draft.bg_from,
          bg_to: draft.bg_to,
          accent: draft.accent,
          animation: draft.animation,
        },
        user.id
      );
      showMsg("Сохранено ✓", "ok");
    } catch (e) {
      showMsg((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (next: boolean) => {
    set("enabled", next);
    setSaving(true);
    try {
      await updateLockdown({ enabled: next }, user.id);
      showMsg(next ? "🔒 Блокировка включена" : "🔓 Блокировка выключена", "ok");
    } catch (e) {
      showMsg((e as Error).message, "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚧</span>
          <div>
            <h3 className="text-base font-bold leading-tight">Блокировка входа</h3>
            <p className="text-xs opacity-50 mt-0.5">Игроки видят экран блокировки. Админы заходят свободно.</p>
          </div>
        </div>
        {/* Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-semibold transition-colors ${draft.enabled ? "text-red-400" : "opacity-40"}`}>
            {draft.enabled ? "ВКЛЮЧЕНО" : "ВЫКЛЮЧЕНО"}
          </span>
          <label className="relative inline-flex h-7 w-13 cursor-pointer items-center">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => toggle(e.target.checked)}
              className="peer sr-only"
              disabled={saving}
            />
            <span className={`absolute inset-0 rounded-full transition-colors duration-200 ${draft.enabled ? "bg-red-500" : "bg-white/20"}`} />
            <span className="absolute left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6" />
          </label>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Status banner */}
        {draft.enabled && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
            <span className="text-base">⚠️</span>
            <span>Блокировка активна — новые игроки видят экран вместо сайта</span>
          </div>
        )}

        {/* Text fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Заголовок">
            <input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              className="lk-inp"
              placeholder="Технические работы..."
            />
          </Field>
          <Field label="Анимация фона">
            <div className="grid grid-cols-4 gap-1.5">
              {ANIMS.map((a) => (
                <button
                  key={a}
                  onClick={() => set("animation", a)}
                  type="button"
                  className={`rounded-lg py-2 text-xs font-medium border transition ${
                    draft.animation === a
                      ? "bg-white text-black border-white"
                      : "bg-white/5 border-white/10 hover:bg-white/10 opacity-70 hover:opacity-100"
                  }`}
                >
                  {ANIM_LABELS[a]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Сообщение для игроков" full>
            <textarea
              value={draft.message}
              onChange={(e) => set("message", e.target.value)}
              rows={2}
              className="lk-inp resize-none"
              placeholder="Сайт временно недоступен. Ожидайте..."
            />
          </Field>
        </div>

        {/* Emblem */}
        <Field label="Иконка">
          <div className="flex flex-wrap gap-2">
            {EMBLEMS.map((e) => (
              <button
                key={e}
                onClick={() => set("emblem", e)}
                type="button"
                title={e}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition ${
                  draft.emblem === e
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                <span>{EMBLEM_ICONS[e]}</span>
                <span className="text-xs opacity-70">{e}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="URL картинки (заменяет иконку)">
          <input
            value={draft.emblem_url ?? ""}
            onChange={(e) => set("emblem_url", e.target.value || null)}
            placeholder="https://..."
            className="lk-inp"
          />
        </Field>

        {/* Colors */}
        <div>
          <p className="text-xs uppercase tracking-wide opacity-40 mb-3">Цвета</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <ColorField label="Фон (верх)" value={draft.bg_from} onChange={(v) => set("bg_from", v)} />
            <ColorField label="Фон (низ)" value={draft.bg_to} onChange={(v) => set("bg_to", v)} />
            <ColorField label="Акцент / свечение" value={draft.accent} onChange={(v) => set("accent", v)} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1 border-t border-white/8">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition-colors"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            onClick={() => setPreview(true)}
            className="rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold hover:bg-white/15 transition-colors border border-white/10"
            type="button"
          >
            👁 Превью
          </button>
          {msg && (
            <span className={`text-sm ${msgType === "err" ? "text-red-400" : "text-emerald-400"}`}>
              {msg}
            </span>
          )}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[10000]">
          <LockdownScreen config={draft} />
          <button
            onClick={() => setPreview(false)}
            className="fixed top-4 right-4 z-[10001] rounded-xl bg-black/80 px-4 py-2 text-sm text-white border border-white/25 hover:bg-black backdrop-blur transition-colors"
          >
            ✕ Закрыть превью
          </button>
        </div>
      )}

      <style>{`
        .lk-inp {
          width: 100%;
          padding: 9px 13px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .lk-inp:focus {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.09);
        }
        .lk-inp::placeholder { opacity: 0.35; }
      `}</style>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-xs uppercase tracking-wide opacity-50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="block text-xs uppercase tracking-wide opacity-50 mb-1.5">{label}</span>
      <div className="flex gap-2 items-center">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <div
            className="h-9 w-10 rounded-lg border border-white/20 cursor-pointer shadow-inner"
            style={{ background: value }}
          />
        </div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="lk-inp"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
