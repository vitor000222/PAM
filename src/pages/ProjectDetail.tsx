import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function ProjectDetail() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [mapName, setMapName] = useState("");
  const [mapType, setMapType] = useState("as-is");

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`http://localhost:3001/projetos/${projectId}`);
        const data = await res.json();
        setProject(data);
      } catch (err) {
        console.error("Erro ao buscar projeto:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const criarMapeamento = async () => {
    try {
      const res = await fetch("http://localhost:3001/mapeamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: mapName,
          tipo: mapType,
          projeto_id: projectId,
        }),
      });

      const data = await res.json();

      // ✅ Redireciona para o Modeler do mapeamento criado
      navigate(`/mapeamentos/${data.id}/modeler`);

    } catch (err) {
      console.error("Erro ao criar mapeamento:", err);
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!project) return <div className="p-6">Projeto não encontrado.</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{project.nome}</h1>
      <p className="text-sm text-neutral-600">
        Cliente: {project.cliente_id} | Conta: {project.conta_id}
      </p>

      <button
        className="mt-4 px-3 py-1 rounded bg-blue-600 text-white"
        onClick={() => setShowForm(true)}
      >
        Criar Mapeamento
      </button>

      {/* Modal de novo mapeamento */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow w-96 space-y-4">
            <h2 className="text-lg font-semibold">Novo Mapeamento</h2>

            <label className="block">
              <span className="text-sm text-neutral-600">Nome</span>
              <input
                type="text"
                className="w-full border rounded px-2 py-1"
                value={mapName}
                onChange={(e) => setMapName(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-neutral-600">Tipo</span>
              <select
                className="w-full border rounded px-2 py-1"
                value={mapType}
                onChange={(e) => setMapType(e.target.value)}
              >
                <option value="as-is">As-Is</option>
                <option value="to-be">To-Be</option>
              </select>
            </label>

            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-1 rounded bg-gray-400 text-white"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1 rounded bg-emerald-600 text-white"
                onClick={criarMapeamento}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
