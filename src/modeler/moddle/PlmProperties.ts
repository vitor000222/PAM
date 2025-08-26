import { useEffect, useState } from "react";

type Props = { getModeler: () => any };

export default function PlmProperties({ getModeler }: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [fields, setFields] = useState<Record<string,string>>({});

  useEffect(() => {
    const modeler = getModeler();
    if (!modeler) return;
    const eventBus = modeler.get('eventBus');
    const onSel = (e: any) => {
      const el = e.newSelection?.[0] || null;
      setSelected(el || null);
      const bo = el?.businessObject;
      if (bo?.$type?.startsWith('plm:')) {
        const f: Record<string,string> = {};
        ["systemA","systemB","direction","notes","automationKind","trigger","actions","filters","rule","approvers","appName","repoUrl","funnelName","stages"].forEach(k=>{
          if (bo[k]!=null) f[k]=String(bo[k]);
        });
        setFields(f);
      } else {
        setFields({});
      }
    };
    eventBus.on('selection.changed', onSel);
    return () => eventBus.off('selection.changed', onSel);
  }, [getModeler]);

  if (!selected) return <div className="text-sm text-neutral-500 p-3">Selecione um elemento.</div>;

  const bo = selected.businessObject;
  const isPlm = bo?.$type?.startsWith('plm:');
  const type = bo?.$type || "—";

  const update = (k: string, v: string) => setFields(s => ({ ...s, [k]: v }));
  const apply = () => {
    const modeler = getModeler();
    const modeling = modeler.get('modeling');
    modeling.updateProperties(selected, fields);
  };

  return (
    <div className="w-80 border-l p-3 space-y-2">
      <div className="font-semibold">Propriedades</div>
      <div className="text-xs text-neutral-500 break-all">{type}</div>

      {!isPlm && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          Dica: use a paleta para criar elementos <b>plm:*</b> e editar aqui.
        </div>
      )}

      {/* Integração */}
      {type === "plm:IntegrationTask" && (
        <>
          <Field label="System A" v={fields.systemA||""} onChange={v=>update("systemA",v)} />
          <Field label="System B" v={fields.systemB||""} onChange={v=>update("systemB",v)} />
          <Field label="Direction (in/out/bidir)" v={fields.direction||""} onChange={v=>update("direction",v)} />
          <Area  label="Notes" v={fields.notes||""} onChange={v=>update("notes",v)} />
        </>
      )}

      {/* Automação */}
      {type === "plm:AutomationTask" && (
        <>
          <Field label="Automation Kind (generic/funnel)" v={fields.automationKind||""} onChange={v=>update("automationKind",v)} />
          <Area  label="Trigger" v={fields.trigger||""} onChange={v=>update("trigger",v)} />
          <Area  label="Actions" v={fields.actions||""} onChange={v=>update("actions",v)} />
          <Area  label="Filters" v={fields.filters||""} onChange={v=>update("filters",v)} />
        </>
      )}

      {/* Aprovação */}
      {type === "plm:ApprovalTask" && (
        <>
          <Area label="Rule" v={fields.rule||""} onChange={v=>update("rule",v)} />
          <Area label="Approvers" v={fields.approvers||""} onChange={v=>update("approvers",v)} />
        </>
      )}

      {/* Aplicação */}
      {type === "plm:ApplicationTask" && (
        <>
          <Field label="App Name" v={fields.appName||""} onChange={v=>update("appName",v)} />
          <Field label="Repo URL" v={fields.repoUrl||""} onChange={v=>update("repoUrl",v)} />
          <Area  label="Notes" v={fields.notes||""} onChange={v=>update("notes",v)} />
        </>
      )}

      {/* Funil */}
      {type === "plm:FunnelSubProcess" && (
        <>
          <Field label="Funnel Name" v={fields.funnelName||""} onChange={v=>update("funnelName",v)} />
          <Area  label="Stages (CSV)" v={fields.stages||""} onChange={v=>update("stages",v)} />
          {/* Futuro: botão "Gerar lanes" usando modeling.addLane(...) */}
        </>
      )}

      <button className="mt-2 px-3 py-1.5 rounded bg-blue-600 text-white" onClick={apply}>
        Salvar propriedades
      </button>
    </div>
  );
}

function Field({ label, v, onChange }: { label: string; v: string; onChange: (v:string)=>void }) {
  return (
    <label className="block text-sm">
      <div className="text-xs text-neutral-600 mb-1">{label}</div>
      <input className="w-full border rounded px-2 py-1" value={v} onChange={e=>onChange(e.target.value)} />
    </label>
  );
}
function Area({ label, v, onChange }: { label: string; v: string; onChange: (v:string)=>void }) {
  return (
    <label className="block text-sm">
      <div className="text-xs text-neutral-600 mb-1">{label}</div>
      <textarea className="w-full border rounded px-2 py-1 h-20" value={v} onChange={e=>onChange(e.target.value)} />
    </label>
  );
}
