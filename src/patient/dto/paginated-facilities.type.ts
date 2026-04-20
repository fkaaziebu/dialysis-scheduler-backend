import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Facility } from '../../facility/entities/facility.entity';

@ObjectType()
export class FacilitiesMeta {
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
export class PaginatedFacilitiesResponse {
  @Field(() => [Facility])
  data: Facility[];

  @Field(() => FacilitiesMeta)
  meta: FacilitiesMeta;
}
