import {
  AsaasClient,
  CriarCobrancaAsaasInput,
  CriarCobrancaAsaasOutput,
} from '../../src/financeiro/asaas/asaas-client.interface';

/**
 * Substitui o AsaasHttpClient real nos testes de integração — nenhum teste
 * deste módulo deve depender de rede ou de credenciais reais do Asaas.
 */
export class FakeAsaasClient implements AsaasClient {
  private contador = 0;
  public chamadas: CriarCobrancaAsaasInput[] = [];

  async criarCobranca(input: CriarCobrancaAsaasInput): Promise<CriarCobrancaAsaasOutput> {
    this.chamadas.push(input);
    this.contador += 1;
    return {
      idExternoGateway: `pay_fake_${this.contador}`,
      status: 'PENDING',
      linkPagamento: `https://fake-asaas.example.com/i/pay_fake_${this.contador}`,
    };
  }
}
