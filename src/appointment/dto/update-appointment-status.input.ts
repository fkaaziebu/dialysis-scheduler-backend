import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AppointmentStatus } from '../entities/appointment.entity';

@InputType()
export class UpdateAppointmentStatusInput {
  @Field()
  @IsUUID()
  appointmentId: string;

  @Field(() => AppointmentStatus)
  @IsEnum(AppointmentStatus)
  status: AppointmentStatus;

  /**
   * Required when status is COMPLETED or CANCELLED.
   * Captures completion notes or cancellation reason.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
