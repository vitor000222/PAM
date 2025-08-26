import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { Plus, ExternalLink, Loader2, Paperclip, Wand2, Rocket } from "lucide-react";

// ⬇️ Anexos: API + tipos
import {
  API_URL,
  uploadMappingAttachment,
  listMappingAttachments,
  type MappingAttachment
} from "@/lib/api";

import { saveXmlToSession } from "@/utils/localSession";

// ================= Tipos =================

type Projeto = {
  id: string;
  nome: string;
  descricao?: string | null;
  status?: string | null;
  template?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
  cliente_id?: string | null;
  cliente?: Cliente | null;
};

type Cliente = {
  id: string;
  nome: string;
  cnpj?: string | null;
  segmento?: string | null;
  moc_id?: string | null;
  moc?: { id: string; nome: string; codigo?: string | null } | null;
};

type Mapeamento = {
  id: string;
  nome: string;
  tipo: "AS_IS" | "TO_BE";
  criado_em?: string | null;
};

// ===== IA (n8n) =====

type IaJobStatus = "AGUARDANDO" | "GERANDO" | "CONCLUIDO" | "ERRO";

type IaJob = {
  id: string;
  workflow_chave: string;
  status: IaJobStatus;
  criado_em: string;
  iniciado_em?: string | null;
  finalizado_em?: string | null;
  erro?: string | null;
};

type IaAttachment = {
  id: string;
  name: string;
  url: string;
  tipo?: string | null;
};

// =================== IA: chamadas locais (mantém compat com seu backend atual) ===================
async function createIaJobReq(
  mappingId: string,
  payload: { workflow?: string; anexoId?: string | null; anexoUrl?: string | null; notes?: string | null }
): Promise<{ jobId: string; status: IaJobStatus }> {
  const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/ia/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function listIaJobsReq(mappingId: string): Promise<IaJob[]> {
  const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/ia/jobs`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Busca o XML gerado pela IA com estratégia flexível (tenta múltiplas rotas/formatos)
async function fetchAiXml(mappingId: string, jobId?: string): Promise<string | null> {
  // 1) Rotas de resultado específicas do job (duas variações comuns)
  const candidates = [
    jobId ? `${API_URL}/mapeamentos/${mappingId}/ia/jobs/${jobId}/result` : "",
    jobId ? `${API_URL}/mapeamentos/${mappingId}/diagramas/ai/${jobId}` : "",
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      // Formatos possíveis
      const xml = j?.xml || j?.bpmnXml || j?.bpmn_xml || j?.data?.xml;
      if (xml && typeof xml === "string" && xml.includes("<bpmn:")) return xml;
    } catch {}
  }

  // 2) Fallback: pegar o último diagrama salvo e usar seu bpmn_xml
  try {
    const r = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas?limit=1&order=desc`);
    if (r.ok) {
      const j = await r.json();
      const arr: any[] = Array.isArray(j)
        ? j
        : (Array.isArray(j?.diagramas) ? j.diagramas : (Array.isArray(j?.data) ? j.data : []));
      if (arr.length) {
        const d = arr[0];
        const xml = d?.bpmn_xml || d?.bpmnXml || d?.xml;
        if (xml && typeof xml === "string") return xml;
      }
    }
  } catch {}

  return null;
}

// =================== Página ===================
export default function ProjectMappingsPage() {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Projeto | null>(null);
  const [mappings, setMappings] = useState<Mapeamento[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Dialog "Novo mapeamento"
  const [openNew, setOpenNew] = useState(false);
  const [mapName, setMapName] = useState("");
  const [mapType, setMapType] = useState<"AS_IS" | "TO_BE">("AS_IS");
  const [creating, setCreating] = useState(false);

  // Dialog "Anexos"
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachFor, setAttachFor] = useState<Mapeamento | null>(null);
  const [fileTranscricao, setFileTranscricao] = useState<File | null>(null); // As-Is
  const [fileEscopo, setFileEscopo] = useState<File | null>(null);           // To-Be
  const [fileAsIsXml, setFileAsIsXml] = useState<File | null>(null);         // To-Be
  const [uploading, setUploading] = useState(false);

  // Lista de anexos existentes
  const [attachments, setAttachments] = useState<MappingAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);

  // Inputs escondidos
  const refInputTranscricao = useRef<HTMLInputElement | null>(null);
  const refInputEscopo = useRef<HTMLInputElement | null>(null);
  const refInputXmlAsIs = useRef<HTMLInputElement | null>(null);

  // ====== IA (n8n) dialog/estado ======
  const [iaOpen, setIaOpen] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaTargetMapping, setIaTargetMapping] = useState<string | null>(null);
  const [iaWorkflow, setIaWorkflow] = useState<"generate_to_be" | "generate_as_is">("generate_to_be");
  const [iaAttachments, setIaAttachments] = useState<IaAttachment[]>([]);
  const [iaSelectedAttachment, setIaSelectedAttachment] = useState<string | null>(null);

  // status mais recente por mapeamento
  const [iaJobsByMapping, setIaJobsByMapping] = useState<Record<string, IaJob | undefined>>({});

  // ==== Utils ====
  function fmtDate(d?: string | null) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR");
  }
  function maskCnpj(cnpj?: string | null) {
    if (!cnpj) return "—";
    const s = String(cnpj).replace(/\D+/g, "").padStart(14, "•");
    return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
  }
  function typeBadgeVariant(t: "AS_IS" | "TO_BE") {
    return t === "AS_IS" ? ("secondary" as const) : ("default" as const);
  }

  // ==== Fetchers ====
  async function fetchProjectAndMappings() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [pRes, mRes] = await Promise.all([
        fetch(`${API_URL}/projetos/${projectId}`),
        fetch(`${API_URL}/projetos/${projectId}/mapeamentos`)
      ]);
      if (!pRes.ok) throw new Error(await pRes.text());
      if (!mRes.ok) throw new Error(await mRes.text());

      const pJson = await pRes.json();
      const mJson = await mRes.json();

      const pRaw: any =
        pJson?.id ? pJson :
        pJson?.projeto ? pJson.projeto :
        pJson?.data?.id ? pJson.data : {};

      const proj: Projeto = {
        id: String(pRaw.id ?? projectId),
        nome: String(pRaw.nome ?? "Projeto"),
        descricao: pRaw.descricao ?? null,
        status: pRaw.status ?? null,
        template: pRaw.template ?? null,
        criado_em: pRaw.criado_em ?? pRaw.created_at ?? null,
        atualizado_em: pRaw.atualizado_em ?? pRaw.updated_at ?? null,
        cliente_id: pRaw.cliente_id ?? pRaw.cliente?.id ?? null,
        cliente: pRaw.cliente
          ? {
              id: String(pRaw.cliente.id),
              nome: String(pRaw.cliente.nome ?? "—"),
              cnpj: pRaw.cliente.cnpj ?? null,
              segmento: pRaw.cliente.segmento ?? null,
              moc_id: pRaw.cliente.moc_id ?? pRaw.cliente.moc?.id ?? null,
              moc: pRaw.cliente.moc
                ? {
                    id: String(pRaw.cliente.moc.id),
                    nome: String(pRaw.cliente.moc.nome ?? "—"),
                    codigo: pRaw.cliente.moc.codigo ?? null
                  }
                : null
            }
          : null
      };

      if (proj.cliente_id && (!proj.cliente || proj.cliente?.cnpj == null)) {
        try {
          const cRes = await fetch(`${API_URL}/clientes/${proj.cliente_id}`);
          if (cRes.ok) {
            const cJson = await cRes.json();
            const cRaw: any = cJson?.id ? cJson : cJson?.cliente ?? cJson?.data ?? {};
            proj.cliente = {
              id: String(cRaw.id ?? proj.cliente_id),
              nome: String(cRaw.nome ?? proj.cliente?.nome ?? "—"),
              cnpj: cRaw.cnpj ?? null,
              segmento: cRaw.segmento ?? null,
              moc_id: cRaw.moc_id ?? cRaw.moc?.id ?? proj.cliente?.moc_id ?? null,
              moc: cRaw.moc
                ? {
                    id: String(cRaw.moc.id),
                    nome: String(cRaw.moc.nome ?? "—"),
                    codigo: cRaw.moc.codigo ?? null
                  }
                : proj.cliente?.moc ?? null
            };
          }
        } catch {}
      }

      const list: any[] =
        Array.isArray(mJson) ? mJson :
        Array.isArray(mJson?.data) ? mJson.data :
        Array.isArray(mJson?.items) ? mJson.items :
        Array.isArray(mJson?.rows) ? mJson.rows : [];

      const maps: Mapeamento[] = list.map((x) => ({
        id: String(x.id),
        nome: String(x.nome ?? "Sem nome"),
        tipo: (String(x.tipo ?? "AS_IS").toUpperCase() as "AS_IS" | "TO_BE"),
        criado_em: x.criado_em ?? x.created_at ?? null
      }));

      setProject(proj);
      setMappings(maps);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar o projeto");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjectAndMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ==== Novo mapeamento ====
  async function handleCreateMapping() {
    if (!projectId) return;
    if (!mapName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe um nome para o mapeamento.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/projetos/${projectId}/mapeamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: mapName.trim(),
          tipo: mapType,
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const mappingId = json?.id ?? json?.mapeamentoId ?? json?.mapeamento?.id;
      if (!mappingId) throw new Error("ID do mapeamento não retornado.");

      toast({ title: "Mapeamento criado", description: "Você já pode anexar os arquivos." });
      setOpenNew(false);
      setMapName("");
      setMapType("AS_IS");
      // Recarrega lista
      fetchProjectAndMappings();
    } catch (e: any) {
      toast({ title: "Erro ao criar mapeamento", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  // ==== Abrir Modeler / Anexos / IA Result ====
  function openModeler(id: string) {
    navigate(`/modeler/${id}`);
  }

  async function openIaResultInModeler(mappingId: string) {
    try {
      toast({ title: "Buscando resultado da IA…" });
      const job = iaJobsByMapping[mappingId];
      const xml = await fetchAiXml(mappingId, job?.id);
      if (!xml) throw new Error("Não foi possível obter o XML gerado pela IA.");
      saveXmlToSession(mappingId, xml);
      navigate(`/modeler/${mappingId}`);
    } catch (e: any) {
      toast({ title: "Erro ao abrir resultado da IA", description: e?.message ?? "Tente novamente", variant: "destructive" });
    }
  }

  function openAttach(m: Mapeamento) {
    setAttachFor(m);
    setFileTranscricao(null);
    setFileEscopo(null);
    setFileAsIsXml(null);
    setAttachments([]);
    setAttachOpen(true);
    void fetchAndSetAttachments(m.id);
  }

  async function fetchAndSetAttachments(mapId: string) {
    setAttachmentsLoading(true);
    try {
      const items = await listMappingAttachments(mapId);
      setAttachments(Array.isArray(items) ? items : []);
    } catch {
      setAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  }

  // ==== Upload de anexos ==== (mantém compat com seu fluxo)
  async function uploadAnexo(mappingId: string, tipo: "ASIS_TRANSCRICAO" | "TOBE_ESCOPO" | "ASIS_XML", file: File) {
    const form = new FormData();
    form.append("tipo", tipo);
    form.append("arquivo", file);
    const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/anexos`, {
      method: "POST",
      body: form
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function handleSaveAttachments() {
    if (!attachFor) return;
    setUploading(true);
    try {
      if (attachFor.tipo === "AS_IS") {
        if (!fileTranscricao) {
          toast({ title: "Selecione o arquivo de transcrição", variant: "destructive" });
          setUploading(false);
          return;
        }
        await uploadAnexo(attachFor.id, "ASIS_TRANSCRICAO", fileTranscricao);
      } else {
        if (!fileEscopo && !fileAsIsXml) {
          toast({ title: "Selecione pelo menos um arquivo", description: "Escopo e/ou XML As-Is.", variant: "destructive" });
          setUploading(false);
          return;
        }
        if (fileEscopo) await uploadAnexo(attachFor.id, "TOBE_ESCOPO", fileEscopo);
        if (fileAsIsXml) await uploadAnexo(attachFor.id, "ASIS_XML", fileAsIsXml);
      }

      await fetchAndSetAttachments(attachFor.id);
      toast({ title: "Anexos enviados", description: "Arquivos adicionados ao mapeamento." });
      setAttachOpen(false);
      setAttachFor(null);
    } catch (e: any) {
      toast({ title: "Erro ao enviar anexos", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // ===== IA (n8n) fluxo =====
  async function openIaDialog(mappingId: string) {
    setIaOpen(true);
    setIaTargetMapping(mappingId);
    setIaWorkflow("generate_to_be");
    setIaSelectedAttachment(null);
    setIaLoading(true);
    try {
      const list = await listMappingAttachments(mappingId);
      const allowed = (list as any[]).filter((a) => {
        const t = String(a.tipo ?? "").toLowerCase();
        return t === "transcricao" || t === "xmlasis" || t === "escopo" || t === "asis_xml" || t === "tobe_escopo" || t === "asis_transcricao";
      });
      const base = (allowed.length ? allowed : list).map((a: any) => ({
        id: String(a.id ?? ""),
        name: String(a.name ?? a.nome ?? a.nome_arquivo ?? "arquivo"),
        url: String(a.url ?? ""),
        tipo: a.tipo ?? null
      })) as IaAttachment[];
      setIaAttachments(base);
    } catch (e) {
      console.error(e);
      setIaAttachments([]);
    } finally {
      setIaLoading(false);
    }
  }

  async function startIaGeneration() {
    if (!iaTargetMapping) return;
    if (!iaSelectedAttachment) {
      toast({ title: "Selecione um anexo", description: "Escolha o arquivo de referência para a IA.", variant: "destructive" });
      return;
    }
    setIaLoading(true);
    try {
      const res = await createIaJobReq(iaTargetMapping, {
        workflow: iaWorkflow,
        anexoId: iaSelectedAttachment,
        notes: null
      });
      // otimiza UI: marca como em progresso
      setIaJobsByMapping((prev) => ({
        ...prev,
        [iaTargetMapping]: {
          id: res.jobId,
          workflow_chave: iaWorkflow,
          status: (res.status ?? "GERANDO") as IaJobStatus,
          criado_em: new Date().toISOString()
        }
      }));
      setIaOpen(false);
      toast({ title: "Geração iniciada", description: "A IA começou a processar. Acompanhe o status aqui." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Falha ao iniciar IA", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setIaLoading(false);
    }
  }

  // Polling simples dos jobs (10s)
  useEffect(() => {
    let timer: any;
    async function tick() {
      try {
        const next: Record<string, IaJob | undefined> = {};
        for (const m of mappings) {
          try {
            const jobs = await listIaJobsReq(m.id);
            if (Array.isArray(jobs) && jobs.length) next[m.id] = jobs[0]; // mais recente
          } catch {}
        }
        setIaJobsByMapping(next);
      } catch (e) {
        console.warn("Polling IA jobs falhou:", e);
      } finally {
        timer = setTimeout(tick, 10000);
      }
    }
    if (mappings.length) tick();
    return () => clearTimeout(timer);
  }, [mappings]);

  function renderIaStatus(mappingId: string) {
    const job = iaJobsByMapping[mappingId];
    if (!job) return null;
    const s = job.status;
    if (s === "GERANDO" || s === "AGUARDANDO") {
      return (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none"/></svg>
          {s === "AGUARDANDO" ? "Aguardando" : "Gerando"}
        </span>
      );
    }
    if (s === "CONCLUIDO") {
      return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Concluído</span>;
    }
    if (s === "ERRO") {
      return <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Erro</span>;
    }
    return null;
  }

  // ================= Render =================
  return (
    <>
      <Header />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Cabeçalho */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">
              {project?.nome ?? "Projeto"}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              ID: <span className="font-mono">{project?.id ?? "—"}</span>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando informações do projeto...
              </div>
            ) : error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Bloco: Projeto */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dados do Projeto</div>
                  <div className="grid grid-cols-3 gap-y-1 text-sm">
                    <div className="text-muted-foreground">Status</div>
                    <div className="col-span-2">
                      <Badge variant="outline">{project?.status ?? "—"}</Badge>
                    </div>

                    <div className="text-muted-foreground">Template</div>
                    <div className="col-span-2">{project?.template ?? "—"}</div>

                    <div className="text-muted-foreground">Criado em</div>
                    <div className="col-span-2">{fmtDate(project?.criado_em)}</div>

                    <div className="text-muted-foreground">Atualizado em</div>
                    <div className="col-span-2">{fmtDate(project?.atualizado_em)}</div>

                    <div className="text-muted-foreground">Descrição</div>
                    <div className="col-span-2 text-muted-foreground">
                      {project?.descricao?.trim() ? project.descricao : "—"}
                    </div>
                  </div>
                </div>

                {/* Bloco: Cliente */}
                <div className="space-y-2">
                  <div className="text-sm font-medium">Dados do Cliente</div>
                  <div className="grid grid-cols-3 gap-y-1 text-sm">
                    <div className="text-muted-foreground">Cliente</div>
                    <div className="col-span-2">{project?.cliente?.nome ?? "—"}</div>

                    <div className="text-muted-foreground">CNPJ</div>
                    <div className="col-span-2">{maskCnpj(project?.cliente?.cnpj)}</div>

                    <div className="text-muted-foreground">Segmento</div>
                    <div className="col-span-2">{project?.cliente?.segmento ?? "—"}</div>

                    <div className="text-muted-foreground">MOC</div>
                    <div className="col-span-2">
                      {project?.cliente?.moc
                        ? `${project.cliente.moc.nome}${project.cliente.moc.codigo ? ` (${project.cliente.moc.codigo})` : ""}`
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Barra de ações */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mapeamentos do Projeto</h2>
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo mapeamento
          </Button>
        </div>

        {/* Lista de Mapeamentos */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando mapeamentos...
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhum mapeamento ainda. Clique em <b>Novo mapeamento</b> para começar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[940px]">
                  <div className="grid grid-cols-12 px-2 pb-2 text-xs text-muted-foreground">
                    <div className="col-span-4">Título</div>
                    <div className="col-span-2">Tipo</div>
                    <div className="col-span-3">Status IA</div>
                    <div className="col-span-3 text-right">Ações</div>
                  </div>
                  <div className="divide-y">
                    {mappings.map((m) => {
                      const job = iaJobsByMapping[m.id];
                      const canOpenIa = !!job && job.status === "CONCLUIDO";
                      return (
                        <div key={m.id} className="grid grid-cols-12 items-center px-2 py-3">
                          <div className="col-span-4 font-medium">{m.nome}</div>
                          <div className="col-span-2">
                            <Badge variant={typeBadgeVariant(m.tipo)}>
                              {m.tipo === "AS_IS" ? "As-Is" : "To-Be"}
                            </Badge>
                          </div>
                          <div className="col-span-3 text-sm text-muted-foreground">
                            {renderIaStatus(m.id) || <span className="opacity-60">—</span>}
                          </div>
                          <div className="col-span-3 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openModeler(m.id)} title="Abrir no Modeler">
                              <ExternalLink className="w-4 h-4 mr-1" /> Abrir
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => openAttach(m)} title="Anexar arquivos">
                              <Paperclip className="w-4 h-4 mr-1" /> Anexos
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openIaDialog(m.id)}
                              title="Gerar via IA"
                            >
                              <Wand2 className="w-4 h-4 mr-1" /> IA
                            </Button>
                            <Button
                              variant={canOpenIa ? "default" : "outline"}
                              size="sm"
                              className={!canOpenIa ? "opacity-50" : ""}
                              onClick={() => canOpenIa && openIaResultInModeler(m.id)}
                              title={canOpenIa ? "Abrir resultado da IA no Modeler" : "Aguardando IA"}
                            >
                              <Rocket className="w-4 h-4 mr-1" /> Abrir IA
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Novo mapeamento */}
      {openNew && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg">
            <div className="p-4 border-b">
              <div className="text-lg font-semibold">Novo mapeamento</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  placeholder="Ex.: Processo Comercial AS-IS"
                />
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mapType === "AS_IS" ? "default" : "outline"}
                    onClick={() => setMapType("AS_IS")}
                  >
                    As-Is
                  </Button>
                  <Button
                    type="button"
                    variant={mapType === "TO_BE" ? "default" : "outline"}
                    onClick={() => setMapType("TO_BE")}
                  >
                    To-Be
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenNew(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMapping} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Criar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Anexos por mapeamento */}
      {attachOpen && attachFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-xl">
            <div className="p-4 border-b">
              <div className="text-lg font-semibold">
                Anexos — {attachFor.nome}{" "}
                <span className="text-xs text-muted-foreground">
                  ({attachFor.tipo === "AS_IS" ? "As-Is" : "To-Be"})
                </span>
              </div>
            </div>

            <div className="p-4 space-y-5">
              {/* UPLOAD (por tipo) */}
              {attachFor.tipo === "AS_IS" ? (
                <>
                  {/* Hidden input + botão funcional */}
                  <input
                    ref={refInputTranscricao}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => setFileTranscricao(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={() => refInputTranscricao.current?.click()}>
                      Selecionar arquivo de Transcrição
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {fileTranscricao ? fileTranscricao.name : "PDF, DOC, DOCX, TXT, MD"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Escopo */}
                  <input
                    ref={refInputEscopo}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => setFileEscopo(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={() => refInputEscopo.current?.click()}>
                      Selecionar arquivo de Escopo
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {fileEscopo ? fileEscopo.name : "PDF, DOC, DOCX, TXT, MD"}
                    </span>
                  </div>

                  {/* XML AS-IS */}
                  <input
                    ref={refInputXmlAsIs}
                    type="file"
                    accept=".bpmn,.xml"
                    className="hidden"
                    onChange={(e) => setFileAsIsXml(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={() => refInputXmlAsIs.current?.click()}>
                      Selecionar XML AS-IS
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {fileAsIsXml ? fileAsIsXml.name : "BPMN/XML exportado do As-Is"}
                    </span>
                  </div>
                </>
              )}

              {/* LISTA DE ANEXOS EXISTENTES */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Arquivos enviados</div>
                  <button
                    className="text-xs underline"
                    onClick={() => fetchAndSetAttachments(attachFor.id)}
                    title="Recarregar anexos"
                  >
                    Atualizar lista
                  </button>
                </div>

                {attachmentsLoading ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando anexos...
                  </div>
                ) : attachments.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum arquivo enviado ainda.</div>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((a, idx) => {
                      const href = a.url.startsWith("http") ? a.url : `${API_URL}${a.url}`;
                      return (
                        <li key={idx} className="flex items-center justify-between gap-2">
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-sm"
                            title={a.name}
                          >
                            {a.name}
                          </a>
                          <a href={href} download className="text-xs underline opacity-70">
                            baixar
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setAttachOpen(false);
                  setAttachFor(null);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveAttachments} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar anexos
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: IA / n8n */}
      {iaOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="text-lg font-semibold flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> Gerar Mapeamento via IA
              </div>
              <button className="text-xs px-2 py-1 rounded bg-neutral-200" onClick={() => setIaOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <Label className="mb-1 block">Workflow</Label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={iaWorkflow}
                  onChange={(e) => setIaWorkflow(e.target.value as any)}
                >
                  <option value="generate_to_be">Gerar TO-BE</option>
                  <option value="generate_as_is">Gerar AS-IS</option>
                </select>
              </div>

              <div>
                <Label className="mb-1 block">Anexo para a IA processar</Label>
                {iaLoading ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando anexos…
                  </div>
                ) : iaAttachments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum anexo encontrado neste mapeamento.</div>
                ) : (
                  <select
                    className="w-full border rounded px-2 py-1"
                    value={iaSelectedAttachment ?? ""}
                    onChange={(e) => setIaSelectedAttachment(e.target.value || null)}
                  >
                    <option value="">Selecione…</option>
                    {iaAttachments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} {a.tipo ? `(${a.tipo})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIaOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="disabled:opacity-60"
                disabled={iaLoading || !iaSelectedAttachment}
                onClick={startIaGeneration}
              >
                {iaLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Iniciar geração
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
