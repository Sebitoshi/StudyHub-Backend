import { IsInt, IsOptional, IsString } from 'class-validator';

export class ChatDto {
  @IsOptional()
  @IsInt()
  conversationId?: number;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsString()
  message: string;
}
