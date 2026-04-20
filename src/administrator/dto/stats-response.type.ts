import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StatEntry {
  @Field(() => Int)
  count: number;

  /** Positive = increase vs last month, negative = decrease. */
  @Field(() => Float)
  changePercent: number;
}

@ObjectType()
export class StatsResponse {
  @Field(() => StatEntry)
  totalAppointments: StatEntry;

  @Field(() => StatEntry)
  completedAppointments: StatEntry;

  @Field(() => StatEntry)
  pendingAppointments: StatEntry;

  @Field(() => StatEntry)
  noShowAppointments: StatEntry;
}
