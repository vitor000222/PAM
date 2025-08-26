import { useEffect, useMemo, useState } from "react";

type Props = { getModeler: () => any };

type Mapping = { a: string; b: string };
type Criterion = { given: string; when: string; then: string };
type Stage = { name: string; description: string; access: string };

export default function PlmProperties({ getModeler }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [type, setType] = useState<string>("");
  const [fields, setFields] = useState<Record<string, any>>({});

  useEffect(() => {
    const modeler = getModeler();
    if (!modeler) return;
    const eventBus = modeler.get('eventBus');
    const onSel = (e: any) => {
      const el = e.newSelection?.[0] || null;
      setSelected(el || null);
      const bo = el?.businessObject;
      const t = bo?.$type || "";
      setType(t);
      if (!t?.startsWith('plm:')) { setFields({}); return; }

      const next: Record<string, any> = {};
      if (t === "plm:IntegrationTask") {
        next.systemA = bo.systemA || "";
        next.direction = bo.direction || "";
        next.systemB = bo.systemB || "";
        try { next.fieldMappings = bo.fieldMappings ? JSON.parse(bo.fieldMappings) : Array.from({length:10},()=>({a:"",b:""})); }
        catch { next.fieldMappings = Array.from({length:10},()=>({a:"",b:""})); }
      } else if (t === "plm:ApplicationTask") {
        next.description = bo.description || "";
        try { next.acceptanceCriteria = bo.acceptanceCriteria ? JSON.parse(bo.acceptanceCriteria) : [ { given:"", when:"", then:"" } ]; }
        catch { next.acceptanceCriteria = [ { given:"", when:"", then:"" } ]; }
      } else if (t === "plm:AutomationTask") {
        next.description = bo.description || "";
        next.entity = bo.entity || "";
        next.trigger = bo.trigger || "";
        next.filter = bo.filter || "";
        next.action = bo.action || "";
      } else if (t === "plm:FunnelSubProcess") {
        next.funnelName = bo.funnelName || (bo.name || "");
        next.stagesCount = bo.stagesCount || 0;
        try { next.stages = bo.stages ? JSON.parse(bo.stages) : []; }
        catch { next.stages = []; }
        if ((next.stages?.length || 0) < (next.stagesCount || 0)) {
          const missing = (next.stagesCount || 0) - (next.stages?.length || 0);
          next.stages = [...(next.stages||[]), ...Array.from({length:missing},()=>({name:"", description:"", access:""}))];
        }
      } else if (t === "plm:ApprovalTask") {
        next.description = bo.description || "";
        next.entity = bo.entity || "";
        next.field = bo.field || "";
        next.operator = bo.operator || "";
        next.approvers = bo.approvers || "";
      }
      setFields(next);
    };
    eventBus.on('selection.changed', onSel);
    return () => eventBus.off('selection.changed', onSel);
  }, [getModeler]);

  const update = (k: string, v: any) => setFields(s => ({ ...s, [k]: v }));
  const apply = () => {
    const modeler = getModeler();
    const modeling = modeler.get('modeling');
    const boUpdates: Record<string, any> = { ...fields };

    if (type === "plm:IntegrationTask") boUpdates.fieldMappings = JSON.stringify(fields.fieldMappings || []);
    if (type === "plm:ApplicationTask") boUpdates.acceptanceCriteria = JSON.stringify(fields.acceptanceCriteria || []);
    if (type === "plm:FunnelSubProcess") {
      boUpdates.stages = JSON.stringify(fields.stages || []);
      if (fields.funnelName) boUpdates.name = fields.funnelName; // sincroniza o rótulo
    }

    modeling.updateProperties(selected, boUpdates);
  };

  if (!selected) return <div className="text-sm text-neutral-600 p-3">Selecione um elemento.</div>;
  const isPlm = type?.startsWith('plm:');

  return (
    <div className="w-[360px] border-l p-3 space-y-2">
      <div className="font-semibold">Propriedades</div>
      <div className="text-xs text-neutral-500 break-all">{type || "—"}</div>

      {!isPlm && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-400 p-2 rounded">
          Este painel configura elementos <b>To-Be (plm:*)</b>.
        </div>
      )}

      {type === "plm:IntegrationTask" && <IntegrationProps fields={fields} onChange={update} />}
      {type === "plm:ApplicationTask" && <ApplicationProps fields={fields} onChange={update} />}
      {type === "plm:AutomationTask" && <AutomationProps fields={fields} onChange={update} />}
      {type === "plm:FunnelSubProcess" && <FunnelProps fields={fields} onChange={update} />}
      {type === "plm:ApprovalTask" && <ApprovalProps fields={fields} onChange={update} />}

      <button className="mt-1 px-3 py-1.5 rounded bg-blue-600 text-white" onClick={apply}>
        Salvar propriedades
      </button>
    </div>
  );
}

function IntegrationProps({ fields, onChange }: any) {
  const mappings: Mapping[] = useMemo(() => {
    const cur: Mapping[] = fields.fieldMappings || [];
    if (cur.length < 10) return [...cur, ...Array.from({length:10-cur.length},()=>({a:"",b:""}))];
    return cur.slice(0, 10);
  }, [fields.fieldMappings]);

  return (
    <div className="space-y-3">
      <Section title="Vias de integração">
        <div className="grid grid-cols-3 gap-2 items-end">
          <Field label="Sistema A" value={fields.systemA||""} onChange={(v)=>onChange("systemA", v)} />
          <div className="text-xs text-neutral-600">Direção</div>
          <Select value={fields.direction||""} onChange={(v)=>onChange("direction", v)}
                  options={[{value:"",label:"—"},{value:"in",label:"in"},{value:"out",label:"out"},{value:"bidir",label:"bidir"}]} />
          <div className="col-span-3 grid grid-cols-3 gap-2">
            <div></div><div></div>
            <Field label="Sistema B" value={fields.systemB||""} onChange={(v)=>onChange("systemB", v)} />
          </div>
        </div>
      </Section>

      <Section title="Mapeamento de campos">
        <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 font-semibold">
          <div>Campos Sistema A</div><div>Campos Sistema B</div>
        </div>
        <div className="space-y-1">
          {mappings.map((m, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2">
              <input className="border rounded px-2 py-1" placeholder="ex.: Contato" value={m.a}
                     onChange={e=>{ const next = [...mappings]; next[idx] = { ...next[idx], a: e.target.value }; onChange("fieldMappings", next); }} />
              <input className="border rounded px-2 py-1" placeholder="ex.: contact" value={m.b}
                     onChange={e=>{ const next = [...mappings]; next[idx] = { ...next[idx], b: e.target.value }; onChange("fieldMappings", next); }} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ApplicationProps({ fields, onChange }: any) {
  const criteria: Criterion[] = fields.acceptanceCriteria || [ { given:"", when:"", then:"" } ];
  const add = () => onChange("acceptanceCriteria", [...criteria, { given:"", when:"", then:"" }]);
  const updateItem = (i: number, k: keyof Criterion, v: string) => {
    const next = criteria.map((c: Criterion, idx: number) => idx===i? { ...c, [k]: v } : c);
    onChange("acceptanceCriteria", next);
  };
  const remove = (i: number) => {
    const next = criteria.filter((_: any, idx: number) => idx !== i);
    onChange("acceptanceCriteria", next.length? next : [ { given:"", when:"", then:"" } ]);
  };

  return (
    <div className="space-y-3">
      <Section title="Descrição da aplicação">
        <textarea className="border rounded px-2 py-1 h-24" value={fields.description||""}
                  onChange={e=>onChange("description", e.target.value)} />
      </Section>
      <Section title="Critérios de aceite">
        <div className="space-y-2">
          {criteria.map((c, i) => (
            <div key={i} className="border bg-neutral-50 rounded p-2 space-y-2">
              <Field label="Dado" value={c.given} onChange={(v)=>updateItem(i,"given",v)} />
              <Field label="Quando" value={c.when} onChange={(v)=>updateItem(i,"when",v)} />
              <Field label="Então" value={c.then} onChange={(v)=>updateItem(i,"then",v)} />
              <button className="text-xs text-red-600" onClick={()=>remove(i)}>Remover</button>
            </div>
          ))}
          <button className="px-2 py-1 rounded bg-emerald-600 text-white text-xs" onClick={add}>Adicionar critério</button>
        </div>
      </Section>
    </div>
  );
}

function AutomationProps({ fields, onChange }: any) {
  return (
    <div className="space-y-2">
      <Field label="Descrição" value={fields.description||""} onChange={(v)=>onChange("description", v)} />
      <Field label="Entidade" value={fields.entity||""} onChange={(v)=>onChange("entity", v)} />
      <Field label="Gatilho" value={fields.trigger||""} onChange={(v)=>onChange("trigger", v)} />
      <Field label="Filtro" value={fields.filter||""} onChange={(v)=>onChange("filter", v)} />
      <Field label="Ação" value={fields.action||""} onChange={(v)=>onChange("action", v)} />
    </div>
  );
}

function FunnelProps({ fields, onChange }: any) {
  const count = Number(fields.stagesCount || 0);
  const stages: Stage[] = (fields.stages || []).slice(0, count);

  const setCount = (n: number) => {
    const cur: Stage[] = fields.stages || [];
    let next = cur.slice(0, n);
    if (next.length < n) next = [...next, ...Array.from({length: n - next.length}, ()=>({name:"", description:"", access:""}))];
    onChange("stagesCount", n);
    onChange("stages", next);
  };

  return (
    <div className="space-y-3">
      <Field label="Nome do funil" value={fields.funnelName||""} onChange={(v)=>onChange("funnelName", v)} />
      <div className="text-xs text-neutral-600 mb-1">Número de etapas</div>
      <select className="border rounded px-2 py-1" value={count} onChange={e=>setCount(Number(e.target.value))}>
        <option value={0}>0</option>
        {Array.from({length:10},(_,i)=>i+1).map(n=>(<option key={n} value={n}>{n}</option>))}
      </select>

      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={i} className="border rounded p-2 bg-neutral-50 space-y-2">
            <Field label="Nome da etapa" value={s.name} onChange={(v)=>{
              const next = [...stages]; next[i] = { ...next[i], name: v }; onChange("stages", next);
            }} />
            <Field label="Descrição da etapa" value={s.description} onChange={(v)=>{
              const next = [...stages]; next[i] = { ...next[i], description: v }; onChange("stages", next);
            }} />
            <Field label="Quem poderá acessar?" value={s.access} onChange={(v)=>{
              const next = [...stages]; next[i] = { ...next[i], access: v }; onChange("stages", next);
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalProps({ fields, onChange }: any) {
  return (
    <div className="space-y-2">
      <Field label="Descrição" value={fields.description||""} onChange={(v)=>onChange("description", v)} />
      <Field label="Entidade" value={fields.entity||""} onChange={(v)=>onChange("entity", v)} />
      <Field label="Campo" value={fields.field||""} onChange={(v)=>onChange("field", v)} />
      <Field label="Operador lógico" value={fields.operator||""} onChange={(v)=>onChange("operator", v)} />
      <Field label="Aprovadores" value={fields.approvers||""} onChange={(v)=>onChange("approvers", v)} />
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <section className="space-y-2">
      <div className="text-xs text-neutral-600">{title}</div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string)=>void }) {
  return (
    <label className="block text-sm">
      <div className="text-xs text-neutral-600 mb-1">{label}</div>
      <input className="w-full border rounded px-2 py-1" value={value} onChange={e=>onChange(e.target.value)} />
    </label>
  );
}
function Select({ value, onChange, options }:{ value:string; onChange:(v:string)=>void; options:{value:string,label:string}[] }) {
  return (
    <select className="w-full border rounded px-2 py-1" value={value} onChange={e=>onChange(e.target.value)}>
      {options.map(o=>(<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
}
