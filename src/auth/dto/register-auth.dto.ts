import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ description: 'Nombre del usuario', example: 'Juan' })
    @IsString()
    @IsNotEmpty({ message: 'El nombre es obligatorio' })
    nombre: string;

    @ApiProperty({ description: 'Apellido del usuario', example: 'Pérez' })
    @IsString()
    @IsNotEmpty({ message: 'El apellido es obligatorio' })
    apellido: string;

    @ApiProperty({ description: 'Correo electrónico del usuario', example: 'juan@example.com' })
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
    email: string;

    @ApiProperty({ description: 'Contraseña del usuario', example: '123456' })
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    password: string;

    @ApiProperty({ description: 'Confirmación de la contraseña', example: '123456' })
    @IsString()
    @IsNotEmpty({ message: 'Debes confirmar la contraseña' })
    confirmPassword: string;
}