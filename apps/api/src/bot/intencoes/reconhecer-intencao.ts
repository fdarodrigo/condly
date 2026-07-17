export type Intencao =
  | { tipo: 'MENU' }
  | { tipo: 'OPCAO_MENU'; numero: number }
  | { tipo: 'CANCELAR' }
  | { tipo: 'FINANCEIRO' }
  | { tipo: 'ASSEMBLEIAS' }
  | { tipo: 'RESERVAR'; areaComum: string | null }
  | { tipo: 'ABRIR_CHAMADO' }
  | { tipo: 'MEUS_CHAMADOS' }
  | { tipo: 'ADVERTENCIA' }
  | { tipo: 'ACOES_ADMINISTRATIVAS' }
  | { tipo: 'AVISOS' }
  | { tipo: 'BOLETO' }
  | { tipo: 'DESCONHECIDA' };

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
// regra é estrutural: nenhum handler de intenção jamais lê um número de
// unidade ou uma afirmação de papel do texto da mensagem.
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

/**
 * Detecta tentativa de manipulação — exportada porque o BotService precisa
 * rodar esta checagem também sobre mensagens que alimentam um fluxo
 * multi-turno em andamento (onde o texto NÃO passa por reconhecerIntencao,
 * já que é uma resposta livre tipo a descrição de um chamado).
 */
export function ehTextoSuspeito(textoOriginal: string): boolean {
  return PADROES_SUSPEITOS.some((padrao) => padrao.test(normalizarParaPadroes(textoOriginal)));
}

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
  const match = /reservar?\s+(.+)/i.exec(textoOriginal);
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

// Saudações/pedidos de menu: comparação por igualdade (não substring) pra
// "oi" não capturar qualquer frase que contenha essas letras.
const SAUDACOES = ['oi', 'ola', 'menu', 'ajuda', 'inicio', 'comecar', 'opcoes', 'oi!', 'ola!'];
const SAUDACOES_PREFIXO = ['bom dia', 'boa tarde', 'boa noite'];

/**
 * Motor de intenções por palavra-chave — deliberadamente simples (regras,
 * não um LLM, ver docs/stack.md seção 3.2). Nunca lança erro: qualquer
 * mensagem que não bata em nenhuma regra (incluindo as suspeitas) vira
 * DESCONHECIDA, que o BotService traduz pro menu de opções.
 */
export function reconhecerIntencao(textoOriginal: string): Intencao {
  const textoNormalizado = normalizarParaPadroes(textoOriginal);

  if (ehTextoSuspeito(textoOriginal)) {
    return { tipo: 'DESCONHECIDA' };
  }

  // Resposta numérica solta (1-9) = escolha de opção do menu. Só chega aqui
  // quando NÃO há fluxo multi-turno ativo — dentro de um fluxo, o BotService
  // consome o número como resposta do fluxo antes de chamar este motor.
  const numeroSolto = /^\s*([1-9])\s*$/.exec(textoNormalizado);
  if (numeroSolto) {
    return { tipo: 'OPCAO_MENU', numero: Number(numeroSolto[1]) };
  }

  if (textoNormalizado.trim() === 'cancelar' || textoNormalizado.trim() === 'cancela') {
    return { tipo: 'CANCELAR' };
  }

  const compacto = textoNormalizado.trim();
  if (SAUDACOES.includes(compacto) || SAUDACOES_PREFIXO.some((s) => compacto.startsWith(s))) {
    return { tipo: 'MENU' };
  }

  // Boleto ANTES de financeiro: "segunda via do boleto" não é a consulta de
  // saldo. O "ª" (ordinal feminino) não decompõe pra "a" na normalização
  // NFD, por isso entra literal na classe de caracteres.
  if (/boleto|segunda via|2[ªa]?\s*via/.test(textoNormalizado)) {
    return { tipo: 'BOLETO' };
  }

  if (/financeiro|saldo|quanto devo|cobranca/.test(textoNormalizado)) {
    return { tipo: 'FINANCEIRO' };
  }

  if (/assembleia|deliberac/.test(textoNormalizado)) {
    return { tipo: 'ASSEMBLEIAS' };
  }

  // "meus chamados"/"acompanhar" ANTES de "chamado" (que abre um novo).
  if (/meus chamados|acompanhar/.test(textoNormalizado)) {
    return { tipo: 'MEUS_CHAMADOS' };
  }

  if (textoNormalizado.includes('chamado')) {
    return { tipo: 'ABRIR_CHAMADO' };
  }

  if (/reserv/.test(textoNormalizado)) {
    return { tipo: 'RESERVAR', areaComum: extrairNomeAreaComum(textoOriginal) };
  }

  if (/advertencia/.test(textoNormalizado)) {
    return { tipo: 'ADVERTENCIA' };
  }

  // \b evita falso positivo com palavras que CONTÊM "acao" ("reclamacao",
  // "informacao"...) — só "ação"/"ações" como palavra inteira conta.
  if (/\bacoes\b|\bacao\b/.test(textoNormalizado)) {
    return { tipo: 'ACOES_ADMINISTRATIVAS' };
  }

  if (textoNormalizado.includes('aviso')) {
    return { tipo: 'AVISOS' };
  }

  return { tipo: 'DESCONHECIDA' };
}
