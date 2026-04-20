import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';

export enum OAuthProvider {
  GOOGLE = 'GOOGLE',
}

registerEnumType(OAuthProvider, { name: 'OAuthProvider' });

// ── Inputs ───────────────────────────────────────────────────────────────────

@InputType()
export class OAuthLoginInput {
  /** The OAuth provider to authenticate with. */
  @Field(() => OAuthProvider)
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  /**
   * The authorization code returned by the provider after the user consents.
   * The client obtains this from the OAuth redirect and forwards it here.
   */
  @Field()
  @IsString()
  code: string;

}

// ── Responses ────────────────────────────────────────────────────────────────

@ObjectType()
export class OAuthUrlResponse {
  /** The authorization URL to redirect the user to for OAuth consent. */
  @Field()
  url: string;
}
