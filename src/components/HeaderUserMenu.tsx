import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HeaderUserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9">
          {user.nome}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48">
        <div className="text-sm mb-2">
          <div className="font-medium">{user.nome}</div>
          <div className="text-muted-foreground">{user.email}</div>
        </div>
        <div className="border-t my-2" />
        <button className="w-full text-left text-sm py-1.5" onClick={() => navigate("/perfil")}>
          Perfil
        </button>
        <button className="w-full text-left text-sm py-1.5" onClick={() => navigate("/conta/equipe")}>
          Equipe da conta
        </button>
        <div className="border-t my-2" />
        <button className="w-full text-left text-sm py-1.5" onClick={logout}>
          Sair
        </button>
      </PopoverContent>
    </Popover>
  );
}
