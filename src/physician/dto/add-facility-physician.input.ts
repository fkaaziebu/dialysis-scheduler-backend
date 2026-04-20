import { Field, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

@InputType()
export class AddFacilityPhysicianInput {
  @Field()
  @IsUUID()
  facilityId: string;

  @Field()
  @IsBoolean()
  isNewPhysician: boolean;

  @Field()
  @IsEmail()
  email: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  specialization?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  startDate?: string;
}
