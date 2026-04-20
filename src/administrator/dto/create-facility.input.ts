import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';

@InputType()
export class CreateFacilityInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  address: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  city: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  region: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  country: string;

  @Field()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber must be a valid E.164 format (e.g. +12345678901)',
  })
  phoneNumber: string;

  @Field()
  @IsEmail()
  email: string;

  @Field(() => Int)
  @IsInt()
  @IsPositive()
  capacity: number;
}
