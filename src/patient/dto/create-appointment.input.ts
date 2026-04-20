import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { SessionType } from '../../appointment/entities/appointment.entity';

@InputType()
export class CreateAppointmentInput {
  @Field()
  @IsUUID()
  facilityPatientId: string;

  @Field()
  @IsISO8601({ strict: true })
  appointmentDate: string;

  @Field(() => SessionType)
  @IsEnum(SessionType)
  sessionType: SessionType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;
}
