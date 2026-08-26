export function escapeHtml(value) {
  return String(value ?? "—").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

export function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^\w\s]/gi, "")
    .trim();
}

export function appendTextCell(row, value, { strong = false, className = "" } = {}) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  const content = strong ? document.createElement("strong") : document.createElement("span");
  content.textContent = safeText(value);
  cell.appendChild(content);
  row.appendChild(cell);
  return cell;
}
