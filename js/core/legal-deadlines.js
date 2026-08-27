export const LEGAL_DEADLINES = Object.freeze({
  notificationRegularization: { days: 60, article: "Art. 25, LC Municipal nº 6/1996 (redação da LC nº 245/2023)", label: "Regularização" },
  autoDefense: { days: 8, article: "Art. 28, LC Municipal nº 6/1996", label: "Defesa escrita" },
  autoPayment: { days: 8, article: "Art. 29, §1º, LC Municipal nº 6/1996", label: "Pagamento da multa" },
});

function localDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function addCalendarDays(isoDate, days) {
  const value = localDate(isoDate);
  if (!value || !Number.isInteger(days) || days < 0) return null;
  value.setDate(value.getDate() + days);
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

export function legalDeadlineForRecord(record) {
  if (record?.tipoDocumento === "auto") {
    const days = Number(record.prazoDefesaDias) || LEGAL_DEADLINES.autoDefense.days;
    const due = record.prazoDefesaEm || addCalendarDays(record.dataCienciaAuto, days);
    return { ...LEGAL_DEADLINES.autoDefense, days, due, start: record.dataCienciaAuto || null, status: record.statusDefesa || null };
  }
  const days = Number(record?.prazoRegularizacaoDias || record?.prazoDias) || LEGAL_DEADLINES.notificationRegularization.days;
  const due = record?.prazoRegularizacaoEm || addCalendarDays(record?.dataRecebimento, days);
  return { ...LEGAL_DEADLINES.notificationRegularization, days, due, start: record?.dataRecebimento || null, status: record?.statusRegularizacao || null };
}

export function legalDeadlineClassification(record, today = new Date()) {
  const deadline = legalDeadlineForRecord(record);
  if (!deadline.due) return "sem_ciencia";
  const due = localDate(deadline.due);
  const now = new Date(today); now.setHours(0, 0, 0, 0);
  if (!due) return "sem_ciencia";
  if (due < now) return "vencido";
  const warning = new Date(now); warning.setDate(warning.getDate() + 5);
  return due <= warning ? "proximo" : "no_prazo";
}

export function formatDeadline(isoDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || "")) ? isoDate.split("-").reverse().join("/") : "aguarda ciência";
}
