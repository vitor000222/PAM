import { useParams } from "react-router-dom";

export default function ProjectInputs() {
  const { projetoId } = useParams();
  return (
    <div className="p-6">
      Insumos (documentos/transcrições) do projeto {projetoId}.
      {/* Em breve: upload + listagem (documento_fonte / entrevista_fonte) */}
    </div>
  );
}
