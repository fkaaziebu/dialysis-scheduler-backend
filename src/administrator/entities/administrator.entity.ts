import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Facility } from '../../facility/entities/facility.entity';

export enum AdministratorRole {
  ROOT_ADMIN = 'ROOT_ADMIN',
  FACILITY_ADMIN = 'FACILITY_ADMIN',
}

registerEnumType(AdministratorRole, { name: 'AdministratorRole' });

@ObjectType()
@Entity()
export class Administrator {
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

  // Never exposed via GraphQL
  @Column()
  password: string;

  @Field()
  @Column()
  phoneNumber: string;

  @Field(() => AdministratorRole)
  @Column({ type: 'enum', enum: AdministratorRole })
  role: AdministratorRole;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  facilityId: string | null;

  @ManyToOne(() => Facility, { nullable: true, eager: false })
  @JoinColumn({ name: 'facilityId' })
  facility: Facility | null;

  // Two-Factor Authentication
  @Field()
  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Field(() => String, { nullable: true })
  @Column({ type: 'varchar', nullable: true })
  twoFactorMethod: string | null; // 'EMAIL' | 'PHONE' | 'TOTP'

  // Stored only for TOTP; not exposed via GraphQL
  @Column({ type: 'varchar', nullable: true })
  twoFactorSecret: string | null;

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
