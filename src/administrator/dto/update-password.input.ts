import { Field, InputType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class UpdatePasswordInput {
  @Field()
  @IsString()
  currentPassword: string;

  @Field()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
