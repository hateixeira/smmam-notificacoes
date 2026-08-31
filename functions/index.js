const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

admin.initializeApp();
const db = admin.firestore();
const REGION = "southamerica-east1";
const validTypes = new Set(["notificacao", "auto"]);
const validStages = new Set(["rascunho", "aguardando_postagem_ar", "ar_postado", "ar_em_transito", "ar_entregue_pendente_ciencia", "ar_devolvido", "prazo_regularizacao", "prorrogacao_solicitada", "prazo_prorrogado", "vistoria_retorno", "limpeza_confirmada", "irregularidade_pendente", "recebido", "triagem", "analise_tecnica", "vistoria", "aguardando_complementacao", "parecer", "decisao", "deferido", "indeferido", "arquivado"]);
const stageSlaDays = { rascunho: 0, aguardando_postagem_ar: 2, ar_postado: 5, ar_em_transito: 5, ar_entregue_pendente_ciencia: 2, ar_devolvido: 2, prazo_regularizacao: 0, prorrogacao_solicitada: 2, prazo_prorrogado: 0, vistoria_retorno: 5, limpeza_confirmada: 0, irregularidade_pendente: 2, recebido: 2, triagem: 5, analise_tecnica: 10, vistoria: 10, aguardando_complementacao: 0, parecer: 7, decisao: 5, deferido: 0, indeferido: 0, arquivado: 0 };
const LEGAL_DEADLINES = { notificationRegularization: 15, autoDefense: 8 };
const DEFAULT_DOCUMENT_PARAMETERS = Object.freeze({
  prazoRegularizacaoDias: 15,
  prazoDefesaDias: 8,
  valorURM: 0,
  textoMotivoPadrao: "Verificação de irregularidade situada no endereço: {endereco}, BAIRRO {bairro}, MUNICÍPIO DE {cidade}/{uf} – CEP: {cep}, tendo como ponto de referência: {referencia}.",
  textoOrientacoes: "É proibido o emprego de fogo e de capina química para a limpeza dos lotes.\nTodo o entulho/resto ou assemelhado deverá ser acondicionado; e destinado ao local apropriado.",
  textoPrazoRegularizacao: "FICA NOTIFICADO(A) a regularizar a situação do lote em {dias} dias corridos a partir do recebimento desta.",
  textoBaseLegalNotificacao: "O OBJETIVO DESTA NOTIFICAÇÃO É ATENDER A CONFORMIDADE MUNICIPAL NAS LEIS:\n\nLei Ordinária nº. 5.198/2011 – Art. 6º. Os proprietários de terreno(s), edificados ou não, serão responsáveis pela limpeza dele(s), bem como da(s) calçada(s), mantendo-o(s) permanentemente em perfeito estado de limpeza e capinados, evitando que sejam utilizados como depósito de resíduos de qualquer natureza.\n\nLei Complementar nº. 06/1996 - Art. 28º - O infrator tem o prazo de oito (08) dias corridos para apresentar defesa escrita, que deve ser encaminhada para a SMMAM para decisão final. (Direito à ampla defesa e ao contraditório)",
  textoQrCode: "Após a limpeza do terreno, ou em caso de dúvidas, aponte a câmera do celular para o QR Code ao lado e envie as fotos da limpeza para o WhatsApp da Fiscalização (54) 3055-7211. A mensagem já vai pronta com o número desta notificação.",
  textoApresentacao: "Secretaria Municipal do Meio Ambiente (SMMAM) — Setor de Fiscalização\nRua 10 de Novembro, 190 — Cidade Alta\nFone/Whats: 54 3055-7211",
});

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

function timestampWithAddedDays(timestamp, days) {
  const source = timestamp?.toDate?.();
  if (!source || !Number.isInteger(days) || days < 1) return null;
  source.setHours(12, 0, 0, 0);
  source.setDate(source.getDate() + days);
  return admin.firestore.Timestamp.fromDate(source);
}

function initialDocumentStage(payload, type) {
  if (type !== "notificacao") return payload.statusTramitacao;
  if (payload.statusNotificacao === "rascunho") return "rascunho";
  if (payload.tipoAR) return "aguardando_postagem_ar";
  return payload.dataRecebimento ? "prazo_regularizacao" : "recebido";
}

function boundedNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function normalizedDocumentParameters(value = {}) {
  return {
    prazoRegularizacaoDias: boundedNumber(value.prazoRegularizacaoDias, DEFAULT_DOCUMENT_PARAMETERS.prazoRegularizacaoDias, 1, 3650),
    prazoDefesaDias: boundedNumber(value.prazoDefesaDias, DEFAULT_DOCUMENT_PARAMETERS.prazoDefesaDias, 1, 3650),
    valorURM: boundedNumber(value.valorURM, DEFAULT_DOCUMENT_PARAMETERS.valorURM, 0, 1000000),
    textoMotivoPadrao: sanitizeText(value.textoMotivoPadrao || DEFAULT_DOCUMENT_PARAMETERS.textoMotivoPadrao, 1000),
    textoOrientacoes: sanitizeText(value.textoOrientacoes || DEFAULT_DOCUMENT_PARAMETERS.textoOrientacoes, 2000),
    textoPrazoRegularizacao: sanitizeText(value.textoPrazoRegularizacao || DEFAULT_DOCUMENT_PARAMETERS.textoPrazoRegularizacao, 1000),
    textoBaseLegalNotificacao: sanitizeText(value.textoBaseLegalNotificacao || DEFAULT_DOCUMENT_PARAMETERS.textoBaseLegalNotificacao, 4000),
    textoQrCode: sanitizeText(value.textoQrCode || DEFAULT_DOCUMENT_PARAMETERS.textoQrCode, 1500),
    textoApresentacao: sanitizeText(value.textoApresentacao || DEFAULT_DOCUMENT_PARAMETERS.textoApresentacao, 1000),
  };
}

async function documentParametersForSector(sector) {
  const [snapshot, systemSnapshot] = await Promise.all([db.doc(`configuracoes/parametros_${sector}`).get(), db.doc("configuracoes/sistema").get()]);
  const system = systemSnapshot.exists ? systemSnapshot.data() : {};
  return normalizedDocumentParameters({ valorURM: system.valorURM, ...(snapshot.exists ? snapshot.data() : {}) });
}

function legalDeadlineFields(payload, type, parameters = DEFAULT_DOCUMENT_PARAMETERS) {
  if (type === "auto") {
    const days = parameters.prazoDefesaDias;
    const due = legalDueDate(payload.dataCienciaAuto, days);
    return { dataCienciaAuto: payload.dataCienciaAuto, prazoDefesaDias: days, prazoDefesaEm: due, statusDefesa: due ? "no_prazo" : "sem_ciencia", baseLegalPrazo: "Art. 28, LC Municipal nº 6/1996" };
  }
  const days = parameters.prazoRegularizacaoDias;
  const due = legalDueDate(payload.dataRecebimento, days);
  return { prazoDias: days, prazoRegularizacaoDias: days, prazoRegularizacaoEm: due, statusRegularizacao: due ? "no_prazo" : "sem_ciencia", baseLegalPrazo: "Art. 25, LC Municipal nº 6/1996 (redação da LC nº 245/2023)" };
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
    identidade: sanitizeText(payload.identidade, 80), ref: sanitizeText(payload.ref, 250), obs: sanitizeText(payload.obs, 1000), motivoNotificacao: sanitizeText(payload.motivoNotificacao, 1600),
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

exports.reserveDocumentNumber = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de emissão.");
  const type = sanitizeText(request.data?.type, 20);
  const year = Number(request.data?.year || new Date().getFullYear());
  if (!validTypes.has(type) || year < 2020 || year > 2100) throw new HttpsError("invalid-argument", "Tipo ou ano inválido.");
  const setor = profile.setor || "SMMAM";
  const number = await nextDocumentNumber({ sector: setor, type, year, uid: request.auth.uid });
  await db.collection("logs_auditoria").add({ setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: "reservou numeração institucional", documentoAlvo: number, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { number };
});

exports.createDocument = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de emissão.");
  const type = sanitizeText(request.data?.type, 20);
  const payload = request.data?.document;
  if (!validTypes.has(type) || !payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "Dados documentais inválidos.");
  const setor = profile.setor || "SMMAM";
  const safePayload = safeDocumentPayload(payload, type);
  const stage = initialDocumentStage(safePayload, type);
  const parameters = await documentParametersForSector(setor);
  const legalFields = legalDeadlineFields(safePayload, type, parameters);
  const number = await nextDocumentNumber({ sector: setor, type, year: new Date().getFullYear(), uid: request.auth.uid });
  const documentRef = db.collection("notificacoes").doc();
  const documentData = {
    ...safePayload,
    ...legalFields,
    parametrosDocumento: parameters,
    tipoDocumento: type,
    numNotif: number,
    setor: setor,
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
    transaction.set(documentRef.collection("movimentacoes").doc(), { de: null, para: stage, motivo: "Criação do documento", setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", dataHora: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(db.collection("logs_auditoria").doc(), { setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `criou ${type}`, documentoAlvo: number, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  });
  return { id: documentRef.id, number };
});

exports.updateDocument = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de edição.");
  const documentId = sanitizeText(request.data?.documentId, 150);
  const type = sanitizeText(request.data?.type, 20);
  const payload = request.data?.document;
  if (!documentId || !validTypes.has(type) || !payload || typeof payload !== "object") throw new HttpsError("invalid-argument", "Dados de atualização inválidos.");
  const documentRef = db.doc(`notificacoes/${documentId}`);
  const setor = profile.setor || "SMMAM";
  const configuredParameters = await documentParametersForSector(setor);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(documentRef);
    if (!current.exists) throw new HttpsError("not-found", "Documento não localizado.");
    const currentData = current.data();
    if (currentData.setor !== setor || currentData.tipoDocumento !== type) throw new HttpsError("permission-denied", "Documento de outro setor ou tipo incompatível.");
    if (type === "notificacao" && currentData.statusNotificacao !== "rascunho") throw new HttpsError("failed-precondition", "Notificações emitidas são imutáveis. Use o acompanhamento para AR, prorrogação, vistoria ou limpeza.");
    const safePayload = safeDocumentPayload(payload, type);
    delete safePayload.statusTramitacao;
    const parameters = normalizedDocumentParameters(currentData.parametrosDocumento || configuredParameters);
    const legalFields = legalDeadlineFields(safePayload, type, parameters);
    const emitindoRascunho = type === "notificacao" && currentData.statusNotificacao === "rascunho" && safePayload.statusNotificacao !== "rascunho";
    const stageDaEmissao = emitindoRascunho ? initialDocumentStage(safePayload, type) : null;
    transaction.update(documentRef, { ...safePayload, ...legalFields, parametrosDocumento: parameters, ...(stageDaEmissao ? { statusTramitacao: stageDaEmissao, prazoSlaEm: dueDateFor(stageDaEmissao), dataUltimaMovimentacao: admin.firestore.FieldValue.serverTimestamp() } : {}), dataUltimaEdicao: admin.firestore.FieldValue.serverTimestamp(), editadoPor: profile.nome || request.auth.token.email || "Servidor", atualizadoPorId: request.auth.uid });
    transaction.set(db.collection("logs_auditoria").doc(), { setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `atualizou ${type} e prazos legais`, documentoAlvo: currentData.numNotif || documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  });
  return { ok: true };
});

exports.updateDocumentParameters = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel !== "admin") throw new HttpsError("permission-denied", "Somente administradores podem alterar parâmetros documentais.");
  const setor = profile.setor || "SMMAM";
  const parameters = normalizedDocumentParameters(request.data?.parameters || {});
  await db.doc(`configuracoes/parametros_${setor}`).set({ ...parameters, setor: setor, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPorId: request.auth.uid, atualizadoPor: profile.nome || request.auth.token.email || "Administrador" }, { merge: true });
  await db.doc("configuracoes/sistema").set({ valorURM: parameters.valorURM, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(), atualizadoPorId: request.auth.uid }, { merge: true });
  await db.collection("logs_auditoria").add({ setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Administrador", nivel: profile.nivel, acao: "atualizou parâmetros do modelo documental", documentoAlvo: `parametros_${setor}`, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { parameters };
});

exports.recordNotificationFollowUp = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel === "leitor") throw new HttpsError("permission-denied", "Perfil sem permissão de acompanhamento.");
  const documentId = sanitizeText(request.data?.documentId, 150);
  const eventType = sanitizeText(request.data?.eventType, 60);
  const eventDate = sanitizeText(request.data?.eventDate, 20);
  const note = sanitizeText(request.data?.note, 1000);
  const extensionDays = Math.floor(Number(request.data?.extensionDays || 0));
  const trackingStatus = sanitizeText(request.data?.trackingStatus, 30);
  const trackingText = sanitizeText(request.data?.trackingText, 500);
  const allowedEvents = new Set(["ar_postado", "atualizacao_rastreio_ar", "ciencia_confirmada", "prorrogacao_solicitada", "prorrogacao_deferida", "prorrogacao_indeferida", "vistoria_retorno", "limpeza_confirmada", "irregularidade_pendente"]);
  if (!documentId || !allowedEvents.has(eventType) || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !note) throw new HttpsError("invalid-argument", "Documento, evento, data e justificativa são obrigatórios.");
  const documentRef = db.doc(`notificacoes/${documentId}`);
  const setor = profile.setor || "SMMAM";
  const configuredParameters = await documentParametersForSector(setor);
  const result = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(documentRef);
    if (!current.exists) throw new HttpsError("not-found", "Notificação não localizada.");
    const data = current.data();
    if (data.setor !== setor || data.tipoDocumento !== "notificacao") throw new HttpsError("permission-denied", "Acompanhamento permitido somente para notificações do seu setor.");
    const parameters = normalizedDocumentParameters(data.parametrosDocumento || configuredParameters);
    const changes = { dataUltimaMovimentacao: admin.firestore.FieldValue.serverTimestamp(), responsavelAtual: profile.nome || request.auth.token.email || "Servidor", atualizadoPorId: request.auth.uid };
    let stage = data.statusTramitacao || "recebido";
    if (eventType === "ar_postado") {
      if (!data.tipoAR || !data.codigoAR) throw new HttpsError("failed-precondition", "Informe o código de AR antes de registrar a postagem.");
      stage = "ar_postado";
      Object.assign(changes, { statusNotificacao: "enviado_ar", statusRetornoAR: "postado", dataPostagemAR: eventDate });
    } else if (eventType === "atualizacao_rastreio_ar") {
      if (!data.tipoAR) throw new HttpsError("failed-precondition", "Atualização de rastreio aplica-se somente a notificações por AR.");
      const statusToStage = { entregue: "ar_entregue_pendente_ciencia", devolvido: "ar_devolvido", transito: "ar_em_transito", saiu_entrega: "ar_em_transito", tentativa: "ar_em_transito", retirada: "ar_em_transito", aguardando: "ar_postado" };
      stage = statusToStage[trackingStatus] || "ar_em_transito";
      Object.assign(changes, { statusNotificacao: trackingStatus === "entregue" ? "recebido" : "enviado_ar", statusRetornoAR: trackingStatus || "aguardando", statusCorreiosTexto: trackingText.toUpperCase(), dataUltimoRastreioAR: eventDate });
    } else if (eventType === "ciencia_confirmada") {
      stage = "prazo_regularizacao";
      Object.assign(changes, legalDeadlineFields({ dataRecebimento: eventDate }, "notificacao", parameters), { statusNotificacao: "recebido", dataRecebimento: eventDate, dataCienciaConfirmadaEm: eventDate });
    } else if (eventType === "prorrogacao_solicitada") {
      stage = "prorrogacao_solicitada";
      Object.assign(changes, { prorrogacaoSolicitada: true, prorrogacaoSolicitadaEm: eventDate, statusProrrogacao: "solicitada", justificativaProrrogacao: note });
    } else if (eventType === "prorrogacao_deferida") {
      if (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 3650) throw new HttpsError("invalid-argument", "Informe de 1 a 3650 dias de prorrogação aprovados.");
      const originalDeadline = data.prazoRegularizacaoEm || legalDueDate(data.dataRecebimento, Number(data.prazoRegularizacaoDias || data.prazoDias) || parameters.prazoRegularizacaoDias);
      const extendedDeadline = timestampWithAddedDays(originalDeadline, extensionDays);
      if (!extendedDeadline) throw new HttpsError("failed-precondition", "Confirme a ciência antes de deferir a prorrogação.");
      stage = "prazo_prorrogado";
      Object.assign(changes, { prorrogacaoSolicitada: true, statusProrrogacao: "deferida", prorrogacaoDecididaEm: eventDate, prorrogacaoDiasDeferidos: extensionDays, prazoRegularizacaoProrrogadoEm: extendedDeadline, statusRegularizacao: "no_prazo", justificativaProrrogacao: note });
    } else if (eventType === "prorrogacao_indeferida") {
      stage = "prazo_regularizacao";
      Object.assign(changes, { prorrogacaoSolicitada: true, statusProrrogacao: "indeferida", prorrogacaoDecididaEm: eventDate, justificativaProrrogacao: note });
    } else if (eventType === "vistoria_retorno") {
      stage = "vistoria_retorno";
      Object.assign(changes, { vistoriaRetornoEm: eventDate, resultadoVistoria: note });
    } else if (eventType === "limpeza_confirmada") {
      stage = "limpeza_confirmada";
      Object.assign(changes, { terrenoLimpo: true, limpezaConfirmadaEm: eventDate, statusRegularizacao: "regularizado", resultadoVistoria: note });
    } else if (eventType === "irregularidade_pendente") {
      stage = "irregularidade_pendente";
      Object.assign(changes, { terrenoLimpo: false, vistoriaRetornoEm: eventDate, resultadoVistoria: note });
    }
    changes.statusTramitacao = stage;
    changes.prazoSlaEm = dueDateFor(stage);
    transaction.update(documentRef, changes);
    transaction.set(documentRef.collection("acompanhamentos").doc(), { tipo: eventType, dataEvento: eventDate, observacao: note, diasProrrogados: eventType === "prorrogacao_deferida" ? extensionDays : null, statusRastreio: eventType === "atualizacao_rastreio_ar" ? trackingStatus : null, textoRastreio: eventType === "atualizacao_rastreio_ar" ? trackingText : null, setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", criadoEm: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(db.collection("logs_auditoria").doc(), { setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: `registrou acompanhamento: ${eventType}`, documentoAlvo: data.numNotif || documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
    return { stage };
  });
  return { ok: true, ...result };
});

exports.recordAuditEvent = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  const action = sanitizeText(request.data?.action, 180);
  const documentId = sanitizeText(request.data?.documentId, 150);
  if (!action || !documentId) throw new HttpsError("invalid-argument", "Ação e documento são obrigatórios.");
  await db.collection("logs_auditoria").add({ setor: profile.setor || "SMMAM", usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: action, documentoAlvo: documentId, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
  return { ok: true };
});

exports.deleteDocuments = onCall({ region: REGION, invoker: "public" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel !== "admin") throw new HttpsError("permission-denied", "Somente administradores podem excluir registros.");
  const ids = Array.isArray(request.data?.documentIds)
    ? request.data.documentIds.map((id) => sanitizeText(id, 150)).filter(Boolean).slice(0, 50)
    : [];
  if (!ids.length) throw new HttpsError("invalid-argument", "Informe ao menos um documento para exclusão.");
  const setor = profile.setor || "SMMAM";
  const removidos = [];
  for (const documentId of ids) {
    const documentRef = db.doc(`notificacoes/${documentId}`);
    const snapshot = await documentRef.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data();
    if (data.setor !== setor) throw new HttpsError("permission-denied", "Documento de outro setor.");
    const numero = data.numNotif || documentId;
    const evidencias = await documentRef.collection("evidencias").get();
    for (const evidencia of evidencias.docs) {
      const storagePath = evidencia.data()?.storagePath;
      if (storagePath) await admin.storage().bucket().file(storagePath).delete().catch(() => {});
      await evidencia.ref.delete().catch(() => {});
    }
    for (const sub of ["movimentacoes", "acompanhamentos"]) {
      const subDocs = await documentRef.collection(sub).get();
      for (const subDoc of subDocs.docs) await subDoc.ref.delete().catch(() => {});
    }
    await documentRef.delete();
    removidos.push(numero);
    await db.collection("logs_auditoria").add({
      setor,
      usuarioId: request.auth.uid,
      usuario: profile.nome || request.auth.token.email || "Servidor",
      nivel: profile.nivel,
      acao: "excluiu registro definitivamente",
      documentoAlvo: numero,
      dataHora: admin.firestore.FieldValue.serverTimestamp(),
      origem: "backend"
    });
  }
  return { ok: true, removidos };
});

exports.moveProcessStage = onCall({ region: REGION, invoker: "public" }, async (request) => {
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
    if (data.tipoDocumento === "notificacao") throw new HttpsError("failed-precondition", "Notificações devem ser movimentadas pelo acompanhamento de AR, prorrogação, vistoria ou limpeza.");
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

exports.migrateLegacyEvidenceBatch = onCall({ region: REGION, invoker: "public", timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
  const profile = await institutionalProfile(request);
  if (profile.nivel !== "admin") throw new HttpsError("permission-denied", "Apenas administradores podem migrar evidências.");
  const setor = profile.setor || "SMMAM";
  const maxDocuments = Math.min(Math.max(Number(request.data?.limit || 20), 1), 50);
  const documents = await db.collection("notificacoes").where("setor", "==", setor).limit(maxDocuments).get();
  const bucket = admin.storage().bucket();
  let migrated = 0;
  for (const document of documents.docs) {
    const evidences = await document.ref.collection("evidencias").limit(50).get();
    for (const evidence of evidences.docs) {
      const data = evidence.data();
      if (!data.imagemBinaria || data.storagePath) continue;
      const match = String(data.imagemBinaria).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) continue;
      const objectPath = `evidencias/${setor}/${document.id}/${evidence.id}.jpg`;
      await bucket.file(objectPath).save(Buffer.from(match[2], "base64"), { metadata: { contentType: match[1], metadata: { sector: setor, documentId: document.id } }, resumable: false });
      await evidence.ref.update({ storagePath: objectPath, contentType: match[1], tamanhoBytes: Buffer.byteLength(match[2], "base64"), migradoEm: admin.firestore.FieldValue.serverTimestamp(), imagemBinaria: admin.firestore.FieldValue.delete() });
      migrated += 1;
    }
  }
  await db.collection("logs_auditoria").add({ setor: setor, usuarioId: request.auth.uid, usuario: profile.nome || request.auth.token.email || "Servidor", nivel: profile.nivel, acao: "migrou evidências legadas para Storage", documentoAlvo: `${migrated} evidência(s)`, dataHora: admin.firestore.FieldValue.serverTimestamp(), origem: "backend" });
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
    const legalDays = isAuto ? Number(data.prazoDefesaDias) || LEGAL_DEADLINES.autoDefense : Number(data.prazoRegularizacaoDias || data.prazoDias) || LEGAL_DEADLINES.notificationRegularization;
    const calculatedLegalDeadline = legalDueDate(legalStart, legalDays);
    const legalDeadline = (isAuto ? data.prazoDefesaEm : data.prazoRegularizacaoProrrogadoEm || data.prazoRegularizacaoEm)?.toDate?.() || calculatedLegalDeadline?.toDate?.();
    let legalStatus = "sem_ciencia";
    if (legalDeadline) {
      legalDeadline.setHours(0, 0, 0, 0);
      const warning = new Date(today); warning.setDate(warning.getDate() + 5);
      legalStatus = legalDeadline < today ? "vencido" : legalDeadline <= warning ? "proximo" : "no_prazo";
    }
    const legalFields = isAuto
      ? { prazoDefesaDias: legalDays, prazoDefesaEm: calculatedLegalDeadline || null, statusDefesa: legalStatus, baseLegalPrazo: "Art. 28, LC Municipal nº 6/1996" }
      : { prazoDias: legalDays, prazoRegularizacaoDias: legalDays, prazoRegularizacaoEm: calculatedLegalDeadline || null, statusRegularizacao: data.terrenoLimpo ? "regularizado" : legalStatus, baseLegalPrazo: "Art. 25, LC Municipal nº 6/1996 (redação da LC nº 245/2023)" };
    writer.update(document.ref, { slaStatus, slaAtualizadoEm: admin.firestore.FieldValue.serverTimestamp(), ...legalFields });
  });
  await writer.close();
});

exports.cleanupOrphanEvidences = onSchedule({ region: REGION, schedule: "0 3 1 * *", timeZone: "America/Sao_Paulo" }, async () => {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: "evidencias/" });
  let deletedCount = 0;
  for (const file of files) {
    const parts = file.name.split("/");
    if (parts.length >= 4) {
      const documentId = parts[2];
      const docSnapshot = await db.doc(`notificacoes/${documentId}`).get();
      if (!docSnapshot.exists) {
        await file.delete().catch(() => {});
        deletedCount += 1;
      }
    }
  }
  await db.collection("logs_auditoria").add({
    setor: "SISTEMA",
    usuarioId: "sistema",
    usuario: "Garbage Collector Automático",
    nivel: "sistema",
    acao: `limpeza mensal de evidências órfãs (${deletedCount} arquivos)`,
    documentoAlvo: "Cloud Storage",
    dataHora: admin.firestore.FieldValue.serverTimestamp(),
    origem: "backend"
  });
});

