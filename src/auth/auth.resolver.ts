import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RefreshTokenInput } from './dto/refresh-token.input';
import { LogoutInput } from './dto/logout.input';
import {
  AuthResponse,
  LoginResult,
  LogoutResponse,
  RefreshResponse,
} from './dto/auth-response.type';
import {
  CompleteTwoFactorLoginInput,
  DisableTwoFactorInput,
  DisableTwoFactorResponse,
  RequestTwoFactorBypassInput,
  SetupTwoFactorInput,
  SetupTwoFactorResponse,
  TwoFactorBypassResponse,
  VerifyTwoFactorSetupInput,
} from './dto/two-factor.types';
import {
  ForgotPasswordInput,
  ForgotPasswordResponse,
  ResetPasswordInput,
  ResetPasswordResponse,
} from './dto/password-reset.types';
import {
  OAuthLoginInput,
  OAuthProvider,
  OAuthUrlResponse,
} from './dto/oauth.types';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticates a user (administrator or patient).
   * Returns full tokens when 2FA is disabled, or a challenge token when 2FA is enabled.
   */
  @Mutation(() => LoginResult)
  login(@Args('input') input: LoginInput): Promise<typeof LoginResult> {
    return this.authService.login(input);
  }

  /**
   * Completes the second step of 2FA login by verifying the OTP or TOTP code.
   */
  @Mutation(() => AuthResponse)
  completeTwoFactorLogin(
    @Args('input') input: CompleteTwoFactorLoginInput,
  ): Promise<AuthResponse> {
    return this.authService.completeTwoFactorLogin(input);
  }

  @Mutation(() => RefreshResponse)
  refreshToken(@Args('input') input: RefreshTokenInput): Promise<RefreshResponse> {
    return this.authService.refreshToken(input);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => LogoutResponse)
  logout(@Args('input') input: LogoutInput): Promise<LogoutResponse> {
    return this.authService.logout(input);
  }

  // ── 2FA ────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => SetupTwoFactorResponse)
  setupTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: SetupTwoFactorInput,
  ): Promise<SetupTwoFactorResponse> {
    return this.authService.setupTwoFactor(user.id, input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => SetupTwoFactorResponse)
  verifyTwoFactorSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: VerifyTwoFactorSetupInput,
  ): Promise<SetupTwoFactorResponse> {
    return this.authService.verifyTwoFactorSetup(user.id, input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => DisableTwoFactorResponse)
  disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: DisableTwoFactorInput,
  ): Promise<DisableTwoFactorResponse> {
    return this.authService.disableTwoFactor(user.id, input);
  }

  /**
   * Requests a bypass code (via EMAIL or PHONE) for an admin locked out of their
   * TOTP authenticator app. The code is delivered out-of-band and must be passed
   * to completeTwoFactorLogin to complete sign-in.
   */
  @Mutation(() => TwoFactorBypassResponse)
  requestTwoFactorBypass(
    @Args('input') input: RequestTwoFactorBypassInput,
  ): Promise<TwoFactorBypassResponse> {
    return this.authService.requestTwoFactorBypass(input);
  }

  // ── Password Reset ─────────────────────────────────────────────────────────

  /**
   * Initiates a password reset flow for any user (administrator or patient).
   * Always returns the same message to prevent user enumeration.
   */
  @Mutation(() => ForgotPasswordResponse)
  forgotPassword(@Args('input') input: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(input);
  }

  /**
   * Resets the user's password using the token received out-of-band.
   * Invalidates all existing sessions on success.
   */
  @Mutation(() => ResetPasswordResponse)
  resetPassword(@Args('input') input: ResetPasswordInput): Promise<ResetPasswordResponse> {
    return this.authService.resetPassword(input);
  }

  // ── OAuth 2.0 ──────────────────────────────────────────────────────────────

  /**
   * Returns the authorization URL to redirect the user to for OAuth consent.
   * The client opens this URL in a browser; after consent Google redirects back
   * with a code that is then passed to oauthLogin.
   */
  @Query(() => OAuthUrlResponse)
  oauthLoginUrl(
    @Args('provider', { type: () => OAuthProvider }) provider: OAuthProvider,
  ): OAuthUrlResponse {
    return this.authService.getOAuthUrl(provider);
  }

  /**
   * Exchanges an OAuth authorization code for our own JWT tokens.
   * For patients: auto-registers if no account exists.
   * For administrators: requires an existing account with a matching email.
   */
  @Mutation(() => AuthResponse)
  oauthLogin(@Args('input') input: OAuthLoginInput): Promise<AuthResponse> {
    return this.authService.oauthLogin(input);
  }
}
