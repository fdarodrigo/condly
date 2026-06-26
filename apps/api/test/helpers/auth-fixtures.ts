import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../src/prisma/prisma.service';

export const SENHA_PLANA = 'Senha123!';

export async function criarFixtures(prisma: PrismaService) {
  const senhaHash = await bcrypt.hash(SENHA_PLANA, 10);

  const administradora1 = await prisma.administradora.create({
    data: { nome: 'Administradora 1', emailContato: 'contato1@example.com' },
  });
  const administradora2 = await prisma.administradora.create({
    data: { nome: 'Administradora 2', emailContato: 'contato2@example.com' },
  });

  const condominio1 = await prisma.condominio.create({
    data: {
      administradoraId: administradora1.id,
      nome: 'Condomínio 1',
      endereco: 'Rua A, 100',
      cnpj: '11.111.111/0001-11',
    },
  });
  const condominio2 = await prisma.condominio.create({
    data: {
      administradoraId: administradora2.id,
      nome: 'Condomínio 2',
      endereco: 'Rua B, 200',
      cnpj: '22.222.222/0001-22',
    },
  });

  const unidade1 = await prisma.unidade.create({
    data: { condominioId: condominio1.id, identificador: '101', tipo: 'apartamento' },
  });
  const unidade2 = await prisma.unidade.create({
    data: { condominioId: condominio2.id, identificador: '202', tipo: 'apartamento' },
  });

  const usuarioAdministradora = await prisma.usuario.create({
    data: { nome: 'Usuário Administradora', email: 'administradora@example.com', senhaHash },
  });
  await prisma.vinculoUsuario.create({
    data: {
      usuarioId: usuarioAdministradora.id,
      papel: 'ADMINISTRADORA',
      administradoraId: administradora1.id,
    },
  });

  const usuarioSindico = await prisma.usuario.create({
    data: { nome: 'Usuário Síndico', email: 'sindico@example.com', senhaHash },
  });
  await prisma.vinculoUsuario.create({
    data: { usuarioId: usuarioSindico.id, papel: 'SINDICO', condominioId: condominio1.id },
  });

  const usuarioCondomino = await prisma.usuario.create({
    data: { nome: 'Usuário Condômino', email: 'condomino@example.com', senhaHash },
  });
  await prisma.vinculoUsuario.create({
    data: { usuarioId: usuarioCondomino.id, papel: 'CONDOMINO', unidadeId: unidade1.id },
  });

  return {
    administradora1,
    administradora2,
    condominio1,
    condominio2,
    unidade1,
    unidade2,
    usuarioAdministradora,
    usuarioSindico,
    usuarioCondomino,
  };
}
