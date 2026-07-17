/**
 * Menu principal do bot pro CONDOMINO — as opções numeradas são o contrato
 * com `OPCAO_MENU` em reconhecer-intencao.ts e com o switch do BotService:
 * mudar a ordem aqui exige mudar lá também.
 */
export const MENU_BOT =
  'Olá! Sou o assistente do seu condomínio no Condly. 🏠\n' +
  'Responda com o *número* da opção (ou escreva com suas palavras):\n\n' +
  '*1* — Financeiro da minha unidade\n' +
  '*2* — Resultados de assembleias\n' +
  '*3* — Reservar área comum\n' +
  '*4* — Abrir um chamado\n' +
  '*5* — Meus chamados\n' +
  '*6* — Minha última advertência\n' +
  '*7* — Ações administrativas\n' +
  '*8* — Últimos avisos\n' +
  '*9* — 2ª via de boleto\n\n' +
  'A qualquer momento: *menu* volta pra cá, *cancelar* interrompe uma operação.';

export const RESPOSTA_NAO_ENTENDI = `Não entendi sua mensagem. 🤔\n\n${MENU_BOT}`;

export const RESPOSTA_SEM_VINCULO =
  'Não encontrei seu cadastro vinculado a este número de WhatsApp. ' +
  'Acesse o app do Condly e cadastre este número no seu perfil para eu poder te ajudar.';
