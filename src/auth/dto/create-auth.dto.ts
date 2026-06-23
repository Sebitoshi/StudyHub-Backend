import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAuthDto {
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @IsString()
    @IsNotEmpty()
    apellido: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @MinLength(6)
    @IsNotEmpty()
    password: string;
}
