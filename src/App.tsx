import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import LoginPage from "@/pages/Login";
import IndexPage from "@/pages/Index";
import RocketPage from "@/pages/Rocket";
import SlotsPage from "@/pages/Slots";
import RoulettePage from "@/pages/Roulette";
import CasesPage from "@/pages/Cases";
import UpgraderPage from "@/pages/Upgrader";
import InventoryPage from "@/pages/Inventory";
import ProfilePage from "@/pages/Profile";
import AdminPage from "@/pages/Admin";
import PromoPage from "@/pages/Promo";
import ExchangePage from "@/pages/Exchange";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-6xl font-bold glow-text">404</h1>
        <p className="mt-2 text-muted-foreground">Страница не найдена</p>
        <a href="/" className="btn-primary mt-6 inline-block rounded-xl px-5 py-2 text-sm">На главную</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<RequireAuth><IndexPage /></RequireAuth>} />
          <Route path="/rocket" element={<RequireAuth><RocketPage /></RequireAuth>} />
          <Route path="/slots" element={<RequireAuth><SlotsPage /></RequireAuth>} />
          <Route path="/roulette" element={<RequireAuth><RoulettePage /></RequireAuth>} />
          <Route path="/cases" element={<RequireAuth><CasesPage /></RequireAuth>} />
          <Route path="/upgrader" element={<RequireAuth><UpgraderPage /></RequireAuth>} />
          <Route path="/exchange" element={<RequireAuth><ExchangePage /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><InventoryPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/promo" element={<RequireAuth><PromoPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
