import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AppointmentStatus, SessionType } from '../entities/appointment.entity';

@InputType()
export class ListAppointmentsInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @Field(() => AppointmentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @Field(() => SessionType, { nullable: true })
  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  from?: string; // YYYY-MM-DD, inclusive

  @Field({ nullable: true })
  @IsOptional()
  @IsISO8601()
  to?: string; // YYYY-MM-DD, inclusive

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC'; // default DESC (latest first)
}
