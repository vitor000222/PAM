// src/modeler/modules/ploomes-renderer.ts
import BaseRenderer from "diagram-js/lib/draw/BaseRenderer";
import { append as svgAppend, create as svgCreate } from "tiny-svg";

// Carrega ícones dinamicamente; se um arquivo estiver ausente, o renderer usa fallback
const _ICON_URLS = import.meta.glob("@/assets/ploomes/*.{png,svg}", { eager: true, as: "url" }) as Record<string, string>;

function icon(name: string): string | undefined {
  const key1 = `/src/assets/ploomes/${name}`;
  const key2 = `src/assets/ploomes/${name}`;
  return _ICON_URLS[key1] || _ICON_URLS[key2];
}

const ICONS: Record<string, string | undefined> = {
  "plm:IntegrationTask"  : icon("integration.png"),
  "plm:AutomationTask"   : icon("automation.png"),
  "plm:ApplicationTask"  : icon("application.png"),
  "plm:ApprovalTask"     : icon("approval.png"),
  "plm:FunnelSubProcess" : icon("funnel.png"),
  "bpmn:UserTask": icon("user-task.png"),
  "bpmn:Task"    : icon("task.png")
};


export default {
  __init__: ["ploomesRenderer"],
  ploomesRenderer: ["type", PloomesRenderer],
};

PloomesRenderer.$inject = ["eventBus", "bpmnRenderer", "textRenderer"];

function PloomesRenderer(this: any, eventBus: any, bpmnRenderer: any, textRenderer: any) {
  // prioridade alta para sobrepor o renderer padrão
  BaseRenderer.call(this, eventBus, 2000);

  this.canRender = function(element: any) {
    const t = element?.businessObject?.$type || "";
    // renderiza plm:*, Task e UserTask
    return t.startsWith("plm:") || t === "bpmn:Task" || t === "bpmn:UserTask";
  };

  this.drawShape = function(parentGfx: any, element: any) {
    const bo   = element.businessObject;
    const type = bo.$type as string;
    const href = ICONS[type];

    const g = svgCreate("g");
    svgAppend(parentGfx, g);

    const W = element.width, H = element.height;

    // imagem ocupa todo o shape (sem padding → docking encosta na borda visual)
    if (href) {
      const img = svgCreate("image");
      img.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
      img.setAttribute("x", "0");
      img.setAttribute("y", "0");
      img.setAttribute("width", String(W));
      img.setAttribute("height", String(H));
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svgAppend(g, img);
    } else {
      // fallback simples
      const rect = svgCreate("rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("rx", "8");
      rect.setAttribute("ry", "8");
      rect.setAttribute("width", String(W));
      rect.setAttribute("height", String(H));
      rect.setAttribute("fill", "#f3f4f6");
      rect.setAttribute("stroke", "#9ca3af");
      svgAppend(g, rect);
    }

    // label centralizado (cor #1E0C45, bold) e com classe djs-label (some durante edição inline)
    const label = bo.name || "";
    if (label) {
      const text = textRenderer.createText(label, {
        box: { x: 0, y: 0, width: W, height: H },
        align: "center-middle",
        padding: 0,
        style: { fontSize: 12, fill: "#1E0C45", fontWeight: "bold" }
      });
      const prev = text.getAttribute("class") || "";
      text.setAttribute("class", (prev + " djs-label").trim());
      text.setAttribute("pointer-events", "none");
      svgAppend(g, text);
    }

    // hitbox invisível (drag/seleção confiáveis)
    const hit = svgCreate("rect");
    hit.setAttribute("x", "0");
    hit.setAttribute("y", "0");
    hit.setAttribute("width", String(W));
    hit.setAttribute("height", String(H));
    hit.setAttribute("fill", "transparent");
    svgAppend(g, hit);

    return g;
  };

  // usa o contorno nativo → docking das conexões perfeito (não cruza o shape)
  this.getShapePath = function(element: any) {
    return bpmnRenderer.getShapePath(element);
  };

  // conexões continuam com o renderer padrão
  this.drawConnection = function(parentGfx: any, connection: any) {
    return bpmnRenderer.drawConnection(parentGfx, connection);
  };
}
(PloomesRenderer as any).prototype = Object.create(BaseRenderer.prototype);
(PloomesRenderer as any).prototype.constructor = PloomesRenderer;
