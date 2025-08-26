export default {
  __init__: ['ploomesFunnelGuides'],
  ploomesFunnelGuides: ['type', PloomesFunnelGuides],
};

function PloomesFunnelGuides(this: any, eventBus: any, overlays: any) {
  const render = (el: any) => {
    const bo = el?.businessObject;
    if (!bo || bo.$type !== 'plm:FunnelSubProcess') return;

    // remove overlay antigo
    overlays.remove({ element: el, type: 'plm-funnel-guides' });

    const count = Number(bo.stagesCount || 0);
    if (!count || count < 1) return;

    let stages: Array<{ name?: string }> = [];
    try { stages = bo.stages ? JSON.parse(bo.stages) : []; } catch {}

    // container ocupando 100% do Subprocesso
    const node = document.createElement('div');
    node.style.cssText = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',           // não atrapalha cliques no diagrama
      'display:grid',
      `grid-template-columns: repeat(${count}, 1fr)`,
      'gap:0'
    ].join(';');

    for (let i = 0; i < count; i++) {
      const col = document.createElement('div');
      col.style.cssText = [
        'border-left:1px dashed rgba(3,7,18,.25)', // linha vertical sutil
        i === count - 1 ? 'border-right:1px dashed rgba(3,7,18,.25)' : '',
        'display:flex',
        'align-items:flex-start',
        'justify-content:center',
      ].join(';');

      // cabeçalho da etapa
      const label = document.createElement('div');
      label.textContent = stages[i]?.name || `Etapa ${i + 1}`;
      label.style.cssText = [
        'margin-top:4px',
        'padding:2px 6px',
        'background:rgba(59,130,246,.06)', // azul bem leve
        'border:1px solid rgba(59,130,246,.25)',
        'border-radius:6px',
        'font-size:11px',
        'color:#1f2937',
        'pointer-events:auto' // permite selecionar/copiar o texto
      ].join(';');
      col.appendChild(label);
      node.appendChild(col);
    }

    overlays.add(el, {
      position: { left: 0, top: 0 },
      html: node,
      type: 'plm-funnel-guides',
    });
  };

  // Atualiza quando cria/muda o elemento ou muda o canvas
  eventBus.on('shape.added',  (e: any) => render(e.element));
  eventBus.on('element.changed', (e: any) => render(e.element));
  eventBus.on('commandStack.changed', () => {/* em geral o element.changed já cobre */});
}
PloomesFunnelGuides.$inject = ['eventBus', 'overlays'];
