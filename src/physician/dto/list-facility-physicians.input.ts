import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType()
export class ListFacilityPhysiciansInput {
  @Field()
  @IsUUID()
  facilityId: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number = 1;

  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
