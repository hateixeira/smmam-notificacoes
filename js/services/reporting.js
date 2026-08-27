import { workflowLabel, slaClassification } from "../core/workflow.js";
import { legalDeadlineClassification, legalDeadlineForRecord } from "../core/legal-deadlines.js";

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function download(name, content, mime = "text/csv;charset=utf-8;") {
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportManagementReport(records, sector) {
  const header = ["Número", "Tipo", "Etapa", "SLA", "Prazo SLA", "Prazo legal", "Data limite legal", "Situação prazo legal", "Base legal", "Bairro", "Equipe", "Fiscal", "Situação", "Data de emissão"];
  const rows = records.map((record) => { const legal = legalDeadlineForRecord(record); return [
    record.numNotif,
    record.tipoDocumento,
    workflowLabel(record.statusTramitacao),
    slaClassification(record),
    record.prazoSlaEm,
    legal.label,
    legal.due,
    legalDeadlineClassification(record),
    legal.article,
    record.bairro,
    record.territorioEquipe ? `Equipe ${record.territorioEquipe}` : "Não definida",
    record.fiscal,
    record.statusProcesso,
    record.dataNotif,
  ]; });
  download(`Relatorio_Gerencial_${sector}_${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n"));
}
