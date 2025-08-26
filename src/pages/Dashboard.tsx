// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { RefreshCw, Search } from "lucide-react";

type ProjetoListItem = {
  id: string;
  nome: string;
  descricao?: string | null;
  status?: string | null; // ex.: "Em andamento", "Concluído", "Pausado", etc.
  cliente?: { id: string; nome: string } | null;
  atualizado_em?: string | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const API_URL = import.meta.env.VITE_API_URL;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ProjetoListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Busca local (client-side). Se quiser server-side, é só plugar na query da API.
  const [query, setQuery] = useState("");

  // Carrega projetos
  async function fetchProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/projetos`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      const list: any[] =
        Array.isArray(json) ? json :
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.items) ? json.items :
        Array.isArray(json?.rows) ? json.rows : [];

      const mapped: ProjetoListItem[] = list.map((x) => ({
        id: String(x.id),
        nome: String(x.nome ?? "Sem título"),
        descricao: x.descricao ?? x.description ?? null,
        status: x.status ?? null,
        cliente: x.cliente
          ? { id: String(x.cliente.id), nome: String(x.cliente.nome ?? "—") }
          : x.cliente_id && x.cliente_nome
            ? { id: String(x.cliente_id), nome: String(x.cliente_nome) }
            : null,
        atualizado_em: x.atualizado_em ?? x.updated_at ?? null,
      }));

      setItems(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar projetos");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const cliente = p.cliente?.nome?.toLowerCase() ?? "";
      const nome = p.nome?.toLowerCase() ?? "";
      const status = p.status?.toLowerCase() ?? "";
      return (
        nome.includes(q) ||
        cliente.includes(q) ||
        status.includes(q) ||
        (p.descricao?.toLowerCase() ?? "").includes(q)
      );
    });
  }, [items, query]);

  function statusVariant(status?: string | null): "default" | "secondary" | "destructive" | "outline" {
    const s = (status ?? "").toLowerCase();
    if (/(conclu|done|finaliz)/.test(s)) return "default";
    if (/(paus|bloq|hold)/.test(s)) return "secondary";
    if (/(cancel|falha|erro)/.test(s)) return "destructive";
    return "outline"; // Em andamento / novo / sem status
  }

  return (
    <>
      <Header />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por projeto, cliente, status..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" onClick={fetchProjects} title="Atualizar">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Lista de cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={`skeleton-${i}`} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-5 w-2/3 bg-muted rounded" />
                  <div className="h-4 w-1/3 bg-muted rounded" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-4 w-1/4 bg-muted rounded" />
                  <div className="h-12 w-full bg-muted rounded" />
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <div className="col-span-full text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-sm text-muted-foreground">
              Nenhum projeto encontrado.
            </div>
          ) : (
            filtered.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/projetos/${p.id}/mapeamentos`)}
                title="Abrir página do projeto"
              >
                <CardHeader className="pb-3">
                  {/* Título do Projeto */}
                  <CardTitle className="text-base md:text-lg">{p.nome}</CardTitle>

                  {/* Cliente */}
                  <div className="text-sm text-muted-foreground">
                    Cliente: <span className="font-medium">{p.cliente?.nome ?? "—"}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge variant={statusVariant(p.status)}>
                      {p.status ?? "—"}
                    </Badge>
                  </div>

                  {/* Descrição */}
                  <div
                    className="text-sm text-muted-foreground max-h-[4.5rem] overflow-hidden"
                    // se você usa o plugin line-clamp do Tailwind, pode trocar a classe acima por: "line-clamp-3"
                  >
                    {p.descricao?.trim() ? p.descricao : "Sem descrição."}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </>
  );
}
