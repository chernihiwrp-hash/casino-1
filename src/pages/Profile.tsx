import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/RequireAuth";
import { User, Wallet, Calendar, Shield, Star, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";

function ProfilePage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const copyReferral = () => {
    if (!user?.referral_code) return;
    const link = `${window.location.origin}/?ref=${user.referral_code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!user) return (
    <div className="text-center text-sm text-muted-foreground py-10">Завантаження...</div>
  );

  const registeredDate = user.registered_at
    ? new Date(user.registered_at).toLocaleDateString("uk-UA", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

  const roleLabel: Record<string, string> = {
    player: "Гравець",
    admin: "Адміністратор",
    mayor: "Мер",
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Профіль" subtitle="Інформація про акаунт" />

      {/* Avatar + name */}
      <div className="glass-strong rounded-2xl p-5 flex items-center gap-4">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="h-16 w-16 rounded-full object-cover border-2 border-primary/30"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
        )}
        <div>
          <div className="text-xl font-bold">{user.username}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="glass-strong grid grid-cols-2 gap-3 rounded-2xl p-4">
        <StatCard
          icon={<Wallet className="h-4 w-4 text-primary" />}
          label="Баланс CR"
          value={`${(user.balance ?? 0).toLocaleString()} CR`}
        />
        <StatCard
          icon={<Star className="h-4 w-4 text-yellow-400" />}
          label="Rare Balance"
          value={`${(user.rare_balance ?? 0).toLocaleString()} RC`}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          label="Реєстрація"
          value={registeredDate}
          small
        />
        <StatCard
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          label="Статус"
          value={user.is_banned ? "Заблокований" : "Активний"}
          valueClass={user.is_banned ? "text-destructive" : "text-green-400"}
        />
      </div>

      {/* Referral */}
      {user.referral_code && (
        <div className="glass-strong rounded-2xl p-4 space-y-2">
          <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
            Реферальне посилання
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-muted/30 px-3 py-2 text-xs font-mono text-primary">
              {`${window.location.origin}/?ref=${user.referral_code}`}
            </code>
            <button
              onClick={copyReferral}
              className="shrink-0 rounded-lg p-2 bg-primary/15 hover:bg-primary/25 transition text-primary"
              title="Скопіювати"
            >
              {copied
                ? <CheckCircle2 className="h-4 w-4" />
                : <Copy className="h-4 w-4" />}
            </button>
          </div>
          {user.referred_by && (
            <div className="text-xs text-muted-foreground">
              Запросив: <span className="text-foreground font-medium">{user.referred_by}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  small,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  small?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="glass rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div
        className={`font-bold tabular-nums ${small ? "text-sm" : "text-base"} ${valueClass ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

export default ProfilePage;
