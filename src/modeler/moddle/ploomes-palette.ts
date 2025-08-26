export default {
  __init__: ['ploomesPalette'],
  ploomesPalette: ['type', PloomesPalette],
};

function PloomesPalette(this: any, create: any, elementFactory: any, palette: any, translate: any, bpmnFactory: any) {
  this.create = create;
  this.elementFactory = elementFactory;
  this.translate = translate;
  this.bpmnFactory = bpmnFactory;
  palette.registerProvider(this);
}
PloomesPalette.$inject = ['create', 'elementFactory', 'palette', 'translate', 'bpmnFactory'];

PloomesPalette.prototype.getPaletteEntries = function() {
  const mk = (id: string, type: string, label: string) => ({
    group: 'activity',
    className: 'bpmn-icon-task',
    title: `${label} (${type})`,
    action: {
      dragstart: (event: any) => this._create(type, event),
      click: (event: any) => this._create(type, event)
    }
  });

  return {
    'plm-integration': mk('plm-integration', 'plm:IntegrationTask', 'Integração'),
    'plm-automation' : mk('plm-automation',  'plm:AutomationTask',  'Automação'),
    'plm-approval'   : mk('plm-approval',    'plm:ApprovalTask',    'Aprovação'),
    'plm-application': mk('plm-application', 'plm:ApplicationTask', 'Aplicação'),
    'plm-funnel'     : mk('plm-funnel',      'plm:FunnelSubProcess','Funil (Sub)')
  };
};

PloomesPalette.prototype._create = function(type: string, event: any) {
  const { elementFactory, create, bpmnFactory } = this;
  let bo: any, shape: any;

  if (type === 'plm:FunnelSubProcess') {
    bo = bpmnFactory.create(type, { name: 'Funil' });
    shape = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: true, businessObject: bo });
  } else {
    bo = bpmnFactory.create(type, { name: type.replace('plm:', '') });
    shape = elementFactory.createShape({ type: 'bpmn:Task', businessObject: bo });
  }
  create.start(event, shape);
};
