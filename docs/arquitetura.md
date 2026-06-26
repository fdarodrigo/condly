# Arquitetura do sistema — Condly

## 1. Visão geral

Condly é uma plataforma multi-tenant de gestão condominial, vendida para **administradoras de condomínio**, que ativam módulos por condomínio dentro da sua carteira. Três perfis de usuário acessam o mesmo sistema com permissões diferentes:

- **Administradora**: vê todos os condomínios da sua carteira, configura módulos, acompanha o desempenho consolidado.
- **Síndico**: vê apenas o(s) condomínio(s) que administra, gerencia chamados, documentos, financeiro e comunicação.
- **Condômino**: vê apenas a sua unidade, acessa o app/PWA ou interage via bot de WhatsApp.

O sistema é dividido em quatro camadas: **aplicação (app web/PWA)**, **API central**, **banco de dados** e **integrações externas** (bot de WhatsApp e gateway de pagamentos).

## 2. Modelo multi-tenant e marca

**Decisão de produto**: Condly opera com marca própria, não como white label completo. O nome e a identidade visual do Condly ficam visíveis para administradoras e condôminos. O que existe é **co-branding leve**: o nome e o logo da administradora aparecem em pontos pontuais de contato — mensagem de boas-vindas do bot, remetente de e-mail, um banner de "oferecido por [Administradora]" dentro do app — sem que isso exija um motor de temas dinâmico, domínio customizado por cliente, ou qualquer reformulação visual do produto por tenant.

Essa decisão segue um padrão já validado no mercado: o Gruvi, app de moradores da Superlógica (a maior administradora de plataformas do setor), funciona com marca própria única, usada por moradores de mais de 100.000 condomínios geridos por administradoras diferentes — nenhuma delas precisa "vestir" o app com sua própria marca para que ele seja adotado.

**Isolamento de dados (isso não muda)**: independente da decisão de marca, o isolamento multi-tenant continua sendo uma exigência de segurança e privacidade, não uma questão estética. Recomendação para o MVP: **banco de dados único, com isolamento lógico por `administradoraId`**. Cada tabela relevante carrega essa coluna, e toda consulta no backend filtra por esse campo automaticamente (via middleware ou Row-Level Security do PostgreSQL).

Vantagens dessa simplificação para o estágio atual:
- O escopo de engenharia cai bastante: não é preciso construir upload de logo, customização de paleta de cores ou domínio próprio por cliente.
- A marca Condly acumula reputação, avaliações e casos de uso em um único lugar, em vez de ficar fragmentada em "instâncias" por administradora.
- Se a parceria com o primeiro cliente não avançar, o produto já está pronto, com identidade própria, para ser oferecido a qualquer outra administradora — sem retrabalho de configuração visual.

## 3. Entidades principais (modelo de dados simplificado)

- **Administradora**: dados cadastrais, plano contratado.
- **Condomínio**: pertence a uma administradora; dados cadastrais, endereço, áreas comuns cadastradas, e referência ao identificador da sua subconta no gateway de pagamento (ver seção 5.1).
- **Unidade**: pertence a um condomínio (apartamento, casa, sala comercial).
- **Usuário**: pessoa física, com um ou mais vínculos de papel (administradora / síndico / condômino) e vínculo a uma ou mais unidades.
- **Cobrança**: vinculada a uma unidade, com valor, vencimento, status (pendente, pago, atrasado, em acordo) e referência externa do gateway de pagamento.
- **Chamado**: aberto por síndico ou condômino, com categoria, status, histórico de mensagens e responsável.
- **Documento**: arquivo vinculado a um condomínio (ata, convocação, prestação de contas, foto de serviço), com controle de quem pode visualizar.
- **Aviso**: mensagem broadcast para um condomínio ou unidade específica, com canais de envio (app, e-mail, WhatsApp).
- **Reserva**: vinculada a uma área comum e a uma unidade, com data/hora de início e fim.
- **ÁreaComum**: cadastro de espaços reserváveis (salão, churrasqueira, etc.) com regras (intervalo mínimo, antecedência máxima).
- **ConversaBot**: histórico de interações do condômino com o bot, para auditoria e para dar contexto à equipe humana quando uma conversa é escalada.

## 4. Papéis e permissões (RBAC)

| Papel | Visibilidade | Pode fazer |
|---|---|---|
| Administradora | Todos os condomínios da carteira | Configurar módulos, ver financeiro consolidado, gerenciar usuários síndicos |
| Síndico | Apenas seu(s) condomínio(s) | Gerenciar chamados, documentos, avisos, financeiro do condomínio, aprovar chamados de condômino |
| Condômino | Apenas sua unidade | Ver financeiro próprio, abrir chamado (se habilitado), reservar área comum, receber avisos |

A permissão é resolvida em dois níveis: papel (o que a pessoa pode fazer) e tenant/condomínio (sobre o que ela pode fazer). Isso evita que um síndico de um condomínio veja dados de outro, mesmo dentro da mesma administradora.

## 5. Fluxos críticos

### 5.1 Fluxo de pagamento — modelo de subconta

Cada condomínio opera com sua própria **subconta** no gateway de pagamento (Asaas ou Efí), vinculada ao CNPJ do próprio condomínio. Isso significa:

- O dinheiro do pagamento cai direto na conta do condomínio, não numa conta intermediária do Condly.
- A taxa cobrada pelo gateway por boleto/PIX pago é descontada do condomínio, exatamente como já acontece hoje com qualquer processo de cobrança — não é um custo do Condly.
- Condly atua só como orquestrador: gera a cobrança via API em nome da subconta correspondente, e recebe o webhook de confirmação.

Fluxo passo a passo:
1. O sistema gera a cobrança mensal (boleto + PIX) via API do gateway, na subconta do condomínio correspondente.
2. O gateway retorna um identificador externo, salvo no registro de Cobrança.
3. Quando o condômino paga, o gateway dispara um **webhook** para o backend confirmando o pagamento.
4. O backend atualiza o status da Cobrança para "pago" automaticamente, sem intervenção manual.
5. Síndico e administradora veem o status atualizado no dashboard financeiro em tempo real.
6. Opcionalmente, o bot de WhatsApp envia confirmação automática ao condômino.

### 5.2 Fluxo de reserva via bot

1. Condômino envia mensagem ao bot pedindo para reservar uma área comum.
2. Bot consulta a disponibilidade no backend para a área e data informadas.
3. Se disponível, bot cria a reserva diretamente e confirma por mensagem.
4. Se houver conflito, bot informa os horários livres mais próximos.
5. A reserva aparece automaticamente no calendário do app, visível para síndico e demais condôminos.

### 5.3 Fluxo de chamado

1. Síndico ou condômino abre um chamado (pelo app ou pelo bot).
2. Se aberto por condômino, o chamado entra como "pendente de triagem" e o síndico recebe um aviso.
3. Síndico classifica, atribui responsável e acompanha o status.
4. Toda atualização de status dispara notificação ao condômino que abriu o chamado.

## 6. Integrações externas

- **Gateway de pagamento** (Asaas ou Efí): geração de boleto/PIX via subconta de cada condomínio, com webhook de confirmação. A taxa por transação é do condomínio, não do Condly.
- **WhatsApp Business API**: canal do bot.
- **E-mail transacional** (Resend): envio de avisos e notificações por e-mail como canal alternativo, com remetente exibindo o nome da administradora (co-branding leve).
- **Armazenamento de arquivos** (Cloudflare R2): documentos, fotos de comprovação de serviço, gravações de assembleia.

## 7. Segurança e LGPD

- Dados sensíveis (saúde, condição de moradores especiais) exigem base legal específica e devem ficar em campos com controle de acesso mais restrito — apenas síndico e administradora, nunca outros condôminos, e sempre com consentimento explícito do morador.
- Histórico de pagamento e advertências deve ser visível apenas para o próprio condômino, síndico e administradora.
- Toda comunicação com o bot é registrada (ConversaBot) para auditoria, já que decisões automáticas (como confirmar uma reserva) precisam ser rastreáveis.
- Recomenda-se consulta a um advogado especializado em LGPD antes de lançar o módulo de perfis de condômino com dados sensíveis.

## 8. Desenvolvimento assistido por IA

O Condly será desenvolvido com apoio de um agente de codificação de IA (Claude Code ou equivalente) dentro do VS Code. Dado que o risco mais caro deste sistema é um vazamento de dados entre administradoras (violação do isolamento multi-tenant descrito na seção 2), o projeto adota verificação automática além de instruções em linguagem natural — um arquivo de memória do projeto, skills reutilizáveis para padrões recorrentes, um subagente revisor de segurança multi-tenant, e hooks que rodam lint/typecheck automaticamente após cada edição. Ver o documento `05-boas-praticas-ia.md` para a configuração completa, que deve ser feita antes do Prompt 0 do documento de prompts.

## 9. Limitações conhecidas do MVP

Ficam de fora da primeira versão — votação/assembleia online e gráficos de consumo. Ficam também fora, como próximos passos de roadmap (e não ausências definitivas a esconder em conversa de venda):

- Gestão de inadimplência avançada (régua de cobrança automática com escalonamento)
- Controle de visitantes/portaria
- Gestão de funcionários (zeladoria, portaria)
- Livro de ocorrências digital
