import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface Project {
  id: string;
  nome: string;
  descricao?: string;
  criado_em?: string;
  status?: string;
  estagio?: string;
}

export default function ProjectPage() {
  const { id } = useParams();

  // Busca os dados do projeto no backend
  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => {
      const res = await axios.get(`http://localhost:3001/projetos/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-6">Carregando projeto...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        Erro ao carregar projeto. Verifique se o servidor está rodando.
      </div>
    );
  }

  if (!project) {
    return <div className="p-6">Projeto não encontrado.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{project.nome}</h1>

      <p className="mb-2 text-gray-700">{project.descricao || "Sem descrição"}</p>

      <ul className="text-sm text-gray-600 mb-6">
        <li>
          <strong>ID:</strong> {project.id}
        </li>
        {project.status && (
          <li>
            <strong>Status:</strong> {project.status}
          </li>
        )}
        {project.estagio && (
          <li>
            <strong>Estágio:</strong> {project.estagio}
          </li>
        )}
        {project.criado_em && (
          <li>
            <strong>Criado em:</strong>{" "}
            {new Date(project.criado_em).toLocaleString("pt-BR")}
          </li>
        )}
      </ul>

      <div className="mt-6 space-x-4">
        <Link to="/dashboard" className="text-blue-600 underline">
          Voltar ao Dashboard
        </Link>
        <Link
          to={`/projetos/${project.id}/mapeamentos/new`}
          className="text-green-600 underline"
        >
          Criar novo mapeamento
        </Link>
      </div>
    </div>
  );
}
