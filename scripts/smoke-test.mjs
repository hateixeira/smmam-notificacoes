import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { extrairEventoRastreamento, normalizarCodigoAR } from '../js/correios-provider.js';

const [html, app, worker, firestoreRules, firestoreIndexes, storageRules, privacyNotice, continuityGuide, functionsSource, workflow, territory, evidence, legalDeadlines, legalBasis] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../workers/ar-sync-worker.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'),
  readFile(new URL('../storage.rules', import.meta.url), 'utf8'),
  readFile(new URL('../politica-privacidade.html', import.meta.url), 'utf8'),
  readFile(new URL('../CONTINUIDADE_E_RESTAURACAO.md', import.meta.url), 'utf8'),
  readFile(new URL('../functions/index.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/core/workflow.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/core/territory.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/services/evidence.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/core/legal-deadlines.js', import.meta.url), 'utf8'),
  readFile(new URL('../BASE_LEGAL_PRAZOS_DEFESA.md', import.meta.url), 'utf8'),
]);

assert.match(html, /Hub de aplicações/);
assert.match(html, /workspace-title/);
assert.match(html, /Nova Notificação/);
assert.doesNotMatch(html, /Acesso Rápido \(Visitante\)/);
assert.doesNotMatch(app, /const novoPerfil = \{ nome: "Humberto"/);
assert.match(app, /where\("setor", "==", meuSetor\)/);
assert.match(app, /acesso de demonstração foi desativado/i);
assert.match(firestoreRules, /request\.auth != null/);
assert.doesNotMatch(firestoreRules, /allow read, write: if true/);
assert.match(storageRules, /iptu_backup/);
assert.match(app, /fila administrativa protegida/);
assert.match(app, /AR_SYNC_SERVICE_URL/);
assert.match(app, /requisitarServicoAR/);
assert.match(app, /candidatosPendentesAR/);
assert.match(app, /atualizarStatusConsultaAR/);
assert.match(worker, /RAPIDAPI_AR_KEY/);
assert.match(worker, /MAX_PER_WINDOW = 8/);
assert.match(worker, /ArSyncCoordinator/);
assert.doesNotMatch(app, /brasilapi\.com\.br\/api\/correios/);
assert.doesNotMatch(app, /linketrack\.com/);
assert.match(html, /Pacote Vício/);
assert.match(html, /CSV VIPP de expedição/);
assert.match(html, /id="arSyncStatus"/);
assert.match(html, /Pular para o conteúdo principal/);
assert.match(html, /politica-privacidade\.html/);
assert.match(app, /Backup_Restrito_/);
assert.match(app, /GEROU BACKUP SETORIAL/);
assert.match(html, /CPF \(opcional\)/);
assert.match(html, /id="ordemAuditoria"/);
assert.match(app, /orderBy\("dataHora", "desc"\)/);
assert.match(app, /window\.carregarUsuariosDoSetor/);
assert.match(app, /window\.alterarStatusUsuario/);
assert.match(app, /window\.alterarNivelUsuario/);
assert.match(app, /window\.carregarConfiguracoesAdmin/);
assert.match(html, /Gestão de Servidores \(Do Seu Setor\)/);
assert.match(firestoreRules, /request\.auth\.uid != userId/);
assert.match(firestoreIndexes, /"collectionGroup": "logs_auditoria"/);
assert.match(firestoreIndexes, /"fieldPath": "dataHora"/);
assert.match(privacyNotice, /Aviso de privacidade e uso interno/);
assert.match(continuityGuide, /Teste de restauração em homologação/);
assert.match(html, /statusTramitacaoNotif/);
assert.match(html, /btnCarregarMais/);
assert.match(html, /Relatório gerencial/);
assert.match(app, /createDocument/);
assert.match(app, /uploadEvidence/);
assert.match(app, /moverEtapaTramitacao/);
assert.match(app, /exportarRelatorioGerencial/);
assert.match(app, /migrarEvidenciasLegadas/);
assert.match(html, /btnMigrarEvidencias/);
assert.match(html, /btnPreviaNotif/);
assert.match(html, /modal-previa-documento/);
assert.match(html, /configPrazoRegularizacao/);
assert.match(html, /configPrazoDefesa/);
assert.match(html, /configTextoOrientacoes/);
assert.match(html, /id="identidade"/);
assert.match(html, /id="motivoNotificacao"/);
assert.match(firestoreRules, /allow create: if false/);
assert.match(storageRules, /match \/evidencias/);
assert.match(firestoreIndexes, /"collectionGroup": "notificacoes"/);
assert.match(functionsSource, /reserveDocumentNumber/);
assert.match(functionsSource, /createDocument/);
assert.match(functionsSource, /migrateLegacyEvidenceBatch/);
assert.match(functionsSource, /refreshSlaStatus/);
assert.match(functionsSource, /updateDocumentParameters/);
assert.match(functionsSource, /parametrosDocumento/);
assert.match(workflow, /WORKFLOW_STAGES/);
assert.match(territory, /TEAM_1/);
assert.match(evidence, /uploadEvidence/);
assert.match(html, /60 dias corridos para regularização/);
assert.match(html, /8 dias corridos, a partir da ciência, para apresentar defesa escrita/);
assert.match(app, /updateDocument/);
assert.match(functionsSource, /prazoRegularizacaoDias/);
assert.match(functionsSource, /prazoDefesaDias/);
assert.match(firestoreRules, /prazoDefesaEm/);
assert.match(legalDeadlines, /notificationRegularization/);
assert.match(legalBasis, /Art\. 25/);
assert.match(legalBasis, /Art\. 28/);
assert.match(app, /abrirPreviaNotificacao/);
assert.match(app, /dataset\.previaConfirmada/);
assert.match(app, /exportarVipp/);
assert.match(app, /item\.endereco \|\| item\.loteEndereco/);
assert.match(app, /item\.bairro/);
assert.match(app, /item\.cep/);
assert.equal(normalizarCodigoAR('am101510575br'), 'AM101510575BR');
assert.deepEqual(extrairEventoRastreamento({
  temEventoEntrega: true,
  eventos: [{ descricao: 'Objeto entregue ao destinatário', finalizador: 'S' }],
}), { descricao: 'Objeto entregue ao destinatário', entregue: true, dataEvento: null });

console.log('Smoke test aprovado: navegação, fluxos críticos e regras preparadas.');
