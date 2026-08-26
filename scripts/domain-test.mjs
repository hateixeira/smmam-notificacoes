import assert from "node:assert/strict";
import { escapeHtml, normalizeText } from "../js/core/sanitize.js";
import { allowedTransition, calculateSlaDueDate, slaClassification, workflowLabel } from "../js/core/workflow.js";
import { resolveTerritory } from "../js/core/territory.js";

assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
assert.equal(normalizeText('São Vendelino'), 'SAO VENDELINO');
assert.equal(resolveTerritory('São Vendelino').equipe, 1);
assert.equal(resolveTerritory('Centro').equipe, 2);
assert.equal(resolveTerritory('Tuiuty').tipo, 'distrito');
assert.equal(workflowLabel('parecer'), 'Parecer');
assert.equal(allowedTransition('triagem', 'analise_tecnica'), true);
assert.equal(allowedTransition('arquivado', 'triagem'), false);
assert.match(calculateSlaDueDate('triagem'), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(slaClassification({ prazoSlaEm: '2000-01-01' }), 'vencido');
assert.equal(slaClassification({}), 'sem_prazo');

console.log('Domain test aprovado: sanitização, workflow, SLA e território.');
