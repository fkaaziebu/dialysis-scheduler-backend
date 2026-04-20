import { createUnionType, Field, ObjectType } from '@nestjs/graphql';
import { TwoFactorChallengeResponse } from './two-factor.types';

@ObjectType()
export class UserPayload {
  @Field()
  id: string;

  @Field()
  firstName: string;

  @Field()
  lastName: string;

  @Field()
  email: string;

  @Field()
  role: string;
}

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => UserPayload)
  user: UserPayload;
}

@ObjectType()
export class RefreshResponse {
  @Field()
  accessToken: string;
}

@ObjectType()
export class LogoutResponse {
  @Field()
  message: string;
}

export const LoginResult = createUnionType({
  name: 'LoginResult',
  types: () => [AuthResponse, TwoFactorChallengeResponse] as const,
  resolveType(value) {
    if ('challengeToken' in value) return TwoFactorChallengeResponse;
    return AuthResponse;
  },
});
