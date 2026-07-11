import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, getDocs, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

let usuarioLogado = null;
let perfilUsuario = null;

const mostrarLoading = (mostrar, msg = "Sincronizando Banco de Dados...") => {
    document.getElementById('loading-msg').innerText = msg;
    document.getElementById('loading-overlay').style.display = mostrar ? 'flex' : 'none';
}

window.mostrarToast = function(msg) {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.className = "show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function aplicarRestricoesDeTela() {
    if(!perfilUsuario) return;
    const nivel = perfilUsuario.nivel;
    if(nivel === 'leitor') document.getElementById('areaBotoesSalvar').style.display = 'none';
    else document.getElementById('areaBotoesSalvar').style.display = 'flex';

    if(nivel === 'admin') {
        document.getElementById('btnExcluirLote').style.display = 'block';
        document.getElementById('btnAdminTop').style.display = 'block';
    } else {
        document.getElementById('btnExcluirLote').style.display = 'none';
        document.getElementById('btnAdminTop').style.display = 'none';
    }
}

window.toggleAuthMode = function() {
    const loginFields = document.getElementById('login-fields');
    const registerFields = document.getElementById('register-fields');
    const title = document.getElementById('authTitle');
    const btnToggle = document.getElementById('btnToggleAuth');

    if(loginFields.style.display === 'none') {
        loginFields.style.display = 'block'; registerFields.style.display = 'none';
        title.innerText = 'Acesso - SMMAM'; btnToggle.innerText = 'Servidor Novo? Solicite Acesso';
    } else {
        loginFields.style.display = 'none'; registerFields.style.display = 'block';
        title.innerText = 'Cadastro de Servidor'; btnToggle.innerText = 'Já tenho conta (Entrar)';
    }
}

const regCpf = document.getElementById('regCpf'); const regTel = document.getElementById('regTelefone');
if(regCpf) regCpf.addEventListener('input', function(e) { let v = e.target.value.replace(/\D/g, ''); if (v.length <= 11) { v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); } e.target.value = v; });
if(regTel) regTel.addEventListener('input', function(e) { let v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); else v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); e.target.value = v.substring(0, 15); });

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioLogado = user;
        mostrarLoading(true, "Lendo credenciais e permissões...");
        try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                perfilUsuario = docSnap.data();
                if (perfilUsuario.status === 'pendente' || perfilUsuario.status === 'bloqueado') {
                    document.getElementById('auth-container').style.display = 'none'; document.getElementById('main-workspace').style.display = 'none'; document.getElementById('admin-workspace').style.display = 'none'; document.getElementById('waiting-room').style.display = 'block';
                    if(perfilUsuario.status === 'bloqueado') document.querySelector('#waiting-room h2').innerText = '🚫 Acesso Bloqueado';
                } else if (perfilUsuario.status === 'aprovado') {
                    document.getElementById('auth-container').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none'; document.getElementById('admin-workspace').style.display = 'none'; document.getElementById('main-workspace').style.display = 'grid';
                    document.getElementById('userLoggedDisplay').innerHTML = `👤 <strong>${perfilUsuario.nome}</strong> (${perfilUsuario.nivel.toUpperCase()})`;
                    document.getElementById('fiscal').value = perfilUsuario.nome; document.getElementById('matricula').value = perfilUsuario.matricula;
                    aplicarRestricoesDeTela(); window.carregarDadosNuvem();
                }
            } else {
                const novoPerfil = { nome: "Administrador Legado", cargo: "Administrador do Sistema", cpf: "000.000.000-00", telefone: "Não informado", matricula: "0000", email: user.email, status: "aprovado", nivel: "admin", dataCadastro: new Date().toISOString() };
                await setDoc(userDocRef, novoPerfil); perfilUsuario = novoPerfil;
                document.getElementById('auth-container').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none'; document.getElementById('main-workspace').style.display = 'grid';
                document.getElementById('userLoggedDisplay').innerHTML = `👤 <strong>Admin Legado</strong> (ADMIN)`;
                aplicarRestricoesDeTela(); window.carregarDadosNuvem();
            }
        } catch(e) { console.error("Erro na leitura de permissões", e); alert("Erro ao validar permissões de acesso."); }
        mostrarLoading(false);
    } else {
        usuarioLogado = null; perfilUsuario = null;
        document.getElementById('auth-container').style.display = 'flex'; document.getElementById('main-workspace').style.display = 'none'; document.getElementById('waiting-room').style.display = 'none'; document.getElementById('admin-workspace').style.display = 'none';
    }
});

window.realizarLogin = function() {
    const email = document.getElementById('authEmail').value; const senha = document.getElementById('authPassword').value;
    if(!email || !senha) return alert("Preencha e-mail e senha.");
    mostrarLoading(true, "Acessando sistema...");
    signInWithEmailAndPassword(auth, email, senha).catch((error) => { mostrarLoading(false); alert("Erro ao entrar: Verifique as credenciais."); });
}

window.registrarUsuario = async function() {
    const nome = document.getElementById('regNome').value; const cargo = document.getElementById('regCargo').value; const cpf = document.getElementById('regCpf').value; const telefone = document.getElementById('regTelefone').value; const matricula = document.getElementById('regMatricula').value; const email = document.getElementById('regEmail').value; const senha = document.getElementById('regPassword').value;
    if(!nome || !cargo || !cpf || !telefone || !matricula || !email || !senha) return alert("Preencha todos os campos obrigatórios do cadastro.");
    if(senha.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");
    mostrarLoading(true, "Criando ficha do servidor...");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;
        await setDoc(doc(db, "usuarios", user.uid), { nome: nome, cargo: cargo, cpf: cpf, telefone: telefone, matricula: matricula, email: email, status: "pendente", nivel: "leitor", dataCadastro: new Date().toISOString() });
        sendEmailVerification(user);
        mostrarLoading(false); alert("Cadastro realizado! Seu acesso foi enviado para a fila de aprovação do Administrador.");
    } catch(error) { mostrarLoading(false); alert("Erro ao criar conta: " + error.message); }
}

window.recuperarSenha = function() {
    const email = document.getElementById('authEmail').value || document.getElementById('regEmail').value;
    if(!email) return alert("Digite seu e-mail em algum dos campos para recuperar a senha.");
    mostrarLoading(true);
    sendPasswordResetEmail(auth, email).then(() => { mostrarLoading(false); alert("E-mail de redefinição de senha enviado!"); }).catch((error) => { mostrarLoading(false); alert("Erro: " + error.message); });
}

window.realizarLogout = function() { signOut(auth).then(() => { window.DB = []; document.getElementById('tabelaCorpo').innerHTML = ''; window.limparFormulario(); }); }

window.abrirPainelAdmin = async function() {
    document.getElementById('main-workspace').style.display = 'none'; document.getElementById('admin-workspace').style.display = 'block';
    mostrarLoading(true, "Carregando usuários...");
    const corpoUsuarios = document.getElementById('tabelaUsuariosCorpo'); corpoUsuarios.innerHTML = '';
    try {
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        usersSnapshot.forEach(docSnap => {
            const u = docSnap.data(); const uid = docSnap.id;
            const selectStatus = `<select class="select-status status-${u.status}" onchange="alterarConfigUsuario('${uid}', 'status', this.value, this)"><option value="pendente" ${u.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option><option value="aprovado" ${u.status === 'aprovado' ? 'selected' : ''}>✅ Aprovado</option><option value="bloqueado" ${u.status === 'bloqueado' ? 'selected' : ''}>🚫 Bloqueado</option></select>`;
            const selectNivel = `<select style="padding: 4px; font-size: 12px; border-radius: 4px;" onchange="alterarConfigUsuario('${uid}', 'nivel', this.value, this)"><option value="leitor" ${u.nivel === 'leitor' ? 'selected' : ''}>👁️ Leitor</option><option value="fiscal" ${u.nivel === 'fiscal' ? 'selected' : ''}>📝 Fiscal</option><option value="admin" ${u.nivel === 'admin' ? 'selected' : ''}>⚙️ Administrador</option></select>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${u.nome}</strong><br><small style="color:#64748b;">${u.cargo}</small></td><td>${u.email}<br><small style="color:#64748b;">${u.telefone}</small></td><td>${u.matricula}</td><td>${selectStatus}</td><td>${selectNivel}</td>`;
            corpoUsuarios.appendChild(tr);
        });
    } catch(e) { console.error(e); alert("Erro ao carregar usuários. Verifique se você é Administrador."); }
    mostrarLoading(false);
}

window.fecharPainelAdmin = function() { document.getElementById('admin-workspace').style.display = 'none'; document.getElementById('main-workspace').style.display = 'grid'; }

window.alterarConfigUsuario = async function(uid, campo, valorNovo, selectElement) {
    try {
        const userRef = doc(db, "usuarios", uid);
        await updateDoc(userRef, { [campo]: valorNovo });
        window.mostrarToast(`Atualizado para ${valorNovo}!`);
        if(campo === 'status') selectElement.className = `select-status status-${valorNovo}`;
    } catch(e) { console.error(e); alert("Erro ao atualizar o perfil. Você tem permissão de Administrador?"); }
}

window.aplicarFiltro = function(status, btnElement) { window.filtroStatusAtual = status; document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active')); btnElement.classList.add('active'); window.renderizarPainel(); }

window.carregarDadosNuvem = async function() {
    mostrarLoading(true, "Baixando dados...");
    try {
        const querySnapshot = await getDocs(notificacoesRef); window.DB = [];
        querySnapshot.forEach((documento) => { let data = documento.data(); data.firebaseId = documento.id; window.DB.push(data); });
        window.renderizarPainel();
    } catch (e) { console.error(e); }
    mostrarLoading(false);
}

window.salvarNotificacao = async function(event) {
    event.preventDefault();
    if(perfilUsuario.nivel === 'leitor') return alert("Leitores não podem salvar dados.");
    mostrarLoading(true, "Salvando dados e anexando fotos...");
    const btn = document.getElementById('btnSalvar'); btn.disabled = true;
    const editId = document.getElementById('editFirebaseId').value; const qtdFotosAnexadas = window.fotosTemp.length;
    const dados = {
        numNotif: document.getElementById('numNotif').value, procOuvidoria: document.getElementById('procOuvidoria').value, codigoAR: document.getElementById('codigoAR').value.toUpperCase(), dataPrazo: document.getElementById('dataPrazo').value, dataNotif: document.getElementById('dataNotif').value, tipoAR: document.getElementById('tipoAR').checked, tipoPresencial: document.getElementById('tipoPresencial').checked, nome: document.getElementById('nome').value, doc: document.getElementById('doc').value, endereco: document.getElementById('endereco').value, telefone: document.getElementById('telefone').value, bairro: document.getElementById('bairro').value, cep: document.getElementById('cep').value, cadDistrito: document.getElementById('cadDistrito').value, cadZona: document.getElementById('cadZona').value, cadQuadra: document.getElementById('cadQuadra').value, cadLote: document.getElementById('cadLote').value, cadImob: document.getElementById('cadImob').value, loteEndereco: document.getElementById('loteEndereco').value, irrMato: document.getElementById('irrMato').checked, irrResiduos: document.getElementById('irrResiduos').checked, irrEntulhos: document.getElementById('irrEntulhos').checked, irrOutros: document.getElementById('irrOutros').checked, ref: document.getElementById('ref').value, obs: document.getElementById('obs').value, lei5198: document.getElementById('lei5198').checked, lc56: document.getElementById('lc56').checked, fiscal: document.getElementById('fiscal').value, matricula: document.getElementById('matricula').value, qtdFotosSalvas: qtdFotosAnexadas, editadoPor: perfilUsuario ? perfilUsuario.nome : 'Desconhecido', dataUltimaEdicao: new Date().toISOString()
    };
    try {
        let idDoDocumento = editId;
        if (editId) { const docRef = doc(db, "notificacoes", editId); await updateDoc(docRef, dados); } 
        else { dados.criadoPor = perfilUsuario ? perfilUsuario.nome : 'Desconhecido'; dados.criadoPorEmail = perfilUsuario ? perfilUsuario.email : ''; dados.dataCriacao = new Date().toISOString(); const novoDocRef = await addDoc(notificacoesRef, dados); idDoDocumento = novoDocRef.id; }
        const fotosSubRef = collection(db, "notificacoes", idDoDocumento, "evidencias");
        if (editId) { const fotosAntigas = await getDocs(fotosSubRef); for (let f of fotosAntigas.docs) { await deleteDoc(f.ref); } }
        for (let fotoBase64 of window.fotosTemp) { await addDoc(fotosSubRef, { imagemBinaria: fotoBase64 }); }
        await window.carregarDadosNuvem(); window.limparFormulario(); window.mostrarToast("Salvo com sucesso na nuvem!");
    } catch (e) { alert("Erro ao salvar o banco de dados. Você tem permissão?"); console.error(e); }
    btn.disabled = false; mostrarLoading(false);
}

window.excluirSelecionadas = async function() {
    if(perfilUsuario.nivel !== 'admin') return alert("Apenas Administradores podem excluir dados.");
    const marcados = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    if(marcados.length === 0) { alert('Selecione ao menos um item para excluir.'); return; }
    if(confirm(`Tem certeza que deseja apagar ${marcados.length} notificação(ões) DA NUVEM?`)) {
        mostrarLoading(true, "Excluindo arquivos...");
        try {
            for (let id of marcados) { 
                const fotosSubRef = collection(db, "notificacoes", id, "evidencias"); const fotosParaApagar = await getDocs(fotosSubRef);
                for (let f of fotosParaApagar.docs) { await deleteDoc(f.ref); } await deleteDoc(doc(db, "notificacoes", id)); 
            }
            document.getElementById('selecionarTodos').checked = false; await window.carregarDadosNuvem(); window.mostrarToast("Excluído permanentemente!");
        } catch(e) { alert("Erro ao excluir."); console.error(e); }
        mostrarLoading(false);
    }
}

window.processarFotos = function(event) {
    const files = event.target.files; if(!files) return;
    for(let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const MAX_WIDTH = 700; let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height); window.fotosTemp.push(canvas.toDataURL('image/jpeg', 0.45)); window.renderizarPreviewFotos();
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
    event.target.value = ''; 
}

window.renderizarPreviewFotos = function() {
    const container = document.getElementById('previewFotos'); container.innerHTML = '';
    window.fotosTemp.forEach((foto, index) => {
        const div = document.createElement('div'); div.style.position = 'relative';
        div.innerHTML = `<img src="${foto}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc;"><button type="button" onclick="removerFoto(${index})" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:10px;cursor:pointer;">X</button>`; container.appendChild(div);
    });
}
window.removerFoto = function(index) { window.fotosTemp.splice(index, 1); window.renderizarPreviewFotos(); }

window.atualizarDashboard = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0); let noPrazo = 0; let vencidas = 0;
    window.DB.forEach(i => { if(i.dataPrazo) { const prazo = new Date(i.dataPrazo + "T00:00:00"); if(prazo < hoje) vencidas++; else noPrazo++; } });
    document.getElementById('dashTotal').innerText = window.DB.length; document.getElementById('dashPrazo').innerText = noPrazo; document.getElementById('dashVencida').innerText = vencidas;
}

window.renderizarPainel = function() {
    window.atualizarDashboard(); const corpo = document.getElementById('tabelaCorpo'); corpo.innerHTML = ''; const filtroTexto = document.getElementById('buscaInput').value.toLowerCase(); const hoje = new Date(); hoje.setHours(0,0,0,0);
    let filtrados = window.DB.filter(item => { return (item.nome || '').toLowerCase().includes(filtroTexto) || (item.numNotif || '').toLowerCase().includes(filtroTexto) || (item.loteEndereco || '').toLowerCase().includes(filtroTexto) || (item.procOuvidoria || '').toLowerCase().includes(filtroTexto) || (item.codigoAR || '').toLowerCase().includes(filtroTexto); });
    if (window.filtroStatusAtual === 'No Prazo') { filtrados = filtrados.filter(i => i.dataPrazo && new Date(i.dataPrazo + "T00:00:00") >= hoje); } else if (window.filtroStatusAtual === 'Vencidos') { filtrados = filtrados.filter(i => i.dataPrazo && new Date(i.dataPrazo + "T00:00:00") < hoje); } else if (window.filtroStatusAtual === 'Com AR') { filtrados = filtrados.filter(i => i.codigoAR && i.codigoAR.trim() !== ""); }
    if (window.colunaOrdenacao) { filtrados.sort((a, b) => { let valA = (a[window.colunaOrdenacao] || '').toLowerCase(); let valB = (b[window.colunaOrdenacao] || '').toLowerCase(); if (valA < valB) return window.ordemCrescente ? -1 : 1; if (valA > valB) return window.ordemCrescente ? 1 : -1; return 0; }); }
    window.itensFiltradosAtual = filtrados; 
    filtrados.forEach(item => {
        const badgeOuvidoria = item.procOuvidoria ? `<br><span class="badge-ouvidoria">Ouv: ${item.procOuvidoria}</span>` : ''; const iconeFoto = (item.qtdFotosSalvas && item.qtdFotosSalvas > 0) ? ` 📷(${item.qtdFotosSalvas})` : '';
        let statusHtml = ''; let botaoAutuar = '';
        if(item.codigoAR) { statusHtml += `<span class="badge-ar">AR: ${item.codigoAR}</span>`; }
        if(item.dataPrazo) { const dataFormatada = item.dataPrazo.split('-').reverse().join('/'); const prazo = new Date(item.dataPrazo + "T00:00:00"); if(prazo < hoje) { statusHtml += `<span class="badge-vencido">Vencido: ${dataFormatada}</span>`; botaoAutuar = `<a class="btn-autuar" onclick="abrirModuloAutoInfracao()">📝 Autuar</a>`; } else { statusHtml += `<span class="badge-prazo">No Prazo: ${dataFormatada}</span>`; } }
        const carimbo = item.criadoPor ? `<br><small style="color:#94a3b8; font-size:10px;">👤 ${item.criadoPor}</small>` : ''; if(!statusHtml) statusHtml = '<small style="color:#94a3b8">Sem acompanhamento</small>';
        const tr = document.createElement('tr');
        const linkEditarOuVer = (perfilUsuario && perfilUsuario.nivel === 'leitor') ? `<a onclick="carregarParaEditar('${item.firebaseId}')">Ver Lote</a>` : `<a onclick="carregarParaEditar('${item.firebaseId}')">Editar</a>`;
        tr.innerHTML = `<td><input type="checkbox" class="select-item" value="${item.firebaseId}"></td><td><strong>${item.numNotif}</strong>${badgeOuvidoria}</td><td><div style="font-weight:bold; color:#1b365d;">${item.nome.toUpperCase()} ${iconeFoto}</div><div style="font-size:11px; color:#64748b; margin-top:2px;">${item.loteEndereco}</div>${carimbo}</td><td>${statusHtml}</td><td class="action-links">${linkEditarOuVer}<a onclick="imprimirRegistro('${item.firebaseId}')">Imprimir</a>${botaoAutuar}</td>`;
        corpo.appendChild(tr);
    });
}

window.abrirModuloAutoInfracao = function() { alert("Módulo de Auto de Infração em construção!\nSerá configurado na segunda-feira com o formulário oficial."); }
window.ordenarTabela = function(coluna) { if (window.colunaOrdenacao === coluna) { window.ordemCrescente = !window.ordemCrescente; } else { window.colunaOrdenacao = coluna; window.ordemCrescente = true; } window.renderizarPainel(); }

window.carregarParaEditar = async function(firebaseId) {
    const item = window.DB.find(i => i.firebaseId === firebaseId); if (!item) return;
    document.getElementById('indicadorFotos').style.display = 'inline-block'; window.scrollTo(0,0);
    document.getElementById('editFirebaseId').value = item.firebaseId; document.getElementById('numNotif').value = item.numNotif || ''; document.getElementById('procOuvidoria').value = item.procOuvidoria || ''; document.getElementById('codigoAR').value = item.codigoAR || ''; document.getElementById('dataPrazo').value = item.dataPrazo || ''; document.getElementById('dataNotif').value = item.dataNotif || ''; document.getElementById('tipoAR').checked = item.tipoAR; document.getElementById('tipoPresencial').checked = item.tipoPresencial; document.getElementById('nome').value = item.nome || ''; document.getElementById('doc').value = item.doc || ''; document.getElementById('endereco').value = item.endereco || ''; document.getElementById('telefone').value = item.telefone || ''; document.getElementById('bairro').value = item.bairro || ''; document.getElementById('cep').value = item.cep || ''; document.getElementById('cadDistrito').value = item.cadDistrito || ''; document.getElementById('cadZona').value = item.cadZona || ''; document.getElementById('cadQuadra').value = item.cadQuadra || ''; document.getElementById('cadLote').value = item.cadLote || ''; document.getElementById('cadImob').value = item.cadImob || ''; document.getElementById('loteEndereco').value = item.loteEndereco || ''; document.getElementById('irrMato').checked = item.irrMato; document.getElementById('irrResiduos').checked = item.irrResiduos; document.getElementById('irrEntulhos').checked = item.irrEntulhos; document.getElementById('irrOutros').checked = item.irrOutros; document.getElementById('ref').value = item.ref || ''; document.getElementById('obs').value = item.obs || ''; document.getElementById('lei5198').checked = item.lei5198; document.getElementById('lc56').checked = item.lc56;
    window.fotosTemp = [];
    try { const fotosSubRef = collection(db, "notificacoes", item.firebaseId, "evidencias"); const docFotos = await getDocs(fotosSubRef); docFotos.forEach(doc => { window.fotosTemp.push(doc.data().imagemBinaria); }); } catch(e) { console.error("Erro ao buscar fotos", e); }
    document.getElementById('indicadorFotos').style.display = 'none'; window.renderizarPreviewFotos();
}

window.limparFormulario = function() {
    document.getElementById('notifForm').reset(); document.getElementById('editFirebaseId').value = ''; document.getElementById('dataNotif').valueAsDate = new Date();
    if(perfilUsuario) { document.getElementById('fiscal').value = perfilUsuario.nome; document.getElementById('matricula').value = perfilUsuario.matricula; }
    window.fotosTemp = []; window.renderizarPreviewFotos();
}

window.toggleTodos = function(master) { document.querySelectorAll('.select-item').forEach(cb => cb.checked = master.checked); }

const docInputForm = document.getElementById('doc'); const cepInput = document.getElementById('cep'); const telefoneInputForm = document.getElementById('telefone');
if(docInputForm) docInputForm.addEventListener('input', function(e) { let v = e.target.value.replace(/\D/g, ''); if (v.length <= 11) { v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); } else { v = v.substring(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'); } e.target.value = v; });
if(cepInput) cepInput.addEventListener('input', function(e) { let v = e.target.value.replace(/\D/g, ''); e.target.value = v.replace(/^(\d{5})(\d)/, '$1-$2'); });
if(telefoneInputForm) telefoneInputForm.addEventListener('input', function(e) { let v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); else v = v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); e.target.value = v.substring(0, 15); });

window.imprimirRegistro = function(firebaseId) {
    const item = window.DB.find(i => i.firebaseId === firebaseId); if (!item) return;
    document.getElementById('pNum').innerText = item.numNotif; document.getElementById('pData').innerText = item.dataNotif.split('-').reverse().join('/'); document.getElementById('pNome').innerText = (item.nome || '').toUpperCase(); document.getElementById('pDoc').innerText = item.doc; document.getElementById('pEndereco').innerText = item.endereco || '---'; document.getElementById('pTelefone').innerText = item.telefone || '---'; document.getElementById('pBairro').innerText = item.bairro || '---'; document.getElementById('pCep').innerText = item.cep || '---'; document.getElementById('pCadDistrito').innerText = item.cadDistrito || '---'; document.getElementById('pCadZona').innerText = item.cadZona || '---'; document.getElementById('pCadQuadra').innerText = item.cadQuadra || '---'; document.getElementById('pCadLote').innerText = item.cadLote || '---'; document.getElementById('pCadImob').innerText = item.cadImob || ''; document.getElementById('pLoteEndereco').innerText = item.loteEndereco || ''; document.getElementById('pRef').innerText = item.ref || 'Não informado'; document.getElementById('pObs').innerText = item.obs || 'Nenhuma'; document.getElementById('pFiscal').innerText = item.fiscal || ''; document.getElementById('pMatricula').innerText = item.matricula || '';
    document.getElementById('pTipoPresencial').innerText = item.tipoPresencial ? '( X ) Notificação Presencial' : '( ) Notificação Presencial'; document.getElementById('pTipoAR').innerText = item.tipoAR ? '( X ) Notificado por AR' : '( ) Notificado por AR'; document.getElementById('pIrrMato').innerText = item.irrMato ? '( X ) Vegetação Rasteira/mato' : '( ) Vegetação Rasteira/mato'; document.getElementById('pIrrResiduos').innerText = item.irrResiduos ? '( X ) Resíduos Sólidos Diversos' : '( ) Resíduos Sólidos Diversos'; document.getElementById('pIrrEntulhos').innerText = item.irrEntulhos ? '( X ) Entulhos' : '( ) Entulhos'; document.getElementById('pIrrOutros').innerText = item.irrOutros ? '( X ) Outros' : '( ) Outros'; document.getElementById('pLei5198').innerText = item.lei5198 ? '( X ) artigo 6º, parágrafo 2º, da Lei Municipal nº 5.198/2011 e suas alterações.' : '( ) artigo 6º, parágrafo 2º, da Lei Municipal nº 5.198/2011 e suas alterações.'; document.getElementById('pLc56').innerText = item.lc56 ? '( X ) artigo 41, inciso III, da Lei Complementar Municipal nº 56/2002.' : '( ) artigo 41, inciso III, da Lei Complementar Municipal nº 56/2002.';
    const tituloOriginal = document.title; document.title = `${item.numNotif} - ${(item.nome || '').toUpperCase()}`;
    window.print(); setTimeout(() => { document.title = tituloOriginal; }, 1000);
}

window.exportarExcel = function() {
    if(window.itensFiltradosAtual.length === 0) { alert("Não há dados na tela para exportar."); return; }
    let csvContent = "\uFEFF"; csvContent += "Nº Notificacao;Ouvidoria;Data Notificacao;Nome;CPF/CNPJ;Lote Irregular;Bairro;Prazo Regularizacao;Codigo AR;Fiscal Responsavel;Criado Por\n";
    window.itensFiltradosAtual.forEach(i => { const num = i.numNotif || ''; const ouv = i.procOuvidoria || ''; const data = i.dataNotif ? i.dataNotif.split('-').reverse().join('/') : ''; const nome = i.nome ? i.nome.toUpperCase().replace(/;/g, ',') : ''; const doc = i.doc || ''; const lote = i.loteEndereco ? i.loteEndereco.replace(/;/g, ',') : ''; const bairro = i.bairro || ''; const prazo = i.dataPrazo ? i.dataPrazo.split('-').reverse().join('/') : ''; const ar = i.codigoAR || ''; const fiscal = i.fiscal || ''; const criador = i.criadoPor || ''; csvContent += `${num};${ouv};${data};${nome};${doc};${lote};${bairro};${prazo};${ar};${fiscal};${criador}\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `Relatorio_Fiscalizacao_SMMAM_${new Date().toISOString().split('T')[0]}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.exportarBackup = function() {
    if(window.DB.length === 0) { alert("O banco de dados está vazio."); return; }
    const dataStr = JSON.stringify(window.DB, null, 2); const blob = new Blob([dataStr], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `smmam_backup_nuvem_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.importarBackup = async function(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importado = JSON.parse(e.target.result);
            if (Array.isArray(importado)) {
                mostrarLoading(true, "Migrando dados antigos..."); let adicionados = 0;
                for (let item of importado) { delete item.firebaseId; const fotosAntigas = item.fotos; delete item.fotos; const novoDoc = await addDoc(notificacoesRef, item); if(fotosAntigas && fotosAntigas.length > 0) { const fotosSubRef = collection(db, "notificacoes", novoDoc.id, "evidencias"); for(let fotoBase64 of fotosAntigas) { await addDoc(fotosSubRef, { imagemBinaria: fotoBase64 }); } } adicionados++; }
                await window.carregarDadosNuvem(); alert(`${adicionados} registros importados para a Nuvem com sucesso!`);
            } else { alert("Arquivo inválido."); }
        } catch(err) { alert("Erro ao importar."); console.error(err); } mostrarLoading(false); event.target.value = ''; 
    }; reader.readAsText(file);
}

window.exportarVipp = function() {
    const marcados = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value); if(marcados.length === 0) { alert('Selecione as notificações que deseja enviar via VIPP Correios.'); return; }
    const itensExportar = window.DB.filter(item => marcados.includes(item.firebaseId)); let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<correioslog>\n  <tipo_arquivo>Postagem</tipo_arquivo>\n  <versao_arquivo>2.3</versao_arquivo>\n  <remetente>\n    <numero_contrato>9912740833</numero_contrato>\n    <codigo_administrativo>79980660</codigo_administrativo>\n    <nome_remetente>PREFEITURA MUNIC DE BENTO GONCALVES</nome_remetente>\n    <logradouro_remetente>AV OSVALDO ARANHA</logradouro_remetente>\n    <numero_remetente>1075</numero_remetente>\n    <bairro_remetente>CIDADE ALTA</bairro_remetente>\n    <cep_remetente>95700010</cep_remetente>\n    <cidade_remetente>BENTO GONCALVES</cidade_remetente>\n    <uf_remetente>RS</uf_remetente>\n  </remetente>\n';
    itensExportar.forEach(i => {
        const cepLimpo = (i.cep || '').replace(/\D/g, '').padEnd(8, '0'); const numEtiqueta = (i.codigoAR && i.codigoAR.length === 13) ? i.codigoAR : (i.numNotif.replace(/\D/g, '') + Date.now().toString().slice(-6)).padEnd(13, '0');
        xml += `  <objeto_postal>\n    <numero_etiqueta>${numEtiqueta}</numero_etiqueta>\n    <codigo_objeto_cliente>${(i.numNotif || '').substring(0, 20)}</codigo_objeto_cliente>\n    <codigo_servico_postagem>80810</codigo_servico_postagem>\n    <peso>100</peso>\n    <destinatario>\n      <nome_destinatario>${(i.nome || '').toUpperCase().substring(0, 50)}</nome_destinatario>\n      <logradouro_destinatario>${(i.endereco || '').toUpperCase().substring(0, 50)}</logradouro_destinatario>\n      <numero_end_destinatario>S/N</numero_end_destinatario>\n    </destinatario>\n    <nacional>\n      <bairro_destinatario>${(i.bairro || '').toUpperCase().substring(0, 30)}</bairro_destinatario>\n      <cidade_destinatario>BENTO GONCALVES</cidade_destinatario>\n      <uf_destinatario>RS</uf_destinatario>\n      <cep_destinatario>${cepLimpo}</cep_destinatario>\n    </nacional>\n    <servico_adicional>\n      <codigo_servico_adicional>25</codigo_servico_adicional>\n    </servico_adicional>\n    <servico_adicional>\n      <codigo_servico_adicional>01</codigo_servico_adicional>\n    </servico_adicional>\n    <dimensao_objeto>\n      <tipo_objeto>001</tipo_objeto>\n    </dimensao_objeto>\n  </objeto_postal>\n`;
    }); xml += '</correioslog>';
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `importacao_vipp_smmam_${Date.now()}.xml`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
