// src/pages/NewProject.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { Save, Plus, ChevronsUpDown, Check, RotateCw } from "lucide-react";

// Dialog (shadcn)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

// Combobox (Popover + Command do shadcn) para CLIENTE
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type ProjectForm = {
  name: string;
  description: string;
  template: string;
  client_id: string | null; // UUID do cliente
};

type ClienteItem = { id: string; nome: string };

// MOC (lista cadastrada no banco)
type MocItem = { id: string; nome: string; codigo?: string; ativo?: boolean };

export default function NewProject() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProjectForm>({
    name: "",
    description: "",
    template: "blank",
    client_id: null
  });

  const API_URL = import.meta.env.VITE_API_URL;

  // ------- CLIENTES (combobox pesquisável) -------
  const [clients, setClients] = useState<ClienteItem[]>([]);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientFilter, setClientFilter] = useState("");

  const selectedClientName = useMemo(() => {
    const found = clients.find(c => c.id === form.client_id);
    return found?.nome ?? "";
  }, [clients, form.client_id]);

  async function fetchClients(q?: string) {
    setClientsLoading(true);
    try {
      const url = q?.trim()
        ? `${API_URL}/clientes?q=${encodeURIComponent(q.trim())}`
        : `${API_URL}/clientes`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao listar clientes");
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchClients erro:", err);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, []);

  // ------- Salvar PROJETO -------
  async function handleCreateProject() {
    if (!form.client_id) {
      toast({ title: "Selecione um cliente", description: "Escolha um cliente ou cadastre um novo.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/projetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.name,
          descricao: form.description || null,
          template: form.template,
          cliente_id: form.client_id
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // extrai ID de forma defensiva
      const projectId = data?.id ?? data?.projetoId ?? data?.projeto?.id;
      if (!projectId) throw new Error("ID do projeto não retornado pelo backend.");

      toast({ title: "Projeto criado", description: "Abrindo página do projeto..." });

      // ✅ rota solicitada: /projetos/:id/mapeamentos
      navigate(`/projetos/${projectId}/mapeamentos`);
    } catch (e: any) {
      toast({ title: "Erro ao criar projeto", description: e?.message ?? "Tente novamente", variant: "destructive" });
    }
  }

  function update<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ============ DIALOG: CADASTRAR CLIENTE ============
  const [wizardOpen, setWizardOpen] = useState(false);

  // Campos do cliente
  const [newClientName, setNewClientName] = useState("");
  const [newClientCNPJ, setNewClientCNPJ] = useState("");
  const [newClientSegmento, setNewClientSegmento] = useState("");

  // MOC (lista do banco)
  const [mocs, setMocs] = useState<MocItem[]>([]);
  const [selectedMocId, setSelectedMocId] = useState<string | null>(null);
  const [mocsLoading, setMocsLoading] = useState(false);
  const [mocsError, setMocsError] = useState<string | null>(null);

  // Util: somente dígitos no CNPJ
  function onlyDigits(s: string) {
    return (s || "").replace(/\D+/g, "");
  }

  // Busca robusta das MOCs
  async function fetchMocs() {
    setMocsLoading(true);
    setMocsError(null);
    try {
      const candidates = [
        `${API_URL}/mocs?ativo=true`,
        `${API_URL}/mocs`,
        `${API_URL}/moc`,
        `${API_URL}/mocs/list`,
        `${API_URL}/moc/list`,
      ];

      let loaded: any[] | null = null;
      let lastErr: any = null;

      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const arr =
            Array.isArray(json) ? json :
            Array.isArray(json?.data) ? json.data :
            Array.isArray(json?.rows) ? json.rows :
            Array.isArray(json?.items) ? json.items :
            Array.isArray(json?.content) ? json.content :
            Array.isArray(json?.result) ? json.result :
            null;
          if (arr && arr.length >= 0) {
            loaded = arr;
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }

      if (!loaded) {
        throw new Error(`Não foi possível carregar MOCs. Último erro: ${String(lastErr)}`);
      }

      const norm: MocItem[] = loaded.map((m: any) => ({
        id: String(m.id),
        nome: String(m.nome ?? m.name ?? m.titulo ?? m.codigo ?? "Sem nome"),
        codigo: m.codigo ? String(m.codigo) : undefined,
        ativo: typeof m.ativo === "boolean" ? m.ativo : true
      }));

      const ativosOrdenados = norm
        .filter(m => m.ativo !== false)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      setMocs(ativosOrdenados);
    } catch (err: any) {
      console.error("fetchMocs erro:", err);
      setMocs([]);
      setMocsError(err?.message ?? "Falha ao listar MOCs");
    } finally {
      setMocsLoading(false);
    }
  }

  useEffect(() => {
    if (wizardOpen) fetchMocs();
  }, [wizardOpen]);

  useEffect(() => {
    fetchMocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 👇 util para recuperar conta_id
  function getContaId(): string | null {
    return (
      (window as any)?.contaAtualId ||
      localStorage.getItem("conta_id") ||
      sessionStorage.getItem("conta_id") ||
      import.meta.env.VITE_CONTA_ID ||
      null
    );
  }

  async function createCliente() {
    const cnpjDigits = onlyDigits(newClientCNPJ);

    if (!newClientName.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    if (!selectedMocId) {
      toast({ title: "Selecione o MOC", description: "Escolha um MOC da lista.", variant: "destructive" });
      return;
    }
    if (cnpjDigits.length !== 14) {
      toast({ title: "CNPJ inválido", description: "Informe um CNPJ com 14 dígitos.", variant: "destructive" });
      return;
    }

    const conta_id = getContaId();
    if (!conta_id) {
      toast({
        title: "Conta não encontrada",
        description: "Defina VITE_CONTA_ID no .env ou configure conta_id no contexto/sessão.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      nome: newClientName.trim(),
      cnpj: cnpjDigits,
      moc_id: selectedMocId,
      segmento: newClientSegmento.trim() || null,
      conta_id, // ✅ agora enviado
    };

    try {
      const res = await fetch(`${API_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const cliente: ClienteItem = await res.json();

      await fetchClients(cliente.nome);
      setForm((f) => ({ ...f, client_id: cliente.id }));

      setWizardOpen(false);
      toast({ title: "Cliente cadastrado", description: `Cliente "${cliente.nome}" criado com sucesso.` });
    } catch (e: any) {
      toast({ title: "Erro ao cadastrar cliente", description: e?.message ?? "Tente novamente", variant: "destructive" });
    }
  }

  return (
    <>
      <Header />
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Novo Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome do projeto */}
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do projeto</Label>
              <Input
                id="name"
                placeholder="Ex.: Implementação Ploomes - ACME"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>

            {/* Cliente combobox */}
            <div className="grid gap-2">
              <div className="flex items-end justify-between gap-2">
                <div className="flex-1">
                  <Label>Cliente *</Label>
                  <Popover open={clientsOpen} onOpenChange={setClientsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clientsOpen}
                        className="w-full justify-between"
                      >
                        {selectedClientName || (clientsLoading ? "Carregando..." : "Selecione um cliente")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[70]">
                      <Command>
                        <CommandInput
                          placeholder="Buscar cliente..."
                          value={clientFilter}
                          onValueChange={(v) => setClientFilter(v)}
                        />
                        <CommandEmpty>
                          {clientsLoading ? "Carregando..." : "Nenhum cliente encontrado."}
                        </CommandEmpty>
                        <CommandGroup>
                          {clients
                            .filter(c => c.nome.toLowerCase().includes(clientFilter.toLowerCase()))
                            .map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => {
                                  setForm((f) => ({ ...f, client_id: client.id }));
                                  setClientsOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    client.id === form.client_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {client.nome}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => {
                              setClientsOpen(false);
                              setWizardOpen(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Cadastrar novo cliente
                          </Button>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Não encontrou? Clique em <b>Cadastrar novo cliente</b>.
              </p>
            </div>

            {/* Template */}
            <div className="grid gap-2">
              <Label>Template</Label>
              <Select
                value={form.template}
                onValueChange={(v) => update("template", v as ProjectForm["template"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Em branco</SelectItem>
                  <SelectItem value="b2b-default">B2B - Padrão</SelectItem>
                  <SelectItem value="saas-impl">SaaS - Implementação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="grid gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Objetivo do projeto, escopo resumido, etc."
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateProject}>
                <Save className="w-4 h-4 mr-2" />
                Criar projeto
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog cadastrar cliente */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
            <DialogDescription>Informe os dados essenciais do cliente.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 mt-2">
            <div className="grid gap-2">
              <Label>Nome/Razão social *</Label>
              <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>MOC *</Label>
                <Button variant="ghost" size="sm" onClick={fetchMocs} title="Recarregar lista de MOCs">
                  <RotateCw className={`h-4 w-4 ${mocsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <Select
                value={selectedMocId ?? ""}
                onValueChange={(v) => setSelectedMocId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={mocsLoading ? "Carregando MOCs..." : "Selecione um MOC"} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" className="z-[1000] max-h-72 overflow-auto">
                  {mocs.length === 0 && !mocsLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {mocsError ? `Erro: ${mocsError}` : "Nenhum MOC disponível."}
                    </div>
                  ) : (
                    mocs.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} {m.codigo ? `(${m.codigo})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {mocsLoading && <span className="text-xs text-muted-foreground">Carregando lista...</span>}
            </div>

            <div className="grid gap-2">
              <Label>Segmento</Label>
              <Input
                value={newClientSegmento}
                onChange={(e) => setNewClientSegmento(e.target.value)}
                placeholder="Ex.: Indústria, Varejo, Serviços..."
              />
            </div>

            <div className="grid gap-2">
              <Label>CNPJ *</Label>
              <Input
                value={newClientCNPJ}
                onChange={(e) => setNewClientCNPJ(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setWizardOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={createCliente}>
              Concluir cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
