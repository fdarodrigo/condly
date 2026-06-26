import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types/auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, senha: string): Promise<{ accessToken: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { vinculos: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const vinculos = await Promise.all(
      usuario.vinculos.map(async (vinculo) => {
        let condominioId = vinculo.condominioId ?? undefined;

        // Vínculo de CONDOMINO só guarda unidadeId — resolvemos aqui o
        // condominioId da unidade pra que o RolesGuard possa autorizar ações
        // de nível condomínio (ex: abrir chamado) sem precisar reconsultar o
        // banco a cada requisição.
        if (!condominioId && vinculo.unidadeId) {
          const unidade = await this.prisma.unidade.findUnique({
            where: { id: vinculo.unidadeId },
          });
          condominioId = unidade?.condominioId;
        }

        return {
          papel: vinculo.papel,
          administradoraId: vinculo.administradoraId ?? undefined,
          condominioId,
          unidadeId: vinculo.unidadeId ?? undefined,
        };
      }),
    );

    const payload: JwtPayload = { sub: usuario.id, vinculos };

    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
