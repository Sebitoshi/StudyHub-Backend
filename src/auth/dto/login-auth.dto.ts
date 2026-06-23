import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ description: 'Correo electrónico del usuario', example: 'juan@example.com' })
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
    email: string;

    @ApiProperty({ description: 'Contraseña del usuario', example: '123456' })
    @IsString()
    @IsNotEmpty({ message: 'La contraseña es obligatoria' })
    password: string;
}
