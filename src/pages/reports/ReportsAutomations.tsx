import { useSearchParams } from "react-router-dom";

export default function ReportsAutomations() {
  const [sp] = useSearchParams();
  const mapeamentoId = sp.get("mapeamentoId") || "(sem id)";
  return (
    <div className="p-6">
      Relatório de automações do mapeamento {mapeamentoId}.
      {/* Em breve: GET /relatorios/automacoes?mapeamentoId=... */}
    </div>
  );
}
