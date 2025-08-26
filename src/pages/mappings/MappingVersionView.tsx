import { useParams } from "react-router-dom";

export default function MappingVersionView() {
  const { mapeamentoId, versao } = useParams();
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl font-semibold">Mapeamento {mapeamentoId}</h1>
      <p>Versão: {versao}</p>
      <p className="text-sm text-muted-foreground">
        (Em breve: carregar XML dessa versão em modo somente leitura)
      </p>
    </div>
  );
}
