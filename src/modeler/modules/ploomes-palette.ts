// src/modeler/modules/ploomes-palette.ts

export default {
  __init__: ['ploomesPalette'],
  ploomesPalette: ['type', PloomesPalette],
};

function PloomesPalette(
  this: any,
  create: any,
  elementFactory: any,
  palette: any,
  translate: any,
  bpmnFactory: any
) {
  this.create = create;
  this.elementFactory = elementFactory;
  this.translate = translate;
  this.bpmnFactory = bpmnFactory;

  palette.registerProvider(this);
}
PloomesPalette.$inject = ['create', 'elementFactory', 'palette', 'translate', 'bpmnFactory'];

const TASK_W = 100;
const TASK_H = 80;

/* ============================================================
 * Helpers de criação
 * ========================================================== */

// cria elementos do nosso namespace plm:*
PloomesPalette.prototype._create = function(type: string, event: any) {
  const { elementFactory, create, bpmnFactory } = this;

  let bo: any;
  let shape: any;

  if (type === 'plm:FunnelSubProcess') {
    // Funil = SubProcesso colapsado, do tamanho de uma tarefa
    bo = bpmnFactory.create(type, { name: 'Funil' });
    shape = elementFactory.createShape({
      type: 'bpmn:SubProcess',
      isExpanded: false,
      businessObject: bo,
      width: TASK_W,
      height: TASK_H,
    });
  } else {
    // Demais plm:* são desenhados como Task
    bo = bpmnFactory.create(type, { name: type.replace('plm:', '') });
    shape = elementFactory.createShape({
      type: 'bpmn:Task',
      businessObject: bo,
      width: TASK_W,
      height: TASK_H,
    });
  }

  create.start(event, shape);
};

// cria elementos BPMN nativos (ex.: bpmn:Task, bpmn:UserTask)
PloomesPalette.prototype._createBpmn = function(type: string, event: any) {
  const { elementFactory, create, bpmnFactory } = this;

  const bo = bpmnFactory.create(type, { name: type.replace('bpmn:', '') });
  const shape = elementFactory.createShape({
    type,
    businessObject: bo,
    width: TASK_W,
    height: TASK_H,
  });

  create.start(event, shape);
};

// (opcional) cria uma nova Pool/Participant no nível Collaboration
PloomesPalette.prototype._createParticipant = function(event: any) {
  const { elementFactory, create, bpmnFactory } = this;

  const bo = bpmnFactory.create('bpmn:Participant', { name: 'Nova Pool' });
  const shape = elementFactory.createShape({
    type: 'bpmn:Participant',
    businessObject: bo,
  });

  create.start(event, shape);
};

/* ============================================================
 * Entradas da Paleta
 * ========================================================== */

PloomesPalette.prototype.getPaletteEntries = function() {
  // Entradas com classes custom para usar ícones próprios via CSS
  const mkPlm = (type: string, title: string, cls: string) => ({
    group: 'activity',
    className: `entry-icon ${cls}`,
    title,
    action: {
      dragstart: (e: any) => this._create(type, e),
      click:     (e: any) => this._create(type, e),
    },
  });

  const mkBpmn = (type: string, title: string, cls: string) => ({
    group: 'activity',
    className: `entry-icon ${cls}`,
    title,
    action: {
      dragstart: (e: any) => this._createBpmn(type, e),
      click:     (e: any) => this._createBpmn(type, e),
    },
  });

  const entries: Record<string, any> = {
    // ===== nossos elementos To-Be (plm:*) =====
    'plm-integration': mkPlm('plm:IntegrationTask',  'Integração',  'ico-integration'),
    'plm-automation' : mkPlm('plm:AutomationTask',   'Automação',   'ico-automation'),
    'plm-application': mkPlm('plm:ApplicationTask',  'Aplicação',   'ico-application'),
    'plm-approval'   : mkPlm('plm:ApprovalTask',     'Aprovação',   'ico-approval'),
    'plm-funnel'     : mkPlm('plm:FunnelSubProcess', 'Funil (Sub)', 'ico-funnel'),

    // ===== (opcionais) tarefas BPMN nativas com seus ícones =====
    // 'bpmn-user-task': mkBpmn('bpmn:UserTask', 'User Task', 'ico-user-task'),
    // 'bpmn-task'     : mkBpmn('bpmn:Task',     'Task',      'ico-task'),

    // ===== (opcional) criar Pool/Participant =====
    // 'bpmn-participant': {
    //   group: 'collaboration',
    //   className: 'entry-icon ico-participant',
    //   title: 'Criar Pool/Participant',
    //   action: {
    //     dragstart: (e: any) => this._createParticipant(e),
    //     click:     (e: any) => this._createParticipant(e),
    //   },
    // },
  };

  return entries;
};
