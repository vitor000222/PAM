export default {
  __init__: ['plmFunnelOpenFixed'],
  plmFunnelOpenFixed: ['type', PlmFunnelOpenFixed],
};

function PlmFunnelOpenFixed(this: any, contextPad: any, elementRegistry: any, translate: any, canvas: any, selection: any, modeling: any, elementFactory: any, bpmnFactory: any) {

  const ensureCollaboration = () => {
    const root = canvas.getRootElement();
    const bo = root?.businessObject;
    if (bo?.$type === 'bpmn:Collaboration') return root;
    try {
      modeling.createParticipant(root);
      return canvas.getRootElement();
    } catch (e) {
      console.error('Falha ao criar Collaboration a partir do Process', e);
      return null;
    }
  };

  const ensureParticipantForFunnel = (funnelEl: any) => {
    const collab = ensureCollaboration();
    if (!collab) return null;

    const fbo = funnelEl.businessObject;
    if (fbo.linkedParticipantId) {
      const p = elementRegistry.get(fbo.linkedParticipantId);
      if (p) return p;
    }

    const defs = collab.businessObject.$parent; // bpmn:Definitions
    const processId = `Process_Funnel_${fbo.id}`;
    const processBo = bpmnFactory.create('bpmn:Process', { id: processId, isExecutable: false });
    defs.rootElements.push(processBo);

    const participantId = `Participant_Funnel_${fbo.id}`;
    const participantBo = bpmnFactory.create('bpmn:Participant', {
      id: participantId,
      name: fbo.funnelName || 'Funil',
      processRef: processBo
    });
    const participantShape = elementFactory.createShape({ type: 'bpmn:Participant', businessObject: participantBo });

    const parts = (collab.children || []).filter((c: any) => c.type === 'bpmn:Participant');
    const rightMost = parts.reduce((max: number, p: any) => Math.max(max, p.x + p.width), 0);
    const baseX = parts.length ? rightMost + 80 : 120;
    const baseY = parts.length ? parts[0].y : 80;
    const created = modeling.createShape(participantShape, { x: baseX + 480/2, y: baseY + 320/2 }, collab);

    try { modeling.updateProperties(funnelEl, { linkedParticipantId: participantId }); }
    catch { fbo.linkedParticipantId = participantId; }

    return created;
  };

  const zoomToElement = (el: any) => {
    try {
      const size = canvas.getSize && canvas.getSize();
      const padding = 40;
      const w = (size?.width || 1200) - padding * 2;
      const h = (size?.height || 800) - padding * 2;
      const scaleX = w / el.width;
      const scaleY = h / el.height;
      const scale = Math.max(0.2, Math.min(1.5, Math.min(scaleX, scaleY)));
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      canvas.zoom(scale, { x: cx, y: cy });
    } catch (e) {
      try { canvas.zoom('fit-viewport'); } catch {}
    }
    selection.select(el);
  };

  const ensureVerticalLanes = (participant: any, funnelEl: any) => {
    const fbo = funnelEl.businessObject;
    let count = Number(fbo.stagesCount || 0);
    let names: string[] = [];
    try {
      const stages = fbo.stages ? JSON.parse(fbo.stages) : [];
      if (!count && stages?.length) count = stages.length;
      names = (stages || []).map((s: any, i: number) => s?.name || `Etapa ${i+1}`);
    } catch {}
    if (!count || count < 1) { count = 3; names = Array.from({length:3}, (_,i)=>`Etapa ${i+1}`); }
    if (names.length < count) names = [...names, ...Array.from({length: count - names.length}, (_,i)=>`Etapa ${names.length + i + 1}`)];

    const minW = 900, minH = 300;
    const newBox = { x: participant.x, y: participant.y, width: Math.max(participant.width, minW), height: Math.max(participant.height, minH) };
    if (newBox.width !== participant.width || newBox.height !== participant.height) {
      modeling.resizeShape(participant, newBox);
    }

    const existing = (participant.children || []).filter((c: any) => c.type === 'bpmn:Lane');
    existing.forEach((ln: any) => { try { modeling.removeShape(ln); } catch {} });

    let lane = modeling.addLane(participant, 'left');
    modeling.updateProperties(lane, { name: names[0] });
    for (let i = 1; i < count; i++) {
      lane = modeling.addLane(lane, 'right');
      modeling.updateProperties(lane, { name: names[i] });
    }

    const lanes = (participant.children || []).filter((c: any) => c.type === 'bpmn:Lane');
    const colW = participant.width / count;
    lanes.forEach((ln: any, idx: number) => {
      modeling.resizeShape(ln, { x: participant.x + idx * colW, y: participant.y, width: colW, height: participant.height });
    });
  };

  this.getContextPadEntries = function(element: any) {
    const bo = element?.businessObject;
    if (!bo || bo.$type !== 'plm:FunnelSubProcess') return {};
    return {
      'plm-open-funnel-fixed': {
        group: 'edit',
        className: 'bpmn-icon-subprocess-collapsed',
        title: translate('Abrir diagrama do funil'),
        action: {
          click: () => {
            const collab = ensureCollaboration();
            if (!collab) return;
            const participant = ensureParticipantForFunnel(element);
            if (!participant) return;
            ensureVerticalLanes(participant, element);
            zoomToElement(participant);
          }
        }
      }
    };
  };
}
PlmFunnelOpenFixed.$inject = ['contextPad', 'elementRegistry', 'translate', 'canvas', 'selection', 'modeling', 'elementFactory', 'bpmnFactory'];
