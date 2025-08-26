import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const { ready, user } = useAuth();
  const loc = useLocation();

  if (!ready) {
    return (
      <div className="w-full h-[50vh] grid place-items-center text-muted-foreground">
        Carregando sessão...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  }

  return children;
}
