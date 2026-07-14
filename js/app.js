import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc, query, where, limit, writeBatch, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
const notificacoesRef = collection(db, "notificacoes");

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') console.log('Persistência: Múltiplas abas abertas.');
    else if (err.code == 'unimplemented') console.log('Persistência: Navegador não suporta.');
});

window.DB = [];
window.itensFiltradosAtual = [];
window.fotosTemp = [];
window.resultadosConsultaAtual = []; 
window.imovelSelecionadoParaNotificacao = null; 
window.bancoInfracoesGlobais = []; // O Banco de Infrações Dinâmico

window.colunaOrdenacao = '';
window.ordemCrescente = true;
window.filtroStatusAtual = 'Todos';
window.filtroTipoDocumento = 'Todos'; 
window.filtroProcessoAtual = 'ativo'; 
window.valorURMGlobal = 0; 
window.lastCheckedCheckbox = null;

let usuarioLogado = null;
let perfilUsuario = null;

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

// MOTOR DINÂMICO DE INFRAÇÕES (Lê do Firebase)
window.carregarInfracoesGlobais = async function() {
    try {
        const snap = await getDocs(collection(db, "infracoes_config"));
        window.bancoInfracoesGlobais = [];
        snap.forEach(d => { window.bancoInfracoesGlobais.push({ id: d.id, ...d.data() }); });
        
        // Ordenar alfabeticamente
        window.bancoInfracoesGlobais.sort((a,b) => a.nome.localeCompare(b.nome));

        renderizarCheckboxesInfracoes('containerInfracoesDinamicasNotif', 'notificacao');
        renderizarCheckboxesInfracoes('containerInfracoesDinamicasAuto', 'auto');
        
        if(perfilUsuario && perfilUsuario.nivel === 'admin') window.renderizarTabelaInfracoesAdmin();
    } catch(e) { console.error("Erro ao carregar infrações", e); }
}

function renderizarCheckboxesInfracoes(containerId, tipoForm) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';
    
    if(window.bancoInfracoesGlobais.length === 0) {
        container.innerHTML = '<span style="color:#64748b; font-size:11px;">⚠️ Nenhuma infração/lei cadastrada. Solicite ao Admin para cadastrar nas Configurações.</span>';
        return;
    }

    window.bancoInfracoesGlobais.forEach(inf => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.style.marginBottom = '5px';
        
        // Se for o Auto, passa a função que soma o dinheiro
        const funcOnChange = tipoForm === 'auto' ? `onchange="somarUrmsDinamicamente()"` : '';
        
        div.innerHTML = `
            <input type="checkbox" id="infr_${tipoForm}_${inf.id}" value="${inf.id}" class="dinamico-chk-${tipoForm}" data-urm="${inf.multaUrm}" ${funcOnChange}>
            <label for="infr_${tipoForm}_${inf.id}" style="display:inline-block; font-size:12px;">
                <strong>${inf.nome}</strong> 
                <span style="color:#64748b; font-size:10px; margin-left:5px;">(${inf.baseLegal}) - ${inf.multaUrm} URM</span>
            </label>
        `;
        container.appendChild(div);
    });
}

// Soma URM automática no formulário do Auto
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

    if(!nome || !baseLegal || !texto) return alert("Preencha Nome, Base e Texto.");

    mostrarLoading(true, "Salvando Lei/Infração...");
    try {
        await addDoc(collection(db, "infracoes_config"), { nome, baseLegal, textoPadrao: texto, multaUrm });
        window.mostrarToast("Infração cadastrada com sucesso!");
        document.getElementById('adminNomeInfr').value = '';
        document.getElementById('adminBaseInfr').value = '';
        document.getElementById('adminTextoInfr').value = '';
        await window.carregarInfracoesGlobais();
    } catch(e) { alert("Erro ao salvar: " + e.message); }
    mostrarLoading(false);
}

window.removerInfracaoDoBanco = async function(id) {
    if(!confirm("Atenção: Apagar essa infração removerá ela dos novos formulários. Os documentos antigos não serão alterados. Prosseguir?")) return;
    try {
        await deleteDoc(doc(db, "infracoes_config", id));
        window.mostrarToast("Removida!");
        await window.carregarInfracoesGlobais();
    } catch(e) { alert("Erro ao remover."); }
}

window.renderizarTabelaInfracoesAdmin = function() {
    const tbody = document.getElementById('tabelaInfracoesAdmin');
    if(!tbody) return;
    tbody.innerHTML = '';
    window.bancoInfracoesGlobais.forEach(inf => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${inf.nome}</strong></td>
                <td><span style="background:#e2e8f0; padding:3px 6px; font-size:11px; border-radius:4px;">${inf.baseLegal}</span></td>
                <td style="font-size:11px; color:#475569;">${inf.textoPadrao}</td>
                <td><strong>${inf.multaUrm}</strong></td>
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

    if(viewId === 'inicio') window.renderizarPainel();
    if(viewId === 'relatorios') window.renderizarGraficos();
    if(viewId === 'perfil') window.carregarDadosPerfil();
    if(viewId === 'configuracoes' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarConfiguracoesAdmin();
    if(viewId === 'auditoria' && perfilUsuario && perfilUsuario.nivel === 'admin') window.carregarAuditoria();
    
    if(viewId === 'notificacoes' && !document.getElementById('editFirebaseIdNotif').value) {
        document.getElementById('numNotif').value = window.sugerirNumero('notificacao');
    }
    if(viewId === 'autos' && !document.getElementById('editFirebaseIdAuto').value) {
        document.getElementById('autoNum').value = window.sugerirNumero('auto');
    }
}

// CÁLCULO DE PRAZOS (Dias Corridos)
function calcularDataVencimento(dataRecebimento, prazoDias) {
    if (!dataRecebimento || !prazoDias) return null;
    const data = new Date(dataRecebimento + "T12:00:00Z"); 
    data.setDate(data.getDate() + parseInt(prazoDias));
    return data.toISOString().slice(0, 10);
}

// SUGESTÃO DE NUMERO SEQUENCIAL INTELIGENTE
window.sugerirNumero = function(tipo) {
    const anoAtual = new Date().getFullYear().toString();
    let maxNum = 0;
    let sufixo = tipo === 'notificacao' ? 'B' : '';
    
    window.DB.forEach(item => {
        if (item.tipoDocumento === tipo && item.numNotif && item.numNotif.includes(`/${anoAtual}`)) {
            let partNum = item.numNotif.split('/')[0].replace(/\D/g, ''); 
            let n = parseInt(partNum);
            if (n > maxNum) maxNum = n;
        }
    });
    const proximo = (maxNum + 1).toString().padStart(4, '0');
    return `${proximo}${sufixo}/${anoAtual}`;
}

async function registrarLog(acaoRealizada, alvo) {
    if(!perfilUsuario) return;
    try { await addDoc(collection(db, "logs_auditoria"), { dataHora: new Date().toISOString(), usuario: perfilUsuario.nome || 'Desconhecido', matricula: perfilUsuario.matricula || '0000', setor: perfilUsuario.setor || 'SMMAM', nivel: perfilUsuario.nivel || 'leitor', acao: acaoRealizada, documentoAlvo: alvo }); } catch(e) {}
}

window.carregarAuditoria = async function() {
    const corpo = document.getElementById('tabelaAuditoriaCorpo'); if(!corpo) return; corpo.innerHTML = '<tr><td colspan="4">Carregando logs...</td></tr>';
    try {
        const snaps = await getDocs(query(collection(db, "logs_auditoria"), limit(100)));
        corpo.innerHTML = '';
        snaps.forEach(d => {
            const data = d.data(); const dFmt = new Date(data.dataHora).toLocaleString('pt-BR');
            corpo.innerHTML += `<tr><td>${dFmt}</td><td>${data.usuario}</td><td>${data.acao}</td><td>${data.documentoAlvo}</td></tr>`;
        });
    } catch(e) { corpo.innerHTML = '<tr><td colspan="4">Erro ao carregar logs.</td></tr>'; }
}

window.toggleAuthMode = function() {
    const l = document.getElementById('login-fields'); const r = document.getElementById('register-fields'); const t = document.getElementById('authTitle'); const b = document.getElementById('btnToggleAuth');
    if(l && r && t && b) {
        if(l.style.display === 'none') { l.style.display = 'block'; r.style.display = 'none'; t.innerText = 'Acesso - Fiscalização'; b.innerText = 'Servidor Novo? Solicite Acesso'; } 
        else { l.style.display = 'none'; r.style.display = 'block'; t.innerText = 'Cadastro de Servidor'; b.innerText = 'Já tenho conta (Entrar)'; }
    }
}

// O ROBÔ DOS CORREIOS (DIRETO BRASILAPI + FREIO DE 3s)
window.verificarRotinaCorreios = async function(forcar = false) {
    if(!perfilUsuario || perfilUsuario.nivel === 'leitor') return; 
    
    const agora = new Date();
    const hora = agora.getHours();
    const dataHoje = agora.toISOString().slice(0, 10); 
    let turno = null;
    if (hora >= 8 && hora < 13) turno = 'manha';
    else if (hora >= 13) turno = 'tarde';

    if (!turno && !forcar) return; 

    const autoRef = doc(db, "configuracoes", "automacao");
    try {
        const snap = await getDoc(autoRef);
        let dadosAuto = snap.exists() ? snap.data() : {};
        const campoTurno = turno === 'manha' ? 'ultimaSyncManha' : 'ultimaSyncTarde';

        if (dadosAuto[campoTurno] !== dataHoje || forcar) {
            
            const btnForcar = document.getElementById('btnForcarCorreios');
            if(forcar && btnForcar) { btnForcar.innerText = "⏳ Consultando Correios de forma segura (Pode levar vários segundos)..."; btnForcar.disabled = true; }

            if(!forcar) await setDoc(autoRef, { [campoTurno]: dataHoje }, { merge: true });
            
            const q = query(collection(db, "notificacoes"), where("codigoAR", "!=", ""));
            const pendingSnaps = await getDocs(q);

            let consultados = 0;
            let atualizados = 0;
            let falhas = 0;

            for (let document of pendingSnaps.docs) {
                const d = document.data();
                if (!d.codigoAR || d.codigoAR.length < 13) continue;
                if (d.statusRetornoAR === 'entregue' || d.statusRetornoAR === 'devolvido') continue; 

                consultados++;
                let desc = "";
                
                try {
                    const res = await fetch(`https://brasilapi.com.br/api/correios/v1/${d.codigoAR}`);
                    if (res.ok) {
                        const apiData = await res.json();
                        if (apiData.eventos && apiData.eventos.length > 0) desc = apiData.eventos[0].descricao.toLowerCase();
                    }
                } catch(e) {}

                if (desc) {
                    let novoStatus = d.statusRetornoAR || 'aguardando';
                    let statusVida = d.statusNotificacao || 'enviado_ar';
                    let dtRecebimento = d.dataRecebimento || '';

                    if (desc.includes('entregue')) {
                        novoStatus = 'entregue';
                        statusVida = 'recebido';
                        if(!dtRecebimento) dtRecebimento = new Date().toISOString().slice(0, 10); 
                    }
                    else if (desc.includes('devolvido') || desc.includes('incorreto') || desc.includes('recusado') || desc.includes('não procurado') || (desc.includes('ausente') && desc.includes('devolvido'))) novoStatus = 'devolvido';
                    else if (desc.includes('saiu para entrega')) novoStatus = 'saiu_entrega';
                    else if (desc.includes('ausente') || desc.includes('não atendido') || desc.includes('tentativa')) novoStatus = 'tentativa';
                    else if (desc.includes('aguardando retirada')) novoStatus = 'retirada';
                    else if (desc.includes('postado') || desc.includes('trânsito') || desc.includes('encaminhado')) novoStatus = 'transito';

                    if (novoStatus !== d.statusRetornoAR || desc.toUpperCase() !== d.statusCorreiosTexto || statusVida !== d.statusNotificacao) {
                        await updateDoc(document.ref, {
                            statusRetornoAR: novoStatus,
                            statusCorreiosTexto: desc.toUpperCase(),
                            statusNotificacao: statusVida,
                            dataRecebimento: dtRecebimento
                        });
                        atualizados++;
                    }
                } else {
                    falhas++; 
                }
                
                // FREIO DE 3 SEGUNDOS PARA NÃO SER BANIDO DA BRASILAPI
                await new Promise(r => setTimeout(r, 3000));
            }

            if (forcar) {
                alert(`✅ Verificação Concluída!\n\n${consultados} AR(s) processados.\n${atualizados} sofreram alterações de status.\n${falhas} falharam (API bloqueou ou instável).`);
                if(btnForcar) { btnForcar.innerText = "🔄 Forçar Sync da API"; btnForcar.disabled = false; }
            } else if (atualizados > 0) {
                window.mostrarToast(`✅ Correios: ${atualizados} AR(s) atualizados no fundo!`);
            }
            
            if(atualizados > 0) await window.carregarDadosNuvem(); 
        }
    } catch(e) {
        console.error("Falha na rotina em background", e);
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

        await window.carregarInfracoesGlobais(); // LÊ AS LEIS DINÂMICAS

        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                perfilUsuario = docSnap.data(); 
                if(!perfilUsuario.setor) perfilUsuario.setor = 'SMMAM';
                if(!perfilUsuario.status) perfilUsuario.status = 'aprovado';
                if(!perfilUsuario.nivel) perfilUsuario.nivel = 'admin'; 

                if (perfilUsuario.status === 'pendente' || perfilUsuario.status === 'bloqueado') {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'block';
                    if(perfilUsuario.status === 'bloqueado' && document.querySelector('#waiting-room h2')) document.querySelector('#waiting-room h2').innerText = '🚫 Acesso Bloqueado';
                } else {
                    if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                    if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none'; 
                    if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'flex';
                    aplicarRestricoesDeTela(); 
                    await window.carregarDadosNuvem(); 
                    window.navegarPara('inicio');
                    window.verificarRotinaCorreios(); 
                }
            } else {
                const novoPerfil = { nome: "Humberto", cargo: "Admin do Sistema", setor: "SMMAM", cpf: "000.000.000-00", telefone: "Não informado", matricula: "0000", email: user.email, status: "aprovado", nivel: "admin", dataCadastro: new Date().toISOString() };
                await setDoc(userDocRef, novoPerfil); 
                perfilUsuario = novoPerfil;
                if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'none'; 
                if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none'; 
                if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'flex';
                aplicarRestricoesDeTela(); 
                await window.carregarDadosNuvem(); 
                window.navegarPara('inicio');
                window.verificarRotinaCorreios(); 
            }
        } catch(e) { console.error(e); alert("Erro na inicialização: " + e.message); }
        mostrarLoading(false);
    } else {
        if(document.getElementById('auth-container')) document.getElementById('auth-container').style.display = 'flex'; 
        if(document.getElementById('app-layout')) document.getElementById('app-layout').style.display = 'none'; 
        if(document.getElementById('waiting-room')) document.getElementById('waiting-room').style.display = 'none';
    }
});

window.realizarLogin = function() { const email = document.getElementById('authEmail').value; const senha = document.getElementById('authPassword').value; if(!email || !senha) return alert("Preencha tudo."); mostrarLoading(true, "Acessando..."); signInWithEmailAndPassword(auth, email, senha).catch(() => { mostrarLoading(false); alert("Erro ao entrar."); }); }

window.registrarUsuario = async function() { 
    const nome = document.getElementById('regNome').value; 
    const cargo = document.getElementById('regCargo').value; 
    const setor = document.getElementById('regSetor').value; 
    const cpf = document.getElementById('regCpf').value; 
    const telefone = document.getElementById('regTelefone').value; 
    const matricula = document.getElementById('regMatricula').value; 
    const email = document.getElementById('regEmail').value.toLowerCase().trim(); 
    const senha = document.getElementById('regPassword').value; 
    
    if(!nome || !setor || !cpf || !senha) return alert("Preencha os obrigatórios."); 

    let isVip = false;
    try {
        const vipSnap = await getDoc(doc(db, "configuracoes", "lista_vip"));
        if(vipSnap.exists() && vipSnap.data().emails) {
            isVip = vipSnap.data().emails.includes(email);
        }
    } catch(e) {}

    if(!email.endsWith('@bentogoncalves.rs.gov.br') && !isVip) {
        return alert("Acesso Negado: Apenas e-mails do domínio @bentogoncalves.rs.gov.br são permitidos, exceto se autorizados previamente pelo Administrador.");
    }

    mostrarLoading(true); 
    try { 
        const userC = await createUserWithEmailAndPassword(auth, email, senha); 
        await setDoc(doc(db, "usuarios", userC.user.uid), { nome, cargo, setor, cpf, telefone, matricula, email, status: "pendente", nivel: "leitor", dataCadastro: new Date().toISOString() }); 
        sendEmailVerification(userC.user); 
        mostrarLoading(false); 
        alert("Cadastro enviado para chefia."); 
    } catch(e) { mostrarLoading(false); alert(e.message); } 
}

window.recuperarSenha = function() { const email = document.getElementById('authEmail').value || document.getElementById('regEmail').value; if(!email) return alert("Digite o e-mail."); sendPasswordResetEmail(auth, email).then(() => alert("E-mail de redefinição enviado!")); }
window.realizarLogout = function() { signOut(auth).then(() => { window.DB = []; window.limparFormularios(); }); }

function aplicarRestricoesDeTela() {
    if(!perfilUsuario) return;
    const setorEl = document.getElementById('sidebar-setor'); if(setorEl) setorEl.innerText = perfilUsuario.setor || 'SMMAM';
    
    if (perfilUsuario.nome === 'Administrador Legado') {
        perfilUsuario.nome = 'Humberto';
        if (usuarioLogado) { updateDoc(doc(db, "usuarios", usuarioLogado.uid), { nome: 'Humberto' }).catch(()=>{}); }
    }
    
    let nivelStr = perfilUsuario.nivel ? String(perfilUsuario.nivel).toUpperCase() : 'LEITOR';
    if (nivelStr === 'ADMIN') nivelStr = 'ADM';

    const userLogEl = document.getElementById('userLoggedDisplay'); 
    if(userLogEl) userLogEl.innerHTML = `👤 <strong>${perfilUsuario.nome}</strong><br><span style="color:#94a3b8">${nivelStr}</span>`;
    
    const fiscalEl = document.getElementById('fiscal'); if(fiscalEl) fiscalEl.value = perfilUsuario.nome || ''; 
    const matEl = document.getElementById('matricula'); if(matEl) matEl.value = perfilUsuario.matricula || '';
    
    const areaSalvarNotif = document.getElementById('areaBotoesSalvarNotif'); const areaSalvarAuto = document.getElementById('areaBotoesSalvarAuto');
    if(perfilUsuario.nivel === 'leitor') { if(areaSalvarNotif) areaSalvarNotif.style.display = 'none'; if(areaSalvarAuto) areaSalvarAuto.style.display = 'none'; }
    
    const menuAdmin = document.getElementById('menu-admin-area'); const btnExcluir = document.getElementById('areaBotoesAdminExcluir');
    if(perfilUsuario.nivel === 'admin') { if(menuAdmin) menuAdmin.style.display = 'block'; if(btnExcluir) btnExcluir.style.display = 'flex'; } else { if(menuAdmin) menuAdmin.style.display = 'none'; if(btnExcluir) btnExcluir.style.display = 'none'; }
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

// AÇÃO MANUAL DA TABELA COM NATIVO SEM PROXY E COM STATUS WORKFLOW
window.buscarStatusCorreios = async function(codigoAR, spanId, docId) {
    const span = document.getElementById(spanId); 
    if(!span) return;
    span.innerHTML = `<span style="background:#e2e8f0; color:#64748b; font-size:10px; padding:2px 5px; border-radius:4px;">⏳ API...</span>`;
    
    try {
        let desc = "";
        const res = await fetch(`https://brasilapi.com.br/api/correios/v1/${codigoAR}`);
        
        if (res.status === 404) {
            span.innerHTML = `<span style="background:#fef3c7; color:#b45309; border: 1px solid #f59e0b; font-size:10px; padding:2px 5px; border-radius:4px;">🟡 Aguardando</span>`;
            return;
        }
        if (res.ok) {
            const data = await res.json();
            if (data.eventos && data.eventos.length > 0) desc = data.eventos[0].descricao.toLowerCase();
        } else {
            throw new Error('Rate Limit');
        }

        if (!desc) {
            span.innerHTML = `<a href="https://linketrack.com/track?codigo=${codigoAR}" target="_blank" style="background:#fee2e2; color:#991b1b; font-size:10px; padding:2px 5px; border-radius:4px; text-decoration:none; border: 1px solid #ef4444;">❌ API Ocupada (Ver)</a>`; 
            return;
        }

        let novoStatus = 'aguardando';
        let statusVida = 'enviado_ar';
        let dtReceb = new Date().toISOString().slice(0, 10);

        if (desc.includes('entregue')) {
            novoStatus = 'entregue';
            statusVida = 'recebido';
        }
        else if (desc.includes('devolvido') || desc.includes('incorreto') || desc.includes('recusado') || desc.includes('não procurado') || (desc.includes('ausente') && desc.includes('devolvido'))) novoStatus = 'devolvido';
        else if (desc.includes('saiu para entrega')) novoStatus = 'saiu_entrega';
        else if (desc.includes('ausente') || desc.includes('não atendido') || desc.includes('tentativa')) novoStatus = 'tentativa';
        else if (desc.includes('aguardando retirada')) novoStatus = 'retirada';
        else if (desc.includes('postado') || desc.includes('trânsito') || desc.includes('encaminhado')) novoStatus = 'transito';

        if(docId) {
            const dadosAtualizacao = { statusRetornoAR: novoStatus, statusCorreiosTexto: desc.toUpperCase(), statusNotificacao: statusVida };
            if(statusVida === 'recebido') dadosAtualizacao.dataRecebimento = dtReceb; 
            await updateDoc(doc(db, "notificacoes", docId), dadosAtualizacao);
        }

        span.innerHTML = `<span style="color:green; font-weight:bold;">✅ Salvo!</span>`;
        setTimeout(() => { window.carregarDadosNuvem(); }, 800);
        
    } catch(e) { 
        span.innerHTML = `<a href="https://linketrack.com/track?codigo=${codigoAR}" target="_blank" style="background:#fee2e2; color:#991b1b; font-size:10px; padding:2px 5px; border-radius:4px; text-decoration:none; border: 1px solid #ef4444;">❌ Limite API (Ver)</a>`; 
    }
}

// ATUALIZADA: BUSCA POR ENDEREÇO (ARRAY-CONTAINS COM ALERTA INTELIGENTE)
const limpaString = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^\w\s]/gi, '') : '';

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
            // O ALERTA INTELIGENTE PARA O CASO DE FALTA DE ÍNDICE
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
    
    document.getElementById('numNotif').value = window.sugerirNumero('notificacao');
    window.mostrarToast("Dados do Espelho carregados no formulário!");
    window.scrollTo(0,0);
}

window.puxarDadosDaNotificacao = function() {
    const numPesquisa = document.getElementById('autoBuscaNotif').value.trim();
    if(!numPesquisa) return alert("Digite o número da notificação para puxar.");
    
    const notif = window.DB.find(i => i.numNotif === numPesquisa && i.tipoDocumento !== 'auto');
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

let chartBairrosInstance = null; let chartStatusInstance = null; let chartEvolucaoInstance = null; let chartTiposInstance = null; let chartFiscaisInstance = null;

window.renderizarGraficos = function() {
    if(window.DB.length === 0) return;

    let countBairros = {}; let countMeses = {}; let countFiscais = {}; let countTipos = { 'Mato/Vegetação': 0, 'Resíduos/Entulhos': 0, 'Obra/Posturas': 0, 'Outros': 0 };
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let stNoPrazo = 0; let stVencido = 0; let stAutos = 0; let totalMultasReais = 0;

    window.DB.forEach(doc => { 
        if(doc.statusProcesso === 'arquivado') return; 
        let b = (doc.bairro && doc.bairro.trim() !== '') ? doc.bairro.toUpperCase() : 'NÃO INFORMADO'; countBairros[b] = (countBairros[b] || 0) + 1;
        let f = (doc.fiscal && doc.fiscal.trim() !== '') ? doc.fiscal.toUpperCase() : 'NÃO IDENTIFICADO'; countFiscais[f] = (countFiscais[f] || 0) + 1;

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
}

// BACKUP FÍSICO DO ADM
window.baixarBackupLocal = function() {
    const data = JSON.stringify(window.DB, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_SMMAM_Notificacoes_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// DELTA SYNC IPTU
const btnImportarIptu = document.getElementById('btnAdminImportarIptu');
if(btnImportarIptu) {
    btnImportarIptu.addEventListener('click', async function() {
        const file = document.getElementById('adminFileJson').files[0]; if(!file) return alert("Selecione o arquivo JSON.");
        const progressDiv = document.getElementById('adminProgressoIptu');
        document.getElementById('btnAdminImportarIptu').disabled = true;
        
        try {
            if(progressDiv) progressDiv.innerText = `1/4 Lendo arquivo e gerando Índice de Busca...`;
            const textNew = await file.text();
            const dadosNovosArray = JSON.parse(textNew);
            if(!Array.isArray(dadosNovosArray)) throw new Error("JSON inválido.");
            
            const mapNovos = {};
            dadosNovosArray.forEach(im => { 
                if(im.chaveinscricao) {
                    im.logradouro_keywords = limpaString(im.logradouro).split(' ').filter(w => w.length > 0);
                    mapNovos[String(im.chaveinscricao).trim()] = im; 
                }
            });

            if(progressDiv) progressDiv.innerText = `2/4 Baixando base anterior do Storage...`;
            let mapAntigos = {};
            const storageRef = ref(storage, 'iptu_backup/base_anterior.json');
            try {
                const urlAntiga = await getDownloadURL(storageRef);
                const resAntiga = await fetch(urlAntiga);
                const dadosAntigosArray = await resAntiga.json();
                dadosAntigosArray.forEach(im => { if(im.chaveinscricao) mapAntigos[String(im.chaveinscricao).trim()] = im; });
            } catch(e) {
                console.log("Sem base anterior no Storage. Subindo base completa.");
            }

            if(progressDiv) progressDiv.innerText = `3/4 Calculando Diferenças (Delta Sync)...`;
            const chavesAlteradas = [];
            for (let chave in mapNovos) {
                const imovelNovo = mapNovos[chave];
                const imovelAntigo = mapAntigos[chave];
                if (!imovelAntigo || JSON.stringify(imovelNovo) !== JSON.stringify(imovelAntigo)) {
                    chavesAlteradas.push(imovelNovo);
                }
            }

            if(chavesAlteradas.length === 0) {
                if(progressDiv) { progressDiv.innerText = `✅ Nenhum imóvel sofreu alteração. Banco 100% atualizado.`; progressDiv.style.color = 'green'; }
            } else {
                if(progressDiv) progressDiv.innerText = `4/4 Enviando ${chavesAlteradas.length} imóveis alterados...`;
                const TAMANHO_LOTE = 400; let enviados = 0;
                for (let i = 0; i < chavesAlteradas.length; i += TAMANHO_LOTE) {
                    const loteAtual = chavesAlteradas.slice(i, i + TAMANHO_LOTE);
                    const batch = writeBatch(db);
                    loteAtual.forEach(imovel => { batch.set(doc(db, "cadastro_imobiliario", String(imovel.chaveinscricao).trim()), imovel); });
                    await batch.commit(); enviados += loteAtual.length;
                    if(progressDiv) progressDiv.innerText = `⏳ Progresso: ${enviados} de ${chavesAlteradas.length}...`;
                }
                
                if(progressDiv) progressDiv.innerText = `Salvando cópia do arquivo atual no Storage...`;
                const jsonAtualizadoParaSalvar = JSON.stringify(Object.values(mapNovos));
                await uploadString(storageRef, jsonAtualizadoParaSalvar, 'raw', { contentType: 'application/json' });

                if(progressDiv) { progressDiv.innerText = `✅ SUCESSO! Base Sincronizada cirurgicamente com Índices.`; progressDiv.style.color = 'green'; }
            }
        } catch(err) { 
            if(progressDiv) progressDiv.innerText = `❌ Erro: ${err.message}`; 
        }
        document.getElementById('btnAdminImportarIptu').disabled = false;
    });
}

// SCRIPT RETROATIVO
window.corrigirEnderecosAntigos = async function() {
    if(!confirm("Atenção: Isso varrerá todas as notificações do banco e gravará Cidade = BENTO GONÇALVES e UF = RS onde estiver vazio. Deseja prosseguir?")) return;
    mostrarLoading(true, "Corrigindo base retroativa...");
    try {
        const batch = writeBatch(db);
        let count = 0;
        window.DB.forEach(docAtual => {
            if(!docAtual.cidade || !docAtual.uf) {
                batch.update(doc(db, "notificacoes", docAtual.firebaseId), { cidade: "BENTO GONÇALVES", uf: "RS" });
                count++;
            }
        });
        if(count > 0) {
            await batch.commit();
            await window.carregarDadosNuvem();
            alert(`✅ Concluído! ${count} registros antigos foram padronizados com a Cidade e UF.`);
        } else {
            alert("A base já está padronizada.");
        }
    } catch(e) { alert("Erro ao corrigir: " + e.message); }
    mostrarLoading(false);
}

window.carregarDadosNuvem = async function() {
    mostrarLoading(true, "Baixando demandas...");
    try {
        const querySnapshot = await getDocs(notificacoesRef); window.DB = []; const meuSetor = perfilUsuario.setor || 'SMMAM';
        querySnapshot.forEach((documento) => { 
            let data = documento.data(); data.firebaseId = documento.id; 
            if(!data.tipoDocumento) data.tipoDocumento = 'notificacao';
            if(!data.statusProcesso) data.statusProcesso = 'ativo'; 
            if ((data.setor || 'SMMAM') === meuSetor || perfilUsuario.nivel === 'admin') window.DB.push(data); 
        });
        window.renderizarPainel();
    } catch (e) {} mostrarLoading(false);
}

// SALVAR DOCUMENTO COM INFRAÇÕES DINÂMICAS
window.salvarDocumento = async function(event, tipoDoc) {
    event.preventDefault(); if(perfilUsuario.nivel === 'leitor') return alert("Leitores não salvam.");
    mostrarLoading(true, "Verificando e Salvando...");
    
    let editId = ''; let dados = {}; let btnForm = null; let base64Array = window.fotosTemp || [];
    let numeroOriginal = '';
    const anoAtual = new Date().getFullYear();

    // Ler as infrações dinâmicas marcadas
    const infracoesMarcadas = [];
    document.querySelectorAll(`.dinamico-chk-${tipoDoc}:checked`).forEach(chk => { infracoesMarcadas.push(chk.value); });

    if(tipoDoc === 'notificacao') {
        btnForm = document.getElementById('btnSalvarNotif'); editId = document.getElementById('editFirebaseIdNotif').value;
        numeroOriginal = document.getElementById('numNotif').value.trim();
        if(!numeroOriginal.includes('/')) numeroOriginal += `/${anoAtual}`;
        document.getElementById('numNotif').value = numeroOriginal; 

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

        dados = { tipoDocumento: 'notificacao', statusProcesso: 'ativo', statusNotificacao: statusVida, numNotif: numeroOriginal, procOuvidoria: document.getElementById('procOuvidoria').value, codigoAR: codAR, statusRetornoAR: stRetornoAR, prazoDias: document.getElementById('prazoDias').value, dataRecebimento: dtRecebimento, dataNotif: document.getElementById('dataNotif').value, tipoAR: tipoAR, tipoPresencial: document.getElementById('tipoPresencial').checked, nome: nomeNotificado, doc: docNotificado, endereco: document.getElementById('endereco').value, telefone: document.getElementById('telefone').value, bairro: document.getElementById('bairro').value, cep: document.getElementById('cep').value, cidade: "BENTO GONÇALVES", uf: "RS", cadDistrito: document.getElementById('cadDistrito').value, cadZona: document.getElementById('cadZona').value, cadQuadra: document.getElementById('cadQuadra').value, cadLote: document.getElementById('cadLote').value, cadImob: document.getElementById('cadImob').value, loteEndereco: document.getElementById('loteEndereco').value, arrayInfracoes: infracoesMarcadas, ref: document.getElementById('ref').value, obs: document.getElementById('obs').value, fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    } else {
        btnForm = document.getElementById('btnSalvarAuto'); editId = document.getElementById('editFirebaseIdAuto').value;
        numeroOriginal = document.getElementById('autoNum').value.trim();
        if(!numeroOriginal.includes('/')) numeroOriginal += `/${anoAtual}`;
        document.getElementById('autoNum').value = numeroOriginal;

        dados = { tipoDocumento: 'auto', statusProcesso: 'ativo', numNotif: numeroOriginal, dataNotif: document.getElementById('autoData').value, nome: document.getElementById('autoNome').value, doc: document.getElementById('autoDoc').value, loteEndereco: document.getElementById('autoEndOcorrencia').value, autoDescricaoLei: document.getElementById('autoDescricaoLei').value, arrayInfracoes: infracoesMarcadas, autoMultaURM: document.getElementById('autoMultaURM').value, cidade: "BENTO GONÇALVES", uf: "RS", fiscal: perfilUsuario.nome, matricula: perfilUsuario.matricula, qtdFotosSalvas: base64Array.length, editadoPor: perfilUsuario.nome, dataUltimaEdicao: new Date().toISOString(), setor: perfilUsuario.setor || 'SMMAM' };
    }
    
    if(btnForm) btnForm.disabled = true;

    try {
        const dupQuery = query(notificacoesRef, where("numNotif", "==", numeroOriginal));
        const dupSnap = await getDocs(dupQuery);
        let duplicado = false;
        dupSnap.forEach(d => { if(d.id !== editId) duplicado = true; });
        
        if(duplicado) {
            alert(`⚠️ ALERTA DE DUPLICIDADE: O documento ${numeroOriginal} já existe no banco de dados. Operação cancelada.`);
            if(btnForm) btnForm.disabled = false;
            mostrarLoading(false);
            return;
        }

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

// ARQUIVAR DOCUMENTO
window.arquivarDocumento = async function(id) {
    const motivo = prompt("Digite o motivo do Arquivamento (Ex: Limpeza Realizada, Cancelado, Virou Multa):");
    if(!motivo) return;
    mostrarLoading(true, "Arquivando...");
    try {
        await updateDoc(doc(db, "notificacoes", id), { statusProcesso: 'arquivado', motivoArquivamento: motivo, dataArquivamento: new Date().toISOString() });
        await window.carregarDadosNuvem(); window.mostrarToast("Processo Arquivado!"); await registrarLog("Arquivou Processo", `ID: ${id}`);
    } catch(e) { alert("Erro ao arquivar."); }
    mostrarLoading(false);
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
window.aplicarFiltroProcesso = function(status, btnElement) { window.filtroProcessoAtual = status; document.querySelectorAll('#view-inicio .filter-group:first-child .filter-type-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }
window.ordenarTabela = function(coluna) { if (window.colunaOrdenacao === coluna) { window.ordemCrescente = !window.ordemCrescente; } else { window.colunaOrdenacao = coluna; window.ordemCrescente = true; } window.renderizarPainel(); }
window.toggleTodos = function(master) { document.querySelectorAll('.select-item').forEach(cb => { cb.checked = master.checked; }); }

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
            const dv = calcularDataVencimento(i.dataRecebimento, i.prazoDias);
            return dv && new Date(dv + "T00:00:00") >= hoje;
        }); 
    } else if (window.filtroStatusAtual === 'Vencidos') { 
        filtrados = filtrados.filter(i => {
            if(!i.dataRecebimento) return false;
            const dv = calcularDataVencimento(i.dataRecebimento, i.prazoDias);
            return dv && new Date(dv + "T00:00:00") < hoje;
        }); 
    } else if (window.filtroStatusAtual === 'Com AR') { filtrados = filtrados.filter(i => i.codigoAR && i.codigoAR.trim() !== ""); }
    
    if (window.colunaOrdenacao) { filtrados.sort((a, b) => { let valA = (a[window.colunaOrdenacao] || '').toLowerCase(); let valB = (b[window.colunaOrdenacao] || '').toLowerCase(); if (valA < valB) return window.ordemCrescente ? -1 : 1; if (valA > valB) return window.ordemCrescente ? 1 : -1; return 0; }); }
    window.itensFiltradosAtual = filtrados; 
    
    filtrados.forEach(item => {
        const iconeFoto = (item.qtdFotosSalvas && item.qtdFotosSalvas > 0) ? ` 📷(${item.qtdFotosSalvas})` : '';
        let statusHtml = ''; let botaoAutuar = ''; let botaoArquivar = `<a onclick="arquivarDocumento('${item.firebaseId}')" style="color:#d97706;">Arquivar</a>`;
        const badgeTipo = item.tipoDocumento === 'auto' ? `<span class="badge-tipo-auto">MULTA / AUTO</span>` : `<span class="badge-tipo-notif">NOTIFICAÇÃO</span>`;
        
        if (item.statusProcesso === 'arquivado') {
            botaoArquivar = '';
            statusHtml += `<div style="background:#f1f5f9; padding:6px; border-radius:4px; text-align:center; color:#475569; font-weight:bold; font-size:11px;">📂 ARQUIVADO<br><small style="font-weight:normal;">${item.motivoArquivamento || ''}</small></div>`;
        } else {
            if(item.statusNotificacao === 'rascunho') {
                statusHtml += `<div style="background:#fef3c7; color:#b45309; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #fde68a;">📝 RASCUNHO</div>`;
            } else if (item.statusNotificacao === 'enviado_ar') {
                statusHtml += `<div style="background:#e0f2fe; color:#0369a1; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #bae6fd;">📬 ENVIADO POR AR</div>`;
            } else if (item.statusNotificacao === 'recebido' || item.tipoDocumento === 'auto') {
                statusHtml += `<div style="background:#dcfce7; color:#166534; padding:4px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; border:1px solid #bbf7d0;">✅ CIÊNCIA DADA</div>`;
            }

            if(item.codigoAR) { 
                let tituloTooltip = item.statusCorreiosTexto ? `Status Completo: ${item.statusCorreiosTexto}` : `Aguardando atualização.`;
                statusHtml += `
                <div title="${tituloTooltip}" style="margin-top:5px; background:#f8fafc; color:#475569; padding:4px; border-radius:4px; border:1px solid #cbd5e1; text-align:center; min-width: 140px; cursor:help;">
                    <div style="font-size:10px; font-weight:bold;">
                        AR: ${item.codigoAR} <span id="ar-${item.firebaseId}"><button style="background:none;border:none;color:inherit;font-size:10px;cursor:pointer;padding:0;text-decoration:underline;margin-left:5px;" onclick="buscarStatusCorreios('${item.codigoAR}', 'ar-${item.firebaseId}', '${item.firebaseId}')">API</button></span>
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
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="select-item" value="${item.firebaseId}" onclick="handleShiftClick(event, this)"></td><td>${badgeTipo}</td><td><strong>${item.numNotif}</strong></td><td><div style="font-weight:bold; color:#1b365d;">${(item.nome || 'DADOS PENDENTES').toUpperCase()} ${iconeFoto}</div><div style="font-size:11px; color:#64748b; margin-top:2px;">${item.loteEndereco}</div></td><td>${statusHtml}</td><td class="action-links"><a onclick="carregarParaEditar('${item.firebaseId}')">Editar</a><a onclick="imprimirRegistro('${item.firebaseId}')">Imprimir</a>${botaoArquivar}${botaoAutuar}</td>`;
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
        
        document.querySelectorAll('.dinamico-chk-auto').forEach(chk => { chk.checked = (item.arrayInfracoes || []).includes(chk.value); });
        
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
    if(document.getElementById('prazoDias')) document.getElementById('prazoDias').value = item.prazoDias || '15'; 
    if(document.getElementById('dataRecebimento')) document.getElementById('dataRecebimento').value = item.dataRecebimento || ''; 
    
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
    
    // Suporte Legado (antigos checkboxes hardcoded) + Novo Dinâmico
    document.querySelectorAll('.dinamico-chk-notificacao').forEach(chk => { chk.checked = (item.arrayInfracoes || []).includes(chk.value); });
    
    if(document.getElementById('ref')) document.getElementById('ref').value = item.ref || ''; 
    if(document.getElementById('obs')) document.getElementById('obs').value = item.obs || ''; 
    
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
    if(document.getElementById('prazoDias')) document.getElementById('prazoDias').value = '15'; 
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

// IMPRESSÃO DINÂMICA COM O LAYOUT ANTIGO RESTAURADO E MOTOR DE LEIS NOVO
window.imprimirRegistro = function(id) {
    const item = window.DB.find(i => i.firebaseId === id); if (!item) return; const s = item.setor || 'SMMAM';
    if(s === 'MOBILIDADE') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Segurança e Mobilidade Urbana"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Mobilidade Urbana</strong><br>Av. Osvaldo Aranha, 1075"; } else if(s === 'OBRAS') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Obras e Posturas"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>Setor de Posturas</strong><br>Rua Mal Deodoro, 70"; } else { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Municipal do Meio Ambiente"; if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerHTML = "<strong>SMMAM / Fiscalização</strong><br>Rua 10 de Novembro, 190"; }
    
    let pzTxt = "Imediato"; 
    if(item.prazoDias) pzTxt = `${item.prazoDias} Dias Corridos (A partir do recebimento)`;
    
    if(document.getElementById('pNum')) document.getElementById('pNum').innerText = item.numNotif; 
    if(document.getElementById('pData')) document.getElementById('pData').innerText = item.dataNotif.split('-').reverse().join('/'); 
    
    if(document.getElementById('pNome')) document.getElementById('pNome').innerText = (item.nome || '_____________________________________________________').toUpperCase(); 
    if(document.getElementById('pDoc')) document.getElementById('pDoc').innerText = item.doc || '_________________________'; 
    if(document.getElementById('pDataRecebimentoPrint')) document.getElementById('pDataRecebimentoPrint').innerText = item.dataRecebimento ? `Data de Recebimento: ${item.dataRecebimento.split('-').reverse().join('/')}` : 'Data de Recebimento: _____/_____/_________';

    if(document.getElementById('pEndereco')) document.getElementById('pEndereco').innerText = item.endereco || '---'; 
    if(document.getElementById('pTelefone')) document.getElementById('pTelefone').innerText = item.telefone || '---'; 
    if(document.getElementById('pBairro')) document.getElementById('pBairro').innerText = item.bairro || '---'; 
    if(document.getElementById('pCep')) document.getElementById('pCep').innerText = item.cep || '---'; 
    if(document.getElementById('pCadDistrito')) document.getElementById('pCadDistrito').innerText = item.cadDistrito || '---'; 
    if(document.getElementById('pCadZona')) document.getElementById('pCadZona').innerText = item.cadZona || '---'; 
    if(document.getElementById('pCadQuadra')) document.getElementById('pCadQuadra').innerText = item.cadQuadra || '---'; 
    if(document.getElementById('pCadLote')) document.getElementById('pCadLote').innerText = item.cadLote || '---'; 
    if(document.getElementById('pCadImob')) document.getElementById('pCadImob').innerText = item.cadImob || ''; 
    if(document.getElementById('pLoteEndereco')) document.getElementById('pLoteEndereco').innerText = item.loteEndereco || ''; 
    if(document.getElementById('pRef')) document.getElementById('pRef').innerText = item.ref || '---'; 
    if(document.getElementById('pObs')) document.getElementById('pObs').innerText = item.obs || '---'; 
    if(document.getElementById('pFiscal')) document.getElementById('pFiscal').innerText = item.fiscal || ''; 
    if(document.getElementById('pMatricula')) document.getElementById('pMatricula').innerText = item.matricula || ''; 
    
    if(document.getElementById('pCidadePrint')) document.getElementById('pCidadePrint').innerText = item.cidade || 'BENTO GONÇALVES';
    if(document.getElementById('pUfPrint')) document.getElementById('pUfPrint').innerText = item.uf || 'RS';
    if(document.getElementById('pTipoPresencial')) document.getElementById('pTipoPresencial').innerText = item.tipoPresencial ? '( X ) Notificação Presencial' : '( ) Notificação Presencial'; 
    if(document.getElementById('pTipoAR')) document.getElementById('pTipoAR').innerText = item.tipoAR ? '( X ) Notificado por AR' : '( ) Notificado por AR'; 

    // Renderização Dinâmica do Layout Original de Caixinhas
    const boxInfr = document.getElementById('boxInfracoesImpresso');
    const listTextos = document.getElementById('listaTextosLegaisImpresso');
    if(boxInfr && listTextos) {
        boxInfr.innerHTML = '';
        listTextos.innerHTML = '';
        
        let marcadasLegado = [];
        if(item.irrMato) marcadasLegado.push('Vegetação');
        if(item.irrResiduos) marcadasLegado.push('Resíduos');
        if(item.irrEntulhos) marcadasLegado.push('Obras');
        if(item.irrOutros) marcadasLegado.push('Outros');

        window.bancoInfracoesGlobais.forEach(inf => {
            const isChecked = (item.arrayInfracoes && item.arrayInfracoes.includes(inf.id)) || marcadasLegado.includes(inf.nome);
            const marcaX = isChecked ? '( X )' : '(   )';
            boxInfr.innerHTML += `<div style="font-weight:bold; font-size:11px; margin-right:15px;">${marcaX} ${inf.nome}</div>`;
            
            if(isChecked) {
                listTextos.innerHTML += `<li><strong>${inf.baseLegal}:</strong> ${inf.textoPadrao}</li>`;
            }
        });
        
        // Compatibilidade Legado de Texto Padrão caso o banco dinâmico esteja vazio
        if(item.lei5198 && window.bancoInfracoesGlobais.length === 0) listTextos.innerHTML += `<li>Vegetais arbóreos, lenhosos e nativos deverão ser preservados. Fica proibido o emprego do fogo, bem como, a utilização da capina química para limpeza dos lotes. Após realizada limpeza, fica o notificado obrigado a apresentar levantamento fotográfico.</li>`;
    }

    if(document.getElementById('pPrazoImpressao')) document.getElementById('pPrazoImpressao').innerText = pzTxt;
    window.print();
}

window.exportarExcel = function() {
    if(window.itensFiltradosAtual.length === 0) return alert("Vazio."); let c = "\uFEFFNº Reg;Tipo;Ouvidoria;Data Emissao;Data Recebimento;Prazo Dias;Nome;CPF/CNPJ;Lote Irregular;Bairro;Cidade;Codigo AR;Status Processo;Fiscal\n";
    window.itensFiltradosAtual.forEach(i => { c += `${i.numNotif || ''};${(i.tipoDocumento||'').toUpperCase()};${i.procOuvidoria || ''};${i.dataNotif ? i.dataNotif.split('-').reverse().join('/') : ''};${i.dataRecebimento ? i.dataRecebimento.split('-').reverse().join('/') : 'SUSPENSO'};${i.prazoDias||''};${(i.nome||'').toUpperCase().replace(/;/g,',')};${i.doc||''};${(i.loteEndereco||'').replace(/;/g,',')};${i.bairro||''};${i.cidade||''};${i.codigoAR||''};${(i.statusProcesso||'').toUpperCase()};${i.fiscal||''}\n`; });
    const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const l = document.createElement("a"); l.href = URL.createObjectURL(b); l.download = `SMMAM_Relatorio_${Date.now()}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l);
}
