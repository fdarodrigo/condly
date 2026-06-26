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
