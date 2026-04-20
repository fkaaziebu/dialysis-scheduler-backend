import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@ObjectType()
@Entity()
export class Facility {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  name: string;

  @Field()
  @Column()
  address: string;

  @Field()
  @Column()
  city: string;

  @Field()
  @Column()
  region: string;

  @Field()
  @Column()
  country: string;

  @Field()
  @Column()
  phoneNumber: string;

  @Field()
  @Column()
  email: string;

  @Field(() => Int)
  @Column()
  capacity: number;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
