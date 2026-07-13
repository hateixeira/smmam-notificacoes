import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc, query, where, limit, orderBy, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
const notificacoesRef = collection(db, "notificacoes");

window.DB = [];
window.itensFiltradosAtual = [];
window.fotosTemp = [];
window.resultadosConsultaAtual = []; 
window.imovelSelecionadoParaNotificacao = null; 

window.colunaOrdenacao = '';
window.ordemCrescente = true;
window.filtroStatusAtual = 'Todos';
window.filtroTipoDocumento = 'Todos'; 
window.valorURMGlobal = 0; 
window.lastCheckedCheckbox = null; // Memória para o Shift+Click

let usuarioLogado = null;
let perfilUsuario = null;

// ============================================================================
// FUNÇÕES BASE E SELEÇÃO MÚLTIPLA (SHIFT+CLICK)
// ============================================================================
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

window.navegarPara = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active-view'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    const view = document.getElementById('view-' + viewId);
    const nav = document.getElementById('nav-' + viewId);
    if(view) view.classList.add('active-view');
    if(nav) nav.classList.add('active');

    if(viewId === 'inicio') window.renderizarPainel();
    if(viewId === 'relatorios') window.renderizarGraficos();
    if(viewId === 'perfil') window.carregarDadosPerfil();
    if(viewId === 'configuracoes' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarConfiguracoesAdmin();
    if(viewId === 'auditoria' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarAuditoria();
}

async function registrarLog(acaoRealizada, alvo) {
    if(!perfilUsuario) return;
    try { await addDoc(collection(db, "logs_auditoria"), { dataHora: new Date().toISOString(), usuario: perfilUsuario.nome || 'Desconhecido', matricula: perfilUsuario.matricula || '0000', setor: perfilUsuario.setor || 'SMMAM', nivel: perfilUsuario.nivel || 'leitor', acao: acaoRealizada, documentoAlvo: alvo }); } catch(e) {}
}

// ============================================================================
// AUTENTICAÇÃO E PERMISSÕES
// ============================================================================
window.toggleAuthMode = function() {
    const l = document.getElementById('login-fields'); const r = document.getElementById('register-fields'); const t = document.getElementById('authTitle'); const b = document.getElementById('btnToggleAuth');
    if(l && r && t && b) {
        if(l.style.display === 'none') { l.style.display = 'block'; r.style.display = 'none'; t.innerText = 'Acesso - Fiscalização'; b.innerText = 'Servidor Novo? Solicite Acesso'; } 
        else { l.style.display = 'none'; r.style.display = 'block'; t.innerText = 'Cadastro de Servidor'; b.innerText = 'Já tenho conta (Entrar)'; }
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
        } catch(e) { console.log("Aviso: Configurações de URM não lidas."); }

        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                perfilUsuario = docSnap.data(); 
                if(!perfilUsuario.setor) perfilUsuario.setor = 'SMMAM';
                if(!perfilUsuario.status) perfilUsuario.status = 'aprovado';
                if(!perfilUsuario.nivel) perfilUsuario.nivel = 'admin'; 
                if(!perfilUsuario.nome) perfilUsuario.nome = 'Administrador';
                if(!perfilUsuario.matricula) perfilUsuario.matricula = '0000';

                if (perfilUsuario.status === 'pendente' || perfilUsuario.status === 'bloqueado') {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'block';
                    if(perfilUsuario.status === 'bloqueado' && document.querySelector('#waiting-room h2')) document.querySelector('#waiting-room h2').innerText = '🚫 Acesso Bloqueado';
                } else {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'flex';
                    aplicarRestricoesDeTela(); window.carregarDadosNuvem(); window.navegarPara('inicio');
                }
            } else {
                const novoPerfil = { nome: "Administrador Legado", cargo: "Admin do Sistema", setor: "SMMAM", cpf: "000.000.000-00", telefone: "Não informado", matricula: "0000", email: user.email, status: "aprovado", nivel: "admin", dataCadastro: new Date().toISOString() };
                await setDoc(userDocRef, novoPerfil); 
                perfilUsuario = novoPerfil;
                if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none'; 
                if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'flex';
                aplicarRestricoesDeTela(); window.carregarDadosNuvem(); window.navegarPara('inicio');
            }
        } catch(e) { console.error(e); alert("Erro na inicialização: " + e.message + "\n\nTire um print se isso continuar!"); }
        mostrarLoading(false);
    } else {
        if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'flex'; 
        if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
        if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none';
    }
});

window.realizarLogin = function() { const email = document.getElementById('authEmail').value; const senha = document.getElementById('authPassword').value; if(!email || !senha) return alert("Preencha tudo."); mostrarLoading(true, "Acessando..."); signInWithEmailAndPassword(auth, email, senha).catch(() => { mostrarLoading(false); alert("Erro ao entrar."); }); }
window.registrarUsuario = async function() { const nome = document.getElementById('regNome').value; const cargo = document.getElementById('regCargo').value; const setor = document.getElementById('regSetor').value; const cpf = document.getElementById('regCpf').value; const telefone = document.getElementById('regTelefone').value; const matricula = document.getElementById('regMatricula').value; const email = document.getElementById('regEmail').value; const senha = document.getElementById('regPassword').value; if(!nome || !setor || !cpf || !senha) return alert("Preencha os obrigatórios."); mostrarLoading(true); try { const userC = await createUserWithEmailAndPassword(auth, email, senha); await setDoc(doc(db, "usuarios", userC.user.uid), { nome, cargo, setor, cpf, telefone, matricula, email, status: "pendente", nivel: "leitor", dataCadastro: new Date().toISOString() }); sendEmailVerification(userC.user); mostrarLoading(false); alert("Cadastro enviado para chefia."); } catch(e) { mostrarLoading(false); alert(e.message); } }
window.recuperarSenha = function() { const email = document.getElementById('authEmail').value || document.getElementById('regEmail').value; if(!email) return alert("Digite o e-mail."); sendPasswordResetEmail(auth, email).then(() => alert("E-mail de redefinição enviado!")); }
window.realizarLogout = function() { signOut(auth).then(() => { window.DB = []; window.limparFormularios(); }); }

function aplicarRestricoesDeTela() {
    if(!perfilUsuario) return;
    const setorEl = document.getElementById('sidebar-setor'); if(setorEl) setorEl.innerText = perfilUsuario.setor || 'SMMAM';
    const nivelStr = perfilUsuario.nivel ? String(perfilUsuario.nivel).toUpperCase() : 'LEITOR';
    const userLogEl = document.getElementById('userLoggedDisplay'); if(userLogEl) userLogEl.innerHTML = `👤 <strong>${perfilUsuario.nome}</strong><br><span style="color:#94a3b8">${nivelStr}</span>`;
    const fiscalEl = document.getElementById('fiscal'); if(fiscalEl) fiscalEl.value = perfilUsuario.nome || ''; 
    const matEl = document.getElementById('matricula'); if(matEl) matEl.value = perfilUsuario.matricula || '';
    
    const areaSalvarNotif = document.getElementById('areaBotoesSalvarNotif'); const areaSalvarAuto = document.getElementById('areaBotoesSalvarAuto');
    if(perfilUsuario.nivel === 'leitor') { if(areaSalvarNotif) areaSalvarNotif.style.display = 'none'; if(areaSalvarAuto) areaSalvarAuto.style.display = 'none'; }
    
    const menuAdmin = document.getElementById('menu-admin-area'); const btnExcluir = document.getElementById('areaBotoesAdminExcluir');
    if(perfilUsuario.nivel === 'admin') { if(menuAdmin) menuAdmin.style.display = 'block'; if(btnExcluir) btnExcluir.style.display = 'flex'; } else { if(menuAdmin) menuAdmin.style.display = 'none'; if(btnExcluir) btnExcluir.style.display = 'none'; }
}

// ============================================================================
// MÓDULOS DE INTEGRAÇÃO (CEP E IPTU FORMULÁRIOS)
// ============================================================================
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

window.buscarStatusCorreios = async function(codigoAR, spanId) {
    const span = document.getElementById(spanId); if(!span) return;
    span.innerHTML = `<span class="correios-status" style="background:#e2e8f0;color:#64748b;">⏳ API...</span>`;
    try {
        const response = await fetch(`https://brasilapi.com.br/api/correios/v1/${codigoAR}`);
        if(!response.ok) throw new Error('Falha');
        const data = await response.json();
        if(data.isDelivered) { span.innerHTML = `<span class="correios-status correios-entregue">📬 Entregue (API)</span>`; } else { span.innerHTML = `<span class="correios-status correios-transito">🚚 Transito (API)</span>`; }
    } catch(e) { span.innerHTML = `<a href="https://linketrack.com/track?codigo=${codigoAR}" target="_blank" class="correios-status correios-erro">Correios ↗</a>`; }
}

// ============================================================================
// CONSULTA CADASTRAL LIVRE E ESPELHO CADASTRAL
// ============================================================================
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
            return alert("Preencha o Nome ou o CPF/CNPJ para buscar por proprietário.");
        }
    }

    mostrarLoading(true, "Pesquisando Cofre IPTU...");
    
    try {
        let snap = await getDocs(q);
        if(snap.empty && qAlternativa) { snap = await getDocs(qAlternativa); }

        if(!snap.empty) {
            if(countSpan) countSpan.innerText = snap.docs.length;
            
            snap.forEach(docSnap => {
                const im = docSnap.data();
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
                    <td><button class="btn-primary btn-outline" onclick="abrirEspelhoCadastral(${indexArray})" style="padding: 6px 12px; font-size: 11px;">📄 Ver Espelho</button></td>
                `;
                if(tbody) tbody.appendChild(tr);
            });
            if(boxResult) boxResult.style.display = 'block'; 
            window.mostrarToast("Busca concluída!");
        } else { 
            alert("Nenhum imóvel localizado. DICA: Tente buscar apenas pelo primeiro nome ou verifique se o CPF tem pontuação."); 
        }
    } catch(e) { 
        console.error(e); alert("Erro na consulta com o banco de dados."); 
    }
    mostrarLoading(false);
}

window.abrirEspelhoCadastral = function(index) {
    const im = window.resultadosConsultaAtual[index];
    if(!im) return;
    window.imovelSelecionadoParaNotificacao = im; 

    let endLote = im.logradouro || ''; 
    if(im.numero && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${im.numero}`; 
    if(im.complemento) endLote += ` - ${im.complemento}`;

    const html = `
        <div class="espelho-grid">
            <div class="espelho-box">
                <h4>👤 Dados do Proprietário</h4>
                <p><strong>Nome:</strong> ${im.proprietario_principal || '---'}</p>
                <p><strong>CPF/CNPJ:</strong> ${im.cnpj_cpf || '---'}</p>
            </div>
            <div class="espelho-box">
                <h4>🏷️ Identificação do Imóvel</h4>
                <p><strong>Cadastro (Cad):</strong> ${im.cadastroimobiliario || '---'}</p>
                <p><strong>Inscrição (Chave):</strong> ${im.chaveinscricao || '---'}</p>
            </div>
            <div class="espelho-box" style="grid-column: span 2;">
                <h4>📍 Localização do Imóvel</h4>
                <p><strong>Logradouro:</strong> ${endLote}</p>
                <p><strong>Bairro:</strong> ${im.bairro || '---'}</p>
                <p><strong>Loteamento:</strong> ${im.loteamento || '---'}</p>
            </div>
            <div class="espelho-box" style="grid-column: span 2;">
                <h4>📐 Dados Físicos do Lote</h4>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <p><strong>Área do Terreno:</strong> ${im.areaterreno || '---'} m²</p>
                    <p><strong>Testada:</strong> ${im.testada || '---'} m</p>
                    <p><strong>Fração Ideal:</strong> ${im.fracaoideal || '---'} %</p>
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
    
    window.mostrarToast("Dados do Espelho carregados no formulário!");
    window.scrollTo(0,0);
}


// ============================================================================
// MÓDULO AUTO DE INFRAÇÃO E CÁLCULO DE URM
// ============================================================================
window.puxarDadosDaNotificacao = function() {
    const numPesquisa = document.getElementById('autoBuscaNotif').value.trim();
    if(!numPesquisa) return alert("Digite o número da notificação para puxar.");
    
    const notif = window.DB.find(i => i.numNotif === numPesquisa && i.tipoDocumento !== 'auto');
    if(!notif) return alert("Notificação não encontrada ou ela não pertence ao seu Setor.");
    
    document.getElementById('autoNome').value = notif.nome; document.getElementById('autoDoc').value = notif.doc;
    document.getElementById('autoEndOcorrencia').value = notif.loteEndereco; document.getElementById('autoDescricaoLei').value = "Ocorrência vinculada à Notificação " + notif.numNotif;
    window.mostrarToast("Dados importados da Notificação!");
}

window.calcularMultaReais = function() {
    const elUrm = document.getElementById('autoMultaURM'); const elReais = document.getElementById('autoMultaReais');
    if(!elUrm || !elReais) return;
    const qtdURM = parseFloat(elUrm.value) || 0;
    const emReais = qtdURM * window.valorURMGlobal;
    elReais.value = "R$ " + emReais.toFixed(2).replace('.', ',');
}

// ============================================================================
// DASHBOARDS E GRÁFICOS (CHART.JS)
// ============================================================================
let chartBairrosInstance = null; let chartStatusInstance = null; let chartEvolucaoInstance = null; let chartTiposInstance = null; let chartFiscaisInstance = null;

window.renderizarGraficos = function() {
    if(window.DB.length === 0) return;

    let countBairros = {}; let countMeses = {}; let countFiscais = {}; let countTipos = { 'Mato/Vegetação': 0, 'Resíduos/Entulhos': 0, 'Obra/Posturas': 0, 'Outros': 0 };
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let stNoPrazo = 0; let stVencido = 0; let stAutos = 0; let totalMultasReais = 0;

    window.DB.forEach(doc => { 
        let b = (doc.bairro && doc.bairro.trim() !== '') ? doc.bairro.toUpperCase() : 'NÃO INFORMADO'; countBairros[b] = (countBairros[b] || 0) + 1;
        let f = (doc.fiscal && doc.fiscal.trim() !== '') ? doc.fiscal.toUpperCase() : 'NÃO IDENTIFICADO'; countFiscais[f] = (countFiscais[f] || 0) + 1;

        if(doc.tipoDocumento === 'auto') {
            stAutos++;
            if(doc.autoMultaURM) totalMultasReais += (parseFloat(doc.autoMultaURM) * window.valorURMGlobal);
        } else if(doc.dataPrazo) { 
            const pz = new Date(doc.dataPrazo + "T00:00:00"); if(pz < hoje) stVencido++; else stNoPrazo++; 
        }

        if(doc.tipoDocumento !== 'auto') {
            if(doc.irrMato) countTipos['Mato/Vegetação']++;
            if(doc.irrResiduos) countTipos['Resíduos/Entulhos']++;
            if(doc.irrEntulhos) countTipos['Obra/Posturas']++;
            if(doc.irrOutros) countTipos['Outros']++;
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
}

// ============================================================================
// ADMINISTRAÇÃO E IMPORTAÇÃO NATIVA IPTU
// ============================================================================
window.carregarConfiguracoesAdmin = async function() {
    const corpoUsuarios = document.getElementById('tabelaUsuariosCorpo'); if(corpoUsuarios) corpoUsuarios.innerHTML = '';
    try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        usersSnapshot.forEach(docSnap => {
            const u = docSnap.data(); const uid = docSnap.id;
            const selectStatus = `<select class="select-status status-${u.status}" onchange="alterarConfigUsuario('${uid}', 'status', this.value, this)"><option value="pendente" ${u.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option><option value="aprovado" ${u.status === 'aprovado' ? 'selected' : ''}>✅ Aprovado</option><option value="bloqueado" ${u.status === 'bloqueado' ? 'selected' : ''}>🚫 Bloqueado</option></select>`;
            const selectNivel = `<select style="padding: 4px; font-size: 12px; border-radius: 4px;" onchange="alterarConfigUsuario('${uid}', 'nivel', this.value, this)"><option value="leitor" ${u.nivel === 'leitor' ? 'selected' : ''}>👁️ Leitor</option><option value="fiscal" ${u.nivel === 'fiscal' ? 'selected' : ''}>📝 Fiscal</option><option value="admin" ${u.nivel === 'admin' ? 'selected' : ''}>⚙️ Administrador</option></select>`;
            if(corpoUsuarios) corpoUsuarios.innerHTML += `<tr><td><strong>${u.nome}</strong><br><small style="color:#64748b;">${u.cargo}</small></td><td><span style="background:#e2e8f0; padding:3px; border-radius:4px; font-size:11px;">${u.setor || 'SMMAM'}</span></td><td>${u.email}</td><td>${selectStatus}</td><td>${selectNivel}</td></tr>`;
        });
    } catch(e) {}
}

window.alterarConfigUsuario = async function(uid, campo, valorNovo, selectElement) { try { await updateDoc(doc(db, "usuarios", uid), { [campo]: valorNovo }); window.mostrarToast(`Atualizado!`); if(campo === 'status') selectElement.className = `select-status status-${valorNovo}`; } catch(e) { alert("Sem permissão."); } }

const btnSalvarUrm = document.querySelector('#configURM')?.nextElementSibling;
if(btnSalvarUrm) {
    btnSalvarUrm.addEventListener('click', async function() {
        const valor = parseFloat(document.getElementById('configURM').value); if(!valor || valor <= 0) return alert("Valor inválido.");
        mostrarLoading(true);
        try { await setDoc(doc(db, "configuracoes", "sistema"), { valorURM: valor }, { merge: true }); window.valorURMGlobal = valor; const elAtual = document.getElementById('autoValorURMAtual'); if(elAtual) elAtual.value = valor.toFixed(2); window.mostrarToast("Valor URM salvo!"); await registrarLog("Alterou URM", `Novo valor: R$ ${valor}`); } catch(e) { alert("Erro ao salvar URM"); }
        mostrarLoading(false);
    });
}

const btnImportarIptu = document.getElementById('btnAdminImportarIptu');
if(btnImportarIptu) {
    btnImportarIptu.addEventListener('click', function() {
        const file = document.getElementById('adminFileJson').files[0]; if(!file) return alert("Selecione o arquivo JSON.");
        const startIndex = parseInt(document.getElementById('adminStartFrom').value) || 0;
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const dados = JSON.parse(e.target.result);
                if(!Array.isArray(dados)) return alert("Arquivo JSON inválido.");
                if (startIndex >= dados.length) return alert("Número de início maior que o total!");

                const progressDiv = document.getElementById('adminProgressoIptu');
                if(progressDiv) progressDiv.innerText = `Preparando retomada a partir do registro ${startIndex}...`;
                document.getElementById('btnAdminImportarIptu').disabled = true;

                const TAMANHO_LOTE = 400; let enviados = startIndex;

                for (let i = startIndex; i < dados.length; i += TAMANHO_LOTE) {
                    const loteAtual = dados.slice(i, i + TAMANHO_LOTE);
                    const batch = writeBatch(db);
                    loteAtual.forEach(imovel => { if(imovel.chaveinscricao) { const chaveLimpa = String(imovel.chaveinscricao).trim(); batch.set(doc(db, "cadastro_imobiliario", chaveLimpa), imovel); } });
                    await batch.commit(); enviados += loteAtual.length;
                    if(progressDiv) progressDiv.innerText = `⏳ Enviando para Nuvem: ${enviados} de ${dados.length}...`;
                    await new Promise(r => setTimeout(r, 1000));
                }
                if(progressDiv) { progressDiv.innerText = `✅ SUCESSO! Base atualizada.`; progressDiv.style.color = 'green'; }
            } catch(err) { alert("Erro: " + err.message); }
        };
        reader.readAsText(file);
    });
}

// ============================================================================
// CRUD NOTIFICAÇÕES E AUTOS (O NÚCLEO MISTO)
// ============================================================================
window.carregarDadosNuvem = async function() {
    mostrarLoading(true, "Baixando demandas...");
    try {
        const querySnapshot = await getDocs(notificacoesRef); window.DB = []; const meuSetor = perfilUsuario.setor || 'SMMAM';
        querySnapshot.forEach((documento) => { 
            let data = documento.data(); data.firebaseId = documento.id; 
            if(!data.tipoDocumento) data.tipoDocumento = 'notificacao';
            if ((data.setor || 'SMMAM') === meuSetor || perfilUsuario.nivel === 'admin') window.DB.push(data); 
        });
        window.renderizarPainel();
    } catch (e) {} mostrarLoading(false);
}

window.salvarDocumento = async function(event, tipoDoc) {
    event.preventDefault(); if(perfilUsuario.nivel === 'leitor') return alert("Leitores não salvam.");
    mostrarLoading(true, "Salvando na Nuvem...");
    
    let editId = ''; let dados = {}; let btnForm = null; let base64Array = window.fotosTemp || [];

    if(tipoDoc === 'notificacao') {
        btnForm = document.getElementById('btnSalvarNotif'); editId = document.getElementById('editFirebaseIdNotif').value;
        dados = { tipoDocumento: 'notificacao', numNotif: document.getElementById('numNotif').value, procOuvidoria: document.getElementById('procOuvidoria').value, codigoAR: document.getElementById('codigoAR').value.toUpperCase(), statusRetornoAR: document.getElementById('statusRetornoAR').value, dataPrazo: document.getElementById('dataPrazo').value, dataNotif: document.getElementById('dataNotif').value, tipoAR: document.getElementById('tipoAR').checked, tipoPresencial: document.getElementById('tipoPresencial').checked, nome: document.getElementById('nome').value, doc: document.getElementById('doc').value, endereco: document.getElementById('endereco').value, telefone: document.getElementById('telefone').value, bairro: document.getElementById('bairro').value, cep: document.getElementById('cep').value, cadDistrito: document.getElementById('cadDistrito').value, cadZona: document.getElementById('cadZona').value, cadQuadra: document.getElementById('cadQuadra').value, cadLote: document.getElementById('cadLote').value, cadImob: document.getElementById('cadImob').value, loteEndereco: document.getElementById('loteEndereco').value, irrMato: document.getElementById('irrMato').checked, irrResiduos: document.getElementById('irrResiduos').checked, irrEntulhos: document.getElementById('irrEntulhos').checked, irrOutros: document.getElementById('irrOutros').checked, ref: document.getElementById('ref').value, obs: document.getElementById('obs').value, lei5198: document.getElementById('lei5198').checked, lc56: document.getElementById('lc56').checked, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    } else {
        btnForm = document.getElementById('btnSalvarAuto'); editId = document.getElementById('editFirebaseIdAuto').value;
        dados = { tipoDocumento: 'auto', numNotif: document.getElementById('autoNum').value, dataNotif: document.getElementById('autoData').value, nome: document.getElementById('autoNome').value, doc: document.getElementById('autoDoc').value, loteEndereco: document.getElementById('autoEndOcorrencia').value, autoDescricaoLei: document.getElementById('autoDescricaoLei').value, autoMultaURM: document.getElementById('autoMultaURM').value, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    }
    
    if(btnForm) btnForm.disabled = true;
    try {
        let idDoDoc = editId;
        if (editId) { await updateDoc(doc(db, "notificacoes", editId), dados); } 
        else { dados.criadoPor = perfilUsuario.nome; dados.dataCriacao = new Date().toISOString(); const novoDoc = await addDoc(notificacoesRef, dados); idDoDoc = novoDoc.id; }
        
        const fotosSubRef = collection(db, "notificacoes", idDoDoc, "evidencias");
        if (editId) { const fotosAntigas = await getDocs(fotosSubRef); for (let f of fotosAntigas.docs) { await deleteDoc(f.ref); } }
        for (let base64 of base64Array) { await addDoc(fotosSubRef, { imagemBinaria: base64 }); }
        
        await window.carregarDadosNuvem(); window.limparFormularios(); window.mostrarToast("Salvo na Nuvem!"); await registrarLog(editId ? `Editou ${tipoDoc}` : `Criou ${tipoDoc}`, dados.numNotif); window.navegarPara('inicio');
    } catch (e) { alert("Erro ao salvar."); }
    if(btnForm) btnForm.disabled = false; mostrarLoading(false);
}

window.excluirSelecionadas = async function() {
    const m = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value); if(m.length === 0) return alert('Selecione.');
    if(confirm(`Apagar ${m.length} registro(s) PARA SEMPRE?`)) {
        mostrarLoading(true, "Excluindo...");
        try {
            for (let id of m) { const snaps = await getDocs(collection(db, "notificacoes", id, "evidencias")); for (let f of snaps.docs) { await deleteDoc(f.ref); } await deleteDoc(doc(db, "notificacoes", id)); }
            await window.carregarDadosNuvem(); window.mostrarToast("Excluído!"); await registrarLog("Excluiu Lote", m.join(", "));
        } catch(e) { alert("Erro"); } mostrarLoading(false);
    }
}

window.fotoModalAtual = null;
window.abrirModalFoto = function(i) { window.fotoModalAtual = window.fotosTemp[i]; document.getElementById('modal-image').src = window.fotoModalAtual; document.getElementById('photo-modal').style.display = 'flex'; }
window.fecharModalFoto = function() { document.getElementById('photo-modal').style.display = 'none'; }
window.baixarFotoAtual = function() { const a = document.createElement("a"); a.href = window.fotoModalAtual; a.download = `Evidencia_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
window.processarFotos = function(e, containerId) { const files = e.target.files; if(!files) return; for(let file of files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX = 700; let w = img.width; let h = img.height; if (w > MAX) { h *= MAX / w; w = MAX; } canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); window.fotosTemp.push(canvas.toDataURL('image/jpeg', 0.45)); window.renderizarPreviewFotos(containerId); }; img.src = ev.target.result; }; r.readAsDataURL(file); } e.target.value = ''; }
window.renderizarPreviewFotos = function(containerId) { const container = document.getElementById(containerId); if(!container) return; container.innerHTML = ''; window.fotosTemp.forEach((f, i) => { const div = document.createElement('div'); div.style.position = 'relative'; div.innerHTML = `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc;cursor:pointer;" onclick="abrirModalFoto(${i})"><button type="button" onclick="removerFoto(${i}, '${containerId}')" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">X</button>`; container.appendChild(div); }); }
window.removerFoto = function(i, cid) { window.fotosTemp.splice(i, 1); window.renderizarPreviewFotos(cid); }

window.aplicarFiltro = function(status, btnElement) { window.filtroStatusAtual = status; document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.aplicarFiltroTipo = function(tipo, btnElement) { window.filtroTipoDocumento = tipo; document.querySelectorAll('.filter-type-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.ordenarTabela = function(coluna) { if (window.colunaOrdenacao === coluna) { window.ordemCrescente = !window.ordemCrescente; } else { window.colunaOrdenacao = coluna; window.ordemCrescente = true; } window.renderizarPainel(); }
window.toggleTodos = function(master) { document.querySelectorAll('.select-item').forEach(cb => { cb.checked = master.checked; }); }

window.atualizarDashboardGraficos = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0); let tNotif = 0; let tAutos = 0; let arEnv = 0; let arRet = 0; let venc = 0;
    window.DB.forEach(i => { 
        if(i.tipoDocumento === 'auto') tAutos++; else tNotif++;
        if(i.codigoAR && i.codigoAR.trim() !== '') { arEnv++; if(i.statusRetornoAR === 'entregue' || i.statusRetornoAR === 'devolvido') arRet++; }
        if(i.dataPrazo) { const prazo = new Date(i.dataPrazo + "T00:00:00"); if(prazo < hoje) venc++; } 
    });
    if(document.getElementById('dashTotalNotif')) document.getElementById('dashTotalNotif').innerText = tNotif; 
    if(document.getElementById('dashTotalAutos')) document.getElementById('dashTotalAutos').innerText = tAutos; 
    if(document.getElementById('dashAREnviados')) document.getElementById('dashAREnviados').innerText = arEnv; 
    if(document.getElementById('dashARRetornados')) document.getElementById('dashARRetornados').innerText = arRet; 
    if(document.getElementById('dashVencidas')) document.getElementById('dashVencidas').innerText = venc; 
}

window.renderizarPainel = function() {
    window.atualizarDashboardGraficos(); const corpo = document.getElementById('tabelaCorpo'); if(!corpo) return; corpo.innerHTML = ''; 
    const buscaEl = document.getElementById('buscaInput'); const filtroTexto = buscaEl ? buscaEl.value.toLowerCase() : ''; 
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let filtrados = window.DB;
    if(window.filtroTipoDocumento !== 'Todos') filtrados = filtrados.filter(item => item.tipoDocumento === window.filtroTipoDocumento);
    filtrados = filtrados.filter(item => { return (item.nome || '').toLowerCase().includes(filtroTexto) || (item.numNotif || '').toLowerCase().includes(filtroTexto) || (item.loteEndereco || '').toLowerCase().includes(filtroTexto) || (item.procOuvidoria || '').toLowerCase().includes(filtroTexto) || (item.codigoAR || '').toLowerCase().includes(filtroTexto); });
    if (window.filtroStatusAtual === 'No Prazo') { filtrados = filtrados.filter(i => i.dataPrazo && new Date(i.dataPrazo + "T00:00:00") >= hoje); } else if (window.filtroStatusAtual === 'Vencidos') { filtrados = filtrados.filter(i => i.dataPrazo && new Date(i.dataPrazo + "T00:00:00") < hoje); } else if (window.filtroStatusAtual === 'Com AR') { filtrados = filtrados.filter(i => i.codigoAR && i.codigoAR.trim() !== ""); }
    if (window.colunaOrdenacao) { filtrados.sort((a, b) => { let valA = (a[window.colunaOrdenacao] || '').toLowerCase(); let valB = (b[window.colunaOrdenacao] || '').toLowerCase(); if (valA < valB) return window.ordemCrescente ? -1 : 1; if (valA > valB) return window.ordemCrescente ? 1 : -1; return 0; }); }
    window.itensFiltradosAtual = filtrados; 
    
    filtrados.forEach(item => {
        const iconeFoto = (item.qtdFotosSalvas && item.qtdFotosSalvas > 0) ? ` 📷(${item.qtdFotosSalvas})` : '';
        let statusHtml = ''; let botaoAutuar = '';
        const badgeTipo = item.tipoDocumento === 'auto' ? `<span class="badge-tipo-auto">MULTA / AUTO</span>` : `<span class="badge-tipo-notif">NOTIFICAÇÃO</span>`;
        if(item.codigoAR) { let corFisica = ''; if(item.statusRetornoAR === 'entregue') corFisica = 'border-color:#16a34a; background:#dcfce7; color:#166534;'; else if(item.statusRetornoAR === 'devolvido') corFisica = 'border-color:#dc2626; background:#fee2e2; color:#991b1b;'; statusHtml += `<span class="badge-ar" style="${corFisica}">AR: ${item.codigoAR} <span id="ar-${item.firebaseId}"><button style="background:none;border:none;color:inherit;font-size:10px;cursor:pointer;padding:0;text-decoration:underline;margin-left:5px;" onclick="buscarStatusCorreios('${item.codigoAR}', 'ar-${item.firebaseId}')">Status API</button></span></span>`; }
        if(item.dataPrazo) { const df = item.dataPrazo.split('-').reverse().join('/'); const pz = new Date(item.dataPrazo + "T00:00:00"); if(pz < hoje) { statusHtml += `<span class="badge-vencido">Vencido: ${df}</span>`; if(item.tipoDocumento !== 'auto') botaoAutuar = `<a class="btn-autuar" onclick="navegarPara('autos')">📝 Autuar</a>`; } else { statusHtml += `<span class="badge-prazo">No Prazo: ${df}</span>`; } }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="select-item" value="${item.firebaseId}" onclick="handleShiftClick(event, this)"></td><td>${badgeTipo}</td><td><strong>${item.numNotif}</strong></td><td><div style="font-weight:bold; color:#1b365d;">${item.nome.toUpperCase()} ${iconeFoto}</div><div style="font-size:11px; color:#64748b; margin-top:2px;">${item.loteEndereco}</div></td><td>${statusHtml || '<small style="color:#94a3b8">Sem acompanhamento</small>'}</td><td class="action-links"><a onclick="carregarParaEditar('${item.firebaseId}')">Editar</a><a onclick="imprimirRegistro('${item.firebaseId}')">Imprimir</a>${botaoAutuar}</td>`;
        corpo.appendChild(tr);
    });
}

window.carregarParaEditar = async function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return;
    
    if(item.tipoDocumento === 'auto') {
        window.navegarPara('autos'); window.scrollTo(0,0);
        if(document.getElementById('editFirebaseIdAuto')) document.getElementById('editFirebaseIdAuto').value = item.firebaseId; 
        if(document.getElementById('autoNum')) document.getElementById('autoNum').value = item.numNotif || ''; 
        if(document.getElementById('autoData')) document.getElementById('autoData').value = item.dataNotif || ''; 
        if(document.getElementById('autoNome')) document.getElementById('autoNome').value = item.nome || ''; 
        if(document.getElementById('autoDoc')) document.getElementById('autoDoc').value = item.doc || ''; 
        if(document.getElementById('autoEndOcorrencia')) document.getElementById('autoEndOcorrencia').value = item.loteEndereco || ''; 
        if(document.getElementById('autoDescricaoLei')) document.getElementById('autoDescricaoLei').value = item.autoDescricaoLei || ''; 
        if(document.getElementById('autoMultaURM')) document.getElementById('autoMultaURM').value = item.autoMultaURM || ''; 
        window.calcularMultaReais();
        
        window.fotosTemp = []; 
        if(document.getElementById('indicadorFotosAuto')) document.getElementById('indicadorFotosAuto').style.display = 'inline-block'; 
        try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { window.fotosTemp.push(d.data().imagemBinaria); }); } catch(e) {} 
        if(document.getElementById('indicadorFotosAuto')) document.getElementById('indicadorFotosAuto').style.display = 'none'; 
        window.renderizarPreviewFotos('previewFotosAuto');
        return;
    }

    window.navegarPara('notificacoes'); window.scrollTo(0,0);
    if(document.getElementById('editFirebaseIdNotif')) document.getElementById('editFirebaseIdNotif').value = item.firebaseId; 
    if(document.getElementById('numNotif')) document.getElementById('numNotif').value = item.numNotif || ''; 
    if(document.getElementById('procOuvidoria')) document.getElementById('procOuvidoria').value = item.procOuvidoria || ''; 
    if(document.getElementById('codigoAR')) document.getElementById('codigoAR').value = item.codigoAR || ''; 
    if(document.getElementById('statusRetornoAR')) document.getElementById('statusRetornoAR').value = item.statusRetornoAR || 'aguardando'; 
    if(document.getElementById('dataPrazo')) document.getElementById('dataPrazo').value = item.dataPrazo || ''; 
    if(document.getElementById('dataNotif')) document.getElementById('dataNotif').value = item.dataNotif || ''; 
    if(document.getElementById('tipoAR')) document.getElementById('tipoAR').checked = item.tipoAR; 
    if(document.getElementById('tipoPresencial')) document.getElementById('tipoPresencial').checked = item.tipoPresencial; 
    if(document.getElementById('nome')) document.getElementById('nome').value = item.nome || ''; 
    if(document.getElementById('doc')) document.getElementById('doc').value = item.doc || ''; 
    if(document.getElementById('endereco')) document.getElementById('endereco').value = item.endereco || ''; 
    if(document.getElementById('telefone')) document.getElementById('telefone').value = item.telefone || ''; 
    if(document.getElementById('bairro')) document.getElementById('bairro').value = item.bairro || ''; 
    if(document.getElementById('cep')) document.getElementById('cep').value = item.cep || ''; 
    if(document.getElementById('cadDistrito')) document.getElementById('cadDistrito').value = item.cadDistrito || ''; 
    if(document.getElementById('cadZona')) document.getElementById('cadZona').value = item.cadZona || ''; 
    if(document.getElementById('cadQuadra')) document.getElementById('cadQuadra').value = item.cadQuadra || ''; 
    if(document.getElementById('cadLote')) document.getElementById('cadLote').value = item.cadLote || ''; 
    if(document.getElementById('cadImob')) document.getElementById('cadImob').value = item.cadImob || ''; 
    if(document.getElementById('loteEndereco')) document.getElementById('loteEndereco').value = item.loteEndereco || ''; 
    if(document.getElementById('irrMato')) document.getElementById('irrMato').checked = item.irrMato; 
    if(document.getElementById('irrResiduos')) document.getElementById('irrResiduos').checked = item.irrResiduos; 
    if(document.getElementById('irrEntulhos')) document.getElementById('irrEntulhos').checked = item.irrEntulhos; 
    if(document.getElementById('irrOutros')) document.getElementById('irrOutros').checked = item.irrOutros; 
    if(document.getElementById('ref')) document.getElementById('ref').value = item.ref || ''; 
    if(document.getElementById('obs')) document.getElementById('obs').value = item.obs || ''; 
    if(document.getElementById('lei5198')) document.getElementById('lei5198').checked = item.lei5198; 
    if(document.getElementById('lc56')) document.getElementById('lc56').checked = item.lc56;
    
    window.fotosTemp = []; 
    if(document.getElementById('indicadorFotosNotif')) document.getElementById('indicadorFotosNotif').style.display = 'inline-block';
    try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { window.fotosTemp.push(d.data().imagemBinaria); }); } catch(e) {}
    if(document.getElementById('indicadorFotosNotif')) document.getElementById('indicadorFotosNotif').style.display = 'none'; 
    window.renderizarPreviewFotos('previewFotosNotif');
}

window.limparFormularios = function() { 
    if(document.getElementById('notifForm')) document.getElementById('notifForm').reset(); 
    if(document.getElementById('autoForm')) document.getElementById('autoForm').reset(); 
    if(document.getElementById('editFirebaseIdNotif')) document.getElementById('editFirebaseIdNotif').value = ''; 
    if(document.getElementById('editFirebaseIdAuto')) document.getElementById('editFirebaseIdAuto').value = ''; 
    if(document.getElementById('statusRetornoAR')) document.getElementById('statusRetornoAR').value = 'aguardando'; 
    if(document.getElementById('dataNotif')) document.getElementById('dataNotif').valueAsDate = new Date(); 
    if(document.getElementById('autoData')) document.getElementById('autoData').valueAsDate = new Date(); 
    if(document.getElementById('autoMultaReais')) document.getElementById('autoMultaReais').value = ''; 
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

window.imprimirRegistro = function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return; const s = item.setor || 'SMMAM';
    if(s === 'MOBILIDADE') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Segurança e Mobilidade Urbana"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Mobilidade Urbana</strong><br>Av. Osvaldo Aranha, 1075"; } else if(s === 'OBRAS') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Obras e Posturas"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Setor de Posturas</strong><br>Rua Mal Deodoro, 70"; } else { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Municipal do Meio Ambiente"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>SMMAM / Fiscalização</strong><br>Rua 10 de Novembro, 190"; }
    let pzTxt = "Imediato"; if(item.dataPrazo) { const d1 = new Date(item.dataNotif + "T00:00:00"); const d2 = new Date(item.dataPrazo + "T00:00:00"); pzTxt = `${Math.ceil(Math.abs(d2 - d1) / 86400000)} dias`; }
    if(document.getElementById('pNum')) document.getElementById('pNum').innerText = item.numNotif; if(document.getElementById('pData')) document.getElementById('pData').innerText = item.dataNotif.split('-').reverse().join('/'); if(document.getElementById('pNome')) document.getElementById('pNome').innerText = (item.nome || '').toUpperCase(); if(document.getElementById('pDoc')) document.getElementById('pDoc').innerText = item.doc; if(document.getElementById('pEndereco')) document.getElementById('pEndereco').innerText = item.endereco || '---'; if(document.getElementById('pTelefone')) document.getElementById('pTelefone').innerText = item.telefone || '---'; if(document.getElementById('pBairro')) document.getElementById('pBairro').innerText = item.bairro || '---'; if(document.getElementById('pCep')) document.getElementById('pCep').innerText = item.cep || '---'; if(document.getElementById('pCadDistrito')) document.getElementById('pCadDistrito').innerText = item.cadDistrito || '---'; if(document.getElementById('pCadZona')) document.getElementById('pCadZona').innerText = item.cadZona || '---'; if(document.getElementById('pCadQuadra')) document.getElementById('pCadQuadra').innerText = item.cadQuadra || '---'; if(document.getElementById('pCadLote')) document.getElementById('pCadLote').innerText = item.cadLote || '---'; if(document.getElementById('pCadImob')) document.getElementById('pCadImob').innerText = item.cadImob || ''; if(document.getElementById('pLoteEndereco')) document.getElementById('pLoteEndereco').innerText = item.loteEndereco || ''; if(document.getElementById('pRef')) document.getElementById('pRef').innerText = item.ref || '---'; if(document.getElementById('pObs')) document.getElementById('pObs').innerText = item.obs || '---'; if(document.getElementById('pFiscal')) document.getElementById('pFiscal').innerText = item.fiscal || ''; if(document.getElementById('pMatricula')) document.getElementById('pMatricula').innerText = item.matricula || ''; if(document.getElementById('pTipoPresencial')) document.getElementById('pTipoPresencial').innerText = item.tipoPresencial ? '( X ) Presencial' : '( ) Presencial'; if(document.getElementById('pTipoAR')) document.getElementById('pTipoAR').innerText = item.tipoAR ? '( X ) Por AR' : '( ) Por AR'; if(document.getElementById('pIrrMato')) document.getElementById('pIrrMato').innerText = item.irrMato ? '( X ) Vegetação' : '( ) Vegetação'; if(document.getElementById('pIrrResiduos')) document.getElementById('pIrrResiduos').innerText = item.irrResiduos ? '( X ) Resíduos' : '( ) Resíduos'; if(document.getElementById('pIrrEntulhos')) document.getElementById('pIrrEntulhos').innerText = item.irrEntulhos ? '( X ) Obra / Posturas' : '( ) Obra / Posturas'; if(document.getElementById('pIrrOutros')) document.getElementById('pIrrOutros').innerText = item.irrOutros ? '( X ) Outros' : '( ) Outros'; if(document.getElementById('pLei5198')) document.getElementById('pLei5198').innerText = item.lei5198 ? '( X ) Art 6º, L 5.198' : '( ) Art 6º, L 5.198'; if(document.getElementById('pLc56')) document.getElementById('pLc56').innerText = item.lc56 ? '( X ) Art 41, LC 56' : '( ) Art 41, LC 56'; if(document.getElementById('pPrazoImpressao')) document.getElementById('pPrazoImpressao').innerText = pzTxt;
    window.print();
}

window.exportarExcel = function() {
    if(window.itensFiltradosAtual.length === 0) return alert("Vazio."); let c = "\uFEFFNº Reg;Tipo;Ouvidoria;Data;Nome;CPF/CNPJ;Lote Irregular;Bairro;Prazo;Codigo AR;Status AR;Fiscal\n";
    window.itensFiltradosAtual.forEach(i => { c += `${i.numNotif || ''};${(i.tipoDocumento||'').toUpperCase()};${i.procOuvidoria || ''};${i.dataNotif ? i.dataNotif.split('-').reverse().join('/') : ''};${(i.nome||'').toUpperCase().replace(/;/g,',')};${i.doc||''};${(i.loteEndereco||'').replace(/;/g,',')};${i.bairro||''};${i.dataPrazo ? i.dataPrazo.split('-').reverse().join('/') : ''};${i.codigoAR||''};${i.statusRetornoAR||''};${i.fiscal||''}\n`; });
    const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = `SMMAM_Relatorio_${Date.now()}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l);
}

window.exportarVipp = function() {
    const m = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    if(m.length === 0) return alert('Selecione notificações.');

    const itens = window.DB.filter(item => m.includes(item.firebaseId));

    // 69 colunas rigorosamente baseadas no Anexo 1 - Layout Padrão de Importação 4.0 do VIPP
    let csv = "NOME;AOS_CUIDADOS;ENTREGA_NO_VIZINHO;ENDERECO;NUMERO;COMPLEMENTO;BAIRRO;CIDADE;UF;CEP;PAIS;TELEFONE_CELULAR;E_MAIL;CPF_CNPJ;IE_RG;FILLER;NOME_REM;ENDERECO_REM;NUMERO_REM;COMPLEMENTO_REM;BAIRRO_REM;CIDADE_REM;UF_REM;CEP_REM;TELEFONE_CELULAR_REM;E_MAIL_REM;CPF_CNPJ_REM;IE_RG_REM;FILLER_REM;FINANCEIRO;REGISTRO;PESO;FORMATO;ALTURA;LARGURA;COMPRIMENTO;ADICIONAIS;VALOR_DECLARADO;VALOR_A_COBRAR;CONTRATO;CARTAO;RFID_SSCC;FILLER_POST;OBSERVACAO;OBSERVACAO_3;OBSERVACAO_4;OBSERVACAO_5;ID_DO_VOLUME;QTD_DE_VOLUMES;COD_CLIENTE_VISUAL;CHAVE_ROTEAMENTO;CONTA_LOTE;FILLER_LOTE;TIPO_REVERSA;PRAZO;EMBALAGEM;DATA_COLETA;FILLER_REV;CHAVE_ACESSO;SERIE_NOTA;NUMERO_NOTA;VALOR_DA_NOTA;DATA_NOTA;PROTOCOLO_NOTA;OBSERVACAO_NOTA;FILLER_NF;FILLER_1;FILLER_2;DECLARACAO_CONTEUDO\n";

    itens.forEach(i => {
        const nome = (i.nome || 'NÃO INFORMADO').toUpperCase().replace(/;/g, '').substring(0, 50);
        const endereco = (i.endereco || 'NÃO INFORMADO').toUpperCase().replace(/;/g, '').substring(0, 90);
        const numero = "S/N";
        const bairro = (i.bairro || 'NÃO INFORMADO').toUpperCase().replace(/;/g, '').substring(0, 50);
        const cep = (i.cep || '').replace(/\D/g, '').padEnd(8, '0');
        const celular = (i.telefone || '').replace(/\D/g, '').substring(0, 11);
        const cpfCnpj = (i.doc || '').replace(/\D/g, '').substring(0, 14);

        const obs1 = `Notificacao SMMAM ${i.numNotif || ''}`.substring(0, 100);

        // O VIPP deve gerar o AR se a caixa não for preenchida
        const ar = (i.codigoAR && i.codigoAR.length === 13) ? i.codigoAR : "";

        // Montagem minuciosa da Matriz de 69 campos
        let row = [
            nome, "", "", endereco, numero, "", bairro, "BENTO GONCALVES", "RS", cep, "BR", celular, "", cpfCnpj, "", "", 
            "PREFEITURA DE BENTO GONCALVES", "AV OSVALDO ARANHA", "1075", "", "CIDADE ALTA", "BENTO GONCALVES", "RS", "95700010", "", "", "", "", "", 
            "80810", ar, "100", "1", "1", "11", "16", "AR", "0", "0", "9912740833", "79980660", "", "", 
            obs1, "", "", "", "1", "1", "", "", "", "", 
            "", "", "", "", "", 
            "", "", "", "", "", "", "", "", "", "", 
            "Documentos Administrativos|1|100" 
        ];

        csv += row.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VIPP_Importacao_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
