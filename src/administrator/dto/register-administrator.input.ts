import { InputType, Field } from '@nestjs/graphql';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

@InputType()
export class RegisterAdministratorInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @MinLength(8)
  @Matches(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
    {
      message:
        'password must contain at least one uppercase letter, one number, and one special character',
    },
  )
  password: string;

  @Field()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber must be a valid E.164 format (e.g. +12345678901)',
  })
  phoneNumber: string;
}
