import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MonthlyAppointmentCount {
  /** Year-month bucket, e.g. "2024-11" */
  @Field()
  month: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class AppointmentStatsResponse {
  @Field(() => [MonthlyAppointmentCount])
  data: MonthlyAppointmentCount[];
}
