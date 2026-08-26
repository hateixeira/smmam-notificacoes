export const WORKFLOW_STAGES = [
  { id: "recebido", label: "Recebido", slaDays: 2 },
  { id: "triagem", label: "Triagem", slaDays: 5 },
  { id: "analise_tecnica", label: "Análise técnica", slaDays: 10 },
  { id: "vistoria", label: "Vistoria", slaDays: 10 },
  { id: "aguardando_complementacao", label: "Aguardando complementação", slaDays: 0 },
  { id: "parecer", label: "Parecer", slaDays: 7 },
  { id: "decisao", label: "Decisão", slaDays: 5 },
  { id: "deferido", label: "Deferido", slaDays: 0, terminal: true },
  { id: "indeferido", label: "Indeferido", slaDays: 0, terminal: true },
  { id: "arquivado", label: "Arquivado", slaDays: 0, terminal: true },
];

const STAGES_BY_ID = new Map(WORKFLOW_STAGES.map((stage) => [stage.id, stage]));

export function workflowStage(id) {
  return STAGES_BY_ID.get(id) ?? STAGES_BY_ID.get("recebido");
}

export function workflowLabel(id) {
  return workflowStage(id).label;
}

export function calculateSlaDueDate(stageId, from = new Date()) {
  const days = workflowStage(stageId).slaDays;
  if (!days) return null;
  const due = new Date(from);
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

export function slaClassification(record, today = new Date()) {
  if (!record?.prazoSlaEm) return "sem_prazo";
  const due = new Date(`${record.prazoSlaEm}T23:59:59`);
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);
  if (Number.isNaN(due.getTime())) return "sem_prazo";
  if (due < now) return "vencido";
  const near = new Date(now);
  near.setDate(near.getDate() + 2);
  return due <= near ? "proximo" : "no_prazo";
}

export function allowedTransition(from, to) {
  const fromStage = workflowStage(from);
  const toStage = workflowStage(to);
  if (fromStage.terminal) return false;
  return Boolean(toStage);
}
