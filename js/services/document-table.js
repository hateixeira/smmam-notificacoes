import { safeText } from "../core/sanitize.js";
import { slaClassification, workflowLabel } from "../core/workflow.js";
import { formatDeadline, legalDeadlineClassification, legalDeadlineForRecord } from "../core/legal-deadlines.js";

function cell(row, className = "") {
  const element = document.createElement("td");
  if (className) element.className = className;
  row.appendChild(element);
  return element;
}

function action(label, callback, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.style.cssText = "border:0;background:transparent;color:#1b365d;cursor:pointer;padding:0;margin-right:8px;font-size:12px;text-decoration:underline;";
  button.addEventListener("click", callback);
  return button;
}

function statusBox(text, colors) {
  const box = document.createElement("div");
  box.textContent = text;
  box.style.cssText = `padding:4px;text-align:center;font-size:11px;font-weight:bold;border-radius:4px;border:1px solid ${colors.border};background:${colors.background};color:${colors.color};`;
  return box;
}

export function renderDocumentRows(body, records, callbacks) {
  body.replaceChildren();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  records.forEach((record) => {
    const row = document.createElement("tr");
    const selectCell = cell(row);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.className = "select-item"; checkbox.value = record.firebaseId;
    checkbox.addEventListener("click", (event) => callbacks.onSelect(event, checkbox));
    selectCell.appendChild(checkbox);

    const typeCell = cell(row);
    const typeBadge = document.createElement("span");
    typeBadge.className = record.tipoDocumento === "auto" ? "badge-tipo-auto" : "badge-tipo-notif";
    typeBadge.textContent = record.tipoDocumento === "auto" ? "MULTA / AUTO" : "NOTIFICAÇÃO";
    typeCell.appendChild(typeBadge);

    const numberCell = cell(row);
    const number = document.createElement("strong"); number.textContent = safeText(record.numNotif, "SEM NÚMERO"); numberCell.appendChild(number);

    const targetCell = cell(row);
    const name = document.createElement("div"); name.style.cssText = "font-weight:bold;color:#1b365d;"; name.textContent = `${safeText(record.nome, "DADOS PENDENTES").toUpperCase()}${record.qtdFotosSalvas ? ` 📷(${record.qtdFotosSalvas})` : ""}`;
    const address = document.createElement("div"); address.style.cssText = "font-size:11px;color:#64748b;margin-top:2px;"; address.textContent = safeText(record.loteEndereco, "Endereço não informado"); targetCell.append(name, address);

    const statusCell = cell(row);
    if (record.statusProcesso === "arquivado") {
      statusCell.appendChild(statusBox("📂 ARQUIVADO", { background: "#f1f5f9", border: "#cbd5e1", color: "#475569" }));
      if (record.motivoArquivamento) { const reason = document.createElement("small"); reason.textContent = record.motivoArquivamento; statusCell.appendChild(reason); }
    } else {
      if (record.statusNotificacao === "rascunho") statusCell.appendChild(statusBox("📝 RASCUNHO", { background: "#fef3c7", border: "#fde68a", color: "#b45309" }));
      if (record.statusNotificacao === "enviado_ar") statusCell.appendChild(statusBox("📬 ENVIADO POR AR", { background: "#e0f2fe", border: "#bae6fd", color: "#0369a1" }));
      if ((record.statusNotificacao === "recebido" && record.dataRecebimento) || (record.tipoDocumento === "auto" && record.dataCienciaAuto)) statusCell.appendChild(statusBox("✅ CIÊNCIA DADA", { background: "#dcfce7", border: "#bbf7d0", color: "#166534" }));
      if (record.tipoDocumento !== "auto" && record.statusNotificacao === "recebido" && !record.dataRecebimento) statusCell.appendChild(statusBox("AR ENTREGUE · CONFIRMAR DATA", { background: "#fef3c7", border: "#fde68a", color: "#b45309" }));
      if (record.tipoDocumento === "auto" && !record.dataCienciaAuto) statusCell.appendChild(statusBox("CIÊNCIA PENDENTE", { background: "#fef3c7", border: "#fde68a", color: "#b45309" }));
      if (record.codigoAR) {
        const ar = document.createElement("div"); ar.style.cssText = "margin-top:5px;background:#f8fafc;color:#475569;padding:4px;border-radius:4px;border:1px solid #cbd5e1;text-align:center;font-size:10px;font-weight:bold;"; ar.textContent = `AR: ${record.codigoAR} `;
        ar.appendChild(action("Consultar", () => callbacks.onAr(record), "ar-action")); statusCell.appendChild(ar);
      }
      const legal = legalDeadlineForRecord(record);
      const legalStatus = legalDeadlineClassification(record, today);
      const legalTag = document.createElement("div"); legalTag.style.marginTop = "5px";
      legalTag.textContent = legal.due ? `${legal.label}: ${formatDeadline(legal.due)}${legalStatus === "vencido" ? " · vencido" : legalStatus === "proximo" ? " · próximo" : ""}` : `${legal.label}: aguarda ciência`;
      legalTag.className = legalStatus === "vencido" ? "badge-vencido" : "badge-prazo"; statusCell.appendChild(legalTag);
      if (record.tipoDocumento !== "auto" && legalStatus === "vencido") statusCell.appendChild(action("Autuar", callbacks.onAutuar, "btn-autuar"));
      const workflow = document.createElement("div"); workflow.style.cssText = "margin-top:5px;font-size:10px;color:#334155;"; const sla = slaClassification(record); workflow.textContent = `Fluxo: ${workflowLabel(record.statusTramitacao)} · ${sla === "vencido" ? "SLA vencido" : sla === "proximo" ? "SLA próximo" : sla === "no_prazo" ? "SLA no prazo" : "SLA suspenso"}`; statusCell.append(workflow, action("Tramitar", () => callbacks.onMoveStage(record.firebaseId)));
    }

    const actions = cell(row, "action-links");
    actions.append(action("Editar", () => callbacks.onEdit(record.firebaseId)), action("Imprimir", () => callbacks.onPrint(record.firebaseId)));
    if (record.statusProcesso !== "arquivado") actions.append(action("Arquivar", () => callbacks.onArchive(record.firebaseId)));
    body.appendChild(row);
  });
}
