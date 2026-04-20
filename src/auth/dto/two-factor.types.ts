import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';

export enum TwoFactorMethod {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  TOTP = 'TOTP',
}

registerEnumType(TwoFactorMethod, { name: 'TwoFactorMethod' });

// ── Inputs ──────────────────────────────────────────────────────────────────

@InputType()
export class SetupTwoFactorInput {
  @Field(() => TwoFactorMethod)
  @IsEnum(TwoFactorMethod)
  method: TwoFactorMethod;
}

@InputType()
export class VerifyTwoFactorSetupInput {
  /** The 6-digit OTP (email/phone) or TOTP code from authenticator app. */
  @Field()
  @IsString()
  code: string;
}

@InputType()
export class CompleteTwoFactorLoginInput {
  /** Short-lived challenge token returned by the login mutation when 2FA is required. */
  @Field()
  @IsString()
  challengeToken: string;

  /** The 6-digit OTP or TOTP code. */
  @Field()
  @IsString()
  code: string;
}

@InputType()
export class DisableTwoFactorInput {
  /** Current password — required to confirm identity before disabling 2FA. */
  @Field()
  @IsString()
  password: string;
}

@InputType()
export class RequestTwoFactorBypassInput {
  /** The challenge token returned by the login mutation (twoFactorPending: true). */
  @Field()
  @IsString()
  challengeToken: string;

  /**
   * The channel to deliver the bypass code — must be EMAIL or PHONE.
   * Only available when the account has TOTP configured and the authenticator
   * app is unavailable.
   */
  @Field(() => TwoFactorMethod)
  @IsEnum(TwoFactorMethod)
  method: TwoFactorMethod;
}

// ── Response types ───────────────────────────────────────────────────────────

@ObjectType()
export class SetupTwoFactorResponse {
  @Field()
  message: string;

  /** Only present for TOTP: the base32 secret for the authenticator app. */
  @Field(() => String, { nullable: true })
  totpSecret?: string;

  /** Only present for TOTP: the otpauth:// URL to encode as a QR code. */
  @Field(() => String, { nullable: true })
  otpauthUrl?: string;
}

@ObjectType()
export class TwoFactorChallengeResponse {
  /** Short-lived JWT (5 min) to pass to completeTwoFactorLogin. */
  @Field()
  challengeToken: string;

  /** Which method the admin has configured: 'EMAIL' | 'PHONE' | 'TOTP'. */
  @Field()
  twoFactorMethod: string;

  @Field()
  message: string;
}

@ObjectType()
export class DisableTwoFactorResponse {
  @Field()
  message: string;
}

@ObjectType()
export class TwoFactorBypassResponse {
  @Field()
  message: string;
}
