import { Field, Int, ObjectType } from '@nestjs/graphql';
import { FacilityPatient } from '../entities/facility-patient.entity';

@ObjectType()
export class FacilityPatientsMeta {
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
export class PaginatedFacilityPatientsResponse {
  @Field(() => [FacilityPatient])
  data: FacilityPatient[];

  @Field(() => FacilityPatientsMeta)
  meta: FacilityPatientsMeta;
}
