import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Facility } from '../../facility/entities/facility.entity';

export enum FacilityPatientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCHARGED = 'DISCHARGED',
}

registerEnumType(FacilityPatientStatus, { name: 'FacilityPatientStatus' });

@ObjectType()
@Entity()
@Unique(['patientId', 'facilityId'])
export class FacilityPatient {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  patientId: string;

  @Field()
  @Column()
  facilityId: string;

  @Field(() => FacilityPatientStatus)
  @Column({
    type: 'enum',
    enum: FacilityPatientStatus,
    default: FacilityPatientStatus.ACTIVE,
  })
  status: FacilityPatientStatus;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  currentDiagnosis: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  diagnosticStatus: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Field(() => Patient, { nullable: true })
  @ManyToOne(() => Patient, { nullable: false, eager: false })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Facility, { nullable: false, eager: false })
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @Field()
  @CreateDateColumn()
  enrolledAt: Date;
}
