import { Field, ObjectType } from '@nestjs/graphql';
import { AppointmentStatus, SessionType } from '../entities/appointment.entity';

@ObjectType()
export class AppointmentResponse {
  @Field()
  id: string;

  @Field()
  patientId: string;

  @Field()
  facilityId: string;

  @Field()
  facilityName: string;

  @Field()
  appointmentDate: string;

  @Field(() => SessionType)
  sessionType: SessionType;

  @Field(() => AppointmentStatus)
  status: AppointmentStatus;

  @Field(() => String, { nullable: true })
  notes: string | null;

  @Field()
  createdAt: Date;
}
