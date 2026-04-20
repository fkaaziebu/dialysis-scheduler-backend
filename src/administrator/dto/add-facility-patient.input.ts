import { Field, InputType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender } from '../../patient/entities/patient.entity';
import { AddressInput } from '../../patient/dto/address.input';
import { FacilityPatientInfoInput } from './facility-patient-info.input';

@InputType()
export class AddFacilityPatientInput {
  @Field()
  @IsUUID()
  facilityId: string;

  @Field(() => FacilityPatientInfoInput)
  @ValidateNested()
  @Type(() => FacilityPatientInfoInput)
  facilityPatientInfo: FacilityPatientInfoInput;

  // ── Existing patient path ──────────────────────────────────────────────────
  @Field({ nullable: true, defaultValue: true })
  @IsBoolean()
  isNewPatient?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  // ── New patient path ───────────────────────────────────────────────────────

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(8)
  @Matches(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/,
    {
      message:
        'password must contain at least one uppercase letter, one number, and one special character',
    },
  )
  password?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber must be a valid E.164 format (e.g. +12345678901)',
  })
  phoneNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateOfBirth?: string;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field(() => AddressInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInput)
  address?: AddressInput;
}
