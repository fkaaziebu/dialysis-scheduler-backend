import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

// ── Inputs ───────────────────────────────────────────────────────────────────

@InputType()
export class ForgotPasswordInput {
  @Field()
  @IsEmail()
  email: string;
}

@InputType()
export class ResetPasswordInput {
  /** The raw reset token delivered out-of-band (email / notification). */
  @Field()
  @IsString()
  token: string;

  /** Must be at least 8 characters with one uppercase letter, one number, and one special character. */
  @Field()
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message:
      'newPassword must contain at least one uppercase letter, one number, and one special character',
  })
  newPassword: string;
}

// ── Responses ────────────────────────────────────────────────────────────────

@ObjectType()
export class ForgotPasswordResponse {
  @Field()
  message: string;
}

@ObjectType()
export class ResetPasswordResponse {
  @Field()
  message: string;
}
