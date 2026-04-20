import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  APPOINTMENT_CREATED = 'APPOINTMENT_CREATED',
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  APPOINTMENT_COMPLETED = 'APPOINTMENT_COMPLETED',
  APPOINTMENT_NO_SHOW = 'APPOINTMENT_NO_SHOW',
  FACILITY_ADMIN_CREATED = 'FACILITY_ADMIN_CREATED',
  TWO_FACTOR_OTP = 'TWO_FACTOR_OTP',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

registerEnumType(NotificationType, { name: 'NotificationType' });

@ObjectType()
@Entity()
export class Notification {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  userId: string;

  @Field()
  @Column()
  userType: string; // 'administrator' | 'patient'

  @Field()
  @Column()
  title: string;

  @Field()
  @Column({ type: 'text' })
  message: string;

  @Field(() => NotificationType)
  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Field()
  @Column({ default: false })
  read: boolean;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
