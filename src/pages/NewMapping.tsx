import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

export default function NewMapping() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("as-is");
  const [descricao, setDescricao] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:3001/mapeamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          tipo,
          descricao,
          projeto_id: projectId,
        }),
      });
      const data = await res.json();
      navigate(`/mapeamentos/${data.id}/modeler`);
    } catch (err) {
      console.error("Erro ao criar mapeamento:", err);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Novo Mapeamento</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Nome do Mapeamento</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full border rounded px-2 py-1"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Tipo</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="as-is">As-Is</option>
            <option value="to-be">To-Be</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />
        </label>

        <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">
          Criar Mapeamento
        </button>
      </form>
    </div>
  );
}
