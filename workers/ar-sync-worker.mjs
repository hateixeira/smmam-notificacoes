const PROJECT_ID = "smmam-fiscalizacao-tb";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PROVIDER_URL = "https://api.pacotevicio.dev/correios";
const ALLOWED_ORIGIN = "https://smmam-fiscalizacao-tb.web.app";
const MAX_PER_WINDOW = 8;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const REQUEST_SPACING_MS = 6_500;

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      "Vary": "Origin",
    },
  });
}

function toJs(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) return Object.fromEntries(Object.entries(value.mapValue?.fields || {}).map(([key, item]) => [key, toJs(item)]));
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(toJs);
  return null;
}

function fieldsToJs(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, toJs(value)]));
}

function tokenSubject(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload));
    return String(decoded.sub || "");
  } catch {
    return "";
  }
}

function getCurrentWindow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = values.weekday;
  const hour = Number(values.hour);
  const date = `${values.year}-${values.month}-${values.day}`;
  if (weekday === "Sat" || weekday === "Sun" || hour < 8) return null;
  return { date, slot: hour < 13 ? "manha" : "tarde" };
}

function normalizeTrackingCode(value) {
  const code = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code) ? code : null;
}

function interpretProviderResult(response) {
  const event = Array.isArray(response?.eventos) ? response.eventos[0] : null;
  const description = String(event?.descricao || event?.descricaoFrontEnd || "").trim();
  if (!description) throw new Error("O provedor não retornou eventos para este AR.");
  return {
    descricao: description,
    entregue: Boolean(response?.temEventoEntrega || event?.finalizador === "S"),
    dataEvento: event?.dtHrCriado?.date || null,
  };
}

async function firestoreDocument(token, collectionName, documentId) {
  const response = await fetch(`${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const document = await response.json();
  return fieldsToJs(document.fields || {});
}

async function profileFromToken(token) {
  const uid = tokenSubject(token);
  if (!uid) return null;
  const profile = await firestoreDocument(token, "usuarios", uid);
  if (!profile || profile.status !== "aprovado" || !profile.setor || profile.nivel === "leitor") return null;
  return { uid, ...profile };
}

async function validatedCandidates(token, sector, candidates) {
  const uniqueIds = new Set();
  const records = [];
  for (const item of Array.isArray(candidates) ? candidates.slice(0, MAX_PER_WINDOW) : []) {
    const id = String(item?.id || "");
    if (!id || uniqueIds.has(id)) continue;
    uniqueIds.add(id);
    const record = await firestoreDocument(token, "notificacoes", id);
    const code = normalizeTrackingCode(record?.codigoAR);
    if (!record || record.setor !== sector || !code) continue;
    if (["entregue", "devolvido"].includes(String(record.statusRetornoAR || "").toLowerCase())) continue;
    records.push({ id, codigoAR: code });
  }
  return records;
}

async function providerLookup(code, apiKey) {
  const response = await fetch(`${PROVIDER_URL}?tracking_code=${encodeURIComponent(code)}`, {
    headers: { "X-RapidAPI-Key": apiKey },
  });
  if (!response.ok) {
    const error = new Error(`PROVIDER_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return interpretProviderResult(await response.json());
}

async function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class ArSyncCoordinator {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const payload = await request.json();
    const now = Date.now();
    const existing = await this.ctx.storage.get("status");

    if (payload.action === "status") return json({ status: existing || null });

    if (payload.action === "reserve") {
      if (existing?.state === "running" && now - existing.startedAt < LOCK_TIMEOUT_MS) {
        return json({ reserved: false, reason: "running", status: existing });
      }
      if (existing?.state === "done") return json({ reserved: false, reason: "done", status: existing });
      const status = { state: "running", startedAt: now, date: payload.date, slot: payload.slot, sector: payload.sector };
      await this.ctx.storage.put("status", status);
      return json({ reserved: true, status });
    }

    if (payload.action === "complete") {
      const status = { ...payload.status, state: "done", completedAt: now };
      await this.ctx.storage.put("status", status);
      return json({ status });
    }

    return json({ error: "Ação não reconhecida." }, 400);
  }
}

async function coordinatorRequest(env, key, payload) {
  const id = env.AR_SYNC_COORDINATOR.idFromName(key);
  return env.AR_SYNC_COORDINATOR.get(id).fetch("https://coordinator.internal", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((response) => response.json());
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Max-Age": "600",
          "Vary": "Origin",
        },
      });
    }
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origem não autorizada." }, 403);

    const bearer = request.headers.get("Authorization") || "";
    const token = bearer.startsWith("Bearer ") ? bearer.slice(7) : "";
    if (!token) return json({ error: "Autenticação obrigatória." }, 401);

    const profile = await profileFromToken(token);
    if (!profile) return json({ error: "Perfil institucional sem permissão para sincronizar AR." }, 403);

    const url = new URL(request.url);
    const windowInfo = getCurrentWindow();

    if (request.method === "GET" && url.pathname === "/v1/status") {
      const today = windowInfo?.date || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
      const key = `${profile.setor}:${today}`;
      const status = await coordinatorRequest(env, key, { action: "status" });
      return json({ sector: profile.setor, window: windowInfo, ...status });
    }

    if (request.method !== "POST" || url.pathname !== "/v1/sync") return json({ error: "Rota não encontrada." }, 404);
    const body = await request.json();
    const manual = Boolean(body.manual);
    if (!manual && !windowInfo) return json({ executed: false, reason: "outside_business_window" });
    if (manual && profile.nivel !== "admin") return json({ error: "A sincronização manual é exclusiva de administradores." }, 403);
    if (!env.RAPIDAPI_AR_KEY) return json({ error: "Serviço de rastreamento ainda não foi configurado." }, 503);

    const date = windowInfo?.date || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const slot = manual ? `manual-${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date())}` : windowInfo.slot;
    const key = `${profile.setor}:${date}:${slot}`;
    const reservation = await coordinatorRequest(env, key, { action: "reserve", date, slot, sector: profile.setor });
    if (!reservation.reserved) return json({ executed: false, reason: reservation.reason, status: reservation.status });

    const records = await validatedCandidates(token, profile.setor, body.candidates);
    const results = [];
    let failures = 0;
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      try {
        const tracking = await providerLookup(record.codigoAR, env.RAPIDAPI_AR_KEY);
        results.push({ id: record.id, codigoAR: record.codigoAR, ok: true, tracking });
      } catch (error) {
        failures += 1;
        results.push({ id: record.id, codigoAR: record.codigoAR, ok: false, error: String(error?.message || "PROVIDER_ERROR") });
        if (error?.status === 429) break;
      }
      if (index < records.length - 1) await delay(REQUEST_SPACING_MS);
    }

    const summary = {
      date,
      slot,
      sector: profile.setor,
      requestedAt: new Date().toISOString(),
      consulted: results.length,
      updated: results.filter((item) => item.ok).length,
      failures,
      limit: MAX_PER_WINDOW,
    };
    const completed = await coordinatorRequest(env, key, { action: "complete", status: summary });
    return json({ executed: true, summary: completed.status, results });
  },
};
