import { Link, useParams } from "react-router-dom";

export default function ProjectDetails() {
  const { projetoId } = useParams();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Projeto {projetoId}</h1>
      <div className="flex gap-3">
        <Link to={`/projects/${projetoId}/inputs`} className="underline">Insumos</Link>
        <Link to={`/projects/${projetoId}/mappings`} className="underline">Mapeamentos</Link>
      </div>
    </div>
  );
}
