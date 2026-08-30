import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function initAuthModule({ auth, db, mostrarLoading, mostrarToast, registrarLog, navegarPara, carregarDadosNuvem }) {
    window.realizarLogin = function() {
        const email = document.getElementById('authEmail').value.trim();
        const senha = document.getElementById('authPassword').value;
        if (!email || !senha) return alert("Preencha o e-mail e a senha institucional.");
        mostrarLoading(true, "Acessando o sistema...");
        signInWithEmailAndPassword(auth, email, senha)
            .catch((err) => {
                mostrarLoading(false);
                console.error("Falha de autenticação:", err);
                alert("Erro ao entrar. Verifique suas credenciais.");
            });
    };

    window.loginVisitante = function() {
        alert('O acesso de demonstração foi desativado para proteger os dados de fiscalização. Solicite um perfil institucional aprovado.');
    };

    window.toggleAuthMode = function() {
        const loginFields = document.getElementById('login-fields');
        const regFields = document.getElementById('register-fields');
        const title = document.getElementById('authTitle');
        const toggleBtn = document.getElementById('btnToggleAuth');
        if (!loginFields || !regFields) return;
        if (loginFields.style.display === 'none') {
            loginFields.style.display = 'block';
            regFields.style.display = 'none';
            if (title) title.innerText = "Acesso protegido à fiscalização.";
            if (toggleBtn) toggleBtn.innerText = "Servidor Novo? Solicite Acesso";
        } else {
            loginFields.style.display = 'none';
            regFields.style.display = 'block';
            if (title) title.innerText = "Solicitar Acesso Institucional";
            if (toggleBtn) toggleBtn.innerText = "Já tem acesso? Fazer Login";
        }
    };

    window.registrarUsuario = async function() {
        const nome = document.getElementById('regNome').value.trim();
        const cargo = document.getElementById('regCargo').value.trim();
        const setor = document.getElementById('regSetor').value;
        const matricula = document.getElementById('regMatricula').value.trim();
        const telefone = document.getElementById('regTelefone').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const senha = document.getElementById('regPassword').value;

        if (!nome || !cargo || !email || !senha || !matricula) return alert("Preencha todos os campos obrigatórios.");
        if (senha.length < 6) return alert("A senha deve ter no mínimo 6 caracteres.");

        mostrarLoading(true, "Enviando solicitação de acesso...");
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;
            await setDoc(doc(db, "usuarios", user.uid), {
                nome,
                cargo,
                setor,
                matricula,
                telefone,
                email,
                status: "pendente",
                nivel: "leitor",
                criadoEm: new Date().toISOString()
            });
            mostrarLoading(false);
            window.toggleAuthMode();
            mostrarToast("Cadastro realizado! Aguardando liberação da Chefia.");
        } catch (error) {
            mostrarLoading(false);
            console.error("Erro no cadastro:", error);
            alert("Erro ao registrar: " + (error.message || "Tente novamente mais tarde."));
        }
    };

    window.recuperarSenha = function() {
        const email = document.getElementById('authEmail').value || document.getElementById('regEmail').value;
        if (!email) return alert("Digite seu e-mail institucional no campo de login para recuperar a senha.");
        sendPasswordResetEmail(auth, email.trim())
            .then(() => alert("E-mail de redefinição de senha enviado com sucesso!"))
            .catch((err) => alert("Erro ao enviar e-mail: " + err.message));
    };

    window.realizarLogout = function() {
        signOut(auth).then(() => {
            window.DB = [];
            if (typeof window.limparFormularios === 'function') window.limparFormularios();
        });
    };

    window.carregarDadosPerfil = function(perfilUsuario) {
        if (!perfilUsuario) return;
        if (document.getElementById('perfilNome')) document.getElementById('perfilNome').value = perfilUsuario.nome || '';
        if (document.getElementById('perfilCargo')) document.getElementById('perfilCargo').value = perfilUsuario.cargo || '';
        if (document.getElementById('perfilSetor')) document.getElementById('perfilSetor').value = perfilUsuario.setor || '';
        if (document.getElementById('perfilMatricula')) document.getElementById('perfilMatricula').value = perfilUsuario.matricula || '';
        if (document.getElementById('perfilTelefone')) document.getElementById('perfilTelefone').value = perfilUsuario.telefone || '';
        if (document.getElementById('perfilEmail')) document.getElementById('perfilEmail').value = perfilUsuario.email || '';
    };

    window.carregarUsuariosDoSetor = async function(perfilUsuario) {
        if (!perfilUsuario || perfilUsuario.nivel !== 'admin') return;
        const tabela = document.getElementById('corpoTabelaUsuariosAdmin');
        if (!tabela) return;
        tabela.innerHTML = '<tr><td colspan="5" style="text-align:center;">Carregando servidores...</td></tr>';
        try {
            const q = query(collection(db, "usuarios"), where("setor", "==", perfilUsuario.setor || "SMMAM"));
            const snap = await getDocs(q);
            window.usuariosDoSetor = [];
            snap.forEach(d => window.usuariosDoSetor.push({ id: d.id, ...d.data() }));
            
            tabela.innerHTML = '';
            window.usuariosDoSetor.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${u.nome || 'Sem Nome'}</strong><br><small>${u.email || ''}</small></td>
                    <td>${u.cargo || 'Não informado'}<br><small>Matr: ${u.matricula || '-'}</small></td>
                    <td>
                        <select onchange="alterarNivelUsuario('${u.id}', this.value)" style="padding:4px; font-size:12px;">
                            <option value="leitor" ${u.nivel === 'leitor' ? 'selected' : ''}>Leitor (Consulta)</option>
                            <option value="operador" ${u.nivel === 'operador' ? 'selected' : ''}>Operador (Fiscal)</option>
                            <option value="admin" ${u.nivel === 'admin' ? 'selected' : ''}>Administrador</option>
                        </select>
                    </td>
                    <td>
                        <select onchange="alterarStatusUsuario('${u.id}', this.value)" style="padding:4px; font-size:12px; font-weight:bold; color:${u.status === 'aprovado' ? '#166534' : '#991b1b'};">
                            <option value="pendente" ${u.status === 'pendente' ? 'selected' : ''}>⏳ Pendente</option>
                            <option value="aprovado" ${u.status === 'aprovado' ? 'selected' : ''}>✅ Aprovado</option>
                            <option value="bloqueado" ${u.status === 'bloqueado' ? 'selected' : ''}>🚫 Bloqueado</option>
                        </select>
                    </td>
                    <td>
                        <button type="button" class="btn-outline" onclick="abrirModalEdicaoUsuario('${u.id}')" style="padding:4px 8px; font-size:11px;">✏️ Editar</button>
                    </td>
                `;
                tabela.appendChild(tr);
            });
        } catch (e) {
            console.error("Erro ao carregar usuários:", e);
            tabela.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Erro ao listar usuários.</td></tr>';
        }
    };

    window.alterarStatusUsuario = async function(usuarioId, novoStatus) {
        if (!confirm(`Alterar status deste usuário para ${novoStatus.toUpperCase()}?`)) return;
        mostrarLoading(true, "Atualizando status...");
        try {
            await updateDoc(doc(db, "usuarios", usuarioId), { status: novoStatus });
            mostrarToast("Status atualizado com sucesso!");
        } catch (e) {
            alert("Erro ao alterar status: " + e.message);
        }
        mostrarLoading(false);
    };

    window.alterarNivelUsuario = async function(usuarioId, novoNivel) {
        if (!confirm(`Alterar nível de permissão deste usuário para ${novoNivel.toUpperCase()}?`)) return;
        mostrarLoading(true, "Atualizando permissão...");
        try {
            await updateDoc(doc(db, "usuarios", usuarioId), { nivel: novoNivel });
            mostrarToast("Nível de acesso atualizado!");
        } catch (e) {
            alert("Erro ao alterar nível: " + e.message);
        }
        mostrarLoading(false);
    };

    window.abrirModalEdicaoUsuario = function(id) {
        const u = (window.usuariosDoSetor || []).find(user => user.id === id);
        if (!u) return;
        document.getElementById('editUserId').value = u.id;
        document.getElementById('editUserNome').value = u.nome || '';
        document.getElementById('editUserCargo').value = u.cargo || '';
        document.getElementById('editUserSetor').value = u.setor || 'SMMAM';
        document.getElementById('editUserTelefone').value = u.telefone || '';
        document.getElementById('editUserMatricula').value = u.matricula || '';
        document.getElementById('modal-edicao-usuario').style.display = 'flex';
    };

    window.fecharModalEdicaoUsuario = function() {
        document.getElementById('modal-edicao-usuario').style.display = 'none';
    };

    window.salvarEdicaoUsuario = async function() {
        const id = document.getElementById('editUserId').value;
        if (!id) return;
        const dados = {
            nome: document.getElementById('editUserNome').value.trim(),
            cargo: document.getElementById('editUserCargo').value.trim(),
            setor: document.getElementById('editUserSetor').value,
            telefone: document.getElementById('editUserTelefone').value.trim(),
            matricula: document.getElementById('editUserMatricula').value.trim(),
        };
        mostrarLoading(true, "Salvando dados do servidor...");
        try {
            await updateDoc(doc(db, "usuarios", id), dados);
            window.fecharModalEdicaoUsuario();
            mostrarToast("Servidor atualizado!");
            if (typeof window.carregarUsuariosDoSetor === 'function') {
                window.carregarUsuariosDoSetor(window.perfilUsuarioAtual);
            }
        } catch (e) {
            alert("Erro ao atualizar dados: " + e.message);
        }
        mostrarLoading(false);
    };
}
