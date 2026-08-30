import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHtml, normalizeText } from "../core/sanitize.js";
import { resolveTerritory } from "../core/territory.js";

export function initBuscasModule({ db, mostrarLoading, mostrarToast }) {
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
            
            const ruaLimpa = normalizeText(ruaStrRaw);
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
                    mostrarToast("Busca concluída!");
                } else {
                    alert("A rua foi encontrada, mas o NÚMERO não bateu. Tente buscar só pela rua sem o número.");
                }
            } else { 
                if(tipoBusca === 'endereco') {
                    alert("Nenhuma rua encontrada no cadastro imobiliário.");
                } else {
                    alert("Nenhum imóvel localizado com os dados informados.");
                }
            }
        } catch(e) { 
            console.error("Erro na consulta técnica:", e);
            alert("Erro na consulta técnica: " + (e.message || "Tente novamente.")); 
        }
        mostrarLoading(false);
    };

    window.abrirEspelhoCadastral = function(index) {
        const im = window.resultadosConsultaAtual[index];
        if(!im) return;
        window.imovelSelecionadoParaNotificacao = im; 

        let endLote = escapeHtml(im.logradouro || '');
        if(im.numero && im.numero !== '0' && im.numero !== 'S/N' && im.numero !== 'SN') endLote += `, ${escapeHtml(im.numero)}`;
        if(im.complemento) endLote += ` - ${escapeHtml(im.complemento)}`;

        const html = `
            <div class="espelho-grid">
                <div class="espelho-box">
                    <h4>👤 Dados do Proprietário</h4>
                    <p><strong>Nome:</strong> ${escapeHtml(im.proprietario_principal || '---')}</p>
                    <p><strong>CPF/CNPJ:</strong> ${escapeHtml(im.cnpj_cpf || '---')}</p>
                </div>
                <div class="espelho-box">
                    <h4>🏷️ Identificação do Imóvel</h4>
                    <p><strong>Cadastro (Cad):</strong> ${escapeHtml(im.cadastroimobiliario || '---')}</p>
                    <p><strong>Inscrição (Chave):</strong> ${escapeHtml(im.chaveinscricao || '---')}</p>
                </div>
                <div class="espelho-box" style="grid-column: span 2;">
                    <h4>📍 Localização do Imóvel</h4>
                    <p><strong>Logradouro:</strong> ${endLote}</p>
                    <p><strong>Bairro:</strong> ${escapeHtml(im.bairro || '---')}</p>
                    <p><strong>Loteamento:</strong> ${escapeHtml(im.loteamento || '---')}</p>
                </div>
                <div class="espelho-box" style="grid-column: span 2;">
                    <h4>📐 Dados Físicos do Lote</h4>
                    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                        <p><strong>Área do Terreno:</strong> ${escapeHtml(im.areaterreno || '---')} m²</p>
                        <p><strong>Testada:</strong> ${escapeHtml(im.testada || '---')} m</p>
                        <p><strong>Fração Ideal:</strong> ${escapeHtml(im.fracaoideal || '---')} %</p>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('conteudo-espelho').innerHTML = html;
        document.getElementById('modal-espelho-cadastral').style.display = 'flex';
    };

    window.fecharEspelhoCadastral = function() {
        const modal = document.getElementById('modal-espelho-cadastral');
        if (modal) modal.style.display = 'none';
    };

    window.autuarDesteEspelho = function() {
        const im = window.imovelSelecionadoParaNotificacao;
        if(!im) return;
        
        window.fecharEspelhoCadastral();
        window.navegarPara('notificacoes');
        if (typeof window.limparFormularios === 'function') window.limparFormularios();
        
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
        mostrarToast("Dados do Espelho carregados no formulário!");
        window.scrollTo(0,0);
    };

    window.puxarDadosDaNotificacao = function() {
        const numPesquisa = document.getElementById('autoBuscaNotif').value.trim();
        if(!numPesquisa) return alert("Digite o número da notificação.");
        
        const meuSetor = window.perfilUsuarioAtual?.setor || 'SMMAM';
        const notif = (window.DB || []).find(i => i.numNotif === numPesquisa && i.tipoDocumento !== 'auto' && (i.setor || 'SMMAM') === meuSetor);
        if(!notif) return alert("Notificação não encontrada no setor ativo.");

        document.getElementById('autoNome').value = notif.nome || '';
        document.getElementById('autoDoc').value = notif.doc || '';
        document.getElementById('autoEndOcorrencia').value = notif.loteEndereco || notif.endereco || '';
        
        document.querySelectorAll('.dinamico-chk-auto').forEach(chk => {
            chk.checked = notif.arrayInfracoes && notif.arrayInfracoes.includes(chk.value);
        });

        if (typeof window.somarUrmsDinamicamente === 'function') window.somarUrmsDinamicamente();
        mostrarToast("Dados da notificação importados!");
    };

    window.atualizarTerritorioPeloBairro = function() {
        const bairro = document.getElementById('bairro')?.value || '';
        const territorio = resolveTerritory(bairro);
        const tag = document.getElementById('tagTerritorioEquipe');
        if (tag) tag.innerText = `Território: ${territorio.nome} · Equipe ${territorio.equipe} (${territorio.tipo})`;
    };
}
