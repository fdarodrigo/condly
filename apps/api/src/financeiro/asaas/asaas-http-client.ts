import { Injectable } from '@nestjs/common';
import {
  AsaasClient,
  ClienteAsaasInput,
  CriarCobrancaAsaasInput,
  CriarCobrancaAsaasOutput,
} from './asaas-client.interface';

/**
 * Implementação real (via HTTP) do client do Asaas. Em testes de
 * integração esse provider é substituído por um fake via
 * `overrideProvider(ASAAS_CLIENT)` — nenhum teste deste módulo depende de
 * rede ou de credenciais reais.
 *
 * O cliente Asaas é criado/atualizado com os dados de `ClienteAsaasInput`
 * (nome, email, cpfCnpj). Sem `cpfCnpj`, o cadastro funciona em sandbox mas
 * o Asaas de produção rejeita — a checagem de ambiente/aviso fica em
 * FinanceiroService, não aqui.
 */
@Injectable()
export class AsaasHttpClient implements AsaasClient {
  private get baseUrl(): string {
    return process.env.ASAAS_API_URL ?? 'https://api-sandbox.asaas.com/v3';
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      access_token: process.env.ASAAS_API_KEY ?? '',
    };
  }

  async criarCobranca(input: CriarCobrancaAsaasInput): Promise<CriarCobrancaAsaasOutput> {
    const clienteId = await this.obterOuCriarCliente(input.externalReference, input.cliente);

    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        customer: clienteId,
        billingType: 'UNDEFINED',
        value: input.valor,
        dueDate: input.vencimento,
        description: input.descricao,
        externalReference: input.externalReference,
        ...(input.subcontaWalletId
          ? { split: [{ walletId: input.subcontaWalletId, percentualValue: 100 }] }
          : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao criar cobrança no Asaas (HTTP ${response.status}).`);
    }

    const pagamento = (await response.json()) as { id: string; status: string };
    return { idExternoGateway: pagamento.id, status: pagamento.status };
  }

  private async obterOuCriarCliente(
    externalReference: string,
    cliente: ClienteAsaasInput,
  ): Promise<string> {
    const dadosCliente = {
      name: cliente.nome,
      email: cliente.email,
      cpfCnpj: cliente.cpfCnpj,
      externalReference,
    };

    const busca = await fetch(
      `${this.baseUrl}/customers?externalReference=${encodeURIComponent(externalReference)}`,
      { headers: this.headers },
    );
    if (busca.ok) {
      const resultado = (await busca.json()) as { data?: Array<{ id: string }> };
      const existente = resultado.data?.[0];
      if (existente) {
        // Atualiza com os dados mais recentes (ex: CPF/CNPJ cadastrado
        // depois que o customer já existia no Asaas a partir de um nome só).
        const atualizacao = await fetch(`${this.baseUrl}/customers/${existente.id}`, {
          method: 'PUT',
          headers: this.headers,
          body: JSON.stringify(dadosCliente),
        });
        if (!atualizacao.ok) {
          throw new Error(`Falha ao atualizar cliente no Asaas (HTTP ${atualizacao.status}).`);
        }
        return existente.id;
      }
    }

    const criacao = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(dadosCliente),
    });
    if (!criacao.ok) {
      throw new Error(`Falha ao criar cliente no Asaas (HTTP ${criacao.status}).`);
    }
    const novoCliente = (await criacao.json()) as { id: string };
    return novoCliente.id;
  }
}
