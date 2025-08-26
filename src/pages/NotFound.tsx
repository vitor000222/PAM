// src/pages/NotFound.tsx
import { useEffect } from "react";
import { useLocation, Link, Navigate } from "react-router-dom";

export default function NotFound() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname !== "/") {
      console.warn("404 - rota não encontrada:", pathname);
    }
  }, [pathname]);

  // Se por algum motivo a "/" cair aqui, volta pro Dashboard
  if (pathname === "/") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground">Rota: {pathname}</p>
      <Link to="/" className="underline">Ir para o Dashboard</Link>
    </div>
  );
}
