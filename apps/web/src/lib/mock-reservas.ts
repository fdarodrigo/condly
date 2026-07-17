export type StatusReservaMock = 'CONFIRMADA' | 'CANCELADA' | 'PENDENTE' | 'NEGADA';
export type TipoReservante = 'CONDOMINO' | 'SINDICO' | 'GREMIO';

export interface QuemReservou {
  nome: string;
  tipo: TipoReservante;
  unidade?: string;
}

export interface ReservaMock {
  id: string;
  area: string;
  inicio: string;
  fim: string;
  quem: QuemReservou;
  status: StatusReservaMock;
}

const NOMES_CONDOMINO = [
  'Maria Silva', 'João Santos', 'Ana Lima', 'Pedro Carvalho',
  'Beatriz Ferreira', 'Carlos Mendes', 'Lúcia Rocha', 'Roberto Alves',
  'Fernanda Costa', 'Paulo Nunes',
];

const UNIDADES = [
  'Ap. 101', 'Ap. 203', 'Ap. 305', 'Ap. 412',
  'Ap. 501', 'Cobertura A', 'Ap. 102', 'Ap. 204',
];

const AREAS_NOMES = ['Salão de Festas', 'Piscina', 'Churrasqueira'];

interface TemplateReserva {
  diasOffset: number;
  hora: number;
  durHoras: number;
  areaIdx: number;
  tipoIdx: number; // 0=CONDOMINO 1=SINDICO 2=GREMIO
  status: StatusReservaMock;
}

// 5 cenários determinísticos — escolhido por condominioId hash
const CENARIOS: TemplateReserva[][] = [
  // A: ativo, várias pendências
  [
    { diasOffset: -12, hora: 14, durHoras: 4, areaIdx: 0, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -5, hora: 10, durHoras: 2, areaIdx: 1, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -2, hora: 16, durHoras: 3, areaIdx: 2, tipoIdx: 0, status: 'CANCELADA'  },
    { diasOffset:   3, hora: 10, durHoras: 2, areaIdx: 1, tipoIdx: 1, status: 'PENDENTE'   },
    { diasOffset:   5, hora: 14, durHoras: 4, areaIdx: 0, tipoIdx: 0, status: 'PENDENTE'   },
    { diasOffset:   7, hora: 16, durHoras: 2, areaIdx: 2, tipoIdx: 0, status: 'PENDENTE'   },
  ],
  // B: organizado, poucas pendências
  [
    { diasOffset: -15, hora: 18, durHoras: 5, areaIdx: 0, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -8, hora: 14, durHoras: 2, areaIdx: 1, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -3, hora: 10, durHoras: 3, areaIdx: 0, tipoIdx: 1, status: 'CONFIRMADA' },
    { diasOffset:   4, hora: 15, durHoras: 2, areaIdx: 2, tipoIdx: 0, status: 'PENDENTE'   },
    { diasOffset:  10, hora: 10, durHoras: 4, areaIdx: 0, tipoIdx: 2, status: 'PENDENTE'   },
  ],
  // C: muitos cancelamentos e negações
  [
    { diasOffset: -20, hora: 14, durHoras: 4, areaIdx: 0, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset: -10, hora: 10, durHoras: 2, areaIdx: 2, tipoIdx: 0, status: 'CANCELADA'  },
    { diasOffset:  -7, hora: 16, durHoras: 3, areaIdx: 1, tipoIdx: 0, status: 'CANCELADA'  },
    { diasOffset:  -1, hora: 18, durHoras: 2, areaIdx: 0, tipoIdx: 0, status: 'NEGADA'     },
    { diasOffset:   2, hora: 14, durHoras: 4, areaIdx: 0, tipoIdx: 0, status: 'PENDENTE'   },
    { diasOffset:   6, hora: 10, durHoras: 2, areaIdx: 2, tipoIdx: 1, status: 'PENDENTE'   },
    { diasOffset:   9, hora: 16, durHoras: 3, areaIdx: 1, tipoIdx: 0, status: 'PENDENTE'   },
  ],
  // D: síndico e grêmio ativos
  [
    { diasOffset:  -9, hora: 10, durHoras: 2, areaIdx: 1, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -6, hora: 14, durHoras: 4, areaIdx: 0, tipoIdx: 1, status: 'CONFIRMADA' },
    { diasOffset:  -2, hora: 16, durHoras: 2, areaIdx: 2, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:   3, hora: 18, durHoras: 5, areaIdx: 0, tipoIdx: 2, status: 'PENDENTE'   },
    { diasOffset:   8, hora: 14, durHoras: 2, areaIdx: 1, tipoIdx: 0, status: 'PENDENTE'   },
    { diasOffset:  12, hora: 10, durHoras: 3, areaIdx: 2, tipoIdx: 0, status: 'CONFIRMADA' },
  ],
  // E: problemático, várias negações
  [
    { diasOffset: -14, hora: 10, durHoras: 4, areaIdx: 0, tipoIdx: 0, status: 'CONFIRMADA' },
    { diasOffset:  -7, hora: 14, durHoras: 2, areaIdx: 1, tipoIdx: 0, status: 'NEGADA'     },
    { diasOffset:  -3, hora: 16, durHoras: 3, areaIdx: 2, tipoIdx: 0, status: 'NEGADA'     },
    { diasOffset:   1, hora: 10, durHoras: 2, areaIdx: 0, tipoIdx: 0, status: 'PENDENTE'   },
    { diasOffset:   4, hora: 14, durHoras: 4, areaIdx: 1, tipoIdx: 1, status: 'PENDENTE'   },
    { diasOffset:   8, hora: 18, durHoras: 2, areaIdx: 0, tipoIdx: 0, status: 'PENDENTE'   },
  ],
];

function hashSeed(id: string): number {
  return Math.abs(id.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7));
}

function emDias(offset: number, hora: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
}

export function gerarReservasMock(condominioId: string): ReservaMock[] {
  const s = hashSeed(condominioId);
  const cenario = CENARIOS[s % CENARIOS.length];
  const tipos: TipoReservante[] = ['CONDOMINO', 'SINDICO', 'GREMIO'];

  return cenario.map((t, i) => {
    const ls = s + i * 97;
    const tipo = tipos[t.tipoIdx];
    return {
      id: `mock-${condominioId.slice(0, 8)}-${i}`,
      area: AREAS_NOMES[t.areaIdx],
      inicio: emDias(t.diasOffset, t.hora),
      fim: emDias(t.diasOffset, t.hora + t.durHoras),
      quem: {
        nome:
          tipo === 'CONDOMINO'
            ? NOMES_CONDOMINO[ls % NOMES_CONDOMINO.length]
            : tipo === 'SINDICO'
              ? 'Síndico do Condomínio'
              : 'Grêmio Condominial',
        tipo,
        unidade: tipo === 'CONDOMINO' ? UNIDADES[ls % UNIDADES.length] : undefined,
      },
      status: t.status,
    };
  });
}
