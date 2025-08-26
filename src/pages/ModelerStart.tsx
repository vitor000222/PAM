import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:3001";

export default function ModelerStart() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const navigate = useNavigate();

  // Carregar projetos
  useEffect(() => {
    axios.get(`${API_URL}/projetos`).then((res) => setProjects(res.data));
  }, []);

  // Selecionar projeto e carregar mapeamentos
  const handleSelectProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    setSelectedProject(project);

    const res = await axios.get(
      `${API_URL}/projetos/${projectId}/mapeamentos`
    );
    setMappings(res.data);
  };

  // Novo mapeamento → redireciona para ModelerNew
  const handleNewMapping = () => {
    if (!selectedProject) {
      alert("Selecione um projeto primeiro");
      return;
    }
    navigate(`/modeler/new?projectId=${selectedProject.id}`);
  };

  // Abrir mapeamento existente
  const handleOpenMapping = (mappingId: string) => {
    navigate(`/modeler/${mappingId}`);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">
        Selecionar Projeto e Mapeamento
      </h2>

      {/* Seleção de projeto */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => handleSelectProject(project.id)}
            className={`px-4 py-2 rounded ${
              selectedProject?.id === project.id
                ? "bg-blue-600 text-white"
                : "bg-gray-200"
            }`}
          >
            {project.nome}
          </button>
        ))}
      </div>

      {/* Lista de mapeamentos */}
      {selectedProject && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold">
              Mapeamentos de {selectedProject.nome}
            </h3>
            <button
              onClick={handleNewMapping}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Novo Mapeamento
            </button>
          </div>

          {mappings.length === 0 ? (
            <p className="text-gray-500">Nenhum mapeamento ainda.</p>
          ) : (
            <ul className="space-y-2">
              {mappings.map((m) => (
                <li
                  key={m.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span>{m.nome}</span>
                  <button
                    onClick={() => handleOpenMapping(m.id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Abrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
