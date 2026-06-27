import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { CriarCobrancaDto } from './dto/criar-cobranca.dto';
import { AsaasWebhookPayloadDto } from './dto/asaas-webhook-payload.dto';
import { ASAAS_CLIENT, AsaasClient } from './asaas/asaas-client.interface';

const EVENTOS_PAGAMENTO_CONFIRMADO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function ambienteDeProducao(): boolean {
  return (process.env.ASAAS_ENV ?? 'sandbox') === 'production';
}

@Injectable()
export class FinanceiroService {
  private readonly logger = new Logger(FinanceiroService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ASAAS_CLIENT) private readonly asaasClient: AsaasClient,
  ) {}

  async criarCobranca(
    condominioId: string,
    dto: CriarCobrancaDto,
    tenantPrisma: TenantPrismaClient,
  ) {
    const unidade = await tenantPrisma.unidade.findUnique({ where: { id: dto.unidadeId } });
    if (!unidade || unidade.condominioId !== condominioId) {
      throw new NotFoundException('Unidade não encontrada neste condomínio.');
    }

    const condominio = await tenantPrisma.condominio.findUnique({ where: { id: condominioId } });
    if (!condominio) {
      throw new NotFoundException('Condomínio não encontrado.');
    }

    if (!unidade.responsavelCpfCnpj) {
      if (ambienteDeProducao()) {
        // Falha tratada e clara — o Asaas de produção rejeitaria o cadastro
        // do cliente sem cpfCnpj, mas preferimos nunca nem chamar o gateway
        // com dado que sabemos que vai falhar.
        throw new UnprocessableEntityException(
          'Não é possível emitir cobrança em produção: a unidade não tem CPF/CNPJ do responsável cadastrado.',
        );
      }
      this.logger.warn(
        `Cobrança para a unidade ${unidade.id} criada sem CPF/CNPJ do responsável — válido em sandbox, mas não funcionará no Asaas de produção.`,
      );
    }

    // Chama o gateway ANTES de gravar localmente — se o Asaas falhar, não
    // sobra Cobranca "fantasma" sem cobrança real correspondente.
    const resultadoGateway = await this.asaasClient.criarCobranca({
      valor: dto.valor,
      vencimento: dto.vencimento,
      descricao: `Cobrança ${unidade.identificador} — ${condominio.nome}`,
      externalReference: unidade.id,
      subcontaWalletId: condominio.subcontaGatewayId,
      cliente: {
        nome: unidade.responsavelNome ?? `Unidade ${unidade.identificador} — ${condominio.nome}`,
        email: unidade.responsavelEmail ?? undefined,
        cpfCnpj: unidade.responsavelCpfCnpj ?? undefined,
      },
    });

    return tenantPrisma.cobranca.create({
      data: {
        unidadeId: unidade.id,
        valor: dto.valor,
        vencimento: new Date(dto.vencimento),
        status: 'PENDENTE',
        idExternoGateway: resultadoGateway.idExternoGateway,
        linkPagamento: resultadoGateway.linkPagamento,
      },
    });
  }

  /**
   * Processa o webhook já autenticado (a checagem do token acontece no
   * controller, antes de chegar aqui). Idempotente: se a Cobranca já está
   * PAGO, ou se o pagamento não corresponde a nenhuma Cobranca conhecida,
   * não faz nada — nunca duplica nem reescreve um pagamento já confirmado.
   */
  async processarWebhookPagamento(payload: AsaasWebhookPayloadDto): Promise<void> {
    if (!EVENTOS_PAGAMENTO_CONFIRMADO.includes(payload.event)) {
      return;
    }

    const cobranca = await this.prisma.cobranca.findFirst({
      where: { idExternoGateway: payload.payment.id },
    });

    if (!cobranca || cobranca.status === 'PAGO') {
      return;
    }

    await this.prisma.cobranca.update({
      where: { id: cobranca.id },
      data: { status: 'PAGO', pagoEm: new Date() },
    });
  }

  async obterResumo(condominioId: string, tenantPrisma: TenantPrismaClient) {
    const unidades = await tenantPrisma.unidade.findMany({ where: { condominioId } });
    const unidadeIds = unidades.map((unidade) => unidade.id);

    const cobrancas = await tenantPrisma.cobranca.findMany({
      where: { unidadeId: { in: unidadeIds } },
    });

    const agora = new Date();
    const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
    const inicioProximoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
    // Comparação de atraso é por data-calendário, não por timestamp: uma
    // cobrança que vence HOJE ainda não está atrasada, só a partir de amanhã.
    const inicioDeHoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
    );

    let totalAReceberNoMes = 0;
    let totalRecebido = 0;
    const diasAtrasoPorUnidade = new Map<string, number>();

    for (const cobranca of cobrancas) {
      const valor = Number(cobranca.valor);

      const venceNesteMes =
        cobranca.vencimento >= inicioMes && cobranca.vencimento < inicioProximoMes;
      if (cobranca.status !== 'PAGO' && venceNesteMes) {
        totalAReceberNoMes += valor;
      }

      const pagoNesteMes =
        cobranca.pagoEm && cobranca.pagoEm >= inicioMes && cobranca.pagoEm < inicioProximoMes;
      if (cobranca.status === 'PAGO' && pagoNesteMes) {
        totalRecebido += valor;
      }

      const inadimplente =
        cobranca.status === 'ATRASADO' ||
        (cobranca.status === 'PENDENTE' && cobranca.vencimento < inicioDeHoje);
      if (inadimplente) {
        const diasAtraso = Math.max(
          0,
          Math.floor((inicioDeHoje.getTime() - cobranca.vencimento.getTime()) / 86_400_000),
        );
        const atual = diasAtrasoPorUnidade.get(cobranca.unidadeId) ?? 0;
        diasAtrasoPorUnidade.set(cobranca.unidadeId, Math.max(atual, diasAtraso));
      }
    }

    const unidadesPorId = new Map(unidades.map((unidade) => [unidade.id, unidade]));
    const unidadesInadimplentes = Array.from(diasAtrasoPorUnidade.entries()).map(
      ([unidadeId, diasAtraso]) => ({
        unidadeId,
        identificador: unidadesPorId.get(unidadeId)?.identificador ?? null,
        diasAtraso,
      }),
    );

    return {
      totalAReceberNoMes: arredondar(totalAReceberNoMes),
      totalRecebido: arredondar(totalRecebido),
      unidadesInadimplentes,
    };
  }
}
