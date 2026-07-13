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

// [MANTENDO AS VARIÁVEIS GLOBAIS E FUNÇÕES DE UI ANTIGAS...]
// (Ajustando apenas os blocos de Exportar/Importar abaixo)

// ... (todas as funções anteriores continuam iguais, apenas subistitua as debaixo)

window.exportarVipp = function() {
    const m = Array.from(document.querySelectorAll('.select-item:checked')).map(cb => cb.value);
    if(m.length === 0) return alert('Selecione notificações.');
    
    // Identificador de Lote
    const loteId = prompt("Digite o identificador do lote (ex: LOTE20260713):", "LOTE" + new Date().toISOString().slice(0,10).replace(/-/g,''));
    if(!loteId) return;

    const itens = window.DB.filter(item => m.includes(item.firebaseId));
    let csv = "NOME;AOS_CUIDADOS;ENTREGA_NO_VIZINHO;ENDERECO;NUMERO;COMPLEMENTO;BAIRRO;CIDADE;UF;CEP;PAIS;TELEFONE_CELULAR;E_MAIL;CPF_CNPJ;IE_RG;FILLER;NOME_REM;ENDERECO_REM;NUMERO_REM;COMPLEMENTO_REM;BAIRRO_REM;CIDADE_REM;UF_REM;CEP_REM;TELEFONE_CELULAR_REM;E_MAIL_REM;CPF_CNPJ_REM;IE_RG_REM;FILLER_REM;FINANCEIRO;REGISTRO;PESO;FORMATO;ALTURA;LARGURA;COMPRIMENTO;ADICIONAIS;VALOR_DECLARADO;VALOR_A_COBRAR;CONTRATO;CARTAO;RFID_SSCC;FILLER_POST;OBSERVACAO;OBSERVACAO_3;OBSERVACAO_4;OBSERVACAO_5;ID_DO_VOLUME;QTD_DE_VOLUMES;COD_CLIENTE_VISUAL;CHAVE_ROTEAMENTO;CONTA_LOTE;FILLER_LOTE;TIPO_REVERSA;PRAZO;EMBALAGEM;DATA_COLETA;FILLER_REV;CHAVE_ACESSO;SERIE_NOTA;NUMERO_NOTA;VALOR_DA_NOTA;DATA_NOTA;PROTOCOLO_NOTA;OBSERVACAO_NOTA;FILLER_NF;FILLER_1;FILLER_2;DECLARACAO_CONTEUDO\n";

    itens.forEach(i => {
        const limpa = (str) => (str || '').toString().replace(/["'*%?\\/><\[\]{}()#:,;|]/g, '').trim().toUpperCase();
        const nome = limpa(i.nome).substring(0, 50) || 'NAO INFORMADO';
        
        let rawAddress = (i.endereco || 'NAO INFORMADO').toUpperCase();
        let logradouro = rawAddress;
        let numero = "SN";
        let complemento = "";

        if (rawAddress.includes(',')) {
            let parts = rawAddress.split(',');
            logradouro = parts[0].trim();
            let rest = parts.slice(1).join(' ').trim();
            let matchRest = rest.match(/^(\S+)(?:\s*(?:-|\s)\s*(.*))?$/);
            if (matchRest) {
                numero = matchRest[1].trim();
                if (matchRest[2]) complemento = matchRest[2].trim();
            } else {
                numero = rest;
            }
        } else {
            let match = rawAddress.match(/^(.*?)\s+(\d+[A-Z]?|S\/N|SN)(?:\s*[-]*\s*(.*))?$/);
            if (match) {
                logradouro = match[1].trim();
                numero = match[2].trim();
                if (match[3]) complemento = match[3].trim();
            }
        }

        const bairro = limpa(i.bairro).substring(0, 50) || 'NAO INFORMADO';
        const cep = (i.cep || '').replace(/\D/g, '').padEnd(8, '0');
        let cpfCnpj = (i.doc || '').replace(/\D/g, '').substring(0, 14);
        if (!cpfCnpj) cpfCnpj = "00000000000";
        const cnpjPrefeitura = "87849923000109"; // CNPJ Corrigido

        // FORMATO FINAL: Observação + " - " + Tag do Lote
        const obs1 = limpa(`NOTIFICACAO ${i.numNotif || ''} - ${loteId}`).substring(0, 100);

        let row = [
            nome, "", "", limpa(logradouro), limpa(numero), limpa(complemento), bairro, "BENTO GONCALVES", "RS", cep, "BR", "", "", cpfCnpj, "", "", 
            "PREFEITURA DE BENTO GONCALVES", "AV OSVALDO ARANHA", "1075", "", "CIDADE ALTA", "BENTO GONCALVES", "RS", "95700010", "", "", cnpjPrefeitura, "", "", 
            "80810", "", "100", "1", "1", "11", "16", "AR", "0", "0", "9912740833", "79980660", "", "", 
            obs1, "", "", "", "1", "1", "", "", loteId, "", 
            "", "", "", "", "", 
            "", "", "", "", "", "", "", "", "", "", 
            "Documentos Administrativos|1|100" 
        ];
        csv += row.join(";") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VIPP_${loteId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// NOVA FUNÇÃO: Processa o CSV de retorno dos Correios
window.importarRetornoCorreios = function(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        
        mostrarLoading(true, "Lendo Rastreios...");
        const batch = writeBatch(db);
        let atualizados = 0;

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(';');
            if(cols.length < 20) continue;
            
            const rastreio = cols[18]; // Coluna Registro
            const obs = cols[16];      // Coluna Obs
            
            if(rastreio && obs) {
                const numeroNotif = obs.split('-')[0].replace('NOTIFICACAO', '').trim();
                const docRef = window.DB.find(d => d.numNotif === numeroNotif);
                
                if(docRef) {
                    batch.update(doc(db, "notificacoes", docRef.firebaseId), { codigoAR: rastreio, statusRetornoAR: 'aguardando' });
                    atualizados++;
                }
            }
        }
        await batch.commit();
        await window.carregarDadosNuvem();
        mostrarLoading(false);
        alert(`Sucesso! ${atualizados} notificações tiveram seus códigos de rastreio atualizados automaticamente.`);
    };
    reader.readAsText(file);
}
