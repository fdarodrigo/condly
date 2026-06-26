# Stack tecnológico e plano de implementação — Condly

## 1. Visão geral da stack recomendada

| Camada | Tecnologia recomendada | Por quê |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS + shadcn/ui, como PWA | Web responsivo funciona em desktop (síndico/adm) e celular (condômino) sem precisar publicar em loja de app |
| Backend | Node.js com NestJS + Prisma ORM | Estrutura organizada, tipagem forte, fácil de encontrar desenvolvedores no Brasil |
| Banco de dados | PostgreSQL (via Supabase ou Neon) | Relacional, robusto para dados financeiros, suporta Row-Level Security para isolamento multi-tenant |
| Hospedagem (MVP) | Vercel (frontend) + Railway ou Render (backend) | Deploy rápido, custo baixo no início |
| Armazenamento de arquivos | Cloudflare R2 (compatível com S3) | Custo baixo para documentos e fotos de condomínio |
| E-mail transacional | Resend | API simples, gratuito até um volume razoável |
| Gateway de pagamento | Asaas ou Efí, via subconta por condomínio | Boleto + PIX com webhook de confirmação automática, sem custo de transação para o Condly |
| Bot de WhatsApp | Meta WhatsApp Cloud API (oficial) | Ver seção 3 |

## 2. Frontend — PWA, web e mobile em uma única base

Um PWA é acessado normalmente pelo navegador (cobre síndico e administradora) e pode ser "instalado" na tela do celular do condômino, recebendo notificações push como um app nativo — uma única base de código cobrindo as duas pontas. Migrar para app nativo publicado em loja é uma decisão de fase futura, viável sem reescrita (ferramentas como Capacitor empacotam o mesmo PWA), caso isso se mostre necessário para credibilidade comercial.

## 3. Bot de WhatsApp — escolha de API e arquitetura

### 3.1 Opções disponíveis no Brasil

| Opção | Vantagem | Risco |
|---|---|---|
| Meta WhatsApp Cloud API (direta) | Mais barata por mensagem, controle total | Verificação de negócio mais burocrática no início |
| BSP brasileiro (Zenvia, Take Blip, Gupshup) | Onboarding mais rápido, suporte em português | Custo por mensagem mais alto, dependência de terceiro |
| Soluções não-oficiais | Setup imediato | Alto risco de banimento do número — não recomendado |

**Recomendação**: Meta WhatsApp Cloud API diretamente, iniciando o processo de verificação de negócio (Meta Business Manager) o quanto antes, em paralelo ao desenvolvimento.

### 3.2 Arquitetura do bot — regras, não IA generativa livre, na v1

Bot baseado em **menus e intenções estruturadas**, não um agente de IA com liberdade total de resposta. Em um produto que toca em dinheiro e dados de condomínio, previsibilidade importa mais do que naturalidade da conversa. Processamento de linguagem natural simples por cima das regras é viável e melhora a experiência sem abrir mão do controle.

### 3.3 Escopo de informações e ações do bot (v1)

**O bot resolve sozinho**: consultar saldo devedor e próximo vencimento; enviar 2ª via de boleto/PIX; consultar status de chamado; consultar disponibilidade de área comum; fazer reserva (se não houver conflito); confirmar leitura de aviso.

**O bot inicia, humano finaliza**: abrir chamado (síndico classifica); reportar ocorrência (revisão antes de fechar); solicitar documento (link seguro, não o arquivo pelo chat); cancelar reserva (confirmação dupla).

**Fora do escopo na v1**: editar dados cadastrais sensíveis; acessar perfil de outro condômino; participar de votação formal; negociar acordo de inadimplência.

### 3.4 Exemplo de fluxo de conversa (reserva de área comum)

```
Condômino: Oi, quero reservar o salão de festas
Bot: Olá! Para qual data você gostaria de reservar o salão de festas?
Condômino: dia 15 de agosto
Bot: O salão está disponível no dia 15/08. Confirma a reserva das 14h às 22h?
     [Confirmar] [Escolher outro horário]
Condômino: [Confirmar]
Bot: Reserva confirmada! Você pode ver os detalhes pelo link: [link do app].
```

## 4. Gateway de pagamento — modelo de subconta

Cada condomínio (CNPJ próprio) tem sua própria subconta no Asaas ou Efí. O dinheiro cai direto na conta do condomínio; a taxa por transação é descontada dele, não do Condly. Ambos os gateways oferecem ambiente de testes (sandbox) gratuito e a possibilidade de gerar cobranças reais de valor baixo (R$1–5) em produção para validar o fluxo de ponta a ponta antes de qualquer cobrança real de condômino.

**Pergunta a validar com o sócio**: a administradora já usa algum sistema de cobrança próprio? Se sim, recomenda-se rodar em paralelo no início — os condomínios do piloto continuam com o processo atual ativo enquanto as próximas cobranças passam a ser geradas via Condly, sem necessidade de migrar histórico.

## 5. Estratégia de demonstração — backend real, não mock

Construir o backend real desde já, com dados de teste (seed), em vez de um frontend mockado — o diferencial do bot não é demonstrável de forma convincente com tela estática.

### Roteiro de teste sugerido

1. Criar um condomínio fictício com 15–20 unidades, alguns boletos pagos, alguns atrasados.
2. Criar os três logins de teste: administradora, síndico e dois ou três condôminos.
3. Conectar um número de WhatsApp Cloud API em modo sandbox.
4. Roteiro de demonstração: dashboard financeiro com inadimplência → consulta de saldo via WhatsApp → reserva de área comum pelo bot → confirmação aparecendo automaticamente no calendário do app.

## 6. Estimativa de custo e cronograma de desenvolvimento

Com a simplificação do modelo de marca (sem motor de tema dinâmico, sem domínio customizado por cliente), o escopo do MVP ficou mais leve do que a estimativa inicial:

| Abordagem | Prazo estimado | Custo estimado |
|---|---|---|
| Freelancer — 1 dev fullstack | 9–12 semanas | R$32.000–48.000 |
| Squad pequeno (back + front) | 7–9 semanas | R$55.000–80.000 |
| Agência | 10–14 semanas | R$80.000–145.000 |

Recomendação: começar com um freelancer fullstack experiente em Node.js/React, ou uma dupla trabalhando em paralelo.

## 7. Estratégia de testes

Pirâmide de testes recomendada, do mais barato/rápido ao mais caro/lento:

1. **Testes unitários** — regras de negócio isoladas (cálculo de inadimplência, validação de conflito de reserva, motor de intenções do bot), sem tocar banco de dados real. Ferramenta: Jest (já vem com NestJS). Script: `npm run test:unit`.
2. **Testes de integração** — endpoints reais batendo num banco de dados de teste de verdade (não mockado). Essencial para testar isolamento multi-tenant de fato, não apenas a lógica isolada — use um banco/schema separado (`condly_test`) ou Testcontainers para subir um Postgres efêmero a cada execução. Script: `npm run test:integration`.
3. **Testes end-to-end (E2E)** — fluxos completos pelo navegador, cobrindo os caminhos críticos de cada perfil. Ferramenta: Playwright. Script: `npm run test:e2e`.

### O que precisa de teste obrigatório, em ordem de prioridade

| Prioridade | O que testar | Por quê |
|---|---|---|
| 1 | Isolamento multi-tenant em todo módulo | É o erro mais caro do sistema — um síndico do condomínio A nunca pode acessar dado do condomínio B |
| 2 | Webhook de pagamento — idempotência e assinatura | Webhook duplicado não pode gerar pagamento duplicado; payload sem assinatura válida deve ser rejeitado |
| 3 | RBAC por papel | Cada papel (administradora/síndico/condômino) só acessa o que a arquitetura define |
| 4 | Máquina de estados de Chamado e Cobrança | Transições inválidas de status não podem ocorrer |
| 5 | Conflito de reserva | Duas reservas não podem ocupar o mesmo horário na mesma área comum |
| 6 | Motor de intenções do bot | Cada palavra-chave leva à ação certa; mensagem fora do escopo cai no fallback, nunca "inventa" uma resposta |

### Meta de cobertura

Um número de referência razoável é ~80% de cobertura de linha nos módulos de negócio de `apps/api/src` (financeiro, chamados, reservas, RBAC, bot) — não é uma meta a perseguir a qualquer custo: testar getters/setters triviais ou DTOs sem lógica não agrega segurança real, só infla o número. Priorize sempre a lista da tabela acima sobre a métrica de cobertura em si.

### Integração contínua

Configure um workflow de CI (GitHub Actions) que rode lint, checagem de tipos, testes unitários e testes de integração a cada push e pull request, bloqueando merge se algo falhar — detalhado no Prompt 11 do documento de prompts.

## 8. Próximos passos técnicos imediatos

1. Validar com o sócio se a administradora já tem sistema de cobrança próprio.
2. Iniciar o processo de verificação de negócio no Meta Business Manager para a WhatsApp Cloud API.
3. Criar conta de testes (sandbox) no Asaas ou Efí, e abrir as subcontas de teste por condomínio fictício.
4. Definir o condomínio fictício de demonstração e os dados de teste.
