import { Field, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Physician } from './physician.entity';
import { Facility } from '../../facility/entities/facility.entity';

@ObjectType()
@Entity()
@Unique(['physicianId', 'facilityId'])
export class FacilityPhysician {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  physicianId: string;

  @Field()
  @Column()
  facilityId: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  startDate: string | null;

  @Field(() => Physician, { nullable: true })
  @ManyToOne(() => Physician, { nullable: false, eager: false })
  @JoinColumn({ name: 'physicianId' })
  physician: Physician;

  @ManyToOne(() => Facility, { nullable: false, eager: false })
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
