export default { __init__: ['ploomesBadges'], ploomesBadges: ['type', PloomesBadges] };
function PloomesBadges(this: any, eventBus: any, overlays: any) {
  const add = (el: any) => {
    const t = el?.businessObject?.$type as string;
    if (!t || !t.startsWith('plm:')) return;
    overlays.remove({ element: el });
    const label = ({'plm:IntegrationTask':'INT','plm:AutomationTask':'AUT','plm:ApprovalTask':'APR','plm:ApplicationTask':'APP','plm:FunnelSubProcess':'FUNIL'} as any)[t]||'PLM';
    const node = document.createElement('div');
    node.style.cssText='background:#0ea5e9;color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.2)';
    node.textContent = label;
    overlays.add(el, { position: { top: -8, left: -8 }, html: node });
  };
  eventBus.on('shape.added', (e: any) => add(e.element));
  eventBus.on('element.changed', (e: any) => add(e.element));
}
PloomesBadges.$inject = ['eventBus', 'overlays'];
