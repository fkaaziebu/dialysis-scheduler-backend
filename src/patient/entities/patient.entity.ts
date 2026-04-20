import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Address } from './address.embedded';

export enum PatientRole {
  PATIENT = 'PATIENT',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

registerEnumType(PatientRole, { name: 'PatientRole' });
registerEnumType(Gender, { name: 'Gender' });

@ObjectType()
@Entity()
export class Patient {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  firstName: string;

  @Field()
  @Column()
  lastName: string;

  @Field()
  @Column({ unique: true })
  email: string;

  // Never exposed via GraphQL — null for OAuth-only accounts
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Field()
  @Column()
  phoneNumber: string;

  @Field()
  @Column({ type: 'date' })
  dateOfBirth: string;

  @Field(() => Gender)
  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Field(() => Address)
  @Column(() => Address)
  address: Address;

  @Field(() => PatientRole)
  @Column({ type: 'enum', enum: PatientRole, default: PatientRole.PATIENT })
  role: PatientRole;

  // OAuth — not exposed via GraphQL
  @Column({ type: 'varchar', nullable: true })
  oauthProvider: string | null; // 'GOOGLE'

  @Index()
  @Column({ type: 'varchar', nullable: true })
  oauthId: string | null; // Provider's unique user ID

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
