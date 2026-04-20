import { Field, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class AssignPhysicianInput {
  @Field()
  @IsUUID()
  appointmentId: string;

  @Field()
  @IsUUID()
  physicianId: string;
}
