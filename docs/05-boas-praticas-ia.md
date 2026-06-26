# Boas práticas de desenvolvimento assistido por IA — Condly

Este documento monta o "harness" do projeto: a camada de verificação automática que não depende do agente de IA lembrar de uma regra — ela roda sozinha. O conteúdo abaixo é escrito para Claude Code (estrutura de pastas `.claude/`), mas o princípio se aplica a qualquer ferramenta: a maioria das ferramentas de codificação com IA hoje reconhece um arquivo de memória do projeto na raiz (`CLAUDE.md`, ou o equivalente mais genérico `AGENTS.md`, convenção que vem sendo adotada por várias ferramentas além do Claude Code).

Monte esta estrutura **antes** do Prompt 0 do documento `04-prompts-para-vibecoding.md`.

## 1. Por que isso importa especificamente para o Condly

O erro mais caro que um agente de IA pode cometer neste projeto não é estético — é um vazamento de dados entre administradoras diferentes, porque uma query Prisma esqueceu de filtrar por `administradoraId` ou `condominioId`. Isso pode acontecer silenciosamente, numa sessão de codificação longa, sem que ninguém perceba até ser tarde. Por isso a estrutura abaixo tem essa regra repetida em três camadas: no CLAUDE.md (instrução), numa skill (checagem sob demanda), e num subagente (revisão automática antes de qualquer PR).

## 2. Estrutura de pastas

```
condly/
├── CLAUDE.md
├── docs/
│   ├── arquitetura.md          (cópia do documento 01)
│   └── stack.md                 (cópia do documento 02)
├── .claude/
│   ├── settings.json
│   ├── skills/
│   │   ├── checar-isolamento-tenant/SKILL.md
│   │   └── novo-modulo-crud/SKILL.md
│   └── agents/
│       └── tenant-security-reviewer.md
├── apps/
│   ├── web/
│   └── api/
```

## 3. CLAUDE.md (raiz do projeto)

```markdown
# Condly

SaaS de gestão condominial multi-tenant. Administradoras de condomínio
contratam o Condly e oferecem aos seus condomínios (síndicos e
condôminos) financeiro automatizado, chamados, reservas, documentos,
avisos e um bot de WhatsApp.

Documentação completa: `docs/arquitetura.md` e `docs/stack.md`. Leia-os
antes de propor mudanças estruturais — este arquivo é só um resumo de
navegação, não a fonte da verdade.

## Stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui,
  como PWA — `apps/web`
- Backend: NestJS + TypeScript + Prisma ORM — `apps/api`
- Banco: PostgreSQL
- Gateway de pagamento: Asaas (sandbox em dev), via subconta por condomínio
- Bot: Meta WhatsApp Cloud API, motor de regras (não LLM livre)

## Comandos
- `npm run dev` (em cada app) — ambiente local
- `npm test` — suíte de testes (apps/api)
- `npm run lint` / `npx tsc --noEmit` — lint e checagem de tipos
- `npx prisma migrate dev` — aplicar migrations
- `npm run db:seed` — popular banco de demonstração

## Regra inegociável: isolamento multi-tenant
Toda query que toca Condominio, Unidade, Cobranca, Chamado, Documento,
Aviso, Reserva, AreaComum ou ConversaBot PRECISA passar pelo filtro de
administradoraId/condominioId do interceptor descrito em
docs/arquitetura.md (seção 4). Nunca escreva uma query Prisma "crua"
que ignore esse filtro, mesmo em scripts de debug ou seed. Se não tiver
certeza se uma query está isolada corretamente, use a skill
checar-isolamento-tenant antes de declarar a tarefa concluída.

## Outras regras de domínio
- Webhooks de pagamento (/webhooks/*) sempre validam a assinatura antes
  de processar qualquer payload, mesmo em ambiente de teste.
- Nunca logue o payload completo de uma Cobranca ou de um webhook de
  pagamento — logue apenas IDs e status.
- Campos cadastrais sensíveis (saúde, condição de moradores especiais)
  só podem ser lidos por SINDICO e ADMINISTRADORA, nunca por outro
  CONDOMINO, nem em endpoints genéricos de listagem.
- O bot do WhatsApp é baseado em regras, não em geração livre de texto
  sobre saldo, valores ou dados de terceiros — siga o escopo definido
  em docs/stack.md (seção 3.3).

## Convenção de nomenclatura
Entidades de domínio (Administradora, Condominio, Unidade, Cobranca,
Chamado etc.) ficam em português, espelhando o Prisma schema. Código
genérico (utilitários, helpers sem relação direta com o domínio) segue
a convenção padrão em inglês do ecossistema Node/TypeScript. Não
misture os dois dentro da mesma entidade.

## Definição de "pronto"
Uma tarefa só está concluída quando: os testes relevantes passam,
não há erro de tipo, o lint está limpo, e — se a mudança tocou em
Cobranca, Condominio ou qualquer query multi-tenant — a skill
checar-isolamento-tenant foi executada sobre o diff.
```

## 4. Skill — checagem de isolamento multi-tenant

Salve em `.claude/skills/checar-isolamento-tenant/SKILL.md`:

```markdown
---
name: checar-isolamento-tenant
description: Audita um trecho de código ou diff do Condly em busca de
  queries Prisma que não filtram por administradoraId ou condominioId.
  Use sempre depois de criar ou alterar qualquer endpoint, service ou
  query que toque Condominio, Unidade, Cobranca, Chamado, Documento,
  Aviso, Reserva ou ConversaBot.
---

# Checagem de isolamento multi-tenant

## Diff atual
!`git diff HEAD`

## Instruções

Revise o diff acima procurando toda chamada ao Prisma Client
(findMany, findUnique, update, delete, create etc.) sobre os modelos:
Condominio, Unidade, Cobranca, Chamado, Documento, Aviso, Reserva,
AreaComum, ConversaBot.

Para cada chamada encontrada, verifique:
1. O filtro `where` inclui administradoraId ou condominioId (direto ou
   via relação), ou a chamada já passa pelo interceptor de tenant?
2. Se está dentro de um endpoint, o Guard de RBAC correto está aplicado?
3. Algum `include` de relação poderia retornar dados de outro
   condomínio/administradora sem essa intenção?

Para cada violação, reporte arquivo, linha, o risco, e a correção
sugerida. Se não encontrar nenhuma, diga explicitamente "nenhuma
violação de isolamento encontrada neste diff" — não invente um
problema para parecer útil.
```

## 5. Skill — novo módulo no padrão do projeto

Salve em `.claude/skills/novo-modulo-crud/SKILL.md`:

```markdown
---
name: novo-modulo-crud
description: Cria um novo módulo NestJS no Condly seguindo o padrão
  estabelecido do projeto (controller, service, DTOs, filtro de
  tenant, testes). Use quando pedirem para criar um módulo de domínio
  que ainda não existe.
---

# Criar novo módulo NestJS no padrão Condly

Ao criar um novo módulo, siga exatamente esta estrutura, espelhando os
módulos já existentes (financeiro, chamados, reservas):

1. apps/api/src/<modulo>/<modulo>.module.ts
2. apps/api/src/<modulo>/<modulo>.controller.ts — endpoints REST,
   sempre com o Guard de RBAC
3. apps/api/src/<modulo>/<modulo>.service.ts — toda query Prisma aqui,
   nunca direto no controller, sempre com filtro de tenant explícito
4. apps/api/src/<modulo>/dto/ — DTOs validados com class-validator
5. apps/api/src/<modulo>/<modulo>.service.spec.ts — testes cobrindo:
   caso de sucesso, tentativa de acesso cross-tenant (deve falhar), e
   validação de entrada inválida

Depois de gerar o módulo, rode a skill checar-isolamento-tenant sobre
o resultado antes de considerar a tarefa concluída.
```

## 6. Subagente — revisor de segurança multi-tenant

Salve em `.claude/agents/tenant-security-reviewer.md`:

```markdown
---
name: tenant-security-reviewer
description: Revisor de segurança especializado em isolamento
  multi-tenant do Condly. Use depois de qualquer alteração no backend
  que toque modelos do Prisma ou endpoints novos, antes de abrir um PR.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Você é um revisor de segurança focado exclusivamente em isolamento
multi-tenant e RBAC no backend do Condly.

Quando invocado:
1. Rode git diff HEAD para ver as mudanças.
2. Para cada arquivo alterado em apps/api/src, verifique se toda query
   Prisma sobre modelos com administradoraId/condominioId está
   corretamente filtrada.
3. Verifique se todo endpoint novo tem o Guard de RBAC aplicado com o
   papel correto.
4. Verifique se nenhum log ou resposta de erro expõe dados de outro
   tenant.

Reporte em três categorias: CRÍTICO (vazamento entre tenants — bloqueia
o PR), AVISO (Guard ausente ou mal configurado), SUGESTÃO (melhoria que
não bloqueia). Se nada for encontrado, diga isso explicitamente.
```

## 7. Hooks — o harness propriamente dito

A diferença entre uma regra escrita no CLAUDE.md e um hook é que o CLAUDE.md é lido pelo modelo (e pode, em tese, ser esquecido numa sessão longa); o hook roda como um comando determinístico, sempre, independente do que o modelo "lembra". Configure em `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "cd apps/api && npx tsc --noEmit && npm run lint && npm run test:unit"
          }
        ]
      }
    ]
  }
}
```

Isso roda checagem de tipos, lint e os testes unitários (rápidos, sem banco) automaticamente depois de toda edição no backend — qualquer erro aparece imediatamente na conversa, antes do agente seguir para o próximo passo. Os testes de integração e E2E (mais lentos, definidos em `02-stack-tecnologico-e-implementacao.md`, seção 7) ficam de fora do hook de cada edição — rodar um banco de teste a cada salvamento de arquivo seria lento demais para ser prático. Eles entram no fluxo em dois pontos: quando o subagente `tenant-security-reviewer` é chamado explicitamente, e no pipeline de CI configurado no Prompt 11 do documento de prompts, que roda a suíte completa antes de qualquer merge.

**Nota de cautela**: a sintaxe exata de hooks pode variar entre versões do Claude Code. Antes de confiar neste JSON, confirme o formato atual perguntando diretamente "como configuro um hook PostToolUse?" dentro de uma sessão do Claude Code, ou consultando a documentação oficial em code.claude.com/docs — ele tem acesso à própria documentação atualizada, o que é mais confiável do que qualquer trecho fixo neste documento.

## 8. Resumo de como isso se encaixa no fluxo

1. Configure os 4 arquivos acima antes do Prompt 0.
2. Rode os Prompts 0–10 do documento `04-prompts-para-vibecoding.md` normalmente.
3. Depois de cada módulo que toque dados financeiros ou multi-tenant (Prompts 1, 2, 3, 4, 5, 8), peça explicitamente: "use o subagente tenant-security-reviewer para revisar essa mudança" antes de seguir para o próximo prompt.
4. Se, em algum momento, a skill ou o subagente apontar uma violação, pare e corrija antes de continuar — não acumule dívida de isolamento multi-tenant, ela só fica mais cara de encontrar depois.
