import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ⚠️ provisório até ter auth real
const DEFAULT_USER_ID = "ff4e45aa-76a8-4e05-8554-43c8b818b89d";

export default function NewProject() {
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"AS_IS" | "TO_BE">("AS_IS");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    setLoading(true);

    try {
      // 1) Criar PROJETO
      const resProj = await fetch(`${API_BASE}/projetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // campos mínimos (outros são opcionais no backend que sugeri)
          nome,
          // clienteId, contaId, gerenteId, mocId podem ser adicionados depois
        }),
      });

      if (!resProj.ok) {
        const t = await safeText(resProj);
        throw new Error(`Falha ao criar projeto: ${resProj.status} ${t}`);
      }

      const projData = await resProj.json() as { id: string };
      const projetoId = projData.id;

      // 2) Criar MAPEAMENTO vinculado ao projeto
      const resMap = await fetch(`${API_BASE}/mapeamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projetoId,
          tipo,                 // "AS_IS" | "TO_BE"
          criadoPor: DEFAULT_USER_ID,
          notas: notas || null,
        }),
      });

      if (!resMap.ok) {
        const t = await safeText(resMap);
        throw new Error(`Falha ao criar mapeamento: ${resMap.status} ${t}`);
      }

      const mapData = await resMap.json() as { id: string };
      const mapeamentoId = mapData.id;

      toast.success("Projeto e mapeamento criados com sucesso!");
      // 3) Ir direto para o Modeler vinculado ao mapeamento
      nav(`/mappings/${mapeamentoId}/modeler`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro inesperado ao criar projeto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">Novo Projeto</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome do Projeto</label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: Implementação ACME"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de Mapeamento Inicial</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "AS_IS" | "TO_BE")}
            className="w-full rounded border px-3 py-2"
          >
            <option value="AS_IS">AS-IS (mapeamento atual)</option>
            <option value="TO_BE">TO-BE (mapeamento proposto)</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Você pode criar outros mapeamentos depois, este é só o inicial.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded border px-3 py-2 min-h-[90px]"
            placeholder="Contexto, observações, links..."
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar e abrir Modeler"}
          </button>
          <span className="text-sm text-neutral-500">
            A API usada: <code>{API_BASE}</code>
          </span>
        </div>
      </form>
    </div>
  );
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}
