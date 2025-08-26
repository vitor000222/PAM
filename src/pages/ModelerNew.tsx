import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import BpmnModeler from "bpmn-js/lib/Modeler";

const API_URL = "http://localhost:3001";

export default function ModelerNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const projectId = query.get("projectId");

  const modelerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("AS_IS");

  useEffect(() => {
    if (containerRef.current) {
      modelerRef.current = new BpmnModeler({
        container: containerRef.current,
      });

      // XML inicial mínimo
      const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                   xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_1"
                   targetNamespace="http://bpmn.io/schema/bpmn">
        <process id="Process_1" isExecutable="false"/>
        <bpmndi:BPMNDiagram id="BPMNDiagram_1">
          <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"/>
        </bpmndi:BPMNDiagram>
      </definitions>`;

      modelerRef.current.importXML(initialXml);
    }
  }, []);

  const handleSave = async () => {
    if (!projectId) {
      alert("Projeto inválido");
      return;
    }

    const { xml } = await modelerRef.current.saveXML({ format: true });

    // 🔧 Corrigido para rota em português
    await axios.post(`${API_URL}/projetos/${projectId}/mapeamentos`, {
      nome: name || "Novo Mapeamento",
      tipo: type,
      xml,
    });

    // depois de salvar volta para seleção de mapeamentos
    navigate("/modeler/start");
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Novo Mapeamento</h2>

      <div className="space-y-2">
        <label className="block">
          <span className="text-sm">Nome</span>
          <input
            type="text"
            className="border rounded w-full px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-sm">Tipo</span>
          <select
            className="border rounded w-full px-2 py-1"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="AS_IS">As-Is</option>
            <option value="TO_BE">To-Be</option>
          </select>
        </label>
      </div>

      <div
        ref={containerRef}
        className="border h-[500px] w-full bg-white"
      ></div>

      <button
        onClick={handleSave}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Salvar Mapeamento
      </button>
    </div>
  );
}
