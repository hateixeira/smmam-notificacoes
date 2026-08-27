const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();
const REGION = "southamerica-east1";
const validTypes = new Set(["notificacao", "auto"]);
const validStages = new Set(["recebido", "triagem", "analise_tecnica", "vistoria", "aguardando_complementacao", "parecer", "decisao", "deferido", "indeferido", "arquivado"]);
const stageSlaDays = { recebido: 2, triagem: 5, analise_tecnica: 10, vistoria: 10, aguardando_complementacao: 0, parecer: 7, decisao: 5, deferido: 0, indeferido: 0, arquivado: 0 };
const LEGAL_DEADLINES = { notificationRegularization: 60, autoDefense: 8 };

async function institutionalProfile(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Autenticação institucional obrigatória.");
  const snapshot = await db.doc(`usuarios/${request.auth.uid}`).get();
  const profile = snapshot.data();
  if (!profile || profile.status !== "aprovado") throw new HttpsError("permission-denied", "Perfil institucional não aprovado.");
  return { uid: request.auth.uid, ...profile };
}

function sanitizeText(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function dueDateFor(stage) {
  const days = stageSlaDays[stage] || 0;
  if (!days) return null;
  const due = new Date();
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return admin.firestore.Timestamp.fromDate(due);
}

function legalDueDate(dateString, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ""))) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  const due = new Date(year, month - 1, day, 12, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return admin.firestore.Timestamp.fromDate(due);
}

function legalDeadlineFields(payload, type) {
  if (type === "auto") {
    const due = legalDueDate(payload.dataCienciaAuto, LEGAL_DEADLINES.autoDefense);
    return { dataCienciaAuto: payload.dataCienciaAuto, prazoDefesaDias: LEGAL_DEADLINES.autoDefense, prazoDefesaEm: due, statusDefesa: due ? "no_prazo" : "sem_ciencia", baseLegalPrazo: "Art. 28, LC Municipal nº 6/1996" };
  }
  const due = legalDueDate(payload.dataRecebimento, LEGAL_DEADLINES.notificationRegularization);
  return { prazoDias: LEGAL_DEADLINES.notificationRegularization, prazoRegularizacaoDias: LEGAL_DEADLINES.notificationRegularization, prazoRegularizacaoEm: due, statusRegularizacao: due ? "no_prazo" : "sem_ciencia", baseLegalPrazo: "Art. 25, LC Municipal nº 6/1996 (redação da LC nº 245/2023)" };
}

function safeStringArray(value, maxItems = 30, maxLength = 100) {
  return Array.isArray(value) ? value.slice(0, maxItems).map((item) => sanitizeText(item, maxLength)).filter(Boolean) : [];
}

function safeDocumentPayload(payload, type) {
  const shared = {
    dataNotif: sanitizeText(payload.dataNotif, 20),
    nome: sanitizeText(payload.nome, 250),
    doc: sanitizeText(payload.doc, 30),
    loteEndereco: sanitizeText(payload.loteEndereco, 300),
    cidade: sanitizeText(payload.cidade, 100) || "BENTO GONÇALVES",
    uf: sanitizeText(payload.uf, 2) || "RS",
    fiscal: sanitizeText(payload.fiscal, 160),
    matricula: sanitizeText(payload.matricula, 60),
    arrayInfracoes: safeStringArray(payload.arrayInfracoes),
    statusTramitacao: validStages.has(payload.statusTramitacao) ? payload.statusTramitacao : "recebido",
    territorioEquipe: [1, 2].includes(Number(payload.territorioEquipe)) ? Number(payload.territorioEquipe) : null,
    territorioTipo: sanitizeText(payload.territorioTipo, 30),
    territorioNome: sanitizeText(payload.territorioNome, 100),
  };
  if (type === "auto") return { ...shared, dataCienciaAuto: sanitizeText(payload.dataCienciaAuto, 20), autoDescricaoLei: sanitizeText(payload.autoDescricaoLei, 800), autoMultaURM: Number(payload.autoMultaURM) || 0 };
  return {
    ...shared,
    statusNotificacao: ["rascunho", "enviado_ar", "recebido"].includes(payload.statusNotificacao) ? payload.statusNotificacao : "rascunho",
    procOuvidoria: sanitizeText(payload.procOuvidoria, 80), codigoAR: sanitizeText(payload.codigoAR, 30), statusRetornoAR: sanitizeText(payload.statusRetornoAR, 50),
    prazoDias: Math.min(Math.max(Number(payload.prazoDias) || 0, 0), 3650), dataRecebimento: sanitizeText(payload.dataRecebimento, 20), tipoAR: Boolean(payload.tipoAR), tipoPresencial: Boolean(payload.tipoPresencial),
    endereco: sanitizeText(payload.endereco, 300), telefone: sanitizeText(payload.telefone, 30), bairro: sanitizeText(payload.bairro, 100), cep: sanitizeText(payload.cep, 12),
    cadDistrito: sanitizeText(payload.cadDistrito, 30), cadZona: sanitizeText(payload.cadZona, 30), cadQuadra: sanitizeText(payload.cadQuadra, 30), cadLote: sanitizeText(payload.cadLote, 30), cadImob: sanitizeText(payload.cadImob, 60),
    ref: sanitizeText(payload.ref, 250), obs: sanitizeText(payload.obs, 1000),
  };
}

async function nextDocumentNumber({ sector, type, year, uid }) {
  const sequenceRef = db.doc(`sequencias/${sector}_${year}_${type}`);
  const next = await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(sequenceRef);
    const value = (previous.exists ? Number(previous.data().ultimoNumero) : 0) + 1;
    transaction.set(sequenceRef, { setor: sector, ano: year, tipo: type, ultimoNumero: value, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPor: uid }, { merge: true });
    return value;
  });
  return `${String(next).padStart(4, "0")}${type === "notificacao" ? "B" : ""}/${year}`;
}

exports.reserveDocumentNumber = onCall({ region: REGION }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de emissão.");
  const type = sanitizeText(request.data?.type, 20);
  const year = Number(request.data?.year || new Date().getFullYear());
  if (!validTypes.has(type) || year < 2020 || year > 2100) throw new HttpsError("invalid-argument", "Tipo ou ano inválido.");
  const sector = profile.setor || "SMMAM";
  const number = await nextDocumentNumber({ sector, type, year, uid: request.auth.uid });
  await db.collection("logs_auditoria").add({ setor: sector, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: "reservou numeração institucional", documentoAlvo: number, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { number };
});

exports.createDocument = onCall({ region: REGION }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de emissão.");
  const type = sanitizeText(request.data?.type, 20);
  const payload = request.data?.document;
  if (!validTypes.has(type) || !payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "Dados documentais inválidos.");
  const sector = profile.setor || "SMMAM";
  const safePayload = safeDocumentPayload(payload, type);
  const stage = safePayload.statusTramitacao;
  const legalFields = legalDeadlineFields(safePayload, type);
  const number = await nextDocumentNumber({ sector, type, year: new Date().getFullYear(), uid: request.auth.uid });
  const documentRef = db.collection("notificacoes").doc();
  const documentData = {
    ...safePayload,
    ...legalFields,
    tipoDocumento: type,
    numNotif: number,
    setor: sector,
    statusProcesso: "ativo",
    statusTramitacao: stage,
    prazoSlaEm: dueDateFor(stage),
    slaStatus: "no_prazo",
    criadoPor: profile.nome || request.auth.token.email || "Servidor",
    criadoPorId: request.auth.uid,
    responsavelAtual: profile.nome || request.auth.token.email || "Servidor",
    dataCriacao: admin.firestore.FieldValue.serverTimestamp(),
    dataUltimaEdicao: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.runTransaction(async (transaction) => {
    transaction.set(documentRef, documentData);
    transaction.set(documentRef.collection("movimentacoes").doc(), { de: null, para: stage, motivo: "Criação do documento", setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", dataHora: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(db.collection("logs_auditoria").doc(), { setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `criou ${type}`, documentoAlvo: number, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  });
  return { id: documentRef.id, number };
});

exports.updateDocument = onCall({ region: REGION }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de edição.");
  const documentId = sanitizeText(request.data?.documentId, 150);
  const type = sanitizeText(request.data?.type, 20);
  const payload = request.data?.document;
  if (!documentId || !validTypes.has(type) || !payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "Dados de atualização inválidos.");
  const documentRef = db.doc(`notificacoes/${documentId}`);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(documentRef);
    if (!current.exists) throw new HttpsError("not-found", "Documento não localizado.");
    const currentData = current.data();
    const sector = profile.setor || "SMMAM";
    if (currentData.setor !== sector || currentData.tipoDocumento !== type) throw new HttpsError("permission-denied", "Documento de outro setor ou tipo incompatível.");
    const safePayload = safeDocumentPayload(payload, type);
    delete safePayload.statusTramitacao;
    const legalFields = legalDeadlineFields(safePayload, type);
    transaction.update(documentRef, { ...safePayload, ...legalFields, dataUltimaEdicao: admin.firestore.FieldValue.serverTimestamp(), editadoPor: profile.nome || request.auth.token.email || "Servidor", atualizadoPorId: request.auth.uid });
    transaction.set(db.collection("logs_auditoria").doc(), { setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `atualizou ${type} e prazos legais`, documentoAlvo: currentData.numNotif || documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  });
  return { ok: true };
});

exports.recordAuditEvent = onCall({ region: REGION }, async (request) => {
  const profile = await institutionalProfile(request);
  const action = sanitizeText(request.data?.action, 180);
  const documentId = sanitizeText(request.data?.documentId, 150);
  if (!action || !documentId) throw new HttpsError("invalid-argument", "Ação e documento são obrigatórios.");
  await db.collection("logs_auditoria").add({ setor: profile.setor || "SMMAM", usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: action, documentoAlvo: documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { ok: true };
});

exports.moveProcessStage = onCall({ region: REGION }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de tramitação.");
  const documentId = sanitizeText(request.data?.documentId, 150);
  const stage = sanitizeText(request.data?.stage, 60);
  const reason = sanitizeText(request.data?.reason, 500);
  if (!documentId || !validStages.has(stage) || !reason) throw new HttpsError("invalid-argument", "Documento, etapa e justificativa são obrigatórios.");
  const documentRef = db.doc(`notificacoes/${documentId}`);
  const result = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(documentRef);
    if (!current.exists) throw new HttpsError("not-found", "Documento não localizado.");
    const data = current.data();
    if (data.setor !== (profile.setor || "SMMAM")) throw new HttpsError("permission-denied", "Documento de outro setor.");
    const previousStage = data.statusTramitacao || "recebido";
    const movementRef = documentRef.collection("movimentacoes").doc();
    transaction.update(documentRef, { statusTramitacao: stage, statusProcesso: stage === "arquivado" ? "arquivado" : data.statusProcesso || "ativo", prazoSlaEm: dueDateFor(stage), dataUltimaMovimentacao: admin.firestore.FieldValue.serverTimestamp(), responsavelAtual: profile.nome || request.auth.token.email || "Servidor", atualizadoPorId: request.auth.uid });
    transaction.set(movementRef, { de: previousStage, para: stage, motivo: reason, setor: profile.setor || "SMMAM", usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", dataHora: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(db.collection("logs_auditoria").doc(), { setor: profile.setor || "SMMAM", usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `movimentou tramitação de ${previousStage} para ${stage}`, documentoAlvo: data.numNotif || documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
    return { previousStage, stage };
  });
  return { ok: true, ...result };
});

exports.processIptuImport = onDocumentCreated({ region: REGION, document: "iptu_import_jobs/{jobId}" }, async (event) => {
  const job = event.data?.data();
  if (!job?.sourcePath || !job?.setor) return;
  const jobRef = event.data.ref;
  await jobRef.update({ status: "processando", iniciadoEm: admin.firestore.FieldValue.serverTimestamp() });
  try {
    const bucket = admin.storage().bucket();
    const [content] = await bucket.file(job.sourcePath).download();
    const rows = JSON.parse(content.toString("utf8"));
    if (!Array.isArray(rows)) throw new Error("O arquivo de importação não contém uma lista JSON.");
    const writer = db.bulkWriter();
    let processed = 0;
    for (const raw of rows) {
      const key = sanitizeText(raw?.chaveinscricao, 50);
      if (!key) continue;
      const address = sanitizeText(raw?.logradouro, 150);
      const normalized = address.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^\w\s]/g, "");
      writer.set(db.doc(`cadastro_imobiliario/${key}`), { ...raw, chaveinscricao: key, logradouro_keywords: normalized.split(/\s+/).filter(Boolean), atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), origemImportacao: jobRef.id }, { merge: true });
      processed += 1;
    }
    await writer.close();
    await jobRef.update({ status: "concluido", totalProcessado: processed, concluidoEm: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    await jobRef.update({ status: "erro", erro: sanitizeText(error.message, 500), concluidoEm: admin.firestore.FieldValue.serverTimestamp() });
    throw error;
  }
});

exports.migrateLegacyEvidenceBatch = onCall({ region: REGION, timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel !== "admin") throw new HttpsError("permission-denied", "Apenas administradores podem migrar evidências.");
  const sector = profile.setor || "SMMAM";
  const maxDocuments = Math.min(Math.max(Number(request.data?.limit || 20), 1), 50);
  const documents = await db.collection("notificacoes").where("setor", "==", sector).limit(maxDocuments).get();
  const bucket = admin.storage().bucket();
  let migrated = 0;
  for (const document of documents.docs) {
    const evidences = await document.ref.collection("evidencias").limit(50).get();
    for (const evidence of evidences.docs) {
      const data = evidence.data();
      if (!data.imagemBinaria || data.storagePath) continue;
      const match = String(data.imagemBinaria).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) continue;
      const objectPath = `evidencias/${sector}/${document.id}/${evidence.id}.jpg`;
      await bucket.file(objectPath).save(Buffer.from(match[2], "base64"), { metadata: { contentType: match[1], metadata: { sector, documentId: document.id } }, resumable: false });
      await evidence.ref.update({ storagePath: objectPath, contentType: match[1], tamanhoBytes: Buffer.byteLength(match[2], "base64"), migradoEm: admin.firestore.FieldValue.serverTimestamp(), imagemBinaria: admin.firestore.FieldValue.delete() });
      migrated += 1;
    }
  }
  await db.collection("logs_auditoria").add({ setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: "migrou evidências legadas para Storage", documentoAlvo: `${migrated} evidência(s)`, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { migrated };
});

exports.refreshSlaStatus = onSchedule({ region: REGION, schedule: "every day 06:15", timeZone: "America/Sao_Paulo" }, async () => {
  const active = await db.collection("notificacoes").where("statusProcesso", "==", "ativo").limit(5000).get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const writer = db.bulkWriter();
  active.forEach((document) => {
    const data = document.data();
    const due = data.prazoSlaEm?.toDate?.();
    let slaStatus = "sem_prazo";
    if (due) {
      due.setHours(0, 0, 0, 0);
      const near = new Date(today); near.setDate(near.getDate() + 2);
      slaStatus = due < today ? "vencido" : due <= near ? "proximo" : "no_prazo";
    }
    const isAuto = data.tipoDocumento === "auto";
    const legalStart = isAuto ? data.dataCienciaAuto : data.dataRecebimento;
    const legalDays = isAuto ? LEGAL_DEADLINES.autoDefense : LEGAL_DEADLINES.notificationRegularization;
    const calculatedLegalDeadline = legalDueDate(legalStart, legalDays);
    const legalDeadline = (isAuto ? data.prazoDefesaEm : data.prazoRegularizacaoEm)?.toDate?.() || calculatedLegalDeadline?.toDate?.();
    let legalStatus = "sem_ciencia";
    if (legalDeadline) {
      legalDeadline.setHours(0, 0, 0, 0);
      const warning = new Date(today); warning.setDate(warning.getDate() + 5);
      legalStatus = legalDeadline < today ? "vencido" : legalDeadline <= warning ? "proximo" : "no_prazo";
    }
    const legalFields = isAuto
      ? { prazoDefesaDias: legalDays, prazoDefesaEm: calculatedLegalDeadline || null, statusDefesa: legalStatus, baseLegalPrazo: "Art. 28, LC Municipal nº 6/1996" }
      : { prazoDias: legalDays, prazoRegularizacaoDias: legalDays, prazoRegularizacaoEm: calculatedLegalDeadline || null, statusRegularizacao: legalStatus, baseLegalPrazo: "Art. 25, LC Municipal nº 6/1996 (redação da LC nº 245/2023)" };
    writer.update(document.ref, { slaStatus, slaAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(), ...legalFields });
  });
  await writer.close();
});
