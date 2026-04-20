import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class TwoFactorToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  adminId: string;

  // SHA-256 hash of the 6-digit OTP (used for email/phone methods)
  @Column()
  codeHash: string;

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
