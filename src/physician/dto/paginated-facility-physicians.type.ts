import { Field, Int, ObjectType } from '@nestjs/graphql';
import { FacilityPhysician } from '../entities/facility-physician.entity';

@ObjectType()
export class FacilityPhysiciansMeta {
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
export class PaginatedFacilityPhysiciansResponse {
  @Field(() => [FacilityPhysician])
  data: FacilityPhysician[];

  @Field(() => FacilityPhysiciansMeta)
  meta: FacilityPhysiciansMeta;
}
