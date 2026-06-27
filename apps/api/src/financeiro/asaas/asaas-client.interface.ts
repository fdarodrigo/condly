export const ASAAS_CLIENT = 'ASAAS_CLIENT';

export interface ClienteAsaasInput {
  nome: string;
  email?: string;
  cpfCnpj?: string;
}

export interface CriarCobrancaAsaasInput {
  valor: number;
  vencimento: string; // YYYY-MM-DD
  descricao: string;
  externalReference: string;
  subcontaWalletId?: string | null;
  cliente: ClienteAsaasInput;
}

export interface CriarCobrancaAsaasOutput {
  idExternoGateway: string;
  status: string;
  // Link hospedado pelo Asaas pra visualizar/pagar a cobrança (2ª via) —
  // vem direto da resposta da API, nunca reconstruído a partir de um
  // padrão de URL assumido.
  linkPagamento: string | null;
}

export interface AsaasClient {
  criarCobranca(input: CriarCobrancaAsaasInput): Promise<CriarCobrancaAsaasOutput>;
}
