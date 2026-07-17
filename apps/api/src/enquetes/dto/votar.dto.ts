import { IsString } from 'class-validator';

export class VotarDto {
  @IsString()
  opcaoId: string;
}
