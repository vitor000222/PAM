import { useQuery } from "@tanstack/react-query";
import { getProjects, Project } from "../../lib/projects";
import ProjectCard from "../../components/ProjectCard";
import { useNavigate } from "react-router-dom";

export default function ProjectsIndex() {
  const {
    data: projects = [],
    isLoading,
    error,
  } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const navigate = useNavigate();

  if (isLoading) return <p className="p-4">Carregando projetos...</p>;
  if (error) return <p className="p-4 text-red-600">Erro ao carregar projetos.</p>;

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Projetos</h1>

      {projects.length === 0 ? (
        <p>Nenhum projeto encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projetos/${project.id}/mapeamentos`)} // ✅ vai direto para mapeamentos
            />
          ))}
        </div>
      )}
    </div>
  );
}
