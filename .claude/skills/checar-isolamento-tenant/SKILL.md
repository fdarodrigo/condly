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
