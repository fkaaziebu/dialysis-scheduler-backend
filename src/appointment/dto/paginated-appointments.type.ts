import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Appointment } from '../entities/appointment.entity';

@ObjectType()
export class AppointmentsMeta {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  totalPages: number;
}

@ObjectType()
export class PaginatedAppointmentsResponse {
  @Field(() => [Appointment])
  data: Appointment[];

  @Field(() => AppointmentsMeta)
  meta: AppointmentsMeta;
}
