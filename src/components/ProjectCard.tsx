import { Project } from "../lib/projects";
import { useNavigate } from "react-router-dom";

interface ProjectCardProps {
  project: Project;
  onClick?: () => void; // ✅ aceita clique externo
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(); // ✅ usa a navegação passada pelo pai (Dashboard)
    } else {
      // fallback: comportamento antigo
      navigate(`/modeler/start?projectId=${project.id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer rounded-xl border p-4 shadow hover:shadow-lg transition"
    >
      <h3 className="text-lg font-bold">{project.name}</h3>
      <p className="text-sm text-gray-600">Status: {project.status}</p>
      {project.team && (
        <p className="text-sm text-gray-600">Time: {project.team}</p>
      )}
      {project.clientName && (
        <p className="text-sm text-gray-600">
          Cliente: <strong>{project.clientName}</strong>
        </p>
      )}

      <div className="mt-2 flex gap-2">
        {project.hasAsIs && (
          <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600">
            As-Is
          </span>
        )}
        {project.hasToBe && (
          <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-600">
            To-Be
          </span>
        )}
      </div>
    </div>
  );
}
