import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class AddressInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  street: string;

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
}
