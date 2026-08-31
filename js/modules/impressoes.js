import { escapeHtml } from "../core/sanitize.js";
import { formatDeadline, legalDeadlineForRecord } from "../core/legal-deadlines.js";
import { resolveTerritory } from "../core/territory.js";

const WHATSAPP_FISCALIZACAO_NUMERO = '555430557211';

export function gerarLinkWhatsappNotificacao(numeroDocumento) {
    const numeroLimpo = String(numeroDocumento || '').trim();
    if (!numeroLimpo) return '';
    const mensagem = `Olá, estou entrando em contato sobre a notificação ${numeroLimpo}.`;
    return `https://wa.me/${WHATSAPP_FISCALIZACAO_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

export function gerarQrCodeWhatsappNotificacao(numeroDocumento, targetContainer = null) {
    const container = targetContainer || document.getElementById('qrcodeWhats');
    if (!container) return;
    container.innerHTML = '';
    const numeroLimpo = String(numeroDocumento || '').trim();
    if (!numeroLimpo || numeroLimpo.includes('PRÉVIA') || numeroLimpo.includes('NUMERAÇÃO') || numeroLimpo.includes('Gerado ao salvar') || numeroLimpo === '---') {
        container.innerHTML = '<div style="width:90px;height:90px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:8px;color:#555;border:1px dashed #999;box-sizing:border-box;padding:4px;line-height:1.3;">QR Code gerado após o salvamento</div>';
        return;
    }
    if (typeof QRCode === 'undefined') return;
    const link = gerarLinkWhatsappNotificacao(numeroLimpo);
    new QRCode(container, { text: link, width: 90, height: 90, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
}

export function preencherEspelhoDocumento(item, parametrosDocumento = {}) {
    const s = item.setor || 'SMMAM';
    const parametros = normalizarParametros(item.parametrosDocumento || parametrosDocumento);
    if(s === 'MOBILIDADE') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Segurança e Mobilidade Urbana"; if(document.getElementById('pEnderecoSecretariaNome')) document.getElementById('pEnderecoSecretariaNome').innerHTML = "Mobilidade Urbana"; if(document.getElementById('pEnderecoSecretariaLocal')) document.getElementById('pEnderecoSecretariaLocal').innerHTML = "Av. Osvaldo Aranha, 1075"; } else if(s === 'OBRAS') { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Obras e Posturas"; if(document.getElementById('pEnderecoSecretariaNome')) document.getElementById('pEnderecoSecretariaNome').innerHTML = "Setor de Posturas"; if(document.getElementById('pEnderecoSecretariaLocal')) document.getElementById('pEnderecoSecretariaLocal').innerHTML = "Rua Mal Deodoro, 70"; } else { if(document.getElementById('printSecretaria')) document.getElementById('printSecretaria').innerText = "Municipal do Meio Ambiente"; if(document.getElementById('pEnderecoSecretariaNome')) document.getElementById('pEnderecoSecretariaNome').innerHTML = "SMMAM / Fiscalização"; if(document.getElementById('pEnderecoSecretariaLocal')) document.getElementById('pEnderecoSecretariaLocal').innerHTML = "Rua 10 de Novembro, 190<br>Fone/whats: 54 3055-7211"; }
    
    const labelNum = document.getElementById('pLabelTipoNum');
    if (labelNum) {
        labelNum.innerText = item.tipoDocumento === 'auto' ? '2. AUTO DE INFRAÇÃO N°' : '2. NOTIFICAÇÃO N°';
    }

    const prazoLegal = legalDeadlineForRecord(item);
    const marcoCiencia = item.tipoDocumento === 'auto' ? item.dataCienciaAuto : item.dataRecebimento;
    let pzTxt = item.tipoDocumento === 'auto'
        ? `O AUTUADO dispõe de ${prazoLegal.days} dias corridos, contados da ciência, para apresentar defesa escrita.`
        : `FICA NOTIFICADO POR ESTE INSTRUMENTO, a providenciar a regularização da situação descrita, no prazo de ${prazoLegal.days} dias corridos a partir do recebimento desta, em conformidade com o:`;
    if (prazoLegal.due) pzTxt += ` Data-limite: ${formatDeadline(prazoLegal.due)}.`;
    
    if(document.getElementById('pNum')) document.getElementById('pNum').innerText = item.numNotif || '';
    if(document.getElementById('pData')) document.getElementById('pData').innerText = item.dataNotif ? item.dataNotif.split('-').reverse().join('/') : '';

    if(document.getElementById('pNome')) document.getElementById('pNome').innerText = (item.nome || '_____________________________________________________').toUpperCase(); 
    if(document.getElementById('pDoc')) document.getElementById('pDoc').innerText = item.doc || '_________________________'; 
    if(document.getElementById('pIdentidade')) document.getElementById('pIdentidade').innerText = item.identidade || '_________________________';
    if(document.getElementById('pDataRecebimentoPrint')) document.getElementById('pDataRecebimentoPrint').innerText = marcoCiencia ? `Recebi o presente em ${marcoCiencia.split('-').reverse().join('/')}` : 'Recebi o presente em ____/____/________.';

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
    const localNotificado = [item.loteEndereco, item.bairro ? `BAIRRO ${item.bairro}` : '', `${item.cidade || 'BENTO GONÇALVES'}/${item.uf || 'RS'}`, item.cep ? `CEP: ${item.cep}` : ''].filter(Boolean).join(', ');
    const renderizarTemplate = (template, valores) => String(template || '').replace(/\{(endereco|bairro|cidade|uf|cep|referencia|dias)\}/gi, (_, chave) => valores[chave.toLowerCase()] ?? '');
    const motivoPadrao = renderizarTemplate(parametros.textoMotivoPadrao, {
        endereco: item.loteEndereco || item.endereco || 'não informado',
        bairro: item.bairro || '',
        cidade: item.cidade || 'BENTO GONÇALVES',
        uf: item.uf || 'RS',
        cep: item.cep || '',
        referencia: item.ref || 'não informado'
    });
    const motivoComLocal = parametros.textoMotivoPadrao.includes('{')
        ? motivoPadrao
        : `${parametros.textoMotivoPadrao}\n\nVerificação de irregularidade situada no endereço: ${localNotificado || 'NÃO INFORMADO'}${item.ref ? `, tendo como ponto de referência: ${item.ref}.` : '.'}`;
    if(document.getElementById('pMotivoNotificacao')) document.getElementById('pMotivoNotificacao').innerText = item.motivoNotificacao || motivoComLocal;
    if(document.getElementById('pRef')) document.getElementById('pRef').innerText = item.ref || '---'; 
    if(document.getElementById('pObs')) document.getElementById('pObs').innerText = item.obs || '---'; 
    if(document.getElementById('pFiscal')) document.getElementById('pFiscal').innerText = item.fiscal || ''; 
    if(document.getElementById('pMatricula')) document.getElementById('pMatricula').innerText = item.matricula || ''; 
    
    if(document.getElementById('pCidadePrint')) document.getElementById('pCidadePrint').innerText = item.cidade || 'BENTO GONÇALVES';
    if(document.getElementById('pUfPrint')) document.getElementById('pUfPrint').innerText = item.uf || 'RS';
    if(document.getElementById('pTipoPresencial')) document.getElementById('pTipoPresencial').innerText = item.tipoPresencial ? '( X ) Notificação Presencial' : '( ) Notificação Presencial'; 
    if(document.getElementById('pTipoAR')) document.getElementById('pTipoAR').innerText = item.tipoAR ? '( X ) Notificado por AR' : '( ) Notificado por AR'; 
    if(document.getElementById('pOrientacoesImpressao')) document.getElementById('pOrientacoesImpressao').innerText = `ORIENTAÇÕES:\n${parametros.textoOrientacoes}`;
    if(document.getElementById('pBaseLegalNotificacao')) document.getElementById('pBaseLegalNotificacao').innerText = parametros.textoBaseLegalNotificacao;
    if(document.getElementById('pQrCodeTexto')) document.getElementById('pQrCodeTexto').innerText = parametros.textoQrCode;
    if(document.getElementById('pEnderecoSecretaria')) document.getElementById('pEnderecoSecretaria').innerText = parametros.textoApresentacao;

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

        (window.bancoInfracoesGlobais || []).forEach(inf => {
            const isChecked = (item.arrayInfracoes && item.arrayInfracoes.includes(inf.id)) || marcadasLegado.includes(inf.nome);
            const marcaX = isChecked ? '( X )' : '(   )';
            boxInfr.innerHTML += `<div style="font-weight:bold; font-size:11px; margin-right:15px;">${marcaX} ${escapeHtml(inf.nome)}</div>`;
            
            if(isChecked) {
                listTextos.innerHTML += `<li><strong>( X )</strong> ${escapeHtml(inf.textoPadrao)}</li>`;
            }
        });
    }

    if(document.getElementById('pPrazoImpressao')) {
        const textoPrazo = item.tipoDocumento === 'auto'
            ? pzTxt
            : renderizarTemplate(parametros.textoPrazoRegularizacao, { dias: prazoLegal.days });
        document.getElementById('pPrazoImpressao').innerText = textoPrazo;
    }

    const qrContainer = document.querySelector('#print-area .qrcode-whats-container');
    if (qrContainer) {
        qrContainer.style.display = item.tipoDocumento === 'auto' ? 'none' : 'flex';
    }
    if (item.tipoDocumento !== 'auto') {
        gerarQrCodeWhatsappNotificacao(item.numNotif);
    }
}

function normalizarParametros(valor = {}) {
    return {
        prazoRegularizacaoDias: Number(valor.prazoRegularizacaoDias) || 15,
        prazoDefesaDias: Number(valor.prazoDefesaDias) || 8,
        valorURM: Number(valor.valorURM) || 0,
        textoMotivoPadrao: valor.textoMotivoPadrao || 'Verificação de irregularidade situada no endereço: {endereco}, BAIRRO {bairro}, MUNICÍPIO DE {cidade}/{uf} – CEP: {cep}, tendo como ponto de referência: {referencia}.',
        textoOrientacoes: valor.textoOrientacoes || 'É proibido o emprego de fogo e de capina química para a limpeza dos lotes.\nTodo o entulho/resto ou assemelhado deverá ser acondicionado; e destinado ao local apropriado.',
        textoPrazoRegularizacao: valor.textoPrazoRegularizacao || 'FICA NOTIFICADO(A) a regularizar a situação do lote em {dias} dias corridos a partir do recebimento desta.',
        textoBaseLegalNotificacao: valor.textoBaseLegalNotificacao || 'O OBJETIVO DESTA NOTIFICAÇÃO É ATENDER A CONFORMIDADE MUNICIPAL NAS LEIS:\n\nLei Ordinária nº. 5.198/2011 – Art. 6º. Os proprietários de terreno(s), edificados ou não, serão responsáveis pela limpeza dele(s), bem como da(s) calçada(s), mantendo-o(s) permanentemente em perfeito estado de limpeza e capinados, evitando que sejam utilizados como depósito de resíduos de qualquer natureza.\n\nLei Complementar nº. 06/1996 - Art. 28º - O infrator tem o prazo de oito (08) dias corridos para apresentar defesa escrita, que deve ser encaminhada para a SMMAM para decisão final. (Direito à ampla defesa e ao contraditório)',
        textoQrCode: valor.textoQrCode || 'Após a limpeza do terreno, ou em caso de dúvidas, aponte a câmera do celular para o QR Code ao lado e envie as fotos da limpeza para o WhatsApp da Fiscalização (54) 3055-7211. A mensagem já vai pronta com o número desta notificação.',
        textoApresentacao: valor.textoApresentacao || 'Secretaria Municipal do Meio Ambiente (SMMAM) — Setor de Fiscalização\nRua 10 de Novembro, 190 — Cidade Alta\nFone/Whats: 54 3055-7211'
    };
}

export function initImpressoesModule() {
    window.gerarLinkWhatsappNotificacao = gerarLinkWhatsappNotificacao;
    window.gerarQrCodeWhatsappNotificacao = gerarQrCodeWhatsappNotificacao;
    window.preencherEspelhoDocumento = preencherEspelhoDocumento;

    window.abrirPreviaNotificacao = function() {
        const form = document.getElementById('notifForm');
        if (!form) return;
        if (!form.reportValidity()) return;
        const parametros = normalizarParametros(window.parametrosDocumento);
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
            fiscal: window.perfilUsuarioAtual?.nome || '',
            matricula: window.perfilUsuarioAtual?.matricula || '',
            setor: window.perfilUsuarioAtual?.setor || 'SMMAM',
            parametrosDocumento: parametros
        };
        preencherEspelhoDocumento(previa, window.parametrosDocumento);
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

    window.imprimirRegistro = function(id) {
        const item = (window.DB || []).find(i => i.firebaseId === id);
        if (!item) return;
        preencherEspelhoDocumento(item, window.parametrosDocumento);
        setTimeout(() => {
            window.print();
        }, 500);
    };
}
