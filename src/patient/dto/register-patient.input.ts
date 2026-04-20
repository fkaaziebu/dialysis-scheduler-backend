import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../entities/patient.entity';
import { AddressInput } from './address.input';

@InputType()
export class RegisterPatientInput {
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

  @Field()
  @IsISO8601({ strict: true })
  dateOfBirth: string;

  @Field(() => Gender)
  @IsEnum(Gender)
  gender: Gender;

  @Field(() => AddressInput)
  @ValidateNested()
  @Type(() => AddressInput)
  address: AddressInput;
}
