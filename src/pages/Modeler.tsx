// src/pages/Modeler.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import BpmnModeler from "bpmn-js/lib/Modeler";

// Módulos customizados (existentes no projeto)
import PloomesRenderer from "@/modeler/modules/ploomes-renderer";
import PloomesPalette from "@/modeler/modules/ploomes-palette";
import PlmFunnelOpenFixed from "@/modeler/modules/ploomes-funnel-open-fixed";
import PlmProperties from "@/modeler/panels/PlmProperties";

// Moddle Ploomes
import plmDescriptor from "@/modeler/moddle/ploomes.json";

// Utils (persistência local)
import { saveXmlToSession, loadXmlFromSession } from "@/utils/localSession";

// 🔗 API base + token (sem quebrar nada existente)
import { API_URL, getAuthToken } from "@/lib/api";

// CSS bpmn.io obrigatórios
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css";

// Diagrama base
const SKELETON_COLLAB = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1"/>
  <bpmn:process id="Process_1" isExecutable="false"/>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1"/>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default function Modeler() {
  const { id } = useParams(); // /modeler/:id (id do mapeamento)
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);

  // painel de propriedades (o seu painel React usa o modeler via getModeler())
  const propsRef = useRef<HTMLDivElement | null>(null);

  // UI
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(360);
  const [xmlPreview, setXmlPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ===== ▼▼▼ ADIÇÕES: Versões do diagrama ▼▼▼ =====
  type DiagramVersion = { id: string; versao: number; nome: string; criado_em: string; snapshot_url?: string | null };
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versionsBtnRef = useRef<HTMLDivElement | null>(null);

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const t = getAuthToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
    return headers;
  }

  async function fetchVersions(mappingId: string) {
    try {
      const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas/versions`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const data: DiagramVersion[] = await res.json();
      setVersions(data);
      setCurrentVersion(data[0]?.versao ?? null);
    } catch (e) {
      console.warn("Falha ao listar versões:", e);
      setVersions([]);
      setCurrentVersion(null);
    }
  }

  async function restoreVersion(mappingId: string, versao: number) {
    if (!window.confirm(`Restaurar para a versão v${versao}? Isso criará uma nova versão.`)) return;
    try {
      const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ versao })
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json().catch(() => ({}));
      const newVersao = json?.diagrama?.versao ?? null;

      // Carrega o último XML (nova versão criada)
      const lastXmlRes = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas`, { headers: authHeaders() });
      if (lastXmlRes.ok) {
        const last = await lastXmlRes.json();
        if (last?.bpmn_xml) {
          await modelerRef.current!.importXML(last.bpmn_xml);
          saveXmlToSession(mappingId, last.bpmn_xml);
        }
      }

      setVersionsOpen(false);
      await fetchVersions(mappingId);
      if (newVersao != null) setCurrentVersion(newVersao);
      console.info(`✅ Restaurado e criada nova versão v${newVersao}.`);
    } catch (e) {
      console.error("Erro ao restaurar versão:", e);
    }
  }
  // ===== ▲▲▲ ADIÇÕES: Versões do diagrama ▲▲▲ =====

  // Helpers backend (não quebram nada local)
  async function fetchLatestDiagramXML(mappingId: string): Promise<string | null> {
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas`, { headers });

      if (res.status === 204) return null; // sem diagrama (No Content)
      if (res.status === 404) return null; // compat
      if (!res.ok) throw new Error(await res.text());
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return null;
      const data = await res.json();
      return data?.bpmn_xml ?? null;
    } catch (e) {
      console.warn("Não foi possível carregar do backend, caindo para sessionStorage.", e);
      return null;
    }
  }

  async function saveDiagramToBackend(mappingId: string, xml: string) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getAuthToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/mapeamentos/${mappingId}/diagramas`, {
        method: "POST",
        headers,
        body: JSON.stringify({ bpmnXml: xml }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json().catch(() => ({}));
      console.info("✅ XML salvo no backend.", data?.diagrama || "");
    } catch (e) {
      console.error("⚠️ Falha ao salvar no backend (mantido no sessionStorage):", e);
    }
  }

  useEffect(() => {
    if (!canvasRef.current) return;

    if (!modelerRef.current) {
      modelerRef.current = new BpmnModeler({
        container: canvasRef.current,
        additionalModules: [PloomesPalette, PlmFunnelOpenFixed, PloomesRenderer],
        // ❗️NÃO usar keyboard.bindTo nas versões novas
        moddleExtensions: { plm: plmDescriptor as any }
      });
    }

    const modeler = modelerRef.current;

    (async () => {
      try {
        // ordem: backend -> session -> skeleton (mantendo compat com o que já existia)
        let xmlToLoad: string | null = null;

        if (id) {
          xmlToLoad = await fetchLatestDiagramXML(id);
        }

        if (!xmlToLoad) {
          const saved = loadXmlFromSession(id || "");
          xmlToLoad = saved || SKELETON_COLLAB;
        }

        const { warnings } = await modeler.importXML(xmlToLoad);
        if (warnings?.length) console.warn("⚠️ Warnings ao importar XML:", warnings);

        // Foco e ajuste inicial
        try {
          modeler.get("canvas").zoom("fit-viewport");
          modeler.get("canvas").focus?.();
        } catch {}

        // ▼ Buscar versões após carregar o XML
        if (id) await fetchVersions(id);
      } catch (err) {
        console.error("❌ Erro ao importar XML:", err);
      }
    })();

    // Autosave básico (local)
    const onStackChanged = async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        if (id) saveXmlToSession(id, xml);
      } catch (e) {
        console.error("Erro ao salvar XML:", e);
      }
    };
    modeler.on("commandStack.changed", onStackChanged);

    return () => {
      modeler.off("commandStack.changed", onStackChanged);
      // Se quiser preservar estado em hot-reload, não destrua.
      // modeler.destroy(); modelerRef.current = null;
    };
  }, [id]);

  // --------- Funções de toolbar ---------
  async function handleSave() {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });

      // 1) mantém o comportamento atual: salvar localmente
      if (id) saveXmlToSession(id, xml);
      console.info("💾 XML salvo localmente (sessionStorage).");

      // 2) adiciona persistência no backend (sem remover o local)
      if (id) {
        await saveDiagramToBackend(id, xml);
        await fetchVersions(id); // ▼ atualizar dropdown e badge após salvar
      }
    } catch (e) {
      console.error("Erro ao salvar:", e);
    }
  }

  async function handleExport() {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapeamento_${id || "ploomes"}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
      console.info("⬇️ XML exportado.");
    } catch (e) {
      console.error("Erro ao exportar:", e);
    }
  }

  function openImportDialog() {
    fileInputRef.current?.click();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !modelerRef.current) return;
    try {
      const text = await file.text();
      const { warnings } = await modelerRef.current.importXML(text);
      if (warnings?.length) console.warn("⚠️ Warnings ao importar:", warnings);
      // Ajustes pós-import
      try {
        modelerRef.current.get("canvas").zoom("fit-viewport");
        modelerRef.current.get("canvas").focus?.();
      } catch {}
      if (id) saveXmlToSession(id, text);
      console.info("📤 XML importado com sucesso.");
      // limpa o input para permitir re-importar o mesmo arquivo no futuro
      e.target.value = "";
    } catch (err) {
      console.error("❌ Erro ao importar XML:", err);
    }
  }

  async function openXmlPreview() {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      setXmlPreview(xml);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleGenerateMapping() {
    // Placeholder do botão “Gerar Mapeamento (n8n)”
    console.info("🤖 Gerar Mapeamento (n8n) — TODO: integrar com webhook n8n.");
    // Mantido como estava; quando integrar, chamar API e importar novo XML + salvar local.
  }

  // --------- Resize do painel ---------
  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const next = Math.min(Math.max(startW + delta, 240), 640);
      setPanelWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <main
      className="h-[calc(100vh-64px)] w-full grid transition-[grid-template-columns] duration-300 ease-linear"
      style={{ gridTemplateColumns: panelOpen ? `1fr ${panelWidth}px` : "1fr 0px" } as React.CSSProperties}
    >
      {/* Canvas */}
      <div ref={canvasRef} className="relative bg-muted/30">
        {/* Toolbar flutuante */}
        <div className="absolute z-50 top-2 right-2 sm:right-4 md:right-6 flex flex-wrap justify-end items-center gap-2">
          <button
            className="px-3 py-1.5 rounded bg-primary text-primary-foreground shadow"
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? "Fechar propriedades" : "Abrir propriedades"}
          >
            {panelOpen ? "Fechar propriedades" : "Abrir propriedades"}
          </button>

          <button
            className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground shadow"
            onClick={openImportDialog}
            title="Importar XML (.bpmn/.xml)"
          >
            Importar
          </button>

          <button
            className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground shadow"
            onClick={handleExport}
            title="Exportar XML (.bpmn)"
          >
            Exportar
          </button>

          <button
            className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground shadow"
            onClick={handleSave}
            title="Salvar XML"
          >
            Salvar
          </button>

          {/* ▼▼▼ Dropdown de versões */}
          <div className="relative" ref={versionsBtnRef}>
            <button
              className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground shadow"
              onClick={() => setVersionsOpen((v) => !v)}
              title="Ver/Restaurar versões"
            >
              Versões {currentVersion ? `(v${currentVersion})` : ""}
            </button>

            {versionsOpen && (
              <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-auto rounded border bg-background shadow z-50">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">Histórico de versões</div>
                {versions.length === 0 ? (
                  <div className="px-3 py-3 text-sm">Sem versões ainda</div>
                ) : (
                  <ul className="py-1">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/50">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">v{v.versao} — {v.nome || "Sem nome"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(v.criado_em).toLocaleString()}
                          </span>
                        </div>
                        <button
                          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
                          onClick={() => id && restoreVersion(id, v.versao)}
                          title={`Restaurar v${v.versao}`}
                        >
                          Restaurar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {/* ▲▲▲ Dropdown de versões */}

          <button
            className="px-3 py-1.5 rounded bg-secondary text-secondary-foreground shadow"
            onClick={openXmlPreview}
            title="Visualizar XML"
          >
            Ver XML
          </button>

          <button
            className="px-3 py-1.5 rounded bg-accent text-accent-foreground shadow"
            onClick={handleGenerateMapping}
            title="Gerar Mapeamento (n8n)"
          >
            Gerar Mapeamento (n8n)
          </button>

          {/* input oculto para import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".bpmn,.xml"
            className="hidden"
            onChange={onImportFile}
          />
        </div>
      </div>

      {/* Painel de Propriedades — SEMPRE montado */}
      <div className={panelOpen ? "relative border-l bg-background opacity-100" : "relative border-l bg-background opacity-0 pointer-events-none"}>
        {/* handle de resize */}
        <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize z-30" onMouseDown={startDrag} />
        <div className="h-full overflow-auto">
          <PlmProperties getModeler={() => modelerRef.current} />
        </div>
      </div>

      {/* Modal Ver XML */}
      {xmlPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded shadow flex flex-col">
            <div className="flex justify-between items-center p-2 border-b">
              <div className="font-semibold">XML atual</div>
              <button className="px-2 py-1 rounded bg-neutral-200" onClick={() => setXmlPreview("")}>
                Fechar
              </button>
            </div>
            <textarea className="flex-1 w-full p-2 font-mono text-xs border-0" value={xmlPreview} readOnly />
          </div>
        </div>
      )}
    </main>
  );
}
