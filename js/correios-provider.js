export const PACOTE_VICIO_URL = 'https://api.pacotevicio.dev/correios';

export function normalizarCodigoAR(codigo) {
  const normalizado = String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(normalizado)) {
    throw new Error('Código de AR inválido. Use o formato AA123456789BR.');
  }
  return normalizado;
}

export function extrairEventoRastreamento(resposta) {
  const evento = Array.isArray(resposta?.eventos) ? resposta.eventos[0] : null;
  const descricao = String(evento?.descricao || evento?.descricaoFrontEnd || '').trim();

  if (!descricao) {
    throw new Error('O provedor não retornou eventos para este AR.');
  }

  return {
    descricao,
    entregue: Boolean(resposta?.temEventoEntrega || evento?.finalizador === 'S'),
    dataEvento: evento?.dtHrCriado?.date || null,
  };
}

export async function consultarRastreamentoPacoteVicio(codigoAR, chaveApi, fetchFn = fetch) {
  const codigo = normalizarCodigoAR(codigoAR);
  const chave = String(chaveApi || '').trim();

  if (!chave) {
    throw new Error('Configure a chave gratuita do Pacote Vício antes de sincronizar ARs.');
  }

  const resposta = await fetchFn(`${PACOTE_VICIO_URL}?tracking_code=${encodeURIComponent(codigo)}`, {
    headers: { 'X-RapidAPI-Key': chave },
  });

  if (resposta.status === 401 || resposta.status === 403) {
    throw new Error('A chave gratuita de rastreamento não foi aceita. Revise-a nas configurações.');
  }
  if (resposta.status === 429) {
    throw new Error('A cota do provedor gratuito foi atingida. Use o retorno VIPP ou tente novamente depois.');
  }
  if (resposta.status === 404) {
    throw new Error('Nenhum evento foi localizado para este AR.');
  }
  if (!resposta.ok) {
    throw new Error(`O provedor de rastreamento respondeu com erro ${resposta.status}.`);
  }

  return extrairEventoRastreamento(await resposta.json());
}
