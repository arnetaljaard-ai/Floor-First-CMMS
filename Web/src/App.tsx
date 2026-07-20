import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider, useSession } from "@/context/session";

import Login from "./pages/Login";
import Board from "./pages/Board";
import Cil from "./pages/Cil";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import QrPrint from "./pages/QrPrint";
import Pm from "./pages/Pm";
import Pareto from "./pages/Pareto";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return null;
  if (!user) return <Login />;
  return <>{children}</>;
}

function Router() {
  const { user, can } = useSession();

  if (!user) return <Login />;

  const canRoute = (allowed: boolean, el: React.ReactNode) =>
    allowed ? <>{el}</> : <Navigate to="/board" replace />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/board" replace />} />
      <Route
        path="/board"
        element={canRoute(can.viewKanban, <Board />)}
      />
      <Route path="/cil" element={<Cil />} />
      <Route
        path="/assets"
        element={canRoute(can.manageAssets, <Assets />)}
      />
      <Route path="/a/:qrHash" element={<AssetDetail />} />
      <Route
        path="/qr"
        element={canRoute(can.manageAssets, <QrPrint />)}
      />
      <Route path="/pm" element={canRoute(can.managePm, <Pm />)} />
      <Route
        path="/pareto"
        element={canRoute(can.viewAnalytics, <Pareto />)}
      />
      <Route
        path="/admin"
        element={canRoute(can.manageUsers, <Admin />)}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function Shell() {
  return (
    <RequireAuth>
      <Router />
    </RequireAuth>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionProvider>
      <TooltipProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Shell />
        </BrowserRouter>
      </TooltipProvider>
    </SessionProvider>
  </QueryClientProvider>
);

export default App;