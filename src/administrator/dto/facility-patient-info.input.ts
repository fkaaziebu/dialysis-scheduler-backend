import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FacilityPatientStatus } from '../../patient/entities/facility-patient.entity';

@InputType()
export class FacilityPatientInfoInput {
  @Field(() => FacilityPatientStatus, { nullable: true })
  @IsOptional()
  @IsEnum(FacilityPatientStatus)
  status?: FacilityPatientStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currentDiagnosis?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  diagnosticStatus?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
