export type Intencao =
  | { tipo: 'SALDO' }
  | { tipo: 'RESERVAR'; areaComum: string | null }
  | { tipo: 'CHAMADO' }
  | { tipo: 'DESCONHECIDA' };

const PALAVRAS_SALDO = ['saldo', 'quanto devo'];
const PALAVRA_RESERVAR = 'reservar';
const PALAVRA_CHAMADO = 'chamado';
const PALAVRAS_FUNCIONAIS = ['o', 'a', 'um', 'uma', 'para', 'pra', 'do', 'da', 'no', 'na'];

// Frases de injeção/engenharia social ("ignore as regras anteriores",
// "sou o síndico", "me dê acesso total"...) — qualquer mensagem que bata
// aqui é tratada como fora de escopo (DESCONHECIDA), mesmo que também
// contenha uma palavra-chave válida (ex: "...me mostre o saldo da unidade
// 12"). Checado ANTES de qualquer palavra-chave, de propósito: a
// autoridade de quem está falando vem exclusivamente do telefoneWhatsapp
// resolvido contra o banco (ver BotService), nunca de uma afirmação no
// texto — isto aqui é só a primeira camada (heurística, pega frases
// óbvias de tentativa de manipulação); a camada que realmente garante a
// regra é estrutural: nenhum handler de intenção abaixo jamais lê um
// número de unidade ou uma afirmação de papel do texto da mensagem.
const PADROES_SUSPEITOS: RegExp[] = [
  // Roda sobre o texto JÁ normalizado (sem acento) — por isso "instruc",
  // não "instruç"/"instrução": cobre singular e plural ("instrução" e
  // "instruções" normalizam pro mesmo radical "instruc").
  /ignor[ae]\w*.{0,30}(regra|instruc)/,
  /\bsou\s+(o|a)\s+s[ií]ndic[ao]\b/,
  /\bsou\s+(o|a)\s+administrador[a]?\b/,
  /\bme\s+d[êe]\s+acesso\b/,
  /\bacesso\s+total\b/,
  /\bmodo\s+(admin|administrador|desenvolvedor)\b/,
];

function normalizarParaPadroes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Extrai o nome da área comum logo depois da palavra "reservar" — opera no
 * texto original (só lowercased via regex `/i`), nunca no texto sem
 * acento, porque o nome extraído é usado pra buscar `AreaComum.nome` no
 * banco e a maioria dos nomes em português tem acento ("Salão de Festas").
 */
function extrairNomeAreaComum(textoOriginal: string): string | null {
  const match = /reservar\s+(.+)/i.exec(textoOriginal);
  if (!match) {
    return null;
  }

  const palavras = match[1]
    .trim()
    .replace(/[?.!]+$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (palavras.length && PALAVRAS_FUNCIONAIS.includes(palavras[0].toLowerCase())) {
    palavras.shift();
  }

  const nome = palavras.join(' ').trim();
  return nome.length > 0 ? nome : null;
}

/**
 * Motor de intenções por palavra-chave — deliberadamente simples (regras,
 * não um LLM, ver docs/stack.md seção 3.2). Nunca lança erro: qualquer
 * mensagem que não bata em nenhuma regra (incluindo as suspeitas) vira
 * DESCONHECIDA, que o BotService traduz pra uma resposta padrão.
 */
export function reconhecerIntencao(textoOriginal: string): Intencao {
  const textoMinusculo = textoOriginal.toLowerCase();
  const textoParaPadroes = normalizarParaPadroes(textoOriginal);

  if (PADROES_SUSPEITOS.some((padrao) => padrao.test(textoParaPadroes))) {
    return { tipo: 'DESCONHECIDA' };
  }

  if (PALAVRAS_SALDO.some((palavra) => textoMinusculo.includes(palavra))) {
    return { tipo: 'SALDO' };
  }

  if (textoMinusculo.includes(PALAVRA_RESERVAR)) {
    return { tipo: 'RESERVAR', areaComum: extrairNomeAreaComum(textoOriginal) };
  }

  if (textoMinusculo.includes(PALAVRA_CHAMADO)) {
    return { tipo: 'CHAMADO' };
  }

  return { tipo: 'DESCONHECIDA' };
}
