import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { Facility } from '../../facility/entities/facility.entity';
import { Physician } from '../../physician/entities/physician.entity';

export enum SessionType {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  EVENING = 'EVENING',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
}

registerEnumType(SessionType, { name: 'SessionType' });
registerEnumType(AppointmentStatus, { name: 'AppointmentStatus' });

@ObjectType()
@Entity()
export class Appointment {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  patientId: string;

  @Field()
  @Column()
  facilityId: string;

  @Field()
  @Column({ type: 'varchar' })
  appointmentDate: string;

  @Field(() => SessionType)
  @Column({ type: 'enum', enum: SessionType })
  sessionType: SessionType;

  @Field(() => AppointmentStatus)
  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.PENDING,
  })
  status: AppointmentStatus;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  physicianId: string | null;

  @Field(() => Patient, { nullable: true })
  @ManyToOne(() => Patient, { nullable: false, eager: false })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @ManyToOne(() => Facility, { nullable: false, eager: false })
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @Field(() => Physician, { nullable: true })
  @ManyToOne(() => Physician, { nullable: true, eager: false })
  @JoinColumn({ name: 'physicianId' })
  physician: Physician | null;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
