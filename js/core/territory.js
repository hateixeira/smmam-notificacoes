import { normalizeText } from "./sanitize.js";

const TEAM_1 = ["Aparecida", "Barracão", "Caminhos da Eulalia", "Cruzeiro", "Fátima", "Fenavinho", "Industrial", "Juventude da Enologia", "Licorsul", "Nossa Senhora do Carmo", "Ouro Verde", "Pomarosa", "Pradel", "Salgado", "Santa Helena", "Santa Marta", "Santo Antão", "São João", "São Roque", "São Valentim", "São Vendelino", "Vila Nova", "Vila Nova II", "Zatt"];
const TEAM_2 = ["Borgo", "Botafogo", "Centro", "Cidade Alta", "Cohab", "Conceição", "Eucaliptos", "Humaitá", "Imigrante", "Jardim Glória", "Maria Goretti", "Merlot", "Municipal", "Planalto", "Progresso", "Santa Rita", "São Bento", "São Francisco", "Universitário", "Verona", "Vinhedos", "Vinosul"];
const DISTRICTS = ["Tuiuty", "Faria Lemos", "São Pedro", "Vale dos Vinhedos"];

const byName = new Map([
  ...TEAM_1.map((name) => [normalizeText(name), { equipe: 1, tipo: "bairro", nome: name }]),
  ...TEAM_2.map((name) => [normalizeText(name), { equipe: 2, tipo: "bairro", nome: name }]),
  ...DISTRICTS.map((name, index) => [normalizeText(name), { equipe: index < 2 ? 1 : 2, tipo: "distrito", nome: name }]),
]);

export function resolveTerritory(name) {
  const territory = byName.get(normalizeText(name));
  return territory ? { ...territory } : { equipe: null, tipo: "nao_identificado", nome: String(name ?? "") };
}

export const TERRITORY_REFERENCE = { team1: TEAM_1, team2: TEAM_2, districts: DISTRICTS };
