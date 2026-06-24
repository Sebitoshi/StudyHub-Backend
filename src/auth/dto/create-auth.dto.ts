import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthDto {
    @ApiProperty({ example: 'Juan', description: 'Nombre del usuario' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario' })
    @IsString()
    @IsNotEmpty()
    apellido: string;

    @ApiProperty({ example: 'juan@example.com', description: 'Correo electrónico' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'secure123', description: 'Contraseña (mín. 6 caracteres)' })
    @IsString()
    @MinLength(6)
    @IsNotEmpty()
    password: string;
}
