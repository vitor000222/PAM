import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthProvider";
import { API_URL } from "@/lib/api";

type Member = {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "member";
};

export default function AccountTeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const contaId = user?.conta_id ?? user?.conta?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);

  async function fetchMembers() {
    if (!contaId) return;
    setLoading(true);
    setError(null);
    try {
      const candidates = [
        `${API_URL}/contas/${contaId}/usuarios`,
        `${API_URL}/accounts/${contaId}/users`,
        `${API_URL}/equipes?conta_id=${contaId}`,
      ];

      let list: any[] | null = null,
        lastErr: any = null;
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(await res.text());
          const j = await res.json();
          const arr =
            Array.isArray(j) ? j :
            Array.isArray(j?.data) ? j.data :
            Array.isArray(j?.items) ? j.items :
            Array.isArray(j?.rows) ? j.rows : null;
          if (arr) {
            list = arr;
            break;
          }
        } catch (e) {
          lastErr = e;
        }
      }
      if (!list) throw lastErr ?? new Error("Falha ao listar equipe");

      setMembers(
        list.map((x: any) => ({
          id: String(x.id),
          nome: String(x.nome ?? x.name ?? "—"),
          email: String(x.email ?? "—"),
          role: (x.role ?? x.papel ?? "member").toLowerCase(),
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar equipe");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  async function invite() {
    if (!contaId) return;
    if (!inviteEmail.trim()) {
      toast({ title: "Informe um email", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const candidates = [
        {
          path: "/convites",
          body: { email: inviteEmail.trim(), conta_id: contaId, role: inviteRole },
        },
        {
          path: "/invitations",
          body: { email: inviteEmail.trim(), account_id: contaId, role: inviteRole },
        },
      ];
      let ok = false,
        lastErr: any = null;
      for (const c of candidates) {
        try {
          const res = await fetch(`${API_URL}${c.path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c.body),
          });
          if (!res.ok) {
            lastErr = new Error(await res.text());
            continue;
          }
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!ok) throw lastErr ?? new Error("Falha ao enviar convite");

      setInviteEmail("");
      setInviteRole("member");
      toast({ title: "Convite enviado", description: "O usuário receberá um email para entrar na conta." });
      fetchMembers();
    } catch (e: any) {
      toast({
        title: "Erro ao convidar",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, [contaId]);

  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Equipe da Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div className="grid gap-2">
                <Label>Email para convite</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="pessoa@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>Permissão</Label>
                <select
                  className="border rounded h-10 px-3"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                >
                  <option value="member">Membro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Enviando..." : "Enviar convite"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {loading ? "Carregando equipe..." : error ?? `Membros (${members.length})`}
              </div>
              {!loading && !error && (
                <div className="grid gap-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="border rounded-md p-3 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{m.nome}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </div>
                      <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                        {m.role === "admin" ? "Admin" : "Membro"}
                      </Badge>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Nenhum membro nesta conta.
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
