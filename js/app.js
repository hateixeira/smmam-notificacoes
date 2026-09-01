import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc, query, where, orderBy, limit, startAfter, writeBatch, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { escapeHtml, normalizeText } from "./core/sanitize.js";
import { WORKFLOW_STAGES, calculateSlaDueDate, workflowLabel, slaClassification } from "./core/workflow.js";
import { resolveTerritory } from "./core/territory.js";
import { LEGAL_DEADLINES, addCalendarDays, formatDeadline, legalDeadlineForRecord } from "./core/legal-deadlines.js";
import { uploadEvidence, deleteEvidence } from "./services/evidence.js";
import { exportManagementReport } from "./services/reporting.js";
import { renderDocumentRows } from "./services/document-table.js";
import { initAuthModule } from "./modules/auth.js";
import { initImpressoesModule, gerarLinkWhatsappNotificacao, gerarQrCodeWhatsappNotificacao, preencherEspelhoDocumento } from "./modules/impressoes.js";
import { initBuscasModule } from "./modules/buscas.js";

const firebaseConfig = {
    apiKey: "AIzaSyAP56ee8ituvxypF_aPOVSClu0EfCJBhR8",
    authDomain: "smmam-fiscalizacao-tb.firebaseapp.com",
    projectId: "smmam-fiscalizacao-tb",
    storageBucket: "smmam-fiscalizacao-tb.firebasestorage.app",
    messagingSenderId: "969517921131",
    appId: "1:969517921131:web:0346350b921ad7bab5522e"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const functions = getFunctions(app, "southamerica-east1");
const notificacoesRef = collection(db, "notificacoes");
const PAGE_SIZE = 50;
let lastDocumentCursor = null;
let hasMoreDocuments = true;

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') console.log('Persistência: Múltiplas abas abertas.');
    else if (err.code == 'unimplemented') console.log('Persistência: Navegador não suporta.');
});

window.DB = [];
window.itensFiltradosAtual = [];
window.fotosTemp = [];
window.resultadosConsultaAtual = []; 
window.imovelSelecionadoParaNotificacao = null; 
window.bancoInfracoesGlobais = []; 
window.usuariosDoSetor = [];

window.colunaOrdenacao = '';
window.ordemCrescente = true;
window.filtroStatusAtual = 'Todos';

const AR_SYNC_SERVICE_URL = 'https://smmam-ar-sync.eu-ounico.workers.dev';
const DEFAULT_DOCUMENT_PARAMETERS = Object.freeze({
    prazoRegularizacaoDias: 15,
    prazoDefesaDias: 8,
    valorURM: 0,
    textoMotivoPadrao: 'Verificação de irregularidade situada no endereço informado neste documento.',
    textoOrientacoes: 'É proibido o emprego de fogo e de capina química para a limpeza dos lotes.\nTodo o entulho/resto ou assemelhado deverá ser acondicionado; e destinado ao local apropriado.',
    textoPrazoRegularizacao: 'FICA NOTIFICADO(A) a regularizar a situação do lote em {dias} dias corridos a partir do recebimento desta.',
    textoBaseLegalNotificacao: 'O OBJETIVO DESTA NOTIFICAÇÃO É ATENDER A CONFORMIDADE MUNICIPAL NAS LEIS:\n\nLei Ordinária nº. 5.198/2011 – Art. 6º. Os proprietários de terreno(s), edificados ou não, serão responsáveis pela limpeza dele(s), bem como da(s) calçada(s), mantendo-o(s) permanentemente em perfeito estado de limpeza e capinados, evitando que sejam utilizados como depósito de resíduos de qualquer natureza.\n\nLei Complementar nº. 06/1996 - Art. 28º - O infrator tem o prazo de oito (08) dias corridos para apresentar defesa escrita, que deve ser encaminhada para a SMMAM para decisão final. (Direito à ampla defesa e ao contraditório)',
    textoQrCode: 'Após a limpeza do terreno, ou em caso de dúvidas, aponte a câmera do celular para o QR Code ao lado e envie as fotos da limpeza para o WhatsApp da Fiscalização (54) 3055-7211. A mensagem já vai pronta com o número desta notificação.',
    textoApresentacao: 'Secretaria Municipal do Meio Ambiente (SMMAM) — Setor de Fiscalização\nRua 10 de Novembro, 190 — Cidade Alta\nFone/Whats: 54 3055-7211'
});
window.parametrosDocumento = { ...DEFAULT_DOCUMENT_PARAMETERS };

function linkRastreamentoOficial(codigoAR) {
    const codigo = String(codigoAR || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(codigo)}`;
}

function interpretarStatusAR(descricao, confirmadoEntregue = false) {
    const texto = String(descricao || '').toLowerCase();
    let statusRetornoAR = 'aguardando';
    let statusNotificacao = 'enviado_ar';

    if (confirmadoEntregue || texto.includes('entregue')) {
        statusRetornoAR = 'entregue';
        statusNotificacao = 'recebido';
    } else if (texto.includes('devolvido') || texto.includes('incorreto') || texto.includes('recusado') || texto.includes('não procurado') || (texto.includes('ausente') && texto.includes('devolvido'))) {
        statusRetornoAR = 'devolvido';
    } else if (texto.includes('saiu para entrega')) {
        statusRetornoAR = 'saiu_entrega';
    } else if (texto.includes('ausente') || texto.includes('não atendido') || texto.includes('tentativa')) {
        statusRetornoAR = 'tentativa';
    } else if (texto.includes('aguardando retirada')) {
        statusRetornoAR = 'retirada';
    } else if (texto.includes('postado') || texto.includes('trânsito') || texto.includes('transito') || texto.includes('encaminhado')) {
        statusRetornoAR = 'transito';
    }

    return { statusRetornoAR, statusNotificacao, texto };
}

function candidatosPendentesAR() {
    return (window.DB || [])
        .filter(item => item?.firebaseId && item?.codigoAR && !['entregue', 'devolvido'].includes(String(item.statusRetornoAR || '').toLowerCase()))
        .slice(0, 8)
        .map(item => ({ id: item.firebaseId }));
}

function atualizarIndicadorAR(texto, tipo = 'normal') {
    const elemento = document.getElementById('arSyncStatus');
    if (!elemento) return;
    const cor = tipo === 'erro' ? '#991b1b' : tipo === 'sucesso' ? '#166534' : '#475569';
    elemento.style.color = cor;
    elemento.textContent = texto;
}

async function requisitarServicoAR(caminho, opcoes = {}) {
    if (!usuarioLogado) throw new Error('Sessão indisponível para consulta de AR.');
    const token = await usuarioLogado.getIdToken();
    const resposta = await fetch(`${AR_SYNC_SERVICE_URL}${caminho}`, {
        ...opcoes,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) }
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || 'Falha ao consultar o serviço de AR.');
    return dados;
}

window.atualizarStatusConsultaAR = async function() {
    if (!perfilUsuario || perfilUsuario.nivel === 'leitor') return;
    try {
        const dados = await requisitarServicoAR('/v1/status');
        const status = dados.status;
        if (!status) {
            atualizarIndicadorAR('Nenhuma busca compartilhada registrada hoje. A próxima ocorrerá no primeiro acesso útil após 8h ou 13h.');
            return;
        }
        if (status.state === 'running') {
            atualizarIndicadorAR('Consulta compartilhada de AR em andamento para o setor.');
            return;
        }
        atualizarIndicadorAR(`Última busca de AR: ${formatarDataHora(status.requestedAt || status.completedAt)} · ${status.slot === 'manha' ? 'janela da manhã' : status.slot === 'tarde' ? 'janela da tarde' : 'exceção administrativa'} · ${status.consulted || 0} consultado(s), ${status.updated || 0} retorno(s) obtido(s).`, 'sucesso');
    } catch (erro) {
        atualizarIndicadorAR('Status da consulta compartilhada indisponível. A consulta oficial dos Correios permanece disponível em cada registro.', 'erro');
    }
};
window.filtroTipoDocumento = 'Todos'; 
window.filtroProcessoAtual = 'ativo'; 
window.valorURMGlobal = 0; 
window.lastCheckedCheckbox = null;

let usuarioLogado = null;
let perfilUsuario = null;

const escaparHtml = escapeHtml;

async function chamarFuncaoSegura(nome, dados) {
    const callable = httpsCallable(functions, nome);
    const resposta = await callable(dados);
    return resposta.data;
}

function numeroLocalPersistido(valor, tipo, ano) {
    const texto = String(valor || '').trim().toUpperCase();
    const padrao = tipo === 'notificacao' ? /^(\d+)B?(?:\/(\d{4}))?$/ : /^(\d+)(?:\/(\d{4}))?$/;
    const encontrado = texto.match(padrao);
    if (!encontrado || (encontrado[2] && Number(encontrado[2]) !== Number(ano))) return 0;
    return Number(encontrado[1]) || 0;
}

function proximoNumeroLocal(tipo) {
    const ano = new Date().getFullYear();
    const setor = perfilUsuario?.setor || 'SMMAM';
    const maior = (window.DB || []).reduce((atual, item) => {
        const mesmoSetor = (item.setor || 'SMMAM') === setor;
        const mesmoTipo = item.tipoDocumento ? item.tipoDocumento === tipo : tipo === 'notificacao';
        return mesmoSetor && mesmoTipo ? Math.max(atual, numeroLocalPersistido(item.numNotif, tipo, ano)) : atual;
    }, 0);
    return `${String(maior + 1).padStart(4, '0')}${tipo === 'notificacao' ? 'B' : ''}/${ano}`;
}

function definirNumeroSugerido(id, tipo) {
    const campo = document.getElementById(id);
    if (!campo) return proximoNumeroLocal(tipo);
    const fallback = proximoNumeroLocal(tipo);
    campo.value = fallback;
    campo.dataset.manual = 'false';
    // A consulta completa ao Firestore evita depender apenas da página carregada no navegador.
    if (perfilUsuario) {
        chamarFuncaoSegura('suggestDocumentNumber', { type: tipo, year: new Date().getFullYear() })
            .then((retorno) => {
                if (campo.dataset.manual !== 'true' && (!campo.value || campo.value === fallback || campo.value === 'Gerado ao salvar')) {
                    campo.value = retorno.number;
                }
            })
            .catch(() => {});
    }
    return fallback;
}

window.sugerirNumero = function(tipo) {
    const id = tipo === 'notificacao' ? 'numNotif' : 'autoNum';
    return definirNumeroSugerido(id, tipo);
};

function configurarCamposDeNumeracao() {
    [['numNotif', 'notificacao'], ['autoNum', 'auto']].forEach(([id, tipo]) => {
        const campo = document.getElementById(id);
        if (!campo) return;
        campo.dataset.manual = 'false';
        campo.addEventListener('input', () => { campo.dataset.manual = 'true'; });
        campo.addEventListener('blur', () => {
            if (campo.dataset.manual === 'true' && campo.value.trim()) campo.value = campo.value.trim().toUpperCase();
        });
        if (!campo.value || campo.value === 'Gerado ao salvar') definirNumeroSugerido(id, tipo);
    });
}

function normalizarParametrosDocumento(valor = {}) {
    const inteiro = (campo, padrao) => {
        const numero = Number(valor[campo]);
        return Number.isInteger(numero) && numero >= 1 && numero <= 3650 ? numero : padrao;
    };
    const decimal = Number(valor.valorURM);
    return {
        prazoRegularizacaoDias: inteiro('prazoRegularizacaoDias', DEFAULT_DOCUMENT_PARAMETERS.prazoRegularizacaoDias),
        prazoDefesaDias: inteiro('prazoDefesaDias', DEFAULT_DOCUMENT_PARAMETERS.prazoDefesaDias),
        valorURM: Number.isFinite(decimal) && decimal >= 0 ? decimal : DEFAULT_DOCUMENT_PARAMETERS.valorURM,
        textoMotivoPadrao: String(valor.textoMotivoPadrao || DEFAULT_DOCUMENT_PARAMETERS.textoMotivoPadrao).slice(0, 1000),
        textoOrientacoes: String(valor.textoOrientacoes || DEFAULT_DOCUMENT_PARAMETERS.textoOrientacoes).slice(0, 2000),
        textoPrazoRegularizacao: String(valor.textoPrazoRegularizacao || DEFAULT_DOCUMENT_PARAMETERS.textoPrazoRegularizacao).slice(0, 1000),
        textoBaseLegalNotificacao: String(valor.textoBaseLegalNotificacao || DEFAULT_DOCUMENT_PARAMETERS.textoBaseLegalNotificacao).slice(0, 4000),
        textoQrCode: String(valor.textoQrCode || DEFAULT_DOCUMENT_PARAMETERS.textoQrCode).slice(0, 1500),
        textoApresentacao: String(valor.textoApresentacao || DEFAULT_DOCUMENT_PARAMETERS.textoApresentacao).slice(0, 1000)
    };
}

function refletirParametrosDocumentoNaTela() {
    const parametros = window.parametrosDocumento;
    const valor = (id, conteudo) => { const campo = document.getElementById(id); if (campo) campo.value = conteudo; };
    valor('configPrazoRegularizacao', parametros.prazoRegularizacaoDias);
    valor('configPrazoDefesa', parametros.prazoDefesaDias);
    valor('configURM', parametros.valorURM.toFixed(2));
    valor('configTextoMotivo', parametros.textoMotivoPadrao);
    valor('configTextoOrientacoes', parametros.textoOrientacoes);
    valor('configTextoPrazo', parametros.textoPrazoRegularizacao);
    valor('configTextoBaseLegal', parametros.textoBaseLegalNotificacao);
    valor('configTextoQrCode', parametros.textoQrCode);
    valor('configTextoApresentacao', parametros.textoApresentacao);
    valor('autoValorURMAtual', parametros.valorURM.toFixed(2));
    valor('prazoDias', `${parametros.prazoRegularizacaoDias} dias corridos`);
    const textoRegularizacao = document.getElementById('textoPrazoRegularizacao');
    if (textoRegularizacao) {
        const textoConfigurado = String(parametros.textoPrazoRegularizacao || '')
            .replace(/\{dias\}/gi, String(parametros.prazoRegularizacaoDias));
        textoRegularizacao.textContent = textoConfigurado || `Art. 25 da LC Municipal nº 6/1996: ${parametros.prazoRegularizacaoDias} dias corridos para regularização, contados da ciência/recebimento.`;
    }
    window.atualizarAvisosPrazosLegais?.();
}

window.carregarParametrosDocumento = async function() {
    if (!perfilUsuario) return;
    const setor = perfilUsuario.setor || 'SMMAM';
    try {
        const snapshot = await getDoc(doc(db, 'configuracoes', `parametros_${setor}`));
        window.parametrosDocumento = normalizarParametrosDocumento({ valorURM: window.valorURMGlobal, ...(snapshot.exists() ? snapshot.data() : {}) });
    } catch (erro) {
        console.warn('Não foi possível carregar parâmetros documentais; usando configuração padrão.', erro);
        window.parametrosDocumento = { ...DEFAULT_DOCUMENT_PARAMETERS };
    }
    window.valorURMGlobal = window.parametrosDocumento.valorURM;
    refletirParametrosDocumentoNaTela();
};

window.salvarParametrosDocumento = async function() {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return alert('Somente administradores podem alterar parâmetros do setor.');
    const parametros = normalizarParametrosDocumento({
        prazoRegularizacaoDias: document.getElementById('configPrazoRegularizacao')?.value,
        prazoDefesaDias: document.getElementById('configPrazoDefesa')?.value,
        valorURM: document.getElementById('configURM')?.value,
        textoMotivoPadrao: document.getElementById('configTextoMotivo')?.value,
        textoOrientacoes: document.getElementById('configTextoOrientacoes')?.value,
        textoPrazoRegularizacao: document.getElementById('configTextoPrazo')?.value,
        textoBaseLegalNotificacao: document.getElementById('configTextoBaseLegal')?.value,
        textoQrCode: document.getElementById('configTextoQrCode')?.value,
        textoApresentacao: document.getElementById('configTextoApresentacao')?.value
    });
    if (!confirm('Alterar parâmetros documentais afeta somente novas emissões e ficará registrado na auditoria. Confirmar?')) return;
    try {
        const retorno = await chamarFuncaoSegura('updateDocumentParameters', { parameters: parametros });
        window.parametrosDocumento = normalizarParametrosDocumento(retorno.parameters);
        window.valorURMGlobal = window.parametrosDocumento.valorURM;
        refletirParametrosDocumentoNaTela();
        window.mostrarToast('Parâmetros documentais atualizados para o setor.');
    } catch (erro) {
        console.error('Erro ao salvar parâmetros documentais', erro);
        alert('Não foi possível salvar os parâmetros. Confirme se a atualização das Functions foi implantada em homologação.');
    }
};

function obterHorario(valor) {
    if (valor && typeof valor.toDate === 'function') return valor.toDate().getTime();
    const horario = new Date(valor).getTime();
    return Number.isNaN(horario) ? 0 : horario;
}

function formatarDataHora(valor) {
    const horario = obterHorario(valor);
    return horario ? new Date(horario).toLocaleString('pt-BR') : 'Data não informada';
}

window.handleShiftClick = function(e, checkbox) {
    if (e.shiftKey && window.lastCheckedCheckbox) {
        const checkboxes = Array.from(document.querySelectorAll('.select-item'));
        const start = checkboxes.indexOf(checkbox);
        const end = checkboxes.indexOf(window.lastCheckedCheckbox);
        const slice = checkboxes.slice(Math.min(start, end), Math.max(start, end) + 1);
        slice.forEach(cb => { cb.checked = window.lastCheckedCheckbox.checked; });
    }
    window.lastCheckedCheckbox = checkbox;
}

const mostrarLoading = (mostrar, msg = "Sincronizando...") => {
    const loader = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-msg');
    if(msgEl) msgEl.innerText = msg;
    if(loader) loader.style.display = mostrar ? 'flex' : 'none';
}

window.mostrarToast = function(msg) {
    const toast = document.getElementById("toast"); 
    if(toast) {
        toast.innerText = msg; toast.className = "show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    }
}

initAuthModule({ auth, db, mostrarLoading, mostrarToast: window.mostrarToast, registrarLog: (a, d) => registrarLog(a, d), navegarPara: (v) => window.navegarPara(v), carregarDadosNuvem: () => window.carregarDadosNuvem() });
initImpressoesModule();
initBuscasModule({ db, mostrarLoading, mostrarToast: window.mostrarToast });

// MOTOR DINÂMICO COM BYPASS DE SEGURANÇA E INJEÇÃO DE LEIS
window.carregarInfracoesGlobais = async function() {
    const meuSetor = perfilUsuario ? (perfilUsuario.setor || 'SMMAM') : 'SMMAM';
    window.bancoInfracoesGlobais = [];

    try {
        const snap = await getDocs(query(collection(db, "infracoes_config"), where("setor", "==", meuSetor)));
        snap.forEach(d => { 
            const inf = d.data();
            if(inf.setor === meuSetor || !inf.setor) {
                window.bancoInfracoesGlobais.push({ id: d.id, ...inf }); 
            }
        });
    } catch(e) { 
        console.warn("Aviso: Permissão negada no Firebase. Carregando base legal direto da memória do código.", e); 
    }

    if (meuSetor === 'SMMAM') {
        const infracoesPadraoSmmam = [
            {
                id: "dinamico_mato",
                nome: "Vegetação Rasteira / Mato",
                baseLegal: "artigo 6º, parágrafo 2º, da Lei Municipal nº 5.198/2011",
                textoPadrao: "Limpeza de vegetação rasteira/mato, conforme o artigo 6º, parágrafo 2º, da Lei Municipal nº 5.198/2011 e suas alterações.",
                multaUrm: 5,
                setor: "SMMAM"
            },
            {
                id: "dinamico_residuos",
                nome: "Resíduos Sólidos Diversos / Entulhos",
                baseLegal: "artigo 41, inciso III, da LC nº 56/2002",
                textoPadrao: "Recolhimento e destinação correta de resíduos sólidos diversos/entulhos, conforme o artigo 41, inciso III, da Lei Complementar Municipal nº 56/2002.",
                multaUrm: 5,
                setor: "SMMAM"
            }
        ];
        const idsExistentes = new Set(window.bancoInfracoesGlobais.map(infracao => infracao.id));
        window.bancoInfracoesGlobais.push(...infracoesPadraoSmmam.filter(infracao => !idsExistentes.has(infracao.id)));
    }
    
    window.bancoInfracoesGlobais.sort((a,b) => a.nome.localeCompare(b.nome));

    renderizarCheckboxesInfracoes('containerInfracoesDinamicasNotif', 'notificacao');
    renderizarCheckboxesInfracoes('containerInfracoesDinamicasAuto', 'auto');
    
    if(perfilUsuario && perfilUsuario.nivel === 'admin') window.renderizarTabelaInfracoesAdmin();
}

function renderizarCheckboxesInfracoes(containerId, tipoForm) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.replaceChildren();
    
    if(window.bancoInfracoesGlobais.length === 0) {
        const aviso = document.createElement('span'); aviso.style.cssText = 'color:#64748b; font-size:11px;'; aviso.textContent = '⚠️ Nenhuma infração/lei cadastrada para o seu setor. Solicite ao Admin para cadastrar nas Configurações.'; container.appendChild(aviso);
        return;
    }

    window.bancoInfracoesGlobais.forEach(inf => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.style.marginBottom = '5px';
        
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `infr_${tipoForm}_${crypto.randomUUID()}`; checkbox.value = String(inf.id || ''); checkbox.className = `dinamico-chk-${tipoForm}`; checkbox.dataset.urm = String(inf.multaUrm || 0); if (tipoForm === 'auto') checkbox.addEventListener('change', window.somarUrmsDinamicamente);
        const label = document.createElement('label'); label.htmlFor = checkbox.id; label.style.cssText = 'display:inline-block; font-size:12px;';
        const nome = document.createElement('strong'); nome.textContent = String(inf.nome || 'Infração');
        const detalhes = document.createElement('span'); detalhes.style.cssText = 'color:#64748b; font-size:10px; margin-left:5px;'; detalhes.textContent = `(${inf.baseLegal || 'Base não informada'}) - ${inf.multaUrm || 0} URM`;
        label.append(nome, document.createTextNode(' '), detalhes); div.append(checkbox, label);
        container.appendChild(div);
    });
}

window.somarUrmsDinamicamente = function() {
    const checkboxes = document.querySelectorAll('.dinamico-chk-auto:checked');
    let totalUrm = 0;
    checkboxes.forEach(chk => { totalUrm += parseFloat(chk.getAttribute('data-urm') || 0); });
    const campoUrm = document.getElementById('autoMultaURM');
    if(campoUrm) {
        campoUrm.value = totalUrm;
        window.calcularMultaReais();
    }
}

// ADM DE INFRAÇÕES
window.salvarInfracaoNoBanco = async function() {
    const nome = document.getElementById('adminNomeInfr').value.trim();
    const baseLegal = document.getElementById('adminBaseInfr').value.trim();
    const texto = document.getElementById('adminTextoInfr').value.trim();
    const multaUrm = parseFloat(document.getElementById('adminUrmInfr').value) || 0;
    const meuSetor = perfilUsuario.setor || 'SMMAM';

    if(!nome || !baseLegal || !texto) return alert("Preencha Nome, Base e Texto.");

    mostrarLoading(true, "Salvando Lei/Infração...");
    try {
        await addDoc(collection(db, "infracoes_config"), { 
            nome, 
            baseLegal, 
            textoPadrao: texto, 
            multaUrm,
            setor: meuSetor 
        });
        window.mostrarToast("Infração cadastrada no seu setor!");
        document.getElementById('adminNomeInfr').value = '';
        document.getElementById('adminBaseInfr').value = '';
        document.getElementById('adminTextoInfr').value = '';
        await window.carregarInfracoesGlobais();
    } catch(e) { 
        alert('Não foi possível salvar a infração. Verifique se seu perfil possui permissão administrativa para o setor e tente novamente.');
    }
    mostrarLoading(false);
}

window.removerInfracaoDoBanco = async function(id) {
    if(id.startsWith("dinamico_")) return alert("Esta lei base foi injetada nativamente pelo sistema para garantir o funcionamento da SMMAM e não pode ser excluída.");
    if(!confirm("Atenção: Apagar essa infração removerá ela dos novos formulários do seu setor. Prosseguir?")) return;
    try {
        await deleteDoc(doc(db, "infracoes_config", id));
        window.mostrarToast("Removida!");
        await window.carregarInfracoesGlobais();
    } catch(e) { alert("Erro ao remover: Permissão negada no Firebase."); }
}

window.renderizarTabelaInfracoesAdmin = function() {
    const tbody = document.getElementById('tabelaInfracoesAdmin');
    if(!tbody) return;
    tbody.innerHTML = '';
    window.bancoInfracoesGlobais.forEach(inf => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${escaparHtml(inf.nome)}</strong></td>
                <td><span style="background:#e2e8f0; padding:3px 6px; font-size:11px; border-radius:4px;">${escaparHtml(inf.baseLegal)}</span></td>
                <td style="font-size:11px; color:#475569;">${escaparHtml(inf.textoPadrao)}</td>
                <td><strong>${escaparHtml(inf.multaUrm)}</strong></td>
                <td><button class="btn-danger" style="padding:4px; font-size:10px;" onclick="removerInfracaoDoBanco('${inf.id}')">Excluir</button></td>
            </tr>
        `;
    });
}

window.navegarPara = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active-view'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const view = document.getElementById('view-' + viewId);
    const nav = document.getElementById('nav-' + viewId);
    if(view) view.classList.add('active-view');
    if(nav) nav.classList.add('active');

    const pageMeta = {
        inicio: ['GESTÃO OPERACIONAL', 'Visão geral', 'Acompanhe as demandas, prazos e atividades do seu setor.'],
        notificacoes: ['OPERAÇÃO DE CAMPO', 'Nova notificação', 'Registre uma notificação, seus prazos e evidências de forma rastreável.'],
        autos: ['OPERAÇÃO DE CAMPO', 'Novo auto de infração', 'Vincule infrações, calcule URM e registre o auto com segurança.'],
        consulta: ['CONSULTA PROTEGIDA', 'Consulta cadastral', 'Localize dados imobiliários para instruir o processo de fiscalização.'],
        relatorios: ['ANÁLISE OPERACIONAL', 'Relatórios e gráficos', 'Acompanhe volume, situação e produtividade do setor.'],
        perfil: ['ACESSO INSTITUCIONAL', 'Meu perfil', 'Revise as informações vinculadas ao seu acesso.'],
        auditoria: ['GOVERNANÇA', 'Auditoria do sistema', 'Consulte o histórico operacional registrado pela aplicação.'],
        configuracoes: ['ADMINISTRAÇÃO', 'Configurações do setor', 'Gerencie regras, parâmetros e integrações do ambiente institucional.']
    };
    const meta = pageMeta[viewId];
    if(meta) {
        const eyebrow = document.getElementById('workspace-eyebrow'); const title = document.getElementById('workspace-title'); const subtitle = document.getElementById('workspace-subtitle');
        if(eyebrow) eyebrow.textContent = meta[0]; if(title) title.textContent = meta[1]; if(subtitle) subtitle.textContent = meta[2];
    }

    if(viewId === 'inicio') window.renderizarPainel();
    if(viewId === 'relatorios') window.renderizarGraficos();
    if(viewId === 'perfil') window.carregarDadosPerfil();
    if(viewId === 'configuracoes' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarConfiguracoesAdmin();
    if(viewId === 'auditoria' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarAuditoria();
    
    if(viewId === 'notificacoes' && !document.getElementById('editFirebaseIdNotif').value) {
        definirNumeroSugerido('numNotif', 'notificacao');
    }
    if(viewId === 'autos' && !document.getElementById('editFirebaseIdAuto').value) {
        definirNumeroSugerido('autoNum', 'auto');
    }
}

function calcularDataVencimento(dataRecebimento, prazoDias) {
    return addCalendarDays(dataRecebimento, Number(prazoDias));
}

window.atualizarAvisosPrazosLegais = function() {
    const recebimento = document.getElementById('dataRecebimento')?.value;
    const cienciaAuto = document.getElementById('dataCienciaAuto')?.value;
    const avisoRegularizacao = document.getElementById('prazoRegularizacaoAviso');
    const avisoDefesa = document.getElementById('prazoDefesaAviso');
    if (avisoRegularizacao) {
        const dataLimite = addCalendarDays(recebimento, window.parametrosDocumento.prazoRegularizacaoDias);
        avisoRegularizacao.textContent = dataLimite ? `Data-limite calculada: ${formatDeadline(dataLimite)}.` : 'Informe a data de recebimento para calcular a data-limite.';
    }
    if (avisoDefesa) {
        const dataLimite = addCalendarDays(cienciaAuto, window.parametrosDocumento.prazoDefesaDias);
        avisoDefesa.textContent = dataLimite ? `Data-limite calculada: ${formatDeadline(dataLimite)}.` : 'Informe a data de ciência para calcular a data-limite.';
    }
}

async function registrarLog(acaoRealizada, alvo) {
    if(!perfilUsuario) return;
    try { await chamarFuncaoSegura('recordAuditEvent', { action: acaoRealizada, documentId: alvo }); } catch(e) { console.warn('Auditoria central indisponível.', e); }
}

window.carregarAuditoria = async function() {
    const corpo = document.getElementById('tabelaAuditoriaCorpo'); if(!corpo) return; corpo.innerHTML = '<tr><td colspan="4">Carregando logs...</td></tr>';
    const meuSetor = perfilUsuario.setor || 'SMMAM';
    const ordem = document.getElementById('ordemAuditoria')?.value === 'asc' ? 'asc' : 'desc';
    try {
        let snaps;
        try {
            snaps = await getDocs(query(collection(db, "logs_auditoria"), where("setor", "==", meuSetor), orderBy("dataHora", "desc"), limit(250)));
        } catch (erroDeIndice) {
            console.warn('Índice de auditoria ainda não disponível; usando ordenação local.', erroDeIndice);
            snaps = await getDocs(query(collection(db, "logs_auditoria"), where("setor", "==", meuSetor), limit(250)));
        }
        const registros = snaps.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(data => (data.setor || 'SMMAM') === meuSetor)
            .sort((a, b) => ordem === 'asc' ? obterHorario(a.dataHora) - obterHorario(b.dataHora) : obterHorario(b.dataHora) - obterHorario(a.dataHora));
        corpo.innerHTML = '';
        if (!registros.length) {
            corpo.innerHTML = '<tr><td colspan="4">Nenhum evento de auditoria foi registrado para este setor.</td></tr>';
            return;
        }
        registros.forEach(data => {
            corpo.innerHTML += `<tr><td>${formatarDataHora(data.dataHora)}</td><td>${escaparHtml(data.usuario)}</td><td>${escaparHtml(data.acao)}</td><td>${escaparHtml(data.documentoAlvo)}</td></tr>`;
        });
    } catch(e) { corpo.innerHTML = '<tr><td colspan="4">Erro ao carregar logs.</td></tr>'; }
}

function rotuloStatus(status) {
    const statusNormalizado = status || 'pendente';
    const estilos = {
        aprovado: 'background:#dcfce7;color:#166534;',
        pendente: 'background:#fef3c7;color:#92400e;',
        bloqueado: 'background:#fee2e2;color:#991b1b;'
    };
    return `<span style="${estilos[statusNormalizado] || estilos.pendente} padding:3px 6px; border-radius:999px; font-size:10px; font-weight:700; text-transform:uppercase;">${escaparHtml(statusNormalizado)}</span>`;
}

window.carregarUsuariosDoSetor = async function() {
    const corpo = document.getElementById('tabelaUsuariosCorpo');
    if (!corpo || !perfilUsuario || perfilUsuario.nivel !== 'admin') return;
    corpo.innerHTML = '<tr><td colspan="6">Carregando perfis do setor...</td></tr>';
    const meuSetor = perfilUsuario.setor || 'SMMAM';
    try {
        const snaps = await getDocs(query(collection(db, 'usuarios'), where('setor', '==', meuSetor), limit(100)));
        window.usuariosDoSetor = snaps.docs.map(documento => ({ id: documento.id, ...documento.data() }))
            .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        if (!window.usuariosDoSetor.length) {
            corpo.innerHTML = '<tr><td colspan="6">Nenhum perfil foi encontrado para este setor.</td></tr>';
            return;
        }
        corpo.innerHTML = window.usuariosDoSetor.map(usuario => {
            const eContaAtual = usuario.id === usuarioLogado?.uid;
            const acoesStatus = eContaAtual
                ? '<span style="font-size:10px; color:#64748b;">Conta em uso</span>'
                : `<button class="btn-secondary" style="padding:4px 7px; font-size:10px;" onclick="alterarStatusUsuario('${usuario.id}', '${usuario.status === 'aprovado' ? 'bloqueado' : 'aprovado'}')">${usuario.status === 'aprovado' ? 'Bloquear' : 'Aprovar'}</button>`;
            const opcoesNivel = ['leitor', 'operador', 'admin'].map(nivel => `<option value="${nivel}" ${usuario.nivel === nivel ? 'selected' : ''}>${nivel === 'admin' ? 'Administrador' : nivel.charAt(0).toUpperCase() + nivel.slice(1)}</option>`).join('');
            const controleNivel = eContaAtual
                ? `<span style="font-size:10px; color:#64748b;">${escaparHtml(usuario.nivel || 'leitor')}</span>`
                : `<select aria-label="Nível de ${escaparHtml(usuario.nome || usuario.email)}" onchange="alterarNivelUsuario('${usuario.id}', this.value)" style="font-size:11px; padding:4px; min-width:106px;">${opcoesNivel}</select>`;
            return `<tr><td><strong>${escaparHtml(usuario.nome)}</strong><br><span style="font-size:10px; color:#64748b;">${escaparHtml(usuario.cargo || 'Cargo não informado')}</span></td><td>${escaparHtml(usuario.setor || 'SMMAM')}</td><td style="word-break:break-word; font-size:11px;">${escaparHtml(usuario.email)}</td><td>${rotuloStatus(usuario.status)}</td><td>${controleNivel}</td><td>${acoesStatus}</td></tr>`;
        }).join('');
    } catch (erro) {
        console.error('Erro ao carregar usuários do setor:', erro);
        corpo.innerHTML = '<tr><td colspan="6">Não foi possível carregar os perfis do setor. Verifique as permissões administrativas.</td></tr>';
    }
};

window.alterarStatusUsuario = async function(usuarioId, novoStatus) {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin' || usuarioId === usuarioLogado?.uid) return;
    if (!['aprovado', 'bloqueado'].includes(novoStatus)) return;
    const usuario = window.usuariosDoSetor.find(item => item.id === usuarioId);
    if (!usuario) return;
    const acao = novoStatus === 'aprovado' ? 'aprovou o perfil' : 'bloqueou o perfil';
    try {
        await updateDoc(doc(db, 'usuarios', usuarioId), { status: novoStatus });
        await registrarLog(acao, usuario.email || usuario.nome || usuarioId);
        window.mostrarToast(novoStatus === 'aprovado' ? 'Perfil aprovado para uso do setor.' : 'Perfil bloqueado. O acesso operacional foi revogado.');
        await window.carregarUsuariosDoSetor();
    } catch (erro) {
        console.error('Erro ao atualizar status de usuário:', erro);
        alert('Não foi possível alterar o status do perfil. Verifique as permissões administrativas.');
    }
};

window.alterarNivelUsuario = async function(usuarioId, novoNivel) {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin' || usuarioId === usuarioLogado?.uid) return;
    if (!['leitor', 'operador', 'admin'].includes(novoNivel)) return;
    const usuario = window.usuariosDoSetor.find(item => item.id === usuarioId);
    if (!usuario || usuario.nivel === novoNivel) return;
    try {
        await updateDoc(doc(db, 'usuarios', usuarioId), { nivel: novoNivel });
        await registrarLog('alterou o nível do perfil para ' + novoNivel, usuario.email || usuario.nome || usuarioId);
        window.mostrarToast('Nível do perfil atualizado.');
        await window.carregarUsuariosDoSetor();
    } catch (erro) {
        console.error('Erro ao atualizar nível de usuário:', erro);
        alert('Não foi possível alterar o nível do perfil. Verifique as permissões administrativas.');
    }
};

window.carregarListaVip = async function() {
    const lista = document.getElementById('listaVipEmails');
    if (!lista || !perfilUsuario || perfilUsuario.nivel !== 'admin') return;
    try {
        const snap = await getDoc(doc(db, 'configuracoes', 'lista_vip'));
        const emails = snap.exists() && Array.isArray(snap.data().emails) ? [...snap.data().emails].sort() : [];
        lista.innerHTML = emails.length ? emails.map(email => `<li style="display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:4px;"><span>${escaparHtml(email)}</span><button class="btn-danger" style="padding:2px 5px; font-size:10px;" onclick="removerEmailVip(decodeURIComponent('${encodeURIComponent(email)}'))">Revogar</button></li>`).join('') : '<li>Nenhuma exceção de domínio cadastrada.</li>';
    } catch (erro) {
        lista.innerHTML = '<li>Não foi possível carregar as exceções de domínio.</li>';
    }
};

window.removerEmailVip = async function(email) {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return;
    if (!confirm(`Revogar a autorização de ${email}? Isso não bloqueia contas já aprovadas.`)) return;
    try {
        const vipRef = doc(db, 'configuracoes', 'lista_vip');
        const snap = await getDoc(vipRef);
        const emails = snap.exists() && Array.isArray(snap.data().emails) ? snap.data().emails.filter(item => item !== email) : [];
        await setDoc(vipRef, { emails }, { merge: true });
        await registrarLog('revogou uma exceção de domínio', email);
        window.mostrarToast('Exceção de domínio revogada.');
        await window.carregarListaVip();
    } catch (erro) {
        console.error('Erro ao revogar exceção de domínio:', erro);
        alert('Não foi possível revogar a exceção de domínio.');
    }
};

window.carregarConfiguracoesAdmin = async function() {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return;
    window.renderizarTabelaInfracoesAdmin();
    await Promise.all([window.carregarUsuariosDoSetor(), window.carregarListaVip(), window.carregarParametrosDocumento()]);
};

window.toggleAuthMode = function() {
    const l = document.getElementById('login-fields'); const r = document.getElementById('register-fields'); const t = document.getElementById('authTitle'); const b = document.getElementById('btnToggleAuth');
    if(l && r && t && b) {
        if(l.style.display === 'none') { l.style.display = 'block'; r.style.display = 'none'; t.innerText = 'Acesso - Fiscalização'; b.innerText = 'Servidor Novo? Solicite Acesso'; } 
        else { l.style.display = 'none'; r.style.display = 'block'; t.innerText = 'Cadastro de Servidor'; b.innerText = 'Já tenho conta (Entrar)'; }
    }
}

window.verificarRotinaCorreios = async function(forcar = false, candidatos = null) {
    if (!perfilUsuario || perfilUsuario.nivel === 'leitor') return;
    const btnForcar = document.getElementById('btnForcarCorreios');
    if (forcar && perfilUsuario.nivel !== 'admin') {
        alert('A sincronização manual é exclusiva de administradores. A rotina compartilhada continuará no primeiro acesso útil.');
        return;
    }
    if (forcar && btnForcar) { btnForcar.textContent = '⏳ Consultando ARs protegidos...'; btnForcar.disabled = true; }
    try {
        const resposta = await requisitarServicoAR('/v1/sync', {
            method: 'POST',
            body: JSON.stringify({ manual: forcar, candidates: candidatos || candidatosPendentesAR() })
        });
        if (!resposta.executed) {
            const mensagens = {
                outside_business_window: 'A rotina ocorre somente em dias úteis após 8h ou 13h.',
                running: 'Uma consulta compartilhada já está em andamento.',
                done: 'A janela de consulta deste turno já foi concluída.'
            };
            atualizarIndicadorAR(mensagens[resposta.reason] || 'Nenhuma nova consulta foi necessária nesta janela.');
            return;
        }
        let alterados = 0;
        for (const item of resposta.results || []) {
            if (!item.ok) continue;
            const status = interpretarStatusAR(item.tracking.descricao, item.tracking.entregue);
            const atual = (window.DB || []).find(registro => registro.firebaseId === item.id) || {};
            const dados = { statusRetornoAR: status.statusRetornoAR, statusCorreiosTexto: status.texto.toUpperCase(), statusNotificacao: status.statusNotificacao };
            // A entrega do AR não é, por si só, uma certidão de data para a contagem legal.
            // O rastreio é anexado como evento auditável; a ciência é confirmada separadamente.
            if (dados.statusRetornoAR !== atual.statusRetornoAR || dados.statusCorreiosTexto !== atual.statusCorreiosTexto || dados.statusNotificacao !== atual.statusNotificacao) {
                const dataEvento = /^\d{4}-\d{2}-\d{2}/.test(String(item.tracking.dataEvento || '')) ? String(item.tracking.dataEvento).slice(0, 10) : new Date().toISOString().slice(0, 10);
                await chamarFuncaoSegura('recordNotificationFollowUp', { documentId: item.id, eventType: 'atualizacao_rastreio_ar', eventDate: dataEvento, note: `Atualização automática dos Correios: ${status.texto || 'sem descrição'}`, trackingStatus: status.statusRetornoAR, trackingText: status.texto });
                alterados++;
            }
        }
        const resumo = resposta.summary || {};
        atualizarIndicadorAR(`Última busca de AR: ${formatarDataHora(resumo.requestedAt)} · ${resumo.slot === 'manha' ? 'janela da manhã' : 'janela da tarde'} · ${resumo.consulted || 0} consultado(s), ${alterados} atualização(ões) aplicada(s).`, 'sucesso');
        if (alterados) await window.carregarDadosNuvem();
        if (forcar) alert(`Consulta compartilhada concluída. ${resumo.consulted || 0} AR(s) consultado(s) e ${alterados} atualização(ões) aplicada(s).`);
    } catch (erro) {
        console.error('Falha na sincronização compartilhada de AR', erro);
        atualizarIndicadorAR('A consulta compartilhada falhou. Use a consulta oficial dos Correios no registro e tente novamente na próxima janela.', 'erro');
        if (forcar) alert('Não foi possível concluir a consulta. Acesse a consulta oficial dos Correios no registro.');
    } finally {
        if (forcar && btnForcar) { btnForcar.textContent = '🔄 Sincronizar ARs agora'; btnForcar.disabled = false; }
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user; mostrarLoading(true, "Carregando Plataforma...");
        
        try {
            const configSnap = await getDoc(doc(db, "configuracoes", "sistema"));
            if(configSnap.exists()) window.valorURMGlobal = configSnap.data().valorURM || 0;
            const campoURM = document.getElementById('autoValorURMAtual');
            if(campoURM) campoURM.value = window.valorURMGlobal.toFixed(2);
        } catch(e) {}

        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                perfilUsuario = docSnap.data(); 
                if(!perfilUsuario.setor) perfilUsuario.setor = 'SMMAM';
                if(!perfilUsuario.status) perfilUsuario.status = 'pendente';
                if(!perfilUsuario.nivel) perfilUsuario.nivel = 'leitor';
                window.perfilUsuarioAtual = perfilUsuario;
                
                const areaBotoesAdminExcluir = document.getElementById('areaBotoesAdminExcluir');
                if (areaBotoesAdminExcluir) {
                    areaBotoesAdminExcluir.style.display = perfilUsuario.nivel === 'admin' ? 'inline-flex' : 'none';
                }

                await window.carregarInfracoesGlobais(); 
                await window.carregarParametrosDocumento();

                if (perfilUsuario.status === 'pendente' || perfilUsuario.status === 'bloqueado') {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'block';
                    if(document.getElementById('areaBotoesAdminExcluir')) document.getElementById('areaBotoesAdminExcluir').style.display = 'none';
                    if(perfilUsuario.status === 'bloqueado' && document.querySelector('#waiting-room h2')) document.querySelector('#waiting-room h2').innerText = '🚫 Acesso Bloqueado';
                } else {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'flex';
                    aplicarRestricoesDeTela(); 
                    await window.carregarDadosNuvem(); 
                    window.navegarPara('inicio');
                    await window.atualizarStatusConsultaAR();
                    window.verificarRotinaCorreios(); 
                }
            } else {
                perfilUsuario = null;
                if(document.getElementById('areaBotoesAdminExcluir')) document.getElementById('areaBotoesAdminExcluir').style.display = 'none';
                if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none';
                if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none';
                if(document.getElementById('waiting-room')) {
                    document.getElementById('waiting-room').style.display = 'block';
                    const waitingTitle = document.querySelector('#waiting-room h2'); const waitingText = document.querySelector('#waiting-room p');
                    if(waitingTitle) waitingTitle.textContent = 'Acesso sem perfil autorizado';
                    if(waitingText) waitingText.innerHTML = 'Sua conta foi autenticada, mas ainda não possui um perfil institucional aprovado.<br>Solicite a liberação ao responsável pelo seu setor antes de utilizar dados de fiscalização.';
                }
            }
        } catch(e) { console.error(e); alert("Erro na inicialização: " + e.message); }
        mostrarLoading(false);
    } else {
        if(document.getElementById('areaBotoesAdminExcluir')) document.getElementById('areaBotoesAdminExcluir').style.display = 'none';
        if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'flex'; 
        if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
        if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none';
    }
});

window.adicionarEmailVip = async function() {
    const emailVip = document.getElementById('adminVipEmail').value.toLowerCase().trim();
    if(!emailVip) return alert("Digite um e-mail para liberar.");
    
    try {
        const vipRef = doc(db, "configuracoes", "lista_vip");
        const snap = await getDoc(vipRef);
        let lista = [];
        if(snap.exists() && snap.data().emails) lista = snap.data().emails;
        
        if(!lista.includes(emailVip)) {
            lista.push(emailVip);
            await setDoc(vipRef, { emails: lista }, { merge: true });
            window.mostrarToast("E-mail externo autorizado com sucesso!");
            document.getElementById('adminVipEmail').value = '';
            await registrarLog('autorizou uma exceção de domínio', emailVip);
            await window.carregarListaVip();
        } else {
            alert("Este e-mail já possui autorização VIP.");
        }
    } catch(e) {
        alert("Erro ao adicionar na Lista VIP: " + e.message);
    }
}


function aplicarRestricoesDeTela() {
    if(!perfilUsuario) return;
    const setorEl = document.getElementById('sidebar-setor'); if(setorEl) setorEl.innerText = perfilUsuario.setor || 'SMMAM';
    
    if (perfilUsuario.nome === 'Administrador Legado') {
        perfilUsuario.nome = 'Humberto';
        if (usuarioLogado) { updateDoc(doc(db, "usuarios", usuarioLogado.uid), { nome: 'Humberto' }).catch(()=>{}); }
    }
    
    let nivelStr = perfilUsuario.nivel ? String(perfilUsuario.nivel).toUpperCase() : 'LEITOR';
    if (nivelStr === 'ADMIN') nivelStr = 'ADM DO SETOR';

    const userLogEl = document.getElementById('userLoggedDisplay'); 
    if(userLogEl) { userLogEl.replaceChildren(); const nome = document.createElement('strong'); nome.textContent = `👤 ${perfilUsuario.nome || 'Servidor'}`; const nivel = document.createElement('span'); nivel.style.color = '#94a3b8'; nivel.textContent = nivelStr; userLogEl.append(nome, document.createElement('br'), nivel); }
    
    const fiscalEl = document.getElementById('fiscal'); if(fiscalEl) fiscalEl.value = perfilUsuario.nome || ''; 
    const matEl = document.getElementById('matricula'); if(matEl) matEl.value = perfilUsuario.matricula || '';
    
    const areaSalvarNotif = document.getElementById('areaBotoesSalvarNotif'); const areaSalvarAuto = document.getElementById('areaBotoesSalvarAuto');
    if(perfilUsuario.nivel === 'leitor') { if(areaSalvarNotif) areaSalvarNotif.style.display = 'none'; if(areaSalvarAuto) areaSalvarAuto.style.display = 'none'; }
    
    const menuAdmin = document.getElementById('menu-admin-area'); const btnExcluir = document.getElementById('areaBotoesAdminExcluir');
    if(perfilUsuario.nivel === 'admin') { if(menuAdmin) menuAdmin.style.display = 'block'; if(btnExcluir) btnExcluir.style.display = 'inline-flex'; } else { if(menuAdmin) menuAdmin.style.display = 'none'; if(btnExcluir) btnExcluir.style.display = 'none'; }
}

const cepInput = document.getElementById('cep');
if(cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cepLimpo = this.value.replace(/\D/g, '');
        if(cepLimpo.length === 8) { try { const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`); const data = await response.json(); if(!data.erro) { document.getElementById('endereco').value = data.logradouro || ''; document.getElementById('bairro').value = data.bairro || ''; window.mostrarToast("Endereço localizado!"); } } catch(e) {} }
    });
}

const cadLoteInput = document.getElementById('cadLote');
if(cadLoteInput) {
    cadLoteInput.addEventListener('blur', async function() {
        const dist = document.getElementById('cadDistrito').value.padStart(2, '0'); const zona = document.getElementById('cadZona').value; const quad = document.getElementById('cadQuadra').value.padStart(3, '0'); const lote = document.getElementById('cadLote').value.padStart(4, '0');
        if(!dist || !zona || !quad || !lote || dist === '00' || quad === '000' || lote === '0000') return;
        const chaveBusca = `${dist}${zona}${quad}${lote}`;
        mostrarLoading(true, "Buscando Imóvel...");
        try {
            const q = query(collection(db, "cadastro_imobiliario"), where("chaveinscricao", ">=", chaveBusca), where("chaveinscricao", "<=", chaveBusca + "\uf8ff"), limit(1));
            const snap = await getDocs(q);
            if(!snap.empty) {
                const imovel = snap.docs[0].data();
                document.getElementById('nome').value = imovel.proprietario_principal || ''; document.getElementById('doc').value = imovel.cnpj_cpf || '';
                let endLote = imovel.logradouro || ''; if(imovel.numero && imovel.numero !== '0' && imovel.numero !== 'S/N' && imovel.numero !== 'SN') endLote += `, ${imovel.numero}`; if(imovel.complemento) endLote += ` - ${imovel.complemento}`;
                document.getElementById('loteEndereco').value = endLote; if(!document.getElementById('bairro').value) document.getElementById('bairro').value = imovel.bairro || ''; document.getElementById('cadImob').value = imovel.cadastroimobiliario || '';
                document.getElementById('doc').dispatchEvent(new Event('input')); window.mostrarToast("Preenchido!");
            } else { window.mostrarToast("Lote não encontrado."); }
        } catch(e) {} mostrarLoading(false);
    });
}

window.buscarStatusCorreios = async function(codigoAR, spanId, docId) {
    const span = document.getElementById(spanId); 
    if(!span) return;
    if (perfilUsuario?.nivel !== 'admin' || !docId) {
        span.innerHTML = `<a href="${linkRastreamentoOficial(codigoAR)}" target="_blank" rel="noopener noreferrer" style="background:#fee2e2; color:#991b1b; font-size:10px; padding:2px 5px; border-radius:4px; text-decoration:none; border:1px solid #ef4444;">↗ Consultar nos Correios</a>`;
        return;
    }
    span.innerHTML = `<span style="background:#e2e8f0; color:#64748b; font-size:10px; padding:2px 5px; border-radius:4px;">⏳ Consulta protegida...</span>`;
    await window.verificarRotinaCorreios(true, [{ id: docId }]);
    span.innerHTML = `<span style="color:#166534; font-weight:bold;">✅ Atualizado</span>`;
}

const limpaString = normalizeText;

window.buscarConsultaLivre = async function(tipoBusca) {
    const boxResult = document.getElementById('resultadoConsulta'); 
    const tbody = document.getElementById('tabelaResultadosConsulta');
    const countSpan = document.getElementById('qtdResultadosConsulta');
    
    if(boxResult) boxResult.style.display = 'none';
    if(tbody) tbody.innerHTML = '';
    window.resultadosConsultaAtual = []; 
    
    let q = null;
    let qAlternativa = null; 
    const imoveisRef = collection(db, "cadastro_imobiliario");

    if (tipoBusca === 'lote') {
        const dist = document.getElementById('consDistrito').value.padStart(2, '0'); 
        const zona = document.getElementById('consZona').value; 
        const quad = document.getElementById('consQuadra').value.padStart(3, '0'); 
        const lote = document.getElementById('consLote').value.padStart(4, '0');
        
        if(!dist || !zona || !quad || !lote || dist === '00' || quad === '000' || lote === '0000') {
            return alert("Preencha Distrito, Zona, Quadra e Lote para buscar pela chave física.");
        }
        const chaveBusca = `${dist}${zona}${quad}${lote}`;
        q = query(imoveisRef, where("chaveinscricao", ">=", chaveBusca), where("chaveinscricao", "<=", chaveBusca + "\uf8ff"), limit(50));
    
    } else if (tipoBusca === 'pessoa') {
        const docForm = document.getElementById('consDoc').value.trim();
        const nomeForm = document.getElementById('consNome').value.trim().toUpperCase();

        if (docForm) {
            q = query(imoveisRef, where("cnpj_cpf", "==", docForm), limit(50));
            const docLimpo = docForm.replace(/\D/g, '');
            qAlternativa = query(imoveisRef, where("cnpj_cpf", "==", docLimpo), limit(50));
        } else if (nomeForm) {
            q = query(imoveisRef, where("proprietario_principal", ">=", nomeForm), where("proprietario_principal", "<=", nomeForm + "\uf8ff"), limit(50));
        } else {
            return alert("Preencha o Nome ou o CPF/CNPJ.");
        }
    } else if (tipoBusca === 'endereco') {
        const ruaStrRaw = document.getElementById('consRua').value.trim();
        if(!ruaStrRaw) return alert("Preencha o nome da rua.");
        
        const ruaLimpa = limpaString(ruaStrRaw);
        const palavras = ruaLimpa.split(' ').filter(w => w.length > 2 && !['RUA','AV','AVENIDA','TRAVESSA','BECO','RODOVIA','DAS','DOS'].includes(w));
        const palavraPrincipal = palavras.length > 0 ? palavras[0] : ruaLimpa.split(' ')[0];

        if(!palavraPrincipal) return alert("Digite um nome de rua válido.");

        q = query(imoveisRef, where("logradouro_keywords", "array-contains", palavraPrincipal), limit(150));
    }

    mostrarLoading(true, "Pesquisando Cofre IPTU...");
    
    try {
        let snap = await getDocs(q);
        if(snap.empty && qAlternativa) { snap = await getDocs(qAlternativa); }

        if(!snap.empty) {
            const docsToRender = [];
            snap.forEach(docSnap => {
                const im = docSnap.data();
                if(tipoBusca === 'endereco') {
                    const numBusca = document.getElementById('consNumRua').value.trim();
                    if(numBusca && im.numero !== numBusca) return; 
                }
                docsToRender.push(im);
            });

            if(countSpan) countSpan.innerText = docsToRender.length;
            
            docsToRender.forEach(im => {
                window.resultadosConsultaAtual.push(im); 
                const indexArray = window.resultadosConsultaAtual.length - 1;
                
                let endLote = im.logradouro || ''; 
                if(im.numero && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${im.numero}`; 
                if(im.complemento) endLote += ` - ${im.complemento}`;
                if(im.bairro) endLote += ` <br><small>Bairro: ${im.bairro}</small>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${im.proprietario_principal || 'NÃO INFORMADO'}</strong></td>
                    <td>${im.cnpj_cpf || '---'}</td>
                    <td><span style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-weight:bold;">${im.chaveinscricao || 'Sem Chave'}</span><br><small style="color:#64748b">Cad: ${im.cadastroimobiliario || '---'}</small></td>
                    <td style="font-size: 11px;">${endLote}</td>
                    <td><button class="btn-primary btn-outline" onclick="abrirEspelhoCadastral(${indexArray})" style="padding: 6px 12px; font-size: 11px;">📄 Ver</button></td>
                `;
                if(tbody) tbody.appendChild(tr);
            });
            if(docsToRender.length > 0) {
                if(boxResult) boxResult.style.display = 'block'; 
                window.mostrarToast("Busca concluída!");
            } else {
                alert("A rua foi encontrada, mas o NÚMERO não bateu. Tente buscar só pela rua sem o número.");
            }
        } else { 
            if(tipoBusca === 'endereco') {
                alert("Nenhuma rua encontrada.\n\n⚠️ ATENÇÃO: Se o endereço existe, você precisa ir na aba Configurações e rodar o 'INICIAR DELTA SYNC' do IPTU novamente para que o sistema crie as chaves de busca para endereços!");
            } else {
                alert("Nenhum imóvel localizado com os dados informados.");
            }
        }
    } catch(e) { 
        console.error(e); alert("Erro na consulta técnica: " + e.message); 
    }
    mostrarLoading(false);
}

window.abrirEspelhoCadastral = function(index) {
    const im = window.resultadosConsultaAtual[index];
    if(!im) return;
    window.imovelSelecionadoParaNotificacao = im; 

    let endLote = escaparHtml(im.logradouro || '');
    if(im.numero && im.numero !== '0' && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${escaparHtml(im.numero)}`;
    if(im.complemento) endLote += ` - ${escaparHtml(im.complemento)}`;

    const html = `
        <div class="espelho-grid">
            <div class="espelho-box">
                <h4>👤 Dados do Proprietário</h4>
                <p><strong>Nome:</strong> ${escaparHtml(im.proprietario_principal || '---')}</p>
                <p><strong>CPF/CNPJ:</strong> ${escaparHtml(im.cnpj_cpf || '---')}</p>
            </div>
            <div class="espelho-box">
                <h4>🏷️ Identificação do Imóvel</h4>
                <p><strong>Cadastro (Cad):</strong> ${escaparHtml(im.cadastroimobiliario || '---')}</p>
                <p><strong>Inscrição (Chave):</strong> ${escaparHtml(im.chaveinscricao || '---')}</p>
            </div>
            <div class="espelho-box" style="grid-column: span 2;">
                <h4>📍 Localização do Imóvel</h4>
                <p><strong>Logradouro:</strong> ${endLote}</p>
                <p><strong>Bairro:</strong> ${escaparHtml(im.bairro || '---')}</p>
                <p><strong>Loteamento:</strong> ${escaparHtml(im.loteamento || '---')}</p>
            </div>
            <div class="espelho-box" style="grid-column: span 2;">
                <h4>📐 Dados Físicos do Lote</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <p><strong>Área do Terreno:</strong> ${escaparHtml(im.areaterreno || '---')} m²</p>
                    <p><strong>Testada:</strong> ${escaparHtml(im.testada || '---')} m</p>
                    <p><strong>Fração Ideal:</strong> ${escaparHtml(im.fracaoideal || '---')} %</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('conteudo-espelho').innerHTML = html;
    document.getElementById('modal-espelho-cadastral').style.display = 'flex';
}

window.fecharEspelhoCadastral = function() {
    document.getElementById('modal-espelho-cadastral').style.display = 'none';
}

window.autuarDesteEspelho = function() {
    const im = window.imovelSelecionadoParaNotificacao;
    if(!im) return;
    
    fecharEspelhoCadastral();
    window.navegarPara('notificacoes');
    window.limparFormularios();
    
    document.getElementById('nome').value = im.proprietario_principal || ''; 
    document.getElementById('doc').value = im.cnpj_cpf || '';
    
    let endLote = im.logradouro || ''; 
    if(im.numero && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${im.numero}`; 
    if(im.complemento) endLote += ` - ${im.complemento}`;
    
    document.getElementById('loteEndereco').value = endLote; 
    document.getElementById('bairro').value = im.bairro || ''; 
    document.getElementById('cadImob').value = im.cadastroimobiliario || '';

    if(im.chaveinscricao && im.chaveinscricao.length >= 11) {
        const chave = String(im.chaveinscricao);
        document.getElementById('cadDistrito').value = chave.substring(0,2);
        document.getElementById('cadZona').value = chave.substring(2,3);
        document.getElementById('cadQuadra').value = chave.substring(3,6);
        document.getElementById('cadLote').value = chave.substring(6,10);
    }
    
    document.getElementById('numNotif').value = window.sugerirNumero('notificacao');
    window.mostrarToast("Dados do Espelho carregados no formulário!");
    window.scrollTo(0,0);
}

window.puxarDadosDaNotificacao = function() {
    const numPesquisa = document.getElementById('autoBuscaNotif').value.trim();
    if(!numPesquisa) return alert("Digite o número da notificação para puxar.");
    
    const meuSetor = perfilUsuario.setor || 'SMMAM';
    const notif = window.DB.find(i => i.numNotif === numPesquisa && i.tipoDocumento !== 'auto' && (i.setor || 'SMMAM') === meuSetor);
    if(!notif) return alert("Notificação não encontrada ou ela não pertence ao seu Setor.");
    
    document.getElementById('autoNome').value = notif.nome || ''; 
    document.getElementById('autoDoc').value = notif.doc || '';
    document.getElementById('autoEndOcorrencia').value = notif.loteEndereco || ''; 
    document.getElementById('autoDescricaoLei').value = "Ocorrência vinculada à Notificação " + notif.numNotif;
    window.mostrarToast("Dados importados da Notificação!");
}

window.calcularMultaReais = function() {
    const elUrm = document.getElementById('autoMultaURM'); const elReais = document.getElementById('autoMultaReais');
    if(!elUrm || !elReais) return;
    const qtdURM = parseFloat(elUrm.value) || 0;
    const emReais = qtdURM * window.valorURMGlobal;
    elReais.value = "R$ " + emReais.toFixed(2).replace('.', ',');
}

let chartBairrosInstance = null; let chartStatusInstance = null; let chartEvolucaoInstance = null; let chartTiposInstance = null; let chartFiscaisInstance = null; let chartEtapasInstance = null; let chartEquipesInstance = null;

window.renderizarGraficos = function() {
    if(window.DB.length === 0) return;

    let countBairros = {}; let countMeses = {}; let countFiscais = {}; let countEtapas = {}; let countEquipes = { 'Equipe 1': 0, 'Equipe 2': 0, 'Não identificada': 0 }; let countTipos = { 'Mato/Vegetação': 0, 'Resíduos/Entulhos': 0, 'Obra/Posturas': 0, 'Outros': 0 };
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let stNoPrazo = 0; let stVencido = 0; let stAutos = 0; let totalMultasReais = 0;

    window.DB.forEach(doc => { 
        if(doc.statusProcesso === 'arquivado') return; 
        let b = (doc.bairro && doc.bairro.trim() !== '') ? doc.bairro.toUpperCase() : 'NÃO INFORMADO'; countBairros[b] = (countBairros[b] || 0) + 1;
        let f = (doc.fiscal && doc.fiscal.trim() !== '') ? doc.fiscal.toUpperCase() : 'NÃO IDENTIFICADO'; countFiscais[f] = (countFiscais[f] || 0) + 1;
        const etapa = workflowLabel(doc.statusTramitacao); countEtapas[etapa] = (countEtapas[etapa] || 0) + 1;
        const equipe = doc.territorioEquipe ? `Equipe ${doc.territorioEquipe}` : 'Não identificada'; countEquipes[equipe] = (countEquipes[equipe] || 0) + 1;

        if(doc.tipoDocumento === 'auto') {
            stAutos++;
            if(doc.autoMultaURM) totalMultasReais += (parseFloat(doc.autoMultaURM) * window.valorURMGlobal);
        } else if(doc.dataRecebimento && doc.prazoDias) { 
            const dataVenc = calcularDataVencimento(doc.dataRecebimento, doc.prazoDias);
            if(dataVenc) { const pz = new Date(dataVenc + "T00:00:00"); if(pz < hoje) stVencido++; else stNoPrazo++; }
        }

        if(doc.dataNotif) { let mesAno = doc.dataNotif.substring(0, 7); countMeses[mesAno] = (countMeses[mesAno] || 0) + 1; }
    });

    const painelDinheiro = document.getElementById('painelFinanceiroValor');
    if(painelDinheiro) painelDinheiro.innerText = totalMultasReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const ctxEvolucao = document.getElementById('chartEvolucao');
    if(ctxEvolucao) {
        if(chartEvolucaoInstance) chartEvolucaoInstance.destroy();
        const mesesOrdenados = Object.keys(countMeses).sort();
        const dadosMeses = mesesOrdenados.map(m => countMeses[m]);
        const labelsMeses = mesesOrdenados.map(m => { const partes = m.split('-'); return `${partes[1]}/${partes[0]}`; });
        chartEvolucaoInstance = new Chart(ctxEvolucao, { type: 'line', data: { labels: labelsMeses, datasets: [{ label: 'Novos Cadastros', data: dadosMeses, borderColor: '#1b365d', backgroundColor: 'rgba(27, 54, 93, 0.1)', tension: 0.3, fill: true, pointRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    }

    const ctxB = document.getElementById('chartBairros');
    if(ctxB) {
        if(chartBairrosInstance) chartBairrosInstance.destroy();
        const bairrosOrdenados = Object.entries(countBairros).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const labelsBairros = bairrosOrdenados.map(item => item[0]); const dadosBairros = bairrosOrdenados.map(item => item[1]);
        chartBairrosInstance = new Chart(ctxB, { type: 'bar', data: { labels: labelsBairros, datasets: [{ label: 'Volume', data: dadosBairros, backgroundColor: '#3b82f6', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }

    const ctxTipos = document.getElementById('chartTipos');
    if(ctxTipos) {
        if(chartTiposInstance) chartTiposInstance.destroy();
        chartTiposInstance = new Chart(ctxTipos, { type: 'pie', data: { labels: Object.keys(countTipos), datasets: [{ data: Object.values(countTipos), backgroundColor: ['#22c55e', '#a855f7', '#64748b', '#cbd5e1'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } });
    }

    const ctxS = document.getElementById('chartStatus');
    if(ctxS) {
        if(chartStatusInstance) chartStatusInstance.destroy();
        chartStatusInstance = new Chart(ctxS, { type: 'doughnut', data: { labels: ['No Prazo', 'Vencidos (Irregular)', 'Multas Geradas'], datasets: [{ data: [stNoPrazo, stVencido, stAutos], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } });
    }

    const ctxFiscais = document.getElementById('chartFiscais');
    if(ctxFiscais) {
        if(chartFiscaisInstance) chartFiscaisInstance.destroy();
        const fiscaisOrdenados = Object.entries(countFiscais).sort((a, b) => b[1] - a[1]);
        const labelsFiscais = fiscaisOrdenados.map(item => item[0]); const dadosFiscais = fiscaisOrdenados.map(item => item[1]);
        chartFiscaisInstance = new Chart(ctxFiscais, { type: 'bar', data: { labels: labelsFiscais, datasets: [{ label: 'Documentos Emitidos', data: dadosFiscais, backgroundColor: '#0ea5e9', borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }

    const ctxEtapas = document.getElementById('chartEtapas');
    if(ctxEtapas) {
        if(chartEtapasInstance) chartEtapasInstance.destroy();
        chartEtapasInstance = new Chart(ctxEtapas, { type: 'bar', data: { labels: Object.keys(countEtapas), datasets: [{ label: 'Processos', data: Object.values(countEtapas), backgroundColor: '#7c3aed', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    }
    const ctxEquipes = document.getElementById('chartEquipes');
    if(ctxEquipes) {
        if(chartEquipesInstance) chartEquipesInstance.destroy();
        chartEquipesInstance = new Chart(ctxEquipes, { type: 'doughnut', data: { labels: Object.keys(countEquipes), datasets: [{ data: Object.values(countEquipes), backgroundColor: ['#2563eb', '#15803d', '#94a3b8'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } } });
    }
}

window.baixarBackupLocal = async function() {
    if(!perfilUsuario || perfilUsuario.nivel !== 'admin') return alert('Somente administradores podem gerar backup setorial.');
    const setor = perfilUsuario.setor || 'SMMAM';
    const registrosDoSetor = window.DB.filter(item => (item.setor || 'SMMAM') === setor);
    const pacote = {
        metadados: {
            formato: 'smmam-backup-setorial-v1',
            classificacao: 'uso interno restrito',
            setor,
            geradoEm: new Date().toISOString(),
            geradoPor: perfilUsuario.email || perfilUsuario.nome || 'administrador',
            totalRegistros: registrosDoSetor.length,
            instrucaoRestauracao: 'A restauração deve ser realizada por administrador autorizado, em ambiente de homologação, após validação do arquivo e aprovação da área de TI.'
        },
        notificacoes: registrosDoSetor
    };
    const data = JSON.stringify(pacote, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Restrito_${setor}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await registrarLog('GEROU BACKUP SETORIAL', `${registrosDoSetor.length} registro(s) do setor ${setor}`);
    window.mostrarToast('Backup setorial gerado. Guarde o arquivo em repositório institucional controlado.');
}

const btnImportarIptu = document.getElementById('btnAdminImportarIptu');
if(btnImportarIptu) {
    btnImportarIptu.addEventListener('click', async function() {
        const file = document.getElementById('adminFileJson').files[0]; if(!file) return alert("Selecione o arquivo JSON.");
        const progressDiv = document.getElementById('adminProgressoIptu');
        if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return alert('Somente administradores podem iniciar a importação.');
        if (file.size > 50 * 1024 * 1024) return alert('O arquivo excede o limite de 50 MB. Divida a importação em lotes menores.');
        btnImportarIptu.disabled = true;
        try {
            if(progressDiv) progressDiv.textContent = 'Validando arquivo JSON...';
            const parsed = JSON.parse(await file.text());
            if (!Array.isArray(parsed)) throw new Error('O arquivo precisa conter uma lista JSON.');
            const setor = perfilUsuario.setor || 'SMMAM';
            const jobId = crypto.randomUUID();
            const sourcePath = `iptu_imports/${setor}/${jobId}.json`;
            if(progressDiv) progressDiv.textContent = 'Enviando arquivo à fila administrativa protegida...';
            await uploadBytes(ref(storage, sourcePath), file, { contentType: 'application/json', customMetadata: { setor, enviadoPor: usuarioLogado.uid } });
            await setDoc(doc(db, 'iptu_import_jobs', jobId), { setor, sourcePath, nomeArquivo: file.name, totalDeclarado: parsed.length, status: 'pendente', solicitadoPor: usuarioLogado.uid, solicitadoPorNome: perfilUsuario.nome || 'Administrador', criadoEm: new Date().toISOString() });
            await registrarLog('solicitou importação administrativa de IPTU', `${file.name} · ${parsed.length} registro(s)`);
            if(progressDiv) { progressDiv.textContent = '✅ Arquivo enfileirado. O resultado será registrado pelo job administrativo.'; progressDiv.style.color = 'green'; }
            document.getElementById('adminFileJson').value = '';
        } catch(err) { if(progressDiv) progressDiv.textContent = `❌ Erro: ${err.message}`; }
        btnImportarIptu.disabled = false;
    });
}

window.carregarDadosNuvem = async function({ reset = true } = {}) {
    mostrarLoading(true, "Consultando demandas do seu setor...");
    try {
        const meuSetor = perfilUsuario?.setor || 'SMMAM';
        if (reset) { window.DB = []; lastDocumentCursor = null; hasMoreDocuments = true; }
        if (!hasMoreDocuments) { mostrarLoading(false); return; }
        
        const constraints = [where("setor", "==", meuSetor)];
        if (window.filtroProcessoAtual && window.filtroProcessoAtual !== 'Todos') {
            constraints.push(where("statusProcesso", "==", window.filtroProcessoAtual));
        }
        if (window.filtroTipoDocumento && window.filtroTipoDocumento !== 'Todos') {
            const tipoDocAlvo = window.filtroTipoDocumento === 'Notificacoes' ? 'notificacao' : window.filtroTipoDocumento === 'Autos' ? 'auto' : window.filtroTipoDocumento;
            constraints.push(where("tipoDocumento", "==", tipoDocAlvo));
        }
        constraints.push(orderBy("dataCriacao", "desc"));
        constraints.push(limit(PAGE_SIZE));
        if (lastDocumentCursor) constraints.push(startAfter(lastDocumentCursor));
        
        let querySnapshot;
        try {
            querySnapshot = await getDocs(query(notificacoesRef, ...constraints));
        } catch (queryErr) {
            console.warn("Consulta composta com fallback:", queryErr);
            const fallbackConstraints = [where("setor", "==", meuSetor), limit(PAGE_SIZE)];
            if (lastDocumentCursor) fallbackConstraints.push(startAfter(lastDocumentCursor));
            querySnapshot = await getDocs(query(notificacoesRef, ...fallbackConstraints));
        }
        
        querySnapshot.forEach((documento) => { 
            let data = documento.data(); data.firebaseId = documento.id; 
            if(!data.tipoDocumento) data.tipoDocumento = 'notificacao';
            if(!data.statusProcesso) data.statusProcesso = 'ativo'; 
            ['prazoRegularizacaoEm', 'prazoRegularizacaoProrrogadoEm', 'prazoDefesaEm'].forEach((campo) => {
                if (data[campo] && typeof data[campo].toDate === 'function') data[campo] = data[campo].toDate().toISOString().slice(0, 10);
            });
            window.DB.push(data);
        });
        lastDocumentCursor = querySnapshot.docs.at(-1) || lastDocumentCursor;
        hasMoreDocuments = querySnapshot.size === PAGE_SIZE;
        const loadMore = document.getElementById('btnCarregarMais');
        if (loadMore) loadMore.style.display = hasMoreDocuments ? 'inline-flex' : 'none';
        window.renderizarPainel();
    } catch (e) {
        console.error("Erro ao carregar dados do setor:", e);
    }
    mostrarLoading(false);
}

window.carregarMaisDocumentos = async function() {
    await window.carregarDadosNuvem({ reset: false });
}

window.abrirPreviaNotificacao = function() {
    const form = document.getElementById('notifForm');
    if (!form) return;
    if (!form.reportValidity()) return;
    const parametros = normalizarParametrosDocumento(window.parametrosDocumento);
    const territorio = resolveTerritory(document.getElementById('bairro').value);
    const infracoesMarcadas = Array.from(document.querySelectorAll('.dinamico-chk-notificacao:checked')).map(chk => chk.value);
    const numeroInformado = document.getElementById('numNotif').value.trim();
    const previa = {
        tipoDocumento: 'notificacao',
        numNotif: numeroInformado && numeroInformado !== 'Gerado ao salvar' ? numeroInformado : 'PRÉVIA — NUMERAÇÃO NO SALVAMENTO',
        dataNotif: document.getElementById('dataNotif').value,
        procOuvidoria: document.getElementById('procOuvidoria').value,
        tipoAR: document.getElementById('tipoAR').checked,
        tipoPresencial: document.getElementById('tipoPresencial').checked,
        dataRecebimento: document.getElementById('dataRecebimento').value,
        prazoDias: parametros.prazoRegularizacaoDias,
        prazoRegularizacaoDias: parametros.prazoRegularizacaoDias,
        nome: document.getElementById('nome').value,
        doc: document.getElementById('doc').value,
        identidade: document.getElementById('identidade')?.value || '',
        endereco: document.getElementById('endereco').value,
        telefone: document.getElementById('telefone').value,
        bairro: document.getElementById('bairro').value,
        cep: document.getElementById('cep').value,
        cidade: 'BENTO GONÇALVES',
        uf: 'RS',
        cadDistrito: document.getElementById('cadDistrito').value,
        cadZona: document.getElementById('cadZona').value,
        cadQuadra: document.getElementById('cadQuadra').value,
        cadLote: document.getElementById('cadLote').value,
        cadImob: document.getElementById('cadImob').value,
        loteEndereco: document.getElementById('loteEndereco').value,
        territorioNome: territorio.nome,
        arrayInfracoes: infracoesMarcadas,
        motivoNotificacao: document.getElementById('motivoNotificacao')?.value || '',
        ref: document.getElementById('ref').value,
        obs: document.getElementById('obs').value,
        fiscal: perfilUsuario?.nome || '',
        matricula: perfilUsuario?.matricula || '',
        setor: perfilUsuario?.setor || 'SMMAM',
        parametrosDocumento: parametros
    };
    preencherEspelhoDocumento(previa);
    const printArea = document.getElementById('print-area');
    const conteudo = document.getElementById('conteudo-previa-documento');
    if (!printArea || !conteudo) return;
    const folha = document.createElement('div');
    folha.className = 'preview-document-sheet';
    Array.from(printArea.children).forEach(child => {
        folha.appendChild(child.cloneNode(true));
    });
    conteudo.replaceChildren(folha);
    const qrcodePrevia = folha.querySelector('#qrcodeWhats');
    if (qrcodePrevia) {
        gerarQrCodeWhatsappNotificacao(previa.numNotif, qrcodePrevia);
    }
    document.getElementById('modal-previa-documento').style.display = 'flex';
};

window.fecharPreviaDocumento = function() {
    const modal = document.getElementById('modal-previa-documento');
    if (modal) modal.style.display = 'none';
};

window.imprimirPreviaDocumento = function() {
    window.print();
};

window.confirmarSalvarDaPrevia = function() {
    const form = document.getElementById('notifForm');
    if (!form) return;
    form.dataset.previaConfirmada = 'true';
    window.fecharPreviaDocumento();
    form.requestSubmit();
};

window.salvarDocumento = async function(event, tipoDoc) {
    event.preventDefault(); if(perfilUsuario.nivel === 'leitor') return alert("Leitores não salvam.");
    if (tipoDoc === 'notificacao' && event.currentTarget?.dataset.previaConfirmada !== 'true') { window.abrirPreviaNotificacao(); return; }
    if (tipoDoc === 'notificacao') delete event.currentTarget.dataset.previaConfirmada;
    mostrarLoading(true, "Verificando e Salvando...");
    
    let editId = ''; let dados = {}; let btnForm = null; let fotos = window.fotosTemp || [];
    let numeroOriginal = '';
    const anoAtual = new Date().getFullYear();
    const meuSetor = perfilUsuario.setor || 'SMMAM';

    const infracoesMarcadas = [];
    document.querySelectorAll(`.dinamico-chk-${tipoDoc}:checked`).forEach(chk => { infracoesMarcadas.push(chk.value); });

    if(tipoDoc === 'notificacao') {
        btnForm = document.getElementById('btnSalvarNotif'); editId = document.getElementById('editFirebaseIdNotif').value;
        numeroOriginal = document.getElementById('numNotif').value.trim();

        let dtRecebimento = document.getElementById('dataRecebimento').value;
        let tipoAR = document.getElementById('tipoAR').checked;
        let codAR = document.getElementById('codigoAR').value.toUpperCase();
        let stRetornoAR = document.getElementById('statusRetornoAR').value;
        let nomeNotificado = document.getElementById('nome').value;
        let docNotificado = document.getElementById('doc').value;
        
        let statusVida = 'rascunho';
        if(tipoAR) {
            if (codAR && stRetornoAR !== 'entregue') statusVida = 'enviado_ar';
            else if (codAR && stRetornoAR === 'entregue') statusVida = 'recebido';
        } else {
            if (dtRecebimento && nomeNotificado && docNotificado) statusVida = 'recebido';
        }

        const territorio = resolveTerritory(document.getElementById('bairro').value);
        const etapa = document.getElementById('statusTramitacaoNotif')?.value || 'recebido';
        dados = { tipoDocumento: 'notificacao', statusProcesso: 'ativo', statusNotificacao: statusVida, procOuvidoria: document.getElementById('procOuvidoria').value, codigoAR: codAR, statusRetornoAR: stRetornoAR, prazoDias: window.parametrosDocumento.prazoRegularizacaoDias, dataRecebimento: dtRecebimento, dataNotif: document.getElementById('dataNotif').value, tipoAR: tipoAR, tipoPresencial: document.getElementById('tipoPresencial').checked, nome: nomeNotificado, doc: docNotificado, identidade: document.getElementById('identidade')?.value || '', endereco: document.getElementById('endereco').value, telefone: document.getElementById('telefone').value, bairro: document.getElementById('bairro').value, territorioNome: territorio.nome, territorioEquipe: territorio.equipe, territorioTipo: territorio.tipo, cep: document.getElementById('cep').value, cidade: "BENTO GONÇALVES", uf: "RS", cadDistrito: document.getElementById('cadDistrito').value, cadZona: document.getElementById('cadZona').value, cadQuadra: document.getElementById('cadQuadra').value, cadLote: document.getElementById('cadLote').value, cadImob: document.getElementById('cadImob').value, loteEndereco: document.getElementById('loteEndereco').value, arrayInfracoes: infracoesMarcadas, motivoNotificacao: document.getElementById('motivoNotificacao')?.value || '', ref: document.getElementById('ref').value, obs: document.getElementById('obs').value, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: fotos.length, statusTramitacao: etapa, prazoSlaEm: calculateSlaDueDate(etapa), editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: meuSetor, numNotif: numeroOriginal, numNotifManual: document.getElementById(tipoDoc === 'notificacao' ? 'numNotif' : 'autoNum')?.dataset.manual === 'true' };
    } else {
        btnForm = document.getElementById('btnSalvarAuto'); editId = document.getElementById('editFirebaseIdAuto').value;
        numeroOriginal = document.getElementById('autoNum').value.trim();

        const etapa = document.getElementById('statusTramitacaoAuto')?.value || 'recebido';
        dados = { tipoDocumento: 'auto', statusProcesso: 'ativo', dataNotif: document.getElementById('autoData').value, dataCienciaAuto: document.getElementById('dataCienciaAuto')?.value || '', nome: document.getElementById('autoNome').value, doc: document.getElementById('autoDoc').value, loteEndereco: document.getElementById('autoEndOcorrencia').value, autoDescricaoLei: document.getElementById('autoDescricaoLei').value, arrayInfracoes: infracoesMarcadas, autoMultaURM: document.getElementById('autoMultaURM').value, cidade: "BENTO GONÇALVES", uf: "RS", fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: fotos.length, statusTramitacao: etapa, prazoSlaEm: calculateSlaDueDate(etapa), editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: meuSetor, numNotif: numeroOriginal, numNotifManual: document.getElementById(tipoDoc === 'notificacao' ? 'numNotif' : 'autoNum')?.dataset.manual === 'true' };
    }
    
    if(btnForm) btnForm.disabled = true;

    let etapaAtual = 'preparacao';
    let idDoDoc = editId;
    let docCriadoComSucesso = false;

    try {
        const etapaSelecionada = dados.statusTramitacao || 'recebido';
        if (editId) {
            etapaAtual = 'updateDocument';
            const existente = window.DB.find(item => item.firebaseId === editId);
            const etapaAnterior = existente?.statusTramitacao || 'recebido';
            delete dados.statusTramitacao; delete dados.prazoSlaEm;
            await chamarFuncaoSegura('updateDocument', { documentId: editId, type: tipoDoc, document: dados });
            // Notificações seguem o histórico próprio de AR/prorrogação/vistoria/limpeza.
            // O backend rejeita moveProcessStage direto para notificações; não bloquear o salvamento.
            if (tipoDoc !== 'notificacao' && etapaSelecionada !== etapaAnterior) {
                etapaAtual = 'moveProcessStage';
                await chamarFuncaoSegura('moveProcessStage', { documentId: editId, stage: etapaSelecionada, reason: 'Atualização do documento pelo formulário institucional.' });
            }
        }
        else {
            etapaAtual = 'createDocument';
            const criado = await chamarFuncaoSegura('createDocument', { type: tipoDoc, document: dados });
            idDoDoc = criado.id;
            numeroOriginal = criado.number;
            docCriadoComSucesso = true;
            if (tipoDoc === 'notificacao') document.getElementById('numNotif').value = numeroOriginal;
            else document.getElementById('autoNum').value = numeroOriginal;
        }
        
        etapaAtual = 'evidencias';
        const fotosSubRef = collection(db, "notificacoes", idDoDoc, "evidencias");
        const fotosAntigas = await getDocs(fotosSubRef);
        const mantidas = new Set(fotos.filter(foto => foto.persistedId).map(foto => foto.persistedId));
        for (const antiga of fotosAntigas.docs) {
            if (mantidas.has(antiga.id)) continue;
            await deleteEvidence(storage, antiga.data().storagePath).catch(() => {});
            await deleteDoc(antiga.ref);
        }
        for (const foto of fotos.filter(foto => !foto.persistedId)) {
            const metadados = await uploadEvidence(storage, { sector: meuSetor, documentId: idDoDoc, localEvidence: foto });
            await addDoc(fotosSubRef, { ...metadados, setor: meuSetor, criadoEm: new Date().toISOString(), criadoPor: perfilUsuario.nome || 'Servidor' });
        }
        
        etapaAtual = 'sincronizacao';
        await window.carregarDadosNuvem();
        window.limparFormularios();
        window.mostrarToast("Salvo na Nuvem!");
        await registrarLog(editId ? `Editou ${tipoDoc}` : `Criou ${tipoDoc}`, numeroOriginal || idDoDoc);
        window.navegarPara('inicio');
    } catch (e) {
        console.error(`Erro ao salvar documento na etapa [${etapaAtual}]`, e);
        const codigo = e?.code || 'desconhecido';
        const detalhe = e?.message || '';
        if (docCriadoComSucesso) {
            alert(`O documento institucional foi criado com sucesso (${numeroOriginal || idDoDoc}), porém ocorreu uma falha na etapa posterior [${etapaAtual}]:\n\n${codigo}${detalhe ? ` — ${detalhe}` : ''}\n\nNão tente salvar novamente para não gerar número duplicado. Recarregue a página e confira o registro na lista.`);
        } else {
            alert(`Erro ao salvar documento (etapa: ${etapaAtual}).\n\n${codigo}${detalhe ? ` — ${detalhe}` : ''}`);
        }
    }
    if(btnForm) btnForm.disabled = false; mostrarLoading(false);
}

window.arquivarDocumento = async function(id) {
    const motivo = prompt("Digite o motivo do Arquivamento (Ex: Limpeza Realizada, Cancelado, Virou Multa):");
    if(!motivo) return;
    mostrarLoading(true, "Arquivando...");
    try {
        await chamarFuncaoSegura('moveProcessStage', { documentId: id, stage: 'arquivado', reason: motivo });
        await window.carregarDadosNuvem(); window.mostrarToast("Processo Arquivado!"); await registrarLog("Arquivou Processo", `ID: ${id}`);
    } catch(e) { alert("Erro ao arquivar."); }
    mostrarLoading(false);
}

window.excluirSelecionadas = async function() {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return alert('Somente administradores podem excluir registros.');
    const selecionados = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    if (selecionados.length === 0) return alert('Marque a caixinha de pelo menos um registro na tabela para excluir.');
    if (!confirm(`Excluir DEFINITIVAMENTE ${selecionados.length} registro(s)?\n\nEsta ação remove o documento, as evidências e o histórico, e fica registrada na auditoria. Use apenas durante o desenvolvimento/homologação.`)) return;
    mostrarLoading(true, 'Excluindo registros...');
    try {
        const retorno = await chamarFuncaoSegura('deleteDocuments', { documentIds: selecionados });
        window.mostrarToast(`${(retorno.removidos || []).length} registro(s) excluído(s).`);
        await window.carregarDadosNuvem();
    } catch (erro) {
        console.error('Erro ao excluir registros', erro);
        const codigo = erro?.code || 'desconhecido';
        const detalhe = erro?.message || '';
        alert(`Não foi possível excluir (deleteDocuments).\n\n${codigo}${detalhe ? ` — ${detalhe}` : ''}`);
    }
    mostrarLoading(false);
}

window.fotoModalAtual = null;
window.abrirModalFoto = function(i) { const foto = window.fotosTemp[i]; if (!foto) return; window.fotoModalAtual = foto.previewUrl; document.getElementById('modal-image').src = foto.previewUrl; document.getElementById('photo-modal').style.display = 'flex'; }
window.fecharModalFoto = function() { document.getElementById('photo-modal').style.display = 'none'; }
window.baixarFotoAtual = function() { const a = document.createElement("a"); a.href = window.fotoModalAtual; a.download = `Evidencia_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
window.processarFotos = function(e, containerId) { const files = e.target.files; if(!files) return; for(let file of files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX = 700; let w = img.width; let h = img.height; if (w > MAX) { h *= MAX / w; w = MAX; } canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); window.fotosTemp.push({ previewUrl: canvas.toDataURL('image/jpeg', 0.72), name: file.name || 'evidencia.jpg' }); window.renderizarPreviewFotos(containerId); }; img.src = ev.target.result; }; r.readAsDataURL(file); } e.target.value = ''; }
window.renderizarPreviewFotos = function(containerId) { const container = document.getElementById(''+containerId); if(!container) return; container.replaceChildren(); window.fotosTemp.forEach((foto, i) => { const div = document.createElement('div'); div.style.position = 'relative'; const image = document.createElement('img'); image.src = foto.previewUrl; image.alt = `Evidência ${i + 1}`; image.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc;cursor:pointer;'; image.addEventListener('click', () => window.abrirModalFoto(i)); const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'X'; remove.setAttribute('aria-label', `Remover evidência ${i + 1}`); remove.style.cssText = 'position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;'; remove.addEventListener('click', () => window.removerFoto(i, containerId)); div.append(image, remove); container.appendChild(div); }); }
window.removerFoto = function(i, cid) { window.fotosTemp.splice(i, 1); window.renderizarPreviewFotos(cid); }

window.aplicarFiltro = function(status, btnElement) { window.filtroStatusAtual = status; document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.aplicarFiltroTipo = function(tipo, btnElement) { window.filtroTipoDocumento = tipo; document.querySelectorAll('.filter-type-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.carregarDadosNuvem({ reset: true }); }
window.aplicarFiltroProcesso = function(status, btnElement) { window.filtroProcessoAtual = status; document.querySelectorAll('#view-inicio .filter-group:first-child .filter-type-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.carregarDadosNuvem({ reset: true }); }
window.ordenarTabela = function(coluna) { if (window.colunaOrdenacao === coluna) { window.ordemCrescente = !window.ordemCrescente; } else { window.colunaOrdenacao = coluna; window.ordemCrescente = true; } window.renderizarPainel(); }
window.toggleTodos = function(master) { document.querySelectorAll('.select-item').forEach(cb => { cb.checked = master.checked; }); }

window.exportarRelatorioGerencial = function() {
    if (!perfilUsuario) return;
    exportManagementReport(window.itensFiltradosAtual || [], perfilUsuario.setor || 'SMMAM');
    registrarLog('exportou relatório gerencial', `${(window.itensFiltradosAtual || []).length} registro(s)`);
}

window.migrarEvidenciasLegadas = async function() {
    if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return alert('Somente administradores podem iniciar a migração.');
    if (!confirm('A migração enviará evidências antigas ao Storage em um lote controlado. Confirme que existe backup validado e aprovação para esta execução.')) return;
    const status = document.getElementById('adminProgressoEvidencias');
    const button = document.getElementById('btnMigrarEvidencias');
    try {
        if (button) button.disabled = true;
        if (status) status.textContent = 'Migrando lote protegido...';
        const result = await chamarFuncaoSegura('migrateLegacyEvidenceBatch', { limit: 20 });
        if (status) status.textContent = `✅ ${result.migrated || 0} evidência(s) migrada(s). Confira uma amostra antes de iniciar novo lote.`;
        await registrarLog('executou lote de migração de evidências', `${result.migrated || 0} evidência(s)`);
    } catch (error) {
        if (status) status.textContent = `❌ Falha na migração: ${error.message}`;
    } finally {
        if (button) button.disabled = false;
    }
}

window.atualizarTerritorioPeloBairro = function() {
    const bairro = document.getElementById('bairro')?.value || '';
    const territorio = resolveTerritory(bairro);
    const campo = document.getElementById('territorioEquipeNotif');
    if (campo) campo.value = territorio.equipe ? `Equipe ${territorio.equipe} · ${territorio.tipo}` : 'Bairro sem equipe territorial mapeada';
}

window.moverEtapaTramitacao = async function(id) {
    const item = window.DB.find(registro => registro.firebaseId === id);
    if (!item || perfilUsuario?.nivel === 'leitor') return;
    const opcoes = WORKFLOW_STAGES.map(etapa => `${etapa.id} — ${etapa.label}`).join('\n');
    const etapa = prompt(`Informe o código da nova etapa:\n${opcoes}`, item.statusTramitacao || 'recebido');
    if (!etapa) return;
    const motivo = prompt('Informe a justificativa da movimentação:');
    if (!motivo) return alert('A justificativa é obrigatória para registrar a movimentação.');
    try {
        await chamarFuncaoSegura('moveProcessStage', { documentId: id, stage: etapa.trim(), reason: motivo });
        window.mostrarToast('Etapa atualizada e registrada no histórico.');
        await window.carregarDadosNuvem();
    } catch (error) { alert(`Não foi possível movimentar a etapa: ${error.message}`); }
}

window.abrirAcompanhamentoNotificacao = function(id) {
    const item = window.DB.find(registro => registro.firebaseId === id);
    if (!item || item.tipoDocumento !== 'notificacao') return;
    const modal = document.getElementById('modal-acompanhamento-notificacao');
    if (!modal) return;
    const prazo = legalDeadlineForRecord(item);
    document.getElementById('acompanhamentoDocumentoId').value = id;
    document.getElementById('acompanhamentoData').value = new Date().toISOString().slice(0, 10);
    document.getElementById('acompanhamentoObservacao').value = '';
    document.getElementById('acompanhamentoDiasProrrogacao').value = '';
    document.getElementById('acompanhamentoTextoAR').value = item.statusCorreiosTexto || '';
    const tipo = document.getElementById('acompanhamentoTipo');
    Array.from(tipo.options).forEach(opcao => {
        const eventoAR = ['ar_postado', 'atualizacao_rastreio_ar'].includes(opcao.value);
        opcao.disabled = eventoAR && !item.tipoAR;
    });
    tipo.value = item.tipoAR ? 'atualizacao_rastreio_ar' : 'vistoria_retorno';
    document.getElementById('acompanhamentoResumo').textContent = `${item.numNotif || 'Notificação'} · etapa atual: ${workflowLabel(item.statusTramitacao)} · prazo ${prazo.prorrogado ? 'prorrogado' : 'legal'}: ${formatDeadline(prazo.due)}${item.terrenoLimpo ? ' · limpeza já confirmada' : ''}.`;
    window.atualizarCamposAcompanhamento();
    modal.style.display = 'flex';
};

window.fecharAcompanhamentoNotificacao = function() {
    const modal = document.getElementById('modal-acompanhamento-notificacao');
    if (modal) modal.style.display = 'none';
};

window.atualizarCamposAcompanhamento = function() {
    const tipo = document.getElementById('acompanhamentoTipo')?.value;
    const camposAR = document.getElementById('camposRastreioAcompanhamento');
    const campoDias = document.getElementById('campoDiasProrrogacao');
    if (camposAR) camposAR.style.display = tipo === 'atualizacao_rastreio_ar' ? 'flex' : 'none';
    if (campoDias) campoDias.style.display = tipo === 'prorrogacao_deferida' ? 'block' : 'none';
};

window.registrarAcompanhamentoNotificacao = async function() {
    const documentId = document.getElementById('acompanhamentoDocumentoId')?.value;
    const eventType = document.getElementById('acompanhamentoTipo')?.value;
    const eventDate = document.getElementById('acompanhamentoData')?.value;
    const note = document.getElementById('acompanhamentoObservacao')?.value.trim();
    const extensionDays = Number(document.getElementById('acompanhamentoDiasProrrogacao')?.value || 0);
    const trackingStatus = document.getElementById('acompanhamentoStatusAR')?.value;
    const trackingText = document.getElementById('acompanhamentoTextoAR')?.value.trim();
    if (!documentId || !eventDate || !note) return alert('Data e justificativa são obrigatórias para registrar o acompanhamento.');
    if (eventType === 'prorrogacao_deferida' && (!Number.isInteger(extensionDays) || extensionDays < 1)) return alert('Informe a quantidade de dias deferidos para a prorrogação.');
    try {
        await chamarFuncaoSegura('recordNotificationFollowUp', { documentId, eventType, eventDate, note, extensionDays, trackingStatus, trackingText });
        window.fecharAcompanhamentoNotificacao();
        await window.carregarDadosNuvem();
        window.mostrarToast('Evento de acompanhamento registrado sem alterar a notificação emitida.');
    } catch (error) {
        console.error('Falha no acompanhamento', error);
        alert(`Não foi possível registrar o acompanhamento: ${error.message}`);
    }
};

window.atualizarDashboardGraficos = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0); 
    let tAtivos = 0; let tArquivos = 0; let tRascunho = 0; let arEnv = 0; let venc = 0;
    
    window.DB.forEach(i => { 
        if(i.statusProcesso === 'arquivado') { tArquivos++; return; }
        tAtivos++;
        if(i.statusNotificacao === 'rascunho') tRascunho++;
        if(i.statusNotificacao === 'enviado_ar') arEnv++;
        if(i.dataRecebimento && i.prazoDias) { 
            const dataVenc = calcularDataVencimento(i.dataRecebimento, i.prazoDias);
            if(dataVenc && new Date(dataVenc + "T00:00:00") < hoje) venc++; 
        } 
    });
    if(document.getElementById('dashAtivos')) document.getElementById('dashAtivos').innerText = tAtivos; 
    if(document.getElementById('dashArquivados')) document.getElementById('dashArquivados').innerText = tArquivos; 
    if(document.getElementById('dashRascunhos')) document.getElementById('dashRascunhos').innerText = tRascunho; 
    if(document.getElementById('dashAREnviados')) document.getElementById('dashAREnviados').innerText = arEnv; 
    if(document.getElementById('dashVencidas')) document.getElementById('dashVencidas').innerText = venc; 
}

function numeroParaOrdenacao(valor) {
    const encontrado = String(valor || '').trim().match(/^(\d+)/);
    return encontrado ? Number(encontrado[1]) : Number.MAX_SAFE_INTEGER;
}

function compararDocumentosPorNumero(a, b) {
    const numeroA = numeroParaOrdenacao(a.numNotif);
    const numeroB = numeroParaOrdenacao(b.numNotif);
    if (numeroA !== numeroB) return numeroA - numeroB;
    return String(a.numNotif || '').localeCompare(String(b.numNotif || ''), 'pt-BR');
}

let searchTimeout;
window.onBuscaKeyUp = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { window.renderizarPainel(); }, 400); 
}

window.renderizarPainel = function() {
    window.atualizarDashboardGraficos(); const corpo = document.getElementById('tabelaCorpo'); if(!corpo) return; corpo.innerHTML = ''; 
    const buscaEl = document.getElementById('buscaInput'); const filtroTexto = buscaEl ? buscaEl.value.toLowerCase().trim() : ''; 
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    
    let filtrados = window.DB.filter(i => i.statusProcesso === window.filtroProcessoAtual);

    if(window.filtroTipoDocumento !== 'Todos') filtrados = filtrados.filter(item => item.tipoDocumento === window.filtroTipoDocumento);
    
    filtrados = filtrados.filter(item => { 
        const stringGeral = `${item.nome || ''} ${item.numNotif || ''} ${item.loteEndereco || ''} ${item.endereco || ''} ${item.codigoAR || ''} ${item.statusNotificacao || ''}`.toLowerCase();
        return stringGeral.includes(filtroTexto); 
    });

    if (window.filtroStatusAtual === 'No Prazo') { 
        filtrados = filtrados.filter(i => {
            if(!i.dataRecebimento) return false;
            const dv = legalDeadlineForRecord(i).due;
            return dv && new Date(dv + "T00:00:00") >= hoje;
        }); 
    } else if (window.filtroStatusAtual === 'Vencidos') { 
        filtrados = filtrados.filter(i => {
            if(!i.dataRecebimento) return false;
            const dv = legalDeadlineForRecord(i).due;
            return dv && new Date(dv + "T00:00:00") < hoje;
        }); 
    } else if (window.filtroStatusAtual === 'Com AR') { filtrados = filtrados.filter(i => i.codigoAR && i.codigoAR.trim() !== ""); }
    
    if (window.colunaOrdenacao) {
        filtrados.sort((a, b) => {
            if (window.colunaOrdenacao === 'numNotif') {
                const resultado = compararDocumentosPorNumero(a, b);
                return window.ordemCrescente ? resultado : -resultado;
            }
            let valA = (a[window.colunaOrdenacao] || '').toLowerCase(); let valB = (b[window.colunaOrdenacao] || '').toLowerCase(); if (valA < valB) return window.ordemCrescente ? -1 : 1; if (valA > valB) return window.ordemCrescente ? 1 : -1; return 0;
        });
    } else {
        filtrados.sort(compararDocumentosPorNumero);
    }
    window.itensFiltradosAtual = filtrados; 
    
    renderDocumentRows(corpo, filtrados, {
        onSelect: window.handleShiftClick,
        onEdit: window.carregarParaEditar,
        onFollowUp: window.abrirAcompanhamentoNotificacao,
        onPrint: window.imprimirRegistro,
        onArchive: window.arquivarDocumento,
        onMoveStage: window.moverEtapaTramitacao,
        onAutuar: () => window.navegarPara('autos'),
        onAr: (item) => window.buscarStatusCorreios(item.codigoAR, `ar-${item.firebaseId}`, item.firebaseId),
        deadline: (item) => item.dataRecebimento && item.prazoDias ? calcularDataVencimento(item.dataRecebimento, item.prazoDias) : null,
    });
    /* Legacy renderer kept below temporarily for rollback reference.
    filtrados.forEach(item => {
        const iconeFoto = (item.qtdFotosSalvas && item.qtdFotosSalvas > 0) ? ` 📷(${item.qtdFotosSalvas})` : '';
        const numeroSeguro = escaparHtml(item.numNotif || 'SEM NÚMERO');
        const nomeSeguro = escaparHtml((item.nome || 'DADOS PENDENTES').toUpperCase());
        const loteSeguro = escaparHtml(item.loteEndereco || 'Endereço não informado');
        const etapaSegura = escaparHtml(workflowLabel(item.statusTramitacao));
        const slaAtual = slaClassification(item);
        let statusHtml = ''; let botaoAutuar = ''; let botaoArquivar = `<a onclick="arquivarDocumento('${item.firebaseId}')" style="color:#d97706;">Arquivar</a>`;
        const badgeTipo = item.tipoDocumento === 'auto' ? `<span class="badge-tipo-auto">MULTA / AUTO</span>` : `<span class="badge-tipo-notif">NOTIFICAÇÃO</span>`;
        
        if (item.statusProcesso === 'arquivado') {
            botaoArquivar = '';
            statusHtml += `<div style="background:#f1f5f9; padding:6px; border-radius:4px; text-align:center; color:#475569; font-weight:bold; font-size:11px;">📂 ARQUIVADO<br><small style="font-weight:normal;">${escaparHtml(item.motivoArquivamento || '')}</small></div>`;
        } else {
            if(item.statusNotificacao === 'rascunho') {
                statusHtml += `<div style="background:#fef3c7; color:#b45309; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #fde68a;">📝 RASCUNHO</div>`;
            } else if (item.statusNotificacao === 'enviado_ar') {
                statusHtml += `<div style="background:#e0f2fe; color:#0369a1; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #bae6fd;">📬 ENVIADO POR AR</div>`;
            } else if (item.statusNotificacao === 'recebido' || item.tipoDocumento === 'auto') {
                statusHtml += `<div style="background:#dcfce7; color:#166534; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #bbf7d0;">✅ CIÊNCIA DADA</div>`;
            }

            if(item.codigoAR) { 
                let tituloTooltip = item.statusCorreiosTexto ? `Status Completo: ${escaparHtml(item.statusCorreiosTexto)}` : `Aguardando atualização.`;
                statusHtml += `
                <div title="${tituloTooltip}" style="margin-top:5px; background:#f8fafc; color:#475569; padding:4px; border-radius:4px; border:1px solid #cbd5e1; text-align:center; min-width: 140px; cursor:help;">
                    <div style="font-size:10px; font-weight:bold;">
                        AR: ${escaparHtml(item.codigoAR)} <span id="ar-${item.firebaseId}"><button style="background:none;border:none;color:inherit;font-size:10px;cursor:pointer;padding:0;text-decoration:underline;margin-left:5px;" onclick="buscarStatusCorreios('${escaparHtml(item.codigoAR)}', 'ar-${item.firebaseId}', '${item.firebaseId}')">API</button></span>
                    </div>
                </div>`; 
            }

            if(item.tipoDocumento !== 'auto') {
                if(item.dataRecebimento && item.prazoDias) { 
                    const dataVenc = calcularDataVencimento(item.dataRecebimento, item.prazoDias);
                    const df = dataVenc.split('-').reverse().join('/'); 
                    const pz = new Date(dataVenc + "T00:00:00"); 
                    if(pz < hoje) { 
                        statusHtml += `<div style="margin-top:5px;"><span class="badge-vencido">Vencido: ${df}</span></div>`; 
                        botaoAutuar = `<a class="btn-autuar" onclick="navegarPara('autos')">📝 Autuar</a>`; 
                    } else { 
                        statusHtml += `<div style="margin-top:5px;"><span class="badge-prazo">Vence em: ${df}</span></div>`; 
                    } 
                } else {
                    statusHtml += `<div style="margin-top:5px;"><span style="background:#e2e8f0; color:#475569; padding:3px 6px; font-size:10px; border-radius:4px;">⏳ Prazo Suspenso</span></div>`; 
                }
            }
            const slaLabel = slaAtual === 'vencido' ? 'SLA vencido' : slaAtual === 'proximo' ? 'SLA próximo' : slaAtual === 'no_prazo' ? 'SLA no prazo' : 'SLA suspenso';
            statusHtml += `<div style="margin-top:5px; font-size:10px; color:#334155;">Fluxo: <strong>${etapaSegura}</strong> · ${slaLabel}</div>`;
            statusHtml += `<a onclick="moverEtapaTramitacao('${item.firebaseId}')" style="display:inline-block;margin-top:5px;font-size:11px;">Tramitar</a>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="select-item" value="${item.firebaseId}" onclick="handleShiftClick(event, this)"></td><td>${badgeTipo}</td><td><strong>${numeroSeguro}</strong></td><td><div style="font-weight:bold; color:#1b365d;">${nomeSeguro} ${iconeFoto}</div><div style="font-size:11px; color:#64748b; margin-top:2px;">${loteSeguro}</div></td><td>${statusHtml}</td><td class="action-links"><a onclick="carregarParaEditar('${item.firebaseId}')">Editar</a><a onclick="imprimirRegistro('${item.firebaseId}')">Imprimir</a>${botaoArquivar}${botaoAutuar}</td>`;
        corpo.appendChild(tr);
    }); */
}

window.carregarParaEditar = async function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return;
    if (item.tipoDocumento === 'notificacao' && item.statusNotificacao !== 'rascunho') {
        window.abrirAcompanhamentoNotificacao(id);
        return;
    }
    
    if(item.tipoDocumento === 'auto') {
        window.navegarPara('autos'); window.scrollTo(0,0);
        if(document.getElementById('editFirebaseIdAuto')) document.getElementById('editFirebaseIdAuto').value = item.firebaseId;
    if(document.getElementById('autoNum')) {
        document.getElementById('autoNum').value = item.numNotif || '';
        document.getElementById('autoNum').dataset.manual = 'false';
    }
        if(document.getElementById('autoData')) document.getElementById('autoData').value = item.dataNotif || '';
        if(document.getElementById('dataCienciaAuto')) document.getElementById('dataCienciaAuto').value = item.dataCienciaAuto || '';
        if(document.getElementById('autoNome')) document.getElementById('autoNome').value = item.nome || ''; 
        if(document.getElementById('autoDoc')) document.getElementById('autoDoc').value = item.doc || ''; 
        if(document.getElementById('autoEndOcorrencia')) document.getElementById('autoEndOcorrencia').value = item.loteEndereco || ''; 
        if(document.getElementById('autoDescricaoLei')) document.getElementById('autoDescricaoLei').value = item.autoDescricaoLei || ''; 
        if(document.getElementById('autoMultaURM')) document.getElementById('autoMultaURM').value = item.autoMultaURM || ''; 
        if(document.getElementById('statusTramitacaoAuto')) document.getElementById('statusTramitacaoAuto').value = item.statusTramitacao || 'recebido';
        
        document.querySelectorAll('.dinamico-chk-auto').forEach(chk => { chk.checked = (item.arrayInfracoes || []).includes(chk.value); });
        
        window.calcularMultaReais();
        window.atualizarAvisosPrazosLegais();
        
        window.fotosTemp = []; 
        if(document.getElementById('indicadorFotosAuto')) document.getElementById('indicadorFotosAuto').style.display = 'inline-block'; 
        try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { const evidence = d.data(); const previewUrl = evidence.downloadUrl || evidence.imagemBinaria; if (previewUrl) window.fotosTemp.push({ previewUrl, persistedId: d.id, storagePath: evidence.storagePath || null, name: evidence.nomeArquivo || 'evidencia.jpg' }); }); } catch(e) {}
        if(document.getElementById('indicadorFotosAuto')) document.getElementById('indicadorFotosAuto').style.display = 'none'; 
        window.renderizarPreviewFotos('previewFotosAuto');
        return;
    }

    window.navegarPara('notificacoes'); window.scrollTo(0,0);
    if(document.getElementById('editFirebaseIdNotif')) document.getElementById('editFirebaseIdNotif').value = item.firebaseId; 
    if(document.getElementById('numNotif')) {
        document.getElementById('numNotif').value = item.numNotif || '';
        document.getElementById('numNotif').dataset.manual = 'false';
    }
    if(document.getElementById('procOuvidoria')) document.getElementById('procOuvidoria').value = item.procOuvidoria || ''; 
    if(document.getElementById('codigoAR')) document.getElementById('codigoAR').value = item.codigoAR || ''; 
    if(document.getElementById('statusRetornoAR')) document.getElementById('statusRetornoAR').value = item.statusRetornoAR || 'aguardando';
    if(document.getElementById('prazoDias')) document.getElementById('prazoDias').value = `${item.prazoRegularizacaoDias || item.prazoDias || window.parametrosDocumento.prazoRegularizacaoDias} dias corridos`;
    if(document.getElementById('statusTramitacaoNotif')) document.getElementById('statusTramitacaoNotif').value = item.statusTramitacao || 'recebido';
    if(document.getElementById('dataRecebimento')) document.getElementById('dataRecebimento').value = item.dataRecebimento || ''; 
    window.atualizarAvisosPrazosLegais();
    
    if(document.getElementById('dataNotif')) document.getElementById('dataNotif').value = item.dataNotif || ''; 
    if(document.getElementById('tipoAR')) document.getElementById('tipoAR').checked = item.tipoAR; 
    if(document.getElementById('tipoPresencial')) document.getElementById('tipoPresencial').checked = item.tipoPresencial; 
    if(document.getElementById('nome')) document.getElementById('nome').value = item.nome || ''; 
    if(document.getElementById('doc')) document.getElementById('doc').value = item.doc || ''; 
    if(document.getElementById('identidade')) document.getElementById('identidade').value = item.identidade || '';
    if(document.getElementById('endereco')) document.getElementById('endereco').value = item.endereco || ''; 
    if(document.getElementById('telefone')) document.getElementById('telefone').value = item.telefone || ''; 
    if(document.getElementById('bairro')) document.getElementById('bairro').value = item.bairro || ''; 
    window.atualizarTerritorioPeloBairro();
    if(document.getElementById('cep')) document.getElementById('cep').value = item.cep || ''; 
    if(document.getElementById('cadDistrito')) document.getElementById('cadDistrito').value = item.cadDistrito || ''; 
    if(document.getElementById('cadZona')) document.getElementById('cadZona').value = item.cadZona || ''; 
    if(document.getElementById('cadQuadra')) document.getElementById('cadQuadra').value = item.cadQuadra || ''; 
    if(document.getElementById('cadLote')) document.getElementById('cadLote').value = item.cadLote || ''; 
    if(document.getElementById('cadImob')) document.getElementById('cadImob').value = item.cadImob || ''; 
    if(document.getElementById('loteEndereco')) document.getElementById('loteEndereco').value = item.loteEndereco || ''; 
    
    document.querySelectorAll('.dinamico-chk-notificacao').forEach(chk => { chk.checked = (item.arrayInfracoes || []).includes(chk.value); });
    
    if(document.getElementById('motivoNotificacao')) document.getElementById('motivoNotificacao').value = item.motivoNotificacao || item.parametrosDocumento?.textoMotivoPadrao || window.parametrosDocumento.textoMotivoPadrao;
    if(document.getElementById('ref')) document.getElementById('ref').value = item.ref || ''; 
    if(document.getElementById('obs')) document.getElementById('obs').value = item.obs || ''; 
    
    window.fotosTemp = []; 
    if(document.getElementById('indicadorFotosNotif')) document.getElementById('indicadorFotosNotif').style.display = 'inline-block';
    try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { const evidence = d.data(); const previewUrl = evidence.downloadUrl || evidence.imagemBinaria; if (previewUrl) window.fotosTemp.push({ previewUrl, persistedId: d.id, storagePath: evidence.storagePath || null, name: evidence.nomeArquivo || 'evidencia.jpg' }); }); } catch(e) {}
    if(document.getElementById('indicadorFotosNotif')) document.getElementById('indicadorFotosNotif').style.display = 'none'; 
    window.renderizarPreviewFotos('previewFotosNotif');
}

window.limparFormularios = function() { 
    if(document.getElementById('notifForm')) document.getElementById('notifForm').reset(); 
    if(document.getElementById('autoForm')) document.getElementById('autoForm').reset(); 
    if(document.getElementById('editFirebaseIdNotif')) document.getElementById('editFirebaseIdNotif').value = ''; 
    if(document.getElementById('editFirebaseIdAuto')) document.getElementById('editFirebaseIdAuto').value = ''; 
    if(document.getElementById('numNotif')) document.getElementById('numNotif').dataset.manual = 'false';
    if(document.getElementById('autoNum')) document.getElementById('autoNum').dataset.manual = 'false';
    if(document.getElementById('statusRetornoAR')) document.getElementById('statusRetornoAR').value = 'aguardando'; 
    if(document.getElementById('statusTramitacaoNotif')) document.getElementById('statusTramitacaoNotif').value = 'recebido';
    if(document.getElementById('statusTramitacaoAuto')) document.getElementById('statusTramitacaoAuto').value = 'recebido';
    if(document.getElementById('territorioEquipeNotif')) document.getElementById('territorioEquipeNotif').value = 'Será identificada pelo bairro';
    if(document.getElementById('dataNotif')) document.getElementById('dataNotif').valueAsDate = new Date(); 
    if(document.getElementById('autoData')) document.getElementById('autoData').valueAsDate = new Date(); 
    if(document.getElementById('prazoDias')) document.getElementById('prazoDias').value = `${window.parametrosDocumento.prazoRegularizacaoDias} dias corridos`;
    if(document.getElementById('motivoNotificacao')) document.getElementById('motivoNotificacao').value = window.parametrosDocumento.textoMotivoPadrao || '';
    if(document.getElementById('autoMultaReais')) document.getElementById('autoMultaReais').value = ''; 
    window.atualizarAvisosPrazosLegais();
    if(perfilUsuario) { 
        if(document.getElementById('fiscal')) document.getElementById('fiscal').value = perfilUsuario.nome; 
        if(document.getElementById('matricula')) document.getElementById('matricula').value = perfilUsuario.matricula; 
    } 
    window.fotosTemp = []; 
    window.renderizarPreviewFotos('previewFotosNotif'); 
    window.renderizarPreviewFotos('previewFotosAuto'); 
}

window.carregarDadosPerfil = function() { 
    if(!perfilUsuario) return; 
    if(document.getElementById('perfilNome')) document.getElementById('perfilNome').value = perfilUsuario.nome; 
    if(document.getElementById('perfilMatricula')) document.getElementById('perfilMatricula').value = perfilUsuario.matricula; 
    if(document.getElementById('perfilSetorNivel')) document.getElementById('perfilSetorNivel').value = `${perfilUsuario.setor || 'SMMAM'} - ${(perfilUsuario.nivel || 'LEITOR').toUpperCase()}`; 
    if(document.getElementById('perfilTelefone')) document.getElementById('perfilTelefone').value = perfilUsuario.telefone || ''; 
}

document.getElementById('bairro')?.addEventListener('input', window.atualizarTerritorioPeloBairro);
document.getElementById('dataRecebimento')?.addEventListener('change', window.atualizarAvisosPrazosLegais);
document.getElementById('dataCienciaAuto')?.addEventListener('change', window.atualizarAvisosPrazosLegais);
configurarCamposDeNumeracao();
window.atualizarAvisosPrazosLegais();

window.imprimirRegistro = function(id) {
    const item = (window.DB || []).find(i => i.firebaseId === id);
    if (!item) return;
    preencherEspelhoDocumento(item, window.parametrosDocumento);
    setTimeout(() => window.print(), 500);
};

window.exportarExcel = function() {
    const selecionadosIds = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    let itensParaExportar = window.itensFiltradosAtual;
    
    if(selecionadosIds.length > 0) {
        itensParaExportar = window.itensFiltradosAtual.filter(i => selecionadosIds.includes(i.firebaseId));
    } else {
        return alert("Por favor, marque a caixinha de pelo menos um registro na tabela para exportar para o Excel.");
    }
    
    if(itensParaExportar.length === 0) return alert("Nenhum registro selecionado válido para exportar."); 
    if(!confirm('Este arquivo pode conter dados pessoais. Confirme que o destino é institucional e que o compartilhamento é necessário para a atividade de fiscalização.')) return;
    
    let c = ["Nº Reg", "Tipo", "Ouvidoria", "Data Emissão", "Data de ciência", "Prazo legal", "Dias", "Data-limite", "Situação do prazo", "Nome", "CPF/CNPJ", "Lote irregular", "Bairro", "Cidade", "Código AR", "Status do processo", "Fiscal"].join(';') + '\n';
    itensParaExportar.forEach(i => { const prazo = legalDeadlineForRecord(i); const marco = i.tipoDocumento === 'auto' ? i.dataCienciaAuto : i.dataRecebimento; c += `${i.numNotif || ''};${(i.tipoDocumento||'').toUpperCase()};${i.procOuvidoria || ''};${i.dataNotif ? i.dataNotif.split('-').reverse().join('/') : ''};${marco ? marco.split('-').reverse().join('/') : 'AGUARDA CIÊNCIA'};${prazo.label};${prazo.days};${prazo.due ? prazo.due.split('-').reverse().join('/') : ''};${prazo.status || 'sem_ciencia'};${(i.nome||'').toUpperCase().replace(/;/g,',')};${i.doc||''};${(i.loteEndereco||'').replace(/;/g,',')};${i.bairro||''};${i.cidade||''};${i.codigoAR||''};${(i.statusProcesso||'').toUpperCase()};${i.fiscal||''}\n`; });
    const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); 
    const l = document.createElement("a"); 
    l.href = URL.createObjectURL(b); 
    l.download = `Relatorio_${perfilUsuario.setor || 'Geral'}_${Date.now()}.csv`; 
    document.body.appendChild(l); 
    l.click(); 
    document.body.removeChild(l);
}

window.exportarVipp = function() {
    const selecionadosIds = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    
    if(selecionadosIds.length === 0) {
        return alert("Por favor, marque a caixinha de pelo menos um registro na tabela para exportar para o VIPP.");
    }

    const itensParaExportar = window.itensFiltradosAtual.filter(item => selecionadosIds.includes(item.firebaseId));

    if(itensParaExportar.length === 0) return alert("Nenhum registro selecionado válido para exportar.");
    if(!confirm('O arquivo VIPP contém dados pessoais de destinatários. Confirme que a exportação é necessária para a postagem institucional.')) return;
    
    const cabecalho = "NOME;AOS_CUIDADOS;ENTREGA_NO_VIZINHO;ENDERECO;NUMERO;COMPLEMENTO;BAIRRO;CIDADE;UF;CEP;PAIS;TELEFONE_CELULAR;E_MAIL;CPF_CNPJ;IE_RG;FILLER;NOME;ENDERECO;NUMERO;COMPLEMENTO;BAIRRO;CIDADE;UF;CEP;TELEFONE_CELULAR;E_MAIL;CPF_CNPJ;IE_RG;FILLER;FINANCEIRO;REGISTRO;PESO;FORMATO;ALTURA;LARGURA;COMPRIMENTO;ADICIONAIS;VALOR_DECLARADO;VALOR_A_COBRAR;CONTRATO;CARTAO;RFID_SSCC;FILLER;OBSERVACAO;OBSERVACAO_3;OBSERVACAO_4;OBSERVACAO_5;ID_DO_VOLUME;QTD_DE_VOLUMES;COD_CLIENTE_VISUAL;CHAVE_ROTEAMENTO;CONTA_LOTE;FILLER;TIPO_REVERSA;PRAZO;EMBALAGEM;DATA_COLETA;FILLER;CHAVE_ACESSO;SERIE_NOTA;NUMERO_NOTA;VALOR_DA_NOTA;DATA_NOTA;PROTOCOLO_NOTA;OBSERVACAO_NOTA;FILLER;FILLER_1;FILLER_2;DECLARACAO_CONTEUDO";
    
    let csv = cabecalho + "\n";
    let contagem = 0;
    
    let dataAgrupamento = new Date();
    let contaLoteStr = "LOTE_" + dataAgrupamento.toISOString().replace(/\D/g, '').substring(0, 14);
    
    itensParaExportar.forEach(item => {
        let nome = (item.nome || 'AOS CUIDADOS DO PROPRIETARIO').toUpperCase().replace(/;/g, '');
        let enderecoCompleto = (item.endereco || item.loteEndereco || 'NAO INFORMADO').toUpperCase().replace(/;/g, '');
        let numero = "SN";
        let complemento = "";
        
        let endParts = enderecoCompleto.match(/^(.*?)(?:,\s*(\d+|S\/?N|S\/ N))(.*)?$/);
        let endereco = enderecoCompleto;
        if(endParts) {
            endereco = endParts[1].trim();
            numero = endParts[2].trim();
            complemento = (endParts[3] || '').replace(/^[,\-\s]+/, '').trim();
        }
        
        let bairro = (item.bairro || 'NAO INFORMADO').toUpperCase().replace(/;/g, '');
        let cidade = (item.cidade || 'BENTO GONCALVES').toUpperCase().replace(/;/g, '');
        let uf = (item.uf || 'RS').toUpperCase();
        let cep = (item.cep || '').replace(/\D/g, '').padEnd(8, '0');
        let celular = (item.telefone || '').replace(/\D/g, '');
        let cpfCnpj = (item.doc || '').replace(/\D/g, '');
        let adicionais = item.tipoAR ? "AR" : ""; 
        
        let numNotificacao = item.numNotif || 'SEM_NUMERO';
        let textoEtiquetaBusca = `SMMAM - ${numNotificacao} - TB`;
        
        let linha = [
            nome, "", "", endereco, numero, complemento, bairro, cidade, uf, cep, "", celular, "", cpfCnpj, "", "", 
            "", "", "", "", "", "", "", "", "", "", "", "", "", 
            "", "", "100", "1", "", "", "", adicionais, "", "", "", "", "", "", 
            textoEtiquetaBusca, "", "", "", "1", "1", "", "", contaLoteStr, "", 
            "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", 
            "Documento Oficial|1|100" 
        ];
        
        csv += linha.join(";") + "\n";
        contagem++;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VIPP_Correios_Selecionados_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
