import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { createMapping } from "../../lib/mappings";

const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1"/>
  <bpmn:process id="Process_1" isExecutable="false"/>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"/>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default function MappingCreate() {
  const { id } = useParams(); // id do projeto
  const navigate = useNavigate();

  const [nome, setNome] = useState("Novo Mapeamento");
  const [tipo, setTipo] = useState<"AS_IS" | "TO_BE">("AS_IS");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCreate() {
    if (!id) return;
    try {
      setLoading(true);
      setErro(null);
      const novo = await createMapping(id, nome, tipo, DEFAULT_BPMN_XML);
      // Após criar, abre no modeler:
      navigate(`/modeler/${novo.id}`);
      // (Se preferir voltar para a lista: navigate(`/projetos/${id}/mapeamentos`))
    } catch (e: any) {
      setErro(e?.message || "Falha ao criar mapeamento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Novo Mapeamento</h1>

      <div className="space-y-3 max-w-md">
        <label className="block">
          <span className="text-sm">Nome</span>
          <input
            className="border rounded w-full px-2 py-1"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Processo Comercial"
          />
        </label>

        <label className="block">
          <span className="text-sm">Tipo</span>
          <select
            className="border rounded w-full px-2 py-1"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "AS_IS" | "TO_BE")}
          >
            <option value="AS_IS">As-Is</option>
            <option value="TO_BE">To-Be</option>
          </select>
        </label>
      </div>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar mapeamento"}
        </button>

        <button
          onClick={() => navigate(`/projetos/${id}/mapeamentos`)}
          className="px-3 py-2 border rounded hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
