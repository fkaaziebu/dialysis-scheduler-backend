import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { FacilityPatientStatus } from '../entities/facility-patient.entity';

@InputType()
export class ListFacilityPatientsInput {
  @Field()
  @IsUUID()
  facilityId: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string; // partial match on patient firstName, lastName, email

  @Field(() => FacilityPatientStatus, { nullable: true })
  @IsOptional()
  @IsEnum(FacilityPatientStatus)
  status?: FacilityPatientStatus;
}
