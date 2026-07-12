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
window.colunaOrdenacao = '';
window.ordemCrescente = true;
window.filtroStatusAtual = 'Todos';
window.filtroTipoDocumento = 'Todos'; 
window.valorURMGlobal = 0; 

let usuarioLogado = null;
let perfilUsuario = null;

// ============================================================================
// FUNÇÕES BASE
// ============================================================================
const mostrarLoading = (mostrar, msg = "Sincronizando...") => {
    document.getElementById('loading-msg').innerText = msg;
    document.getElementById('loading-overlay').style.display = mostrar ? 'flex' : 'none';
}

window.mostrarToast = function(msg) {
    const toast = document.getElementById("toast"); toast.innerText = msg; toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

window.navegarPara = function(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active-view'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active-view');
    document.getElementById('nav-' + viewId).classList.add('active');

    if(viewId === 'inicio') window.renderizarPainel();
    if(viewId === 'relatorios') window.renderizarGraficos();
    if(viewId === 'perfil') window.carregarDadosPerfil();
    if(viewId === 'configuracoes' && perfilUsuario.nivel === 'admin') window.carregarConfiguracoesAdmin();
    if(viewId === 'auditoria' && perfilUsuario.nivel === 'admin') window.carregarAuditoria();
}

async function registrarLog(acaoRealizada, alvo) {
    if(!perfilUsuario) return;
    try { await addDoc(collection(db, "logs_auditoria"), { dataHora: new Date().toISOString(), usuario: perfilUsuario.nome, matricula: perfilUsuario.matricula, setor: perfilUsuario.setor || 'SMMAM', nivel: perfilUsuario.nivel, acao: acaoRealizada, documentoAlvo: alvo }); } catch(e) {}
}

// ============================================================================
// AUTENTICAÇÃO E PERMISSÕES BLINDADAS
// ============================================================================
window.toggleAuthMode = function() {
    const l = document.getElementById('login-fields'); const r = document.getElementById('register-fields'); const t = document.getElementById('authTitle'); const b = document.getElementById('btnToggleAuth');
    if(l.style.display === 'none') { l.style.display = 'block'; r.style.display = 'none'; t.innerText = 'Acesso - Fiscalização'; b.innerText = 'Servidor Novo? Solicite Acesso'; } else { l.style.display = 'none'; r.style.display = 'block'; t.innerText = 'Cadastro de Servidor'; b.innerText = 'Já tenho conta (Entrar)'; }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user; mostrarLoading(true, "Carregando Plataforma...");
        
        try {
            const configSnap = await getDoc(doc(db, "configuracoes", "sistema"));
            if(configSnap.exists()) window.valorURMGlobal = configSnap.data().valorURM || 0;
            const campoURM = document.getElementById('autoValorURMAtual');
            if(campoURM) campoURM.value = window.valorURMGlobal.toFixed(2);
        } catch(e) { console.log("Aviso: Configurações de URM não encontradas."); }

        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                perfilUsuario = docSnap.data(); if(!perfilUsuario.setor) perfilUsuario.setor = 'SMMAM';
                if (perfilUsuario.status === 'pendente' || perfilUsuario.status === 'bloqueado') {
                    document.getElementById('auth-container').style.display = 'none'; document.getElementById('app-layout').style.display = 'none'; document.getElementById('waiting-room').style.display = 'block';
                    if(perfilUsuario.status === 'bloqueado') document.querySelector('#waiting-room h2').innerText = '🚫 Acesso Bloqueado';
                } else if (perfilUsuario.status === 'aprovado') {
                    document.getElementById('auth-container').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none'; document.getElementById('app-layout').style.display = 'flex';
                    aplicarRestricoesDeTela(); window.carregarDadosNuvem(); window.navegarPara('inicio');
                }
            } else {
                // COLETE SALVA-VIDAS: Se por acaso a ficha não for encontrada, ele recria o Administrador e te deixa passar
                const novoPerfil = { nome: "Administrador Legado", cargo: "Administrador do Sistema", setor: "SMMAM", cpf: "000.000.000-00", telefone: "Não informado", matricula: "0000", email: user.email, status: "aprovado", nivel: "admin", dataCadastro: new Date().toISOString() };
                await setDoc(userDocRef, novoPerfil); 
                perfilUsuario = novoPerfil;
                document.getElementById('auth-container').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none'; document.getElementById('app-layout').style.display = 'flex';
                aplicarRestricoesDeTela(); window.carregarDadosNuvem(); window.navegarPara('inicio');
            }
        } catch(e) { console.error(e); alert("Erro crítico na leitura. Tente recarregar a página."); }
        mostrarLoading(false);
    } else {
        document.getElementById('auth-container').style.display = 'flex'; document.getElementById('app-layout').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none';
    }
});

window.realizarLogin = function() { const email = document.getElementById('authEmail').value; const senha = document.getElementById('authPassword').value; if(!email || !senha) return alert("Preencha tudo."); mostrarLoading(true, "Acessando..."); signInWithEmailAndPassword(auth, email, senha).catch(() => { mostrarLoading(false); alert("Erro ao entrar."); }); }
window.registrarUsuario = async function() { const nome = document.getElementById('regNome').value; const cargo = document.getElementById('regCargo').value; const setor = document.getElementById('regSetor').value; const cpf = document.getElementById('regCpf').value; const telefone = document.getElementById('regTelefone').value; const matricula = document.getElementById('regMatricula').value; const email = document.getElementById('regEmail').value; const senha = document.getElementById('regPassword').value; if(!nome || !setor || !cpf || !senha) return alert("Preencha os obrigatórios."); mostrarLoading(true); try { const userC = await createUserWithEmailAndPassword(auth, email, senha); await setDoc(doc(db, "usuarios", userC.user.uid), { nome, cargo, setor, cpf, telefone, matricula, email, status: "pendente", nivel: "leitor", dataCadastro: new Date().toISOString() }); sendEmailVerification(userC.user); mostrarLoading(false); alert("Cadastro enviado para chefia."); } catch(e) { mostrarLoading(false); alert(e.message); } }
window.recuperarSenha = function() { const email = document.getElementById('authEmail').value || document.getElementById('regEmail').value; if(!email) return alert("Digite o e-mail."); sendPasswordResetEmail(auth, email).then(() => alert("E-mail de redefinição enviado!")); }
window.realizarLogout = function() { signOut(auth).then(() => { window.DB = []; window.limparFormularios(); }); }

function aplicarRestricoesDeTela() {
    if(!perfilUsuario) return;
    document.getElementById('sidebar-setor').innerText = perfilUsuario.setor || 'SMMAM';
    document.getElementById('userLoggedDisplay').innerHTML = `👤 <strong>${perfilUsuario.nome}</strong><br><span style="color:#94a3b8">${perfilUsuario.nivel.toUpperCase()}</span>`;
    document.getElementById('fiscal').value = perfilUsuario.nome; document.getElementById('matricula').value = perfilUsuario.matricula;

    if(perfilUsuario.nivel === 'leitor') { document.getElementById('areaBotoesSalvarNotif').style.display = 'none'; document.getElementById('areaBotoesSalvarAuto').style.display = 'none'; }
    
    if(perfilUsuario.nivel === 'admin') {
        document.getElementById('menu-admin-area').style.display = 'block'; document.getElementById('areaBotoesAdminExcluir').style.display = 'flex';
    } else {
        document.getElementById('menu-admin-area').style.display = 'none'; document.getElementById('areaBotoesAdminExcluir').style.display = 'none';
    }
}

// ============================================================================
// MÓDULOS DE INTEGRAÇÃO (CEP E IPTU)
// ============================================================================
const cepInput = document.getElementById('cep');
if(cepInput) {
    cepInput.addEventListener('blur', async function() {
        let cepLimpo = this.value.replace(/\D/g, '');
        if(cepLimpo.length === 8) { try { const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`); const data = await response.json(); if(!data.erro) { document.getElementById('endereco').value = data.logradouro || ''; document.getElementById('bairro').value = data.bairro || ''; window.mostrarToast("Endereço localizado!"); } } catch(e) {} }
    });
}

document.getElementById('cadLote').addEventListener('blur', async function() {
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

window.buscarStatusCorreios = async function(codigoAR, spanId) {
    const span = document.getElementById(spanId); span.innerHTML = `<span class="correios-status" style="background:#e2e8f0;color:#64748b;">⏳ API...</span>`;
    try {
        const response = await fetch(`https://brasilapi.com.br/api/correios/v1/${codigoAR}`);
        if(!response.ok) throw new Error('Falha');
        const data = await response.json();
        if(data.isDelivered) { span.innerHTML = `<span class="correios-status correios-entregue">📬 Entregue (API)</span>`; } else { span.innerHTML = `<span class="correios-status correios-transito">🚚 Transito (API)</span>`; }
    } catch(e) { span.innerHTML = `<a href="https://linketrack.com/track?codigo=${codigoAR}" target="_blank" class="correios-status correios-erro">Correios ↗</a>`; }
}

// ============================================================================
// CONSULTA CADASTRAL LIVRE
// ============================================================================
window.buscarLoteConsultaLivre = async function() {
    const dist = document.getElementById('consDistrito').value.padStart(2, '0'); const zona = document.getElementById('consZona').value; const quad = document.getElementById('consQuadra').value.padStart(3, '0'); const lote = document.getElementById('consLote').value.padStart(4, '0');
    if(!dist || !zona || !quad || !lote || dist === '00' || quad === '000' || lote === '0000') return alert("Preencha todos os campos do lote.");
    const chaveBusca = `${dist}${zona}${quad}${lote}`;
    
    mostrarLoading(true, "Pesquisando Cofre IPTU...");
    const boxResult = document.getElementById('resultadoConsulta'); boxResult.style.display = 'none';
    try {
        const q = query(collection(db, "cadastro_imobiliario"), where("chaveinscricao", ">=", chaveBusca), where("chaveinscricao", "<=", chaveBusca + "\uf8ff"), limit(1));
        const snap = await getDocs(q);
        if(!snap.empty) {
            const im = snap.docs[0].data();
            document.getElementById('resProp').innerText = im.proprietario_principal || 'Não inf.'; document.getElementById('resDoc').innerText = im.cnpj_cpf || 'Não inf.';
            let endLote = im.logradouro || ''; if(im.numero && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${im.numero}`; if(im.complemento) endLote += ` - ${im.complemento}`;
            document.getElementById('resEnd').innerText = endLote; document.getElementById('resBairro').innerText = im.bairro || 'Não inf.'; document.getElementById('resCad').innerText = im.cadastroimobiliario || 'Sem ID';
            boxResult.style.display = 'block'; window.mostrarToast("Localizado!");
        } else { alert("Nenhum imóvel localizado com esta chave no banco de dados."); }
    } catch(e) { alert("Erro de conexão."); }
    mostrarLoading(false);
}

// ============================================================================
// MÓDULO AUTO DE INFRAÇÃO E CÁLCULO DE URM
// ============================================================================
window.puxarDadosDaNotificacao = function() {
    const numPesquisa = document.getElementById('autoBuscaNotif').value.trim();
    if(!numPesquisa) return alert("Digite o número da notificação para puxar.");
    
    const notif = window.DB.find(i => i.numNotif === numPesquisa && i.tipoDocumento !== 'auto');
    if(!notif) return alert("Notificação não encontrada ou ela não pertence ao seu Setor.");
    
    document.getElementById('autoNome').value = notif.nome;
    document.getElementById('autoDoc').value = notif.doc;
    document.getElementById('autoEndOcorrencia').value = notif.loteEndereco;
    document.getElementById('autoDescricaoLei').value = "Ocorrência vinculada à Notificação " + notif.numNotif;
    window.mostrarToast("Dados importados da Notificação!");
}

window.calcularMultaReais = function() {
    const qtdURM = parseFloat(document.getElementById('autoMultaURM').value) || 0;
    const emReais = qtdURM * window.valorURMGlobal;
    document.getElementById('autoMultaReais').value = "R$ " + emReais.toFixed(2).replace('.', ',');
}

// ============================================================================
// DASHBOARDS E GRÁFICOS (CHART.JS)
// ============================================================================
let chartBairrosInstance = null;
let chartStatusInstance = null;

window.renderizarGraficos = function() {
    if(window.DB.length === 0) return;

    let countBairros = {};
    window.DB.forEach(doc => { 
        let b = (doc.bairro && doc.bairro.trim() !== '') ? doc.bairro.toUpperCase() : 'NÃO INFORMADO';
        countBairros[b] = (countBairros[b] || 0) + 1;
    });
    const bairrosOrdenados = Object.entries(countBairros).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labelsBairros = bairrosOrdenados.map(item => item[0]);
    const dadosBairros = bairrosOrdenados.map(item => item[1]);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let stNoPrazo = 0; let stVencido = 0; let stAutos = 0;
    window.DB.forEach(i => {
        if(i.tipoDocumento === 'auto') stAutos++;
        else if(i.dataPrazo) { const pz = new Date(i.dataPrazo + "T00:00:00"); if(pz < hoje) stVencido++; else stNoPrazo++; }
    });

    const ctxB = document.getElementById('chartBairros');
    if(chartBairrosInstance) chartBairrosInstance.destroy();
    chartBairrosInstance = new Chart(ctxB, {
        type: 'bar',
        data: { labels: labelsBairros, datasets: [{ label: 'Qtd de Autuações', data: dadosBairros, backgroundColor: '#3b82f6', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const ctxS = document.getElementById('chartStatus');
    if(chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctxS, {
        type: 'doughnut',
        data: { labels: ['No Prazo', 'Vencidos (Irregular)', 'Multas Geradas'], datasets: [{ data: [stNoPrazo, stVencido, stAutos], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'] }] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// ============================================================================
// ADMINISTRAÇÃO E IMPORTAÇÃO NATIVA IPTU
// ============================================================================
window.carregarConfiguracoesAdmin = async function() {
    const corpoUsuarios = document.getElementById('tabelaUsuariosCorpo'); corpoUsuarios.innerHTML = '';
    try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        usersSnapshot.forEach(docSnap => {
            const u = docSnap.data(); const uid = docSnap.id;
            const selectStatus = `<select class="select-status status-${u.status}" onchange="alterarConfigUsuario('${uid}', 'status', this.value, this)"><option value="pendente" ${u.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option><option value="aprovado" ${u.status === 'aprovado' ? 'selected' : ''}>✅ Aprovado</option><option value="bloqueado" ${u.status === 'bloqueado' ? 'selected' : ''}>🚫 Bloqueado</option></select>`;
            const selectNivel = `<select style="padding: 4px; font-size: 12px; border-radius: 4px;" onchange="alterarConfigUsuario('${uid}', 'nivel', this.value, this)"><option value="leitor" ${u.nivel === 'leitor' ? 'selected' : ''}>👁️ Leitor</option><option value="fiscal" ${u.nivel === 'fiscal' ? 'selected' : ''}>📝 Fiscal</option><option value="admin" ${u.nivel === 'admin' ? 'selected' : ''}>⚙️ Administrador</option></select>`;
            corpoUsuarios.innerHTML += `<tr><td><strong>${u.nome}</strong><br><small style="color:#64748b;">${u.cargo}</small></td><td><span style="background:#e2e8f0; padding:3px; border-radius:4px; font-size:11px;">${u.setor || 'SMMAM'}</span></td><td>${u.email}</td><td>${selectStatus}</td><td>${selectNivel}</td></tr>`;
        });
    } catch(e) {}
}

window.alterarConfigUsuario = async function(uid, campo, valorNovo, selectElement) { try { await updateDoc(doc(db, "usuarios", uid), { [campo]: valorNovo }); window.mostrarToast(`Atualizado!`); if(campo === 'status') selectElement.className = `select-status status-${valorNovo}`; } catch(e) { alert("Sem permissão."); } }

document.querySelector('#configURM').nextElementSibling.addEventListener('click', async function() {
    const valor = parseFloat(document.getElementById('configURM').value); if(!valor || valor <= 0) return alert("Valor inválido.");
    mostrarLoading(true);
    try { await setDoc(doc(db, "configuracoes", "sistema"), { valorURM: valor }, { merge: true }); window.valorURMGlobal = valor; document.getElementById('autoValorURMAtual').value = valor.toFixed(2); window.mostrarToast("Valor URM salvo e replicado!"); await registrarLog("Alterou URM", `Novo valor: R$ ${valor}`); } catch(e) { alert("Erro ao salvar URM"); }
    mostrarLoading(false);
});

document.getElementById('btnAdminImportarIptu').addEventListener('click', function() {
    const file = document.getElementById('adminFileJson').files[0]; if(!file) return alert("Selecione o arquivo JSON do IPTU primeiro.");
    const startIndex = parseInt(document.getElementById('adminStartFrom').value) || 0;
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            if(!Array.isArray(dados)) return alert("Arquivo JSON inválido.");
            if (startIndex >= dados.length) return alert("Número de início maior que o total!");

            const progressDiv = document.getElementById('adminProgressoIptu');
            progressDiv.innerText = `Preparando retomada a partir do registro ${startIndex}...`;
            document.getElementById('btnAdminImportarIptu').disabled = true;

            const TAMANHO_LOTE = 400; let enviados = startIndex;

            for (let i = startIndex; i < dados.length; i += TAMANHO_LOTE) {
                const loteAtual = dados.slice(i, i + TAMANHO_LOTE);
                const batch = writeBatch(db);
                loteAtual.forEach(imovel => {
                    if(imovel.chaveinscricao) {
                        const chaveLimpa = String(imovel.chaveinscricao).trim();
                        batch.set(doc(db, "cadastro_imobiliario", chaveLimpa), imovel);
                    }
                });
                await batch.commit(); enviados += loteAtual.length;
                progressDiv.innerText = `⏳ Enviando para Nuvem: ${enviados} de ${dados.length}...`;
                await new Promise(r => setTimeout(r, 1000));
            }
            progressDiv.innerText = `✅ SUCESSO! Base atualizada.`; progressDiv.style.color = 'green';
        } catch(err) { alert("Erro: " + err.message); }
    };
    reader.readAsText(file);
});

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
    
    let editId = ''; let dados = {}; let btnForm = null; let base64Array = [];

    if(tipoDoc === 'notificacao') {
        btnForm = document.getElementById('btnSalvarNotif'); editId = document.getElementById('editFirebaseIdNotif').value; base64Array = window.fotosTemp;
        dados = { tipoDocumento: 'notificacao', numNotif: document.getElementById('numNotif').value, procOuvidoria: document.getElementById('procOuvidoria').value, codigoAR: document.getElementById('codigoAR').value.toUpperCase(), statusRetornoAR: document.getElementById('statusRetornoAR').value, dataPrazo: document.getElementById('dataPrazo').value, dataNotif: document.getElementById('dataNotif').value, tipoAR: document.getElementById('tipoAR').checked, tipoPresencial: document.getElementById('tipoPresencial').checked, nome: document.getElementById('nome').value, doc: document.getElementById('doc').value, endereco: document.getElementById('endereco').value, telefone: document.getElementById('telefone').value, bairro: document.getElementById('bairro').value, cep: document.getElementById('cep').value, cadDistrito: document.getElementById('cadDistrito').value, cadZona: document.getElementById('cadZona').value, cadQuadra: document.getElementById('cadQuadra').value, cadLote: document.getElementById('cadLote').value, cadImob: document.getElementById('cadImob').value, loteEndereco: document.getElementById('loteEndereco').value, irrMato: document.getElementById('irrMato').checked, irrResiduos: document.getElementById('irrResiduos').checked, irrEntulhos: document.getElementById('irrEntulhos').checked, irrOutros: document.getElementById('irrOutros').checked, ref: document.getElementById('ref').value, obs: document.getElementById('obs').value, lei5198: document.getElementById('lei5198').checked, lc56: document.getElementById('lc56').checked, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    } else {
        btnForm = document.getElementById('btnSalvarAuto'); editId = document.getElementById('editFirebaseIdAuto').value; base64Array = window.fotosTemp;
        dados = { tipoDocumento: 'auto', numNotif: document.getElementById('autoNum').value, dataNotif: document.getElementById('autoData').value, nome: document.getElementById('autoNome').value, doc: document.getElementById('autoDoc').value, loteEndereco: document.getElementById('autoEndOcorrencia').value, autoDescricaoLei: document.getElementById('autoDescricaoLei').value, autoMultaURM: document.getElementById('autoMultaURM').value, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    }
    
    btnForm.disabled = true;
    try {
        let idDoDoc = editId;
        if (editId) { await updateDoc(doc(db, "notificacoes", editId), dados); } 
        else { dados.criadoPor = perfilUsuario.nome; dados.dataCriacao = new Date().toISOString(); const novoDoc = await addDoc(notificacoesRef, dados); idDoDoc = novoDoc.id; }
        
        const fotosSubRef = collection(db, "notificacoes", idDoDoc, "evidencias");
        if (editId) { const fotosAntigas = await getDocs(fotosSubRef); for (let f of fotosAntigas.docs) { await deleteDoc(f.ref); } }
        for (let base64 of base64Array) { await addDoc(fotosSubRef, { imagemBinaria: base64 }); }
        
        await window.carregarDadosNuvem(); window.limparFormularios(); window.mostrarToast("Salvo na Nuvem!"); await registrarLog(editId ? `Editou ${tipoDoc}` : `Criou ${tipoDoc}`, dados.numNotif); window.navegarPara('inicio');
    } catch (e) { alert("Erro ao salvar."); }
    btnForm.disabled = false; mostrarLoading(false);
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

// --- FOTOS ---
window.fotoModalAtual = null;
window.abrirModalFoto = function(i) { window.fotoModalAtual = window.fotosTemp[i]; document.getElementById('modal-image').src = window.fotoModalAtual; document.getElementById('photo-modal').style.display = 'flex'; }
window.fecharModalFoto = function() { document.getElementById('photo-modal').style.display = 'none'; }
window.baixarFotoAtual = function() { const a = document.createElement("a"); a.href = window.fotoModalAtual; a.download = `Evidencia_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
window.processarFotos = function(e, containerId) { const files = e.target.files; if(!files) return; for(let file of files) { const r = new FileReader(); r.onload = function(ev) { const img = new Image(); img.onload = function() { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX = 700; let w = img.width; let h = img.height; if (w > MAX) { h *= MAX / w; w = MAX; } canvas.width = w; canvas.height = h; ctx.drawImage(img, 0, 0, w, h); window.fotosTemp.push(canvas.toDataURL('image/jpeg', 0.45)); window.renderizarPreviewFotos(containerId); }; img.src = ev.target.result; }; r.readAsDataURL(file); } e.target.value = ''; }
window.renderizarPreviewFotos = function(containerId) { const container = document.getElementById(containerId); if(!container) return; container.innerHTML = ''; window.fotosTemp.forEach((f, i) => { const div = document.createElement('div'); div.style.position = 'relative'; div.innerHTML = `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc;cursor:pointer;" onclick="abrirModalFoto(${i})"><button type="button" onclick="removerFoto(${i}, '${containerId}')" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">X</button>`; container.appendChild(div); }); }
window.removerFoto = function(i, cid) { window.fotosTemp.splice(i, 1); window.renderizarPreviewFotos(cid); }

// --- DASHBOARD E TABELA CENTRAL ---
window.aplicarFiltro = function(status, btnElement) { window.filtroStatusAtual = status; document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.aplicarFiltroTipo = function(tipo, btnElement) { window.filtroTipoDocumento = tipo; document.querySelectorAll('.filter-type-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.ordenarTabela = function(coluna) { if (window.colunaOrdenacao === coluna) { window.ordemCrescente = !window.ordemCrescente; } else { window.colunaOrdenacao = coluna; window.ordemCrescente = true; } window.renderizarPainel(); }
window.toggleTodos = function(master) { document.querySelectorAll('.select-item').forEach(cb => cb.checked = master.checked); }

window.atualizarDashboardGraficos = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0); let tNotif = 0; let tAutos = 0; let arEnv = 0; let arRet = 0; let venc = 0;
    window.DB.forEach(i => { 
        if(i.tipoDocumento === 'auto') tAutos++; else tNotif++;
        if(i.codigoAR && i.codigoAR.trim() !== '') { arEnv++; if(i.statusRetornoAR === 'entregue' || i.statusRetornoAR === 'devolvido') arRet++; }
        if(i.dataPrazo) { const prazo = new Date(i.dataPrazo + "T00:00:00"); if(prazo < hoje) venc++; } 
    });
    document.getElementById('dashTotalNotif').innerText = tNotif; document.getElementById('dashTotalAutos').innerText = tAutos; document.getElementById('dashAREnviados').innerText = arEnv; document.getElementById('dashARRetornados').innerText = arRet; document.getElementById('dashVencidas').innerText = venc; 
}

window.renderizarPainel = function() {
    window.atualizarDashboardGraficos(); const corpo = document.getElementById('tabelaCorpo'); corpo.innerHTML = ''; const filtroTexto = document.getElementById('buscaInput').value.toLowerCase(); const hoje = new Date(); hoje.setHours(0,0,0,0);
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
        tr.innerHTML = `<td><input type="checkbox" class="select-item" value="${item.firebaseId}"></td><td>${badgeTipo}</td><td><strong>${item.numNotif}</strong></td><td><div style="font-weight:bold; color:#1b365d;">${item.nome.toUpperCase()} ${iconeFoto}</div><div style="font-size:11px; color:#64748b; margin-top:2px;">${item.loteEndereco}</div></td><td>${statusHtml || '<small style="color:#94a3b8">Sem acompanhamento</small>'}</td><td class="action-links"><a onclick="carregarParaEditar('${item.firebaseId}')">Editar</a><a onclick="imprimirRegistro('${item.firebaseId}')">Imprimir</a>${botaoAutuar}</td>`;
        corpo.appendChild(tr);
    });
}

window.carregarParaEditar = async function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return;
    
    if(item.tipoDocumento === 'auto') {
        window.navegarPara('autos'); window.scrollTo(0,0);
        document.getElementById('editFirebaseIdAuto').value = item.firebaseId; document.getElementById('autoNum').value = item.numNotif || ''; document.getElementById('autoData').value = item.dataNotif || ''; document.getElementById('autoNome').value = item.nome || ''; document.getElementById('autoDoc').value = item.doc || ''; document.getElementById('autoEndOcorrencia').value = item.loteEndereco || ''; document.getElementById('autoDescricaoLei').value = item.autoDescricaoLei || ''; document.getElementById('autoMultaURM').value = item.autoMultaURM || ''; window.calcularMultaReais();
        window.fotosTemp = []; document.getElementById('indicadorFotosAuto').style.display = 'inline-block'; try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { window.fotosTemp.push(d.data().imagemBinaria); }); } catch(e) {} document.getElementById('indicadorFotosAuto').style.display = 'none'; window.renderizarPreviewFotos('previewFotosAuto');
        return;
    }

    window.navegarPara('notificacoes'); window.scrollTo(0,0);
    document.getElementById('editFirebaseIdNotif').value = item.firebaseId; document.getElementById('numNotif').value = item.numNotif || ''; document.getElementById('procOuvidoria').value = item.procOuvidoria || ''; document.getElementById('codigoAR').value = item.codigoAR || ''; document.getElementById('statusRetornoAR').value = item.statusRetornoAR || 'aguardando'; document.getElementById('dataPrazo').value = item.dataPrazo || ''; document.getElementById('dataNotif').value = item.dataNotif || ''; document.getElementById('tipoAR').checked = item.tipoAR; document.getElementById('tipoPresencial').checked = item.tipoPresencial; document.getElementById('nome').value = item.nome || ''; document.getElementById('doc').value = item.doc || ''; document.getElementById('endereco').value = item.endereco || ''; document.getElementById('telefone').value = item.telefone || ''; document.getElementById('bairro').value = item.bairro || ''; document.getElementById('cep').value = item.cep || ''; document.getElementById('cadDistrito').value = item.cadDistrito || ''; document.getElementById('cadZona').value = item.cadZona || ''; document.getElementById('cadQuadra').value = item.cadQuadra || ''; document.getElementById('cadLote').value = item.cadLote || ''; document.getElementById('cadImob').value = item.cadImob || ''; document.getElementById('loteEndereco').value = item.loteEndereco || ''; document.getElementById('irrMato').checked = item.irrMato; document.getElementById('irrResiduos').checked = item.irrResiduos; document.getElementById('irrEntulhos').checked = item.irrEntulhos; document.getElementById('irrOutros').checked = item.irrOutros; document.getElementById('ref').value = item.ref || ''; document.getElementById('obs').value = item.obs || ''; document.getElementById('lei5198').checked = item.lei5198; document.getElementById('lc56').checked = item.lc56;
    window.fotosTemp = []; document.getElementById('indicadorFotosNotif').style.display = 'inline-block';
    try { const snaps = await getDocs(collection(db, "notificacoes", item.firebaseId, "evidencias")); snaps.forEach(d => { window.fotosTemp.push(d.data().imagemBinaria); }); } catch(e) {}
    document.getElementById('indicadorFotosNotif').style.display = 'none'; window.renderizarPreviewFotos('previewFotosNotif');
}

window.limparFormularios = function() { 
    document.getElementById('notifForm').reset(); document.getElementById('autoForm').reset(); document.getElementById('editFirebaseIdNotif').value = ''; document.getElementById('editFirebaseIdAuto').value = ''; document.getElementById('statusRetornoAR').value = 'aguardando'; document.getElementById('dataNotif').valueAsDate = new Date(); document.getElementById('autoData').valueAsDate = new Date(); document.getElementById('autoMultaReais').value = ''; if(perfilUsuario) { document.getElementById('fiscal').value = perfilUsuario.nome; document.getElementById('matricula').value = perfilUsuario.matricula; } window.fotosTemp = []; window.renderizarPreviewFotos('previewFotosNotif'); window.renderizarPreviewFotos('previewFotosAuto'); 
}

// --- IMPRESSÃO E EXPORTAÇÃO ---
window.carregarDadosPerfil = function() { if(!perfilUsuario) return; document.getElementById('perfilNome').value = perfilUsuario.nome; document.getElementById('perfilMatricula').value = perfilUsuario.matricula; document.getElementById('perfilSetorNivel').value = `${perfilUsuario.setor || 'SMMAM'} - ${perfilUsuario.nivel.toUpperCase()}`; document.getElementById('perfilTelefone').value = perfilUsuario.telefone || ''; }

window.imprimirRegistro = function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return; const s = item.setor || 'SMMAM';
    if(s === 'MOBILIDADE') { document.getElementById('printSecretaria').innerText = "Segurança e Mobilidade Urbana"; document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Mobilidade Urbana</strong><br>Av. Osvaldo Aranha, 1075"; } else if(s === 'OBRAS') { document.getElementById('printSecretaria').innerText = "Obras e Posturas"; document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Setor de Posturas</strong><br>Rua Mal Deodoro, 70"; } else { document.getElementById('printSecretaria').innerText = "Municipal do Meio Ambiente"; document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>SMMAM / Fiscalização</strong><br>Rua 10 de Novembro, 190"; }
    let pzTxt = "Imediato"; if(item.dataPrazo) { const d1 = new Date(item.dataNotif + "T00:00:00"); const d2 = new Date(item.dataPrazo + "T00:00:00"); pzTxt = `${Math.ceil(Math.abs(d2 - d1) / 86400000)} dias`; }
    document.getElementById('pNum').innerText = item.numNotif; document.getElementById('pData').innerText = item.dataNotif.split('-').reverse().join('/'); document.getElementById('pNome').innerText = (item.nome || '').toUpperCase(); document.getElementById('pDoc').innerText = item.doc; document.getElementById('pEndereco').innerText = item.endereco || '---'; document.getElementById('pTelefone').innerText = item.telefone || '---'; document.getElementById('pBairro').innerText = item.bairro || '---'; document.getElementById('pCep').innerText = item.cep || '---'; document.getElementById('pCadDistrito').innerText = item.cadDistrito || '---'; document.getElementById('pCadZona').innerText = item.cadZona || '---'; document.getElementById('pCadQuadra').innerText = item.cadQuadra || '---'; document.getElementById('pCadLote').innerText = item.cadLote || '---'; document.getElementById('pCadImob').innerText = item.cadImob || ''; document.getElementById('pLoteEndereco').innerText = item.loteEndereco || ''; document.getElementById('pRef').innerText = item.ref || '---'; document.getElementById('pObs').innerText = item.obs || '---'; document.getElementById('pFiscal').innerText = item.fiscal || ''; document.getElementById('pMatricula').innerText = item.matricula || ''; document.getElementById('pTipoPresencial').innerText = item.tipoPresencial ? '( X ) Presencial' : '( ) Presencial'; document.getElementById('pTipoAR').innerText = item.tipoAR ? '( X ) Por AR' : '( ) Por AR'; document.getElementById('pIrrMato').innerText = item.irrMato ? '( X ) Vegetação' : '( ) Vegetação'; document.getElementById('pIrrResiduos').innerText = item.irrResiduos ? '( X ) Resíduos' : '( ) Resíduos'; document.getElementById('pIrrEntulhos').innerText = item.irrEntulhos ? '( X ) Obra / Posturas' : '( ) Obra / Posturas'; document.getElementById('pIrrOutros').innerText = item.irrOutros ? '( X ) Outros' : '( ) Outros'; document.getElementById('pLei5198').innerText = item.lei5198 ? '( X ) Art 6º, L 5.198' : '( ) Art 6º, L 5.198'; document.getElementById('pLc56').innerText = item.lc56 ? '( X ) Art 41, LC 56' : '( ) Art 41, LC 56'; document.getElementById('pPrazoImpressao').innerText = pzTxt;
    window.print();
}

window.exportarExcel = function() {
    if(window.itensFiltradosAtual.length === 0) return alert("Vazio."); let c = "\uFEFFNº Reg;Tipo;Ouvidoria;Data;Nome;CPF/CNPJ;Lote Irregular;Bairro;Prazo;Codigo AR;Status AR;Fiscal\n";
    window.itensFiltradosAtual.forEach(i => { c += `${i.numNotif || ''};${(i.tipoDocumento||'').toUpperCase()};${i.procOuvidoria || ''};${i.dataNotif ? i.dataNotif.split('-').reverse().join('/') : ''};${(i.nome||'').toUpperCase().replace(/;/g,',')};${i.doc||''};${(i.loteEndereco||'').replace(/;/g,',')};${i.bairro||''};${i.dataPrazo ? i.dataPrazo.split('-').reverse().join('/') : ''};${i.codigoAR||''};${i.statusRetornoAR||''};${i.fiscal||''}\n`; });
    const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = `SMMAM_Relatorio_${Date.now()}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l);
}

window.exportarVipp = function() {
    const m = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value); if(m.length === 0) return alert('Selecione notificações.');
    const itens = window.DB.filter(item => m.includes(item.firebaseId)); let x = '<?xml version="1.0" encoding="UTF-8"?>\n<correioslog>\n<tipo_arquivo>Postagem</tipo_arquivo><versao_arquivo>2.3</versao_arquivo><remetente><numero_contrato>9912740833</numero_contrato><codigo_administrativo>79980660</codigo_administrativo><nome_remetente>PREFEITURA DE BENTO GONCALVES</nome_remetente><logradouro_remetente>AV OSVALDO ARANHA</logradouro_remetente><numero_remetente>1075</numero_remetente><bairro_remetente>CIDADE ALTA</bairro_remetente><cep_remetente>95700010</cep_remetente><cidade_remetente>BENTO GONCALVES</cidade_remetente><uf_remetente>RS</uf_remetente></remetente>\n';
    itens.forEach(i => { const cep = (i.cep || '').replace(/\D/g, '').padEnd(8, '0'); const ar = (i.codigoAR && i.codigoAR.length === 13) ? i.codigoAR : (i.numNotif.replace(/\D/g, '') + Date.now().toString().slice(-6)).padEnd(13, '0'); x += `<objeto_postal><numero_etiqueta>${ar}</numero_etiqueta><codigo_objeto_cliente>${(i.numNotif || '').substring(0, 20)}</codigo_objeto_cliente><codigo_servico_postagem>80810</codigo_servico_postagem><peso>100</peso><destinatario><nome_destinatario>${(i.nome || '').toUpperCase().substring(0, 50)}</nome_destinatario><logradouro_destinatario>${(i.endereco || '').toUpperCase().substring(0, 50)}</logradouro_destinatario><numero_end_destinatario>S/N</numero_end_destinatario></destinatario><nacional><bairro_destinatario>${(i.bairro || '').toUpperCase().substring(0, 30)}</bairro_destinatario><cidade_destinatario>BENTO GONCALVES</cidade_destinatario><uf_destinatario>RS</uf_destinatario><cep_destinatario>${cep}</cep_destinatario></nacional><servico_adicional><codigo_servico_adicional>25</codigo_servico_adicional></servico_adicional><servico_adicional><codigo_servico_adicional>01</codigo_servico_adicional></servico_adicional><dimensao_objeto><tipo_objeto>001</tipo_objeto></dimensao_objeto></objeto_postal>\n`; }); x += '</correioslog>';
    const b = new Blob([x], { type: 'application/xml;charset=utf-8;' }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = `VIPP_${Date.now()}.xml`; document.body.appendChild(l); l.click(); document.body.removeChild(l);
}
