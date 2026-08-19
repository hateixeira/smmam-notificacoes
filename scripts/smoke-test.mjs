import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { extrairEventoRastreamento, normalizarCodigoAR } from '../js/correios-provider.js';

const [html, app, firestoreRules, storageRules, privacyNotice, continuityGuide] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../storage.rules', import.meta.url), 'utf8'),
  readFile(new URL('../politica-privacidade.html', import.meta.url), 'utf8'),
  readFile(new URL('../CONTINUIDADE_E_RESTAURACAO.md', import.meta.url), 'utf8'),
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
assert.match(app, /Base sincronizada com índices/);
assert.match(app, /consultarRastreamentoPacoteVicio/);
assert.doesNotMatch(app, /brasilapi\.com\.br\/api\/correios/);
assert.doesNotMatch(app, /linketrack\.com/);
assert.match(html, /Pacote Vício/);
assert.match(html, /CSV de retorno do VIPP/);
assert.match(html, /Pular para o conteúdo principal/);
assert.match(html, /politica-privacidade\.html/);
assert.match(app, /Backup_Restrito_/);
assert.match(app, /GEROU BACKUP SETORIAL/);
assert.match(html, /CPF \(opcional\)/);
assert.match(privacyNotice, /Aviso de privacidade e uso interno/);
assert.match(continuityGuide, /Teste de restauração em homologação/);
assert.equal(normalizarCodigoAR('am101510575br'), 'AM101510575BR');
assert.deepEqual(extrairEventoRastreamento({
  temEventoEntrega: true,
  eventos: [{ descricao: 'Objeto entregue ao destinatário', finalizador: 'S' }],
}), { descricao: 'Objeto entregue ao destinatário', entregue: true, dataEvento: null });

console.log('Smoke test aprovado: navegação, fluxos críticos e regras preparadas.');
