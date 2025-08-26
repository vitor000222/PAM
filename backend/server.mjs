// -------------------- imports --------------------
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

const pump = promisify(pipeline);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- infra --------------------
const prisma = new PrismaClient();
const app = Fastify({ logger: true });

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

await app.register(cors, { origin: true });
await app.register(fastifyStatic, { root: UPLOAD_DIR, prefix: "/uploads/" });
await app.register(multipart);

// ============== AUTH HELPERS ==============
async function getAuthUser(req) {
  const auth = req.headers?.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (!token) return null;

  // aceita token como UUID (id do usuario) ou email
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  if (uuidRegex.test(token)) {
    return prisma.usuario.findUnique({ where: { id: token } });
  }
  if (token.includes("@")) {
    return prisma.usuario.findUnique({ where: { email: token } });
  }
  return null;
}

function sanitizeUser(u) {
  if (!u) return null;
  return { id: u.id, nome: u.nome, email: u.email, conta_id: u.conta_id, cargo: u.cargo };
}

// ---- Normalizador para enum de anexo ----
const TIPO_MAP = {
  ESCOPO: "ESCOPO",
  TRANSCRICAO: "TRANSCRICAO",
  XMLASIS: "XMLASIS",
  OUTRO: "OUTRO",
};

function normalizeAnexoTipo(v) {
  if (!v) return "OUTRO";
  const key = String(v).toUpperCase().replace(/[^A-Z]/g, "");
  return TIPO_MAP[key] || "OUTRO";
}

// ============== AUTH ROUTES ==============
// POST /usuarios/login  { email, password|senha }
async function loginHandler(req, reply) {
  const b = req.body ?? {};
  const email = (b.email || "").toString().trim().toLowerCase();
  if (!email) return reply.code(400).send({ error: "email é obrigatório" });

  // dev: aceita qualquer senha; apenas verifica se o usuário existe
  const user = await prisma.usuario.findUnique({ where: { email } });
  if (!user) {
    return reply.code(401).send({ error: "Usuário não encontrado" });
  }

  // token = id do usuario (simples para dev)
  return reply.send({ token: user.id, user: sanitizeUser(user) });
}

// GET /usuarios/me  -> precisa de Authorization: Bearer <token>
async function meHandler(req, reply) {
  const user = await getAuthUser(req);
  if (!user) return reply.code(401).send({ error: "Não autenticado" });
  return sanitizeUser(user);
}

// rotas sem prefixo
app.post("/usuarios/login", loginHandler);
app.get("/usuarios/me", meHandler);

// rotas com prefixo /api (compat com AuthProvider)
app.post("/api/usuarios/login", loginHandler);
app.get("/api/usuarios/me", meHandler);

// -------------------- helpers --------------------
const ok = () => ({ ok: true, now: new Date().toISOString() });
const bearerFromReq = (req) => {
  const h = {};
  const auth = req.headers?.authorization;
  if (auth) h["Authorization"] = auth;
  return h;
};

// ---- Helpers: enum dinâmico para mapeamento_anexo_tipo ----
let ANEXO_ENUM_CACHE = null;

async function getAnexoEnumValues() {
  if (ANEXO_ENUM_CACHE) return ANEXO_ENUM_CACHE;
  // retorna lista: [{ val: '...' }, ...] -> mapeamos para array de strings
  const rows = await prisma.$queryRaw`
    SELECT unnest(enum_range(NULL::mapeamento_anexo_tipo))::text AS val
  `;
  ANEXO_ENUM_CACHE = rows.map(r => r.val);
  return ANEXO_ENUM_CACHE;
}

// normaliza string para comparar (remove acento, símbolos e força minúsculo)
function normKey(s) {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * Resolve o valor do enum aceitando variações do formulário (xmlasis, xml-asis, XML_ASIS, etc.)
 * Retorna exatamente o valor existente no Postgres (ex.: 'xmlasis' ou 'XML_ASIS' — o que estiver no enum).
 */
async function resolveAnexoTipo(input) {
  const list = await getAnexoEnumValues(); // ['escopo', 'transcricao', 'xmlasis', 'outro'] (exemplo)
  if (!input) {
    // tenta achar 'outro', senão o primeiro
    const fallbackOutro = list.find(v => normKey(v) === 'outro');
    return fallbackOutro || list[0];
  }
  const k = normKey(input);
  // match perfeito por chave normalizada
  const match = list.find(v => normKey(v) === k);
  if (match) return match;

  // mapeamentos comuns se o enum tiver underscore/hífen ou maiúsculas
  const aliases = {
    escopo: ['escopo'],
    transcricao: ['transcricao', 'transcricoes', 'transcription'],
    xmlasis: ['xmlasis', 'xmlasis', 'xml_as_is', 'xmlasis'],
    outro: ['outro', 'others', 'other']
  };
  for (const val of list) {
    const nk = normKey(val);
    if ((aliases.xmlasis || []).includes(k) && nk.includes('xml')) return val;
    if ((aliases.transcricao || []).includes(k) && nk.includes('transcri')) return val;
    if ((aliases.escopo || []).includes(k) && nk.includes('escop')) return val;
    if ((aliases.outro || []).includes(k) && nk.includes('outro')) return val;
  }

  // última tentativa: se existir "outro"
  const fallbackOutro = list.find(v => normKey(v) === 'outro');
  return fallbackOutro || list[0];
}



// -------------------- health --------------------
app.get("/health", async () => ok());

// -------------------- MOCs --------------------
app.get("/mocs", async () => {
  const rows = await prisma.moc.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, codigo: true, ativo: true },
  });
  return rows;
});

// (opcional) criar MOC
app.post("/mocs", async (req, reply) => {
  try {
    const b = req.body ?? {};
    if (!b.nome) return reply.code(400).send({ error: "nome é obrigatório" });
    const created = await prisma.moc.create({
      data: { nome: b.nome, codigo: b.codigo ?? null, ativo: b.ativo ?? true },
    });
    return reply.code(201).send(created);
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao criar MOC", details: String(e) });
  }
});

// -------------------- Clientes --------------------
app.get("/clientes", async (req) => {
  const q = (req.query?.q ?? "").toString().trim();
  const rows = await prisma.cliente.findMany({
    where: q ? { nome: { contains: q, mode: "insensitive" } } : undefined,
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return rows.map((r) => ({ ...r, name: r.nome }));
});

app.get("/clientes/:id", async (req, reply) => {
  const { id } = req.params;
  const c = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true, nome: true, conta_id: true, cnpj: true, segmento: true, moc: true }
  });
  if (!c) return reply.code(404).send({ error: "Cliente não encontrado" });
  return { ...c, name: c.nome };
});

app.post("/clientes", async (req, reply) => {
  try {
    const b = req.body ?? {};
    const data = {
      nome: b.nome ?? b.name,
      conta_id: b.conta_id ?? b.contaId,
      cnpj: b.cnpj ?? null,
      segmento: b.segmento ?? null,
      moc: b.moc_id ?? b.moc ?? null,
    };
    if (!data.nome || !data.conta_id) {
      return reply.code(400).send({ error: "Campos obrigatórios: nome, conta_id" });
    }
    const created = await prisma.cliente.create({ data });
    return { id: created.id, nome: created.nome, name: created.nome };
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao criar cliente", details: String(e) });
  }
});

// Aliases em inglês (compat)
app.get("/clients", async (_req, _reply) => {
  const rows = await prisma.cliente.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.nome, nome: r.nome }));
});
app.get("/clients/:id", async (req, reply) => {
  const { id } = req.params;
  const c = await prisma.cliente.findUnique({ where: { id }, select: { id: true, nome: true } });
  if (!c) return reply.code(404).send({ error: "Client not found" });
  return { id: c.id, name: c.nome, nome: c.nome };
});
app.post("/clients", async (req, reply) => {
  const { name, nome, conta_id, contaId } = req.body ?? {};
  const created = await prisma.cliente.create({
    data: { nome: nome ?? name, conta_id: conta_id ?? contaId },
  });
  return reply.code(201).send({ id: created.id, name: created.nome, nome: created.nome });
});

// -------------------- Projetos --------------------
app.get("/projetos", async () => {
  const rows = await prisma.projeto.findMany({
    orderBy: { criado_em: "desc" },
    select: {
      id: true,
      nome: true,
      criado_em: true,
      status: true,
      estagio: true,
      cliente_id: true,
      conta_id: true,
      cliente: { select: { id: true, nome: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    cliente_id: r.cliente_id,
    conta_id: r.conta_id,
    cliente_nome: r.cliente?.nome ?? null,
    status: r.status,
    estagio: r.estagio,
    criado_em: r.criado_em,
  }));
});

app.get("/projetos/:id", async (req, reply) => {
  const { id } = req.params;
  const p = await prisma.projeto.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      mapeamentos: {
        orderBy: { criado_em: "desc" },
        select: {
          id: true,
          tipo: true,
          status: true,
          criado_em: true,
          diagramas: {
            orderBy: { versao: "desc" },
            take: 1,
            select: { id: true, nome: true, versao: true },
          },
        },
      },
    },
  });
  if (!p) return reply.code(404).send({ error: "Projeto não encontrado" });
  return p;
});

app.post("/projetos", async (req, reply) => {
  try {
    const b = req.body ?? {};
    let contaId = b.conta_id ?? b.contaId ?? null;

    if (!contaId) {
      if (!b.cliente_id && !b.clienteId) {
        return reply.code(400).send({ error: "Informe cliente_id ou conta_id" });
      }
      const cliente = await prisma.cliente.findUnique({
        where: { id: b.cliente_id ?? b.clienteId },
        select: { conta_id: true },
      });
      if (!cliente) return reply.code(422).send({ error: "cliente_id inválido" });
      contaId = cliente.conta_id;
    }

    const data = {
      nome: b.nome ?? b.name,
      cliente_id: b.cliente_id ?? b.clienteId,
      conta_id: contaId,
      gerente_id: b.gerente_id ?? b.gerenteId ?? null,
      status: b.status ?? "NOVO",
      estagio: b.estagio ?? "NOVO",
      moc_id: b.moc_id ?? null,
    };
    if (!data.nome || !data.cliente_id) {
      return reply.code(400).send({ error: "Campos obrigatórios: nome, cliente_id" });
    }
    const created = await prisma.projeto.create({ data });
    return reply.code(201).send(created);
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao criar projeto", details: String(e) });
  }
});

// -------------------- Mapeamentos --------------------
app.get("/projetos/:id/mapeamentos", async (req) => {
  const { id } = req.params;
  const rows = await prisma.mapeamento.findMany({
    where: { projeto_id: id },
    orderBy: { criado_em: "desc" },
    select: {
      id: true,
      tipo: true,
      status: true,
      criado_em: true,
      notas: true,
      diagramas: {
        orderBy: { versao: "desc" },
        take: 1,
        select: { id: true, nome: true, versao: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    status: r.status,
    criado_em: r.criado_em,
    ultimo_diagrama: r.diagramas?.[0] ?? null,
  }));
});

app.post("/projetos/:id/mapeamentos", async (req, reply) => {
  try {
    const { id: projeto_id } = req.params;
    const b = req.body ?? {};
    let criadoPor = b.criado_por ?? b.autor_id ?? b.usuario_id ?? null;

    if (!criadoPor) {
      const proj = await prisma.projeto.findUnique({
        where: { id: projeto_id },
        select: { conta_id: true },
      });
      if (!proj) return reply.code(422).send({ error: "projeto_id inválido" });
      const user = await prisma.usuario.findFirst({
        where: { conta_id: proj.conta_id },
        select: { id: true },
      });
      if (!user) return reply.code(422).send({ error: "Nenhum usuário encontrado para conta do projeto; informe criado_por" });
      criadoPor = user.id;
    }

    const created = await prisma.mapeamento.create({
      data: {
        projeto_id,
        tipo: b.tipo ?? "AS_IS",
        status: b.status ?? "NOVO",
        notas: b.notas ?? null,
        criado_por: criadoPor,
      },
    });
    return reply.code(201).send(created);
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao criar mapeamento", details: String(e) });
  }
});

app.get("/mapeamentos/:id", async (req, reply) => {
  const { id } = req.params;
  const m = await prisma.mapeamento.findUnique({
    where: { id },
    include: {
      diagramas: { orderBy: { versao: "desc" }, take: 1 },
    },
  });
  if (!m) return reply.code(404).send({ error: "Mapeamento não encontrado" });
  return m;
});

app.post("/mapeamentos", async (req, reply) => {
  try {
    const b = req.body ?? {};
    const created = await prisma.mapeamento.create({
      data: {
        projeto_id: b.projetoId ?? b.projeto_id ?? null,
        caixa_mapeamento_id: b.caixaId ?? b.caixa_mapeamento_id ?? null,
        tipo: b.tipo ?? "AS_IS",
        base_as_is_id: b.baseAsIsId ?? b.base_as_is_id ?? null,
        escopo_id: b.escopoId ?? b.escopo_id ?? null,
        criado_por: b.criadoPor ?? b.criado_por,
        notas: b.notas ?? null,
        status: "NOVO",
      },
    });
    return reply.code(201).send({ id: created.id });
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao criar mapeamento (legacy)", details: String(e) });
  }
});

// -------------------- Diagramas (XML) --------------------
app.get("/mapeamentos/:id/diagramas", async (req, reply) => {
  const { id: mapeamento_id } = req.params;
  const last = await prisma.diagrama.findFirst({
    where: { mapeamento_id },
    orderBy: [{ versao: "desc" }, { criado_em: "desc" }],
    select: { id: true, nome: true, versao: true, bpmn_xml: true, snapshot_url: true, criado_em: true },
  });
  if (!last) return reply.code(204).send();
  return last;
});

app.post("/mapeamentos/:id/diagramas", async (req, reply) => {
  try {
    const { id: mapeamento_id } = req.params;
    const { nome, versao, bpmnXml, snapshot_url, elementos } = req.body ?? {};
    if (!bpmnXml) return reply.code(400).send({ error: "bpmnXml é obrigatório" });

    let nextVersion = versao;
    if (nextVersion == null) {
      const last = await prisma.diagrama.findFirst({
        where: { mapeamento_id },
        orderBy: { versao: "desc" },
        select: { versao: true },
      });
      nextVersion = last?.versao ? last.versao + 1 : 1;
    }

    const created = await prisma.diagrama.create({
      data: {
        mapeamento_id,
        nome: nome ?? "Process_Default",
        versao: nextVersion,
        bpmn_xml: bpmnXml,
        snapshot_url: snapshot_url ?? null,
      },
      select: { id: true, nome: true, versao: true },
    });

    if (Array.isArray(elementos) && elementos.length) {
      await prisma.$transaction(
        elementos.map((el) =>
          prisma.elemento_diagrama.create({
            data: {
              diagrama_id: created.id,
              elemento_id: el.elementoId ?? el.elemento_id,
              bpmn_tipo: el.bpmnTipo ?? el.bpmn_tipo,
              nome: el.nome ?? null,
              props: el.props ?? {},
            },
          })
        )
      );
    }

    return reply.code(201).send({ ok: true, diagrama: created });
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Erro ao salvar diagrama", details: String(e) });
  }
});

app.get("/mapeamentos/:id/diagramas/versions", async (req) => {
  const { id: mapeamento_id } = req.params;
  return prisma.diagrama.findMany({
    where: { mapeamento_id },
    orderBy: [{ versao: "desc" }, { criado_em: "desc" }],
    select: { id: true, versao: true, nome: true, criado_em: true, snapshot_url: true }
  });
});

app.post("/mapeamentos/:id/diagramas/restore", async (req, reply) => {
  const { id: mapeamento_id } = req.params;
  const { versao } = req.body ?? {};
  if (versao == null) return reply.code(400).send({ error: "versao é obrigatória" });

  const base = await prisma.diagrama.findFirst({
    where: { mapeamento_id, versao },
    select: { bpmn_xml: true, nome: true }
  });
  if (!base) return reply.code(404).send({ error: "Versão não encontrada" });

  const last = await prisma.diagrama.findFirst({
    where: { mapeamento_id },
    orderBy: { versao: "desc" },
    select: { versao: true }
  });
  const next = (last?.versao ?? 0) + 1;

  const created = await prisma.diagrama.create({
    data: {
      mapeamento_id,
      nome: base.nome ?? `Restore_v${versao}`,
      versao: next,
      bpmn_xml: base.bpmn_xml
    },
    select: { id: true, versao: true, nome: true }
  });

  return { ok: true, diagrama: created };
});

// -------------------- IA / n8n --------------------
const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_BASE || "http://localhost:5678/webhook";
const N8N_CALLBACK_URL = process.env.N8N_CALLBACK_URL || "http://localhost:3001/n8n/callbacks";
const N8N_CALLBACK_SECRET = process.env.N8N_CALLBACK_SECRET || null;

app.post("/mapeamentos/:id/ia/jobs", async (req, reply) => {
  try {
    const { id: mapeamento_id } = req.params;
    const b = req.body ?? {};
    const workflow = b.workflow || "generate_to_be";

    const map = await prisma.mapeamento.findUnique({
      where: { id: mapeamento_id },
      select: { id: true, projeto_id: true }
    });
    if (!map) return reply.code(404).send({ error: "Mapeamento não encontrado" });

    const tarefa = await prisma.tarefa_n8n.create({
      data: {
        projeto_id: map.projeto_id,
        mapeamento_id,
        workflow_chave: workflow,
        input: b,
        status: "AGUARDANDO"
      },
      select: { id: true }
    });

    const webhookUrl = `${N8N_WEBHOOK_BASE}/${encodeURIComponent(workflow)}`;
    const payload = {
      job_id: tarefa.id,
      mapeamento_id,
      projeto_id: map.projeto_id,
      callback_url: `${N8N_CALLBACK_URL}/${tarefa.id}`,
      callback_secret: N8N_CALLBACK_SECRET,
      input: b
    };

    let ok = true;
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearerFromReq(req) },
        body: JSON.stringify(payload)
      });
      ok = res.ok;
    } catch (e) {
      ok = false;
    }

    if (ok) {
      await prisma.tarefa_n8n.update({
        where: { id: tarefa.id },
        data: { status: "GERANDO", iniciado_em: new Date() }
      });
    }

    return reply.code(202).send({ jobId: tarefa.id, status: ok ? "GERANDO" : "AGUARDANDO" });
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Falha ao criar job n8n", details: String(e) });
  }
});

app.get("/mapeamentos/:id/ia/jobs", async (req) => {
  const { id: mapeamento_id } = req.params;
  const rows = await prisma.tarefa_n8n.findMany({
    where: { mapeamento_id },
    orderBy: { criado_em: "desc" },
    select: {
      id: true, workflow_chave: true, status: true,
      criado_em: true, iniciado_em: true, finalizado_em: true, erro: true
    }
  });
  return rows;
});

app.get("/ia/jobs/:jobId", async (req, reply) => {
  const { jobId } = req.params;
  const row = await prisma.tarefa_n8n.findUnique({
    where: { id: jobId },
    select: {
      id: true, projeto_id: true, mapeamento_id: true, workflow_chave: true,
      input: true, output: true, status: true, erro: true,
      criado_em: true, iniciado_em: true, finalizado_em: true
    }
  });
  if (!row) return reply.code(404).send({ error: "Job não encontrado" });
  return row;
});

app.post("/n8n/callbacks/:jobId", async (req, reply) => {
  try {
    const { jobId } = req.params;
    const b = req.body ?? {};

    if (N8N_CALLBACK_SECRET) {
      const pass = req.headers["x-callback-secret"] === N8N_CALLBACK_SECRET;
      if (!pass) return reply.code(401).send({ error: "Unauthorized callback" });
    }

    const job = await prisma.tarefa_n8n.findUnique({
      where: { id: jobId },
      select: { id: true, mapeamento_id: true }
    });
    if (!job) return reply.code(404).send({ error: "Job não encontrado" });

    const status = String(b.status || "").toLowerCase();

    if (status === "concluido" && b.bpmnXml) {
      const last = await prisma.diagrama.findFirst({
        where: { mapeamento_id: job.mapeamento_id },
        orderBy: { versao: "desc" },
        select: { versao: true }
      });
      const nextVersion = (last?.versao ?? 0) + 1;

      await prisma.diagrama.create({
        data: {
          mapeamento_id: job.mapeamento_id,
          nome: b.nome || "Gerado por IA",
          versao: nextVersion,
          bpmn_xml: b.bpmnXml,
          snapshot_url: b.snapshot_url || null
        }
      });

      await prisma.tarefa_n8n.update({
        where: { id: jobId },
        data: { status: "CONCLUIDO", output: b.output ?? null, finalizado_em: new Date() }
      });

      return { ok: true, status: "CONCLUIDO", versao: nextVersion };
    }

    if (status === "erro") {
      await prisma.tarefa_n8n.update({
        where: { id: jobId },
        data: { status: "ERRO", erro: b.error || "erro desconhecido", output: b.output ?? null, finalizado_em: new Date() }
      });
      return { ok: true, status: "ERRO" };
    }

    await prisma.tarefa_n8n.update({
      where: { id: jobId },
      data: { output: b.output ?? null }
    });
    return { ok: true, status: "ATUALIZADO" };
  } catch (e) {
    req.log?.error(e);
    return reply.code(400).send({ error: "Falha no callback", details: String(e) });
  }
});

// -------------------- Anexos do mapeamento --------------------
// GET /mapeamentos/:id/anexos  (converte BigInt -> Number)
app.get("/mapeamentos/:id/anexos", async (req) => {
  const { id: mapeamento_id } = req.params;
  const rows = await prisma.mapeamento_anexo.findMany({
    where: { mapeamento_id },
    orderBy: { criado_em: "desc" },
    select: {
      id: true,
      nome_arquivo: true,
      url: true,
      tipo: true,
      tamanho_bytes: true,
      content_type: true
    }
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.nome_arquivo,
    url: r.url,
    tipo: r.tipo,
    size: Number(r.tamanho_bytes ?? 0),
    contentType: r.content_type ?? null
  }));
});

// POST /mapeamentos/:id/anexos  (fechamento corrigido + BigInt -> Number na resposta)
app.post("/mapeamentos/:id/anexos", async (req, reply) => {
  try {
    const { id: mapeamento_id } = req.params;

    // garante que o mapeamento existe
    const exists = await prisma.mapeamento.findUnique({
      where: { id: mapeamento_id },
      select: { id: true }
    });
    if (!exists) {
      return reply.code(404).send({ error: "Mapeamento não encontrado" });
    }

    let tipoRaw = null;
    let originalName = null;
    let savedName = null;
    let destPath = null;
    let mimetype = null;

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "arquivo") {
        originalName = part.filename || "arquivo";
        mimetype = part.mimetype || null;

        const safeBase = originalName.replace(/[^\w.\-]+/g, "_");
        savedName = `${Date.now()}_${safeBase}`;
        destPath = path.join(UPLOAD_DIR, savedName);

        await pump(part.file, fs.createWriteStream(destPath));
      } else if (part.type === "field" && part.fieldname === "tipo") {
        tipoRaw = String(part.value || "");
      }
    }

    if (!destPath || !originalName) {
      return reply.code(400).send({ error: 'Arquivo (campo "arquivo") é obrigatório' });
    }

    // resolve valor EXATO do enum no banco (usa seu helper resolveAnexoTipo)
    const tipo = await resolveAnexoTipo(tipoRaw);

    // tamanho do arquivo
    const stat = await fs.promises.stat(destPath);
    const size = stat.size;

    const created = await prisma.mapeamento_anexo.create({
      data: {
        mapeamento_id,
        tipo,
        nome_arquivo: originalName,
        content_type: mimetype,
        tamanho_bytes: BigInt(size),
        url: `/uploads/${savedName}`
      },
      select: {
        id: true,
        nome_arquivo: true,
        url: true,
        tipo: true,
        content_type: true,
        tamanho_bytes: true
      }
    });

    // 🔁 resposta sem BigInt
    return reply.code(201).send({
      ok: true,
      anexo: {
        id: created.id,
        nome_arquivo: created.nome_arquivo,
        url: created.url,
        tipo: created.tipo,
        content_type: created.content_type ?? null,
        tamanho_bytes: Number(created.tamanho_bytes ?? 0)
      }
    });
  } catch (e) {
    req.log.error(e);
    return reply
      .code(500)
      .send({ error: "Falha ao subir anexo", details: String(e?.message || e) });
  }
});


// -------------------- start --------------------
const PORT = Number(process.env.PORT ?? 3001);
const HOST = "0.0.0.0";

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Server rodando em http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

const onClose = async () => {
  try { await prisma.$disconnect(); } catch {}
  process.exit(0);
};
process.on("SIGINT", onClose);
process.on("SIGTERM", onClose);
