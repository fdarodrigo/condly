import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { SalvarDadosUnidadeDto } from './dto/salvar-dados-unidade.dto';

@Injectable()
export class DadosUnidadeService {
  async buscar(unidadeId: string, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.dadosUnidade.findUnique({ where: { unidadeId } });
  }

  async salvar(unidadeId: string, dto: SalvarDadosUnidadeDto, tenantPrisma: TenantPrismaClient) {
    const unidade = await tenantPrisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade) throw new NotFoundException('Unidade não encontrada.');

    // veiculos é Json no schema — cast necessário porque o tipo gerado pelo
    // Prisma não aceita diretamente um array de classe TypeScript validada.
    const veiculosJson =
      dto.veiculos !== undefined ? (dto.veiculos as unknown as Prisma.InputJsonValue) : undefined;

    const campos = {
      ...(dto.bebeRecemNascido !== undefined && { bebeRecemNascido: dto.bebeRecemNascido }),
      ...(dto.trabalhadorNoturno !== undefined && { trabalhadorNoturno: dto.trabalhadorNoturno }),
      ...(dto.pessoasIdosas !== undefined && { pessoasIdosas: dto.pessoasIdosas }),
      ...(dto.pets !== undefined && { pets: dto.pets }),
      ...(dto.petsDescricao !== undefined && { petsDescricao: dto.petsDescricao || null }),
      ...(dto.pessoasAutismo !== undefined && { pessoasAutismo: dto.pessoasAutismo }),
      ...(dto.pessoasAutismoDescricao !== undefined && {
        pessoasAutismoDescricao: dto.pessoasAutismoDescricao || null,
      }),
      ...(dto.estrangeiros !== undefined && { estrangeiros: dto.estrangeiros }),
      ...(dto.mobilidadeReduzida !== undefined && { mobilidadeReduzida: dto.mobilidadeReduzida }),
      ...(dto.locacaoCurtaTemporada !== undefined && {
        locacaoCurtaTemporada: dto.locacaoCurtaTemporada,
      }),
      ...(dto.statusOcupacao !== undefined && { statusOcupacao: dto.statusOcupacao }),
      ...(veiculosJson !== undefined && { veiculos: veiculosJson }),
      ...(dto.contatoEmergenciaNome !== undefined && {
        contatoEmergenciaNome: dto.contatoEmergenciaNome || null,
      }),
      ...(dto.contatoEmergenciaTelefone !== undefined && {
        contatoEmergenciaTelefone: dto.contatoEmergenciaTelefone || null,
      }),
    };

    // upsert com input unchecked (unidadeId direto) — o tipo gerado rejeita
    // misturar unidadeId com a sintaxe de relação checked, então cast pontual.
    return tenantPrisma.dadosUnidade.upsert({
      where: { unidadeId },
      create: { unidadeId, ...campos } as Prisma.DadosUnidadeUncheckedCreateInput,
      update: campos,
    });
  }
}
