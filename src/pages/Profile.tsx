import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth();
  const { toast } = useToast();

  const [nome, setNome] = useState(user?.nome ?? "");
  const [saving, setSaving] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [changing, setChanging] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      await updateProfile({ nome });
      toast({ title: "Perfil atualizado" });
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function changePwd() {
    if (!next || next !== confirm) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    setChanging(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ title: "Senha alterada" });
    } catch (e: any) {
      toast({
        title: "Erro ao alterar senha",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setChanging(false);
    }
  }

  return (
    <>
      <Header />
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} readOnly />
              </div>
            </div>
            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Senha atual</Label>
                <Input
                  type="password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={changePwd} disabled={changing}>
              {changing ? "Alterando..." : "Alterar senha"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
