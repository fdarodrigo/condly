import { Matches } from 'class-validator';

export class DisponibilidadeQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'data deve estar no formato YYYY-MM-DD' })
  data!: string;
}
