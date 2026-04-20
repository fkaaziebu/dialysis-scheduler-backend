import { Field, InputType } from '@nestjs/graphql';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class GetAppointmentStatsInput {
  /** Start date inclusive — e.g. "2024-11-01" */
  @Field()
  @IsISO8601()
  from: string;

  /** End date inclusive — e.g. "2025-04-30" */
  @Field()
  @IsISO8601()
  to: string;

  /** Scope to a specific facility. ROOT_ADMIN only; FACILITY_ADMIN always scoped to their facility. */
  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  facilityId?: string;
}
