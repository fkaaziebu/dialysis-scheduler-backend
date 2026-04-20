import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { verify, generateURI, generateSecret } from 'otplib';
import { OAuth2Client } from 'google-auth-library';
import { Administrator } from '../administrator/entities/administrator.entity';
import {
  Patient,
  Gender,
  PatientRole,
} from '../patient/entities/patient.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { TwoFactorToken } from './entities/two-factor-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
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
  TwoFactorChallengeResponse,
  TwoFactorMethod,
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
import {
  JwtPayload,
  RefreshJwtPayload,
} from './interfaces/jwt-payload.interface';

interface TwoFactorJwtPayload extends JwtPayload {
  twoFactorPending: true;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Administrator)
    private readonly administratorRepo: Repository<Administrator>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(TwoFactorToken)
    private readonly twoFactorTokenRepo: Repository<TwoFactorToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepo: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(input: LoginInput): Promise<typeof LoginResult> {
    let userId: string;
    let firstName: string;
    let lastName: string;
    let email: string;
    let role: string;
    let userType: 'administrator' | 'patient';
    let storedPassword: string | null;
    let admin: Administrator | null = null;

    admin = await this.administratorRepo.findOneBy({ email: input.email });

    if (admin) {
      ({
        id: userId,
        firstName,
        lastName,
        email,
        password: storedPassword,
      } = admin);
      role = admin.role;
      userType = 'administrator';
    } else {
      const patient = await this.patientRepo.findOneBy({ email: input.email });
      if (!patient) throw new UnauthorizedException('Invalid credentials');
      ({
        id: userId,
        firstName,
        lastName,
        email,
        password: storedPassword,
      } = patient);
      role = patient.role;
      userType = 'patient';
    }

    if (!storedPassword) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(input.password, storedPassword);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    // 2FA check — only for administrators
    if (admin && admin.twoFactorEnabled && admin.twoFactorMethod) {
      if (
        admin.twoFactorMethod === TwoFactorMethod.EMAIL ||
        admin.twoFactorMethod === TwoFactorMethod.PHONE
      ) {
        const otp = this.generateOtp();
        await this.storeTwoFactorToken(admin.id, otp);
      }

      const challengeToken = this.jwtService.sign(
        {
          sub: userId,
          role,
          type: userType,
          twoFactorPending: true,
        } as TwoFactorJwtPayload,
        {
          expiresIn: '5m',
          secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        },
      );

      const methodMessages: Record<string, string> = {
        [TwoFactorMethod.EMAIL]:
          'A verification code has been sent to your email.',
        [TwoFactorMethod.PHONE]:
          'A verification code has been sent to your phone.',
        [TwoFactorMethod.TOTP]: 'Enter the code from your authenticator app.',
      };

      const response: TwoFactorChallengeResponse = {
        challengeToken,
        twoFactorMethod: admin.twoFactorMethod,
        message: methodMessages[admin.twoFactorMethod],
      };
      return response;
    }

    return this.issueFullTokens(
      userId,
      firstName,
      lastName,
      email,
      role,
      userType,
    );
  }

  // ── Complete 2FA login ─────────────────────────────────────────────────────

  async completeTwoFactorLogin(
    input: CompleteTwoFactorLoginInput,
  ): Promise<AuthResponse> {
    let payload: TwoFactorJwtPayload;
    try {
      payload = this.jwtService.verify<TwoFactorJwtPayload>(
        input.challengeToken,
        { secret: this.configService.get<string>('JWT_ACCESS_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }

    if (!payload.twoFactorPending) {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const admin = await this.administratorRepo.findOneBy({ id: payload.sub });
    if (!admin) throw new UnauthorizedException('Administrator not found');

    // Check for a stored OTP first — covers EMAIL/PHONE normal 2FA and TOTP bypass.
    // If a TwoFactorToken exists it means either a regular OTP was sent (EMAIL/PHONE flow)
    // or a bypass was requested (TOTP users who lost their authenticator).
    const codeHash = this.hashOtp(input.code);
    const storedOtp = await this.twoFactorTokenRepo.findOneBy({
      adminId: admin.id,
      codeHash,
    });

    if (storedOtp) {
      if (storedOtp.expiresAt < new Date()) {
        await this.twoFactorTokenRepo.delete({ adminId: admin.id });
        throw new UnauthorizedException('Invalid or expired verification code');
      }
      await this.twoFactorTokenRepo.delete({ adminId: admin.id });
    } else if (admin.twoFactorMethod === TwoFactorMethod.TOTP) {
      // Normal TOTP path — no bypass OTP was stored
      if (!admin.twoFactorSecret)
        throw new UnauthorizedException('2FA not configured');
      const valid = await verify({
        token: input.code,
        secret: admin.twoFactorSecret,
      });
      if (!valid.valid)
        throw new UnauthorizedException('Invalid authenticator code');
    } else {
      // EMAIL/PHONE path with a wrong or expired code
      await this.twoFactorTokenRepo.delete({ adminId: admin.id });
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    return this.issueFullTokens(
      admin.id,
      admin.firstName,
      admin.lastName,
      admin.email,
      admin.role,
      'administrator',
    );
  }

  // ── 2FA Bypass ────────────────────────────────────────────────────────────

  async requestTwoFactorBypass(
    input: RequestTwoFactorBypassInput,
  ): Promise<TwoFactorBypassResponse> {
    if (input.method === TwoFactorMethod.TOTP) {
      throw new BadRequestException(
        'Bypass method must be EMAIL or PHONE, not TOTP',
      );
    }

    let payload: TwoFactorJwtPayload;
    try {
      payload = this.jwtService.verify<TwoFactorJwtPayload>(
        input.challengeToken,
        { secret: this.configService.get<string>('JWT_ACCESS_SECRET') },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }

    if (!payload.twoFactorPending) {
      throw new UnauthorizedException('Invalid challenge token');
    }

    const admin = await this.administratorRepo.findOneBy({ id: payload.sub });
    if (!admin) throw new UnauthorizedException('Administrator not found');

    if (admin.twoFactorMethod !== TwoFactorMethod.TOTP) {
      throw new BadRequestException(
        'Bypass is only available for accounts with TOTP two-factor authentication',
      );
    }

    const otp = this.generateOtp();
    await this.storeTwoFactorToken(admin.id, otp);

    this.eventEmitter.emit('auth.twoFactorBypassRequested', {
      adminId: admin.id,
      firstName: admin.firstName,
      email: admin.email,
      phoneNumber: admin.phoneNumber,
      method: input.method,
      otp,
    });

    const channelLabel =
      input.method === TwoFactorMethod.EMAIL ? 'email' : 'phone';
    return {
      message: `A bypass code has been sent to your ${channelLabel}. Use it with completeTwoFactorLogin to sign in.`,
    };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────

  async refreshToken(input: RefreshTokenInput): Promise<RefreshResponse> {
    let payload: RefreshJwtPayload;
    try {
      payload = this.jwtService.verify<RefreshJwtPayload>(input.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.refreshTokenRepo.findOneBy({ jti: payload.jti });
    if (!stored)
      throw new UnauthorizedException('Invalid or expired refresh token');

    const isValid = await bcrypt.compare(input.refreshToken, stored.tokenHash);
    if (!isValid)
      throw new UnauthorizedException('Invalid or expired refresh token');

    const { sub, role, type } = payload;
    const accessToken = this.jwtService.sign(
      { sub, role, type },
      {
        expiresIn: '15m',
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      },
    );

    return { accessToken };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(input: LogoutInput): Promise<LogoutResponse> {
    try {
      const payload = this.jwtService.verify<RefreshJwtPayload>(
        input.refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
      );
      await this.refreshTokenRepo.delete({ jti: payload.jti });
    } catch {
      // Silent
    }
    return { message: 'Logged out successfully.' };
  }

  // ── 2FA Setup ──────────────────────────────────────────────────────────────

  async setupTwoFactor(
    adminId: string,
    input: SetupTwoFactorInput,
  ): Promise<SetupTwoFactorResponse> {
    const admin = await this.administratorRepo.findOneBy({ id: adminId });
    if (!admin) throw new NotFoundException('Administrator not found');

    if (input.method === TwoFactorMethod.TOTP) {
      const secret = generateSecret();
      const issuer =
        this.configService.get<string>('TOTP_ISSUER_NAME') ??
        'DialysisScheduler';
      const otpauthUrl = generateURI({ label: admin.email, issuer, secret });

      await this.administratorRepo.update(adminId, {
        twoFactorSecret: secret,
        twoFactorMethod: TwoFactorMethod.TOTP,
      });

      return {
        message:
          'Scan the QR code with your authenticator app then call verifyTwoFactorSetup to activate.',
        totpSecret: secret,
        otpauthUrl,
      };
    }

    const otp = this.generateOtp();
    await this.storeTwoFactorToken(adminId, otp);
    await this.administratorRepo.update(adminId, {
      twoFactorMethod: input.method,
    });

    return {
      message: `A verification code has been sent. Enter it with verifyTwoFactorSetup to activate ${input.method} two-factor authentication.`,
    };
  }

  async verifyTwoFactorSetup(
    adminId: string,
    input: VerifyTwoFactorSetupInput,
  ): Promise<SetupTwoFactorResponse> {
    const admin = await this.administratorRepo.findOneBy({ id: adminId });
    if (!admin) throw new NotFoundException('Administrator not found');

    if (!admin.twoFactorMethod)
      throw new BadRequestException('Call setupTwoFactor first');

    if (admin.twoFactorMethod === TwoFactorMethod.TOTP) {
      if (!admin.twoFactorSecret)
        throw new BadRequestException('TOTP secret not found');
      const valid = await verify({
        token: input.code,
        secret: admin.twoFactorSecret,
      });
      if (!valid.valid)
        throw new UnauthorizedException('Invalid authenticator code');
    } else {
      const codeHash = this.hashOtp(input.code);
      const token = await this.twoFactorTokenRepo.findOneBy({
        adminId,
        codeHash,
      });
      if (!token || token.expiresAt < new Date()) {
        await this.twoFactorTokenRepo.delete({ adminId });
        throw new UnauthorizedException('Invalid or expired verification code');
      }
      await this.twoFactorTokenRepo.delete({ adminId });
    }

    await this.administratorRepo.update(adminId, { twoFactorEnabled: true });
    return { message: 'Two-factor authentication has been enabled.' };
  }

  async disableTwoFactor(
    adminId: string,
    input: DisableTwoFactorInput,
  ): Promise<DisableTwoFactorResponse> {
    const admin = await this.administratorRepo.findOneBy({ id: adminId });
    if (!admin) throw new NotFoundException('Administrator not found');

    const valid = await bcrypt.compare(input.password, admin.password);
    if (!valid) throw new UnauthorizedException('Invalid password');

    await this.administratorRepo.update(adminId, {
      twoFactorEnabled: false,
      twoFactorMethod: null,
      twoFactorSecret: null,
    });

    return { message: 'Two-factor authentication has been disabled.' };
  }

  // ── Password Reset ─────────────────────────────────────────────────────────

  async forgotPassword(
    input: ForgotPasswordInput,
  ): Promise<ForgotPasswordResponse> {
    const admin = await this.administratorRepo.findOneBy({
      email: input.email,
    });
    const patient = admin
      ? null
      : await this.patientRepo.findOneBy({ email: input.email });
    const user = admin ?? patient;

    // Always respond the same way to prevent user enumeration
    if (!user) {
      return {
        message:
          'If an account with that email exists, a reset link has been sent.',
      };
    }

    const userType = admin ? 'administrator' : 'patient';
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashOtp(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.passwordResetTokenRepo.delete({ userId: user.id });
    await this.passwordResetTokenRepo.save(
      this.passwordResetTokenRepo.create({
        userId: user.id,
        userType,
        tokenHash,
        expiresAt,
      }),
    );

    this.eventEmitter.emit('auth.passwordResetRequested', {
      userId: user.id,
      userType,
      email: user.email,
      firstName: user.firstName,
      token: rawToken,
    });

    return {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };
  }

  async resetPassword(
    input: ResetPasswordInput,
  ): Promise<ResetPasswordResponse> {
    const tokenHash = this.hashOtp(input.token);
    const stored = await this.passwordResetTokenRepo.findOneBy({ tokenHash });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await this.passwordResetTokenRepo.delete({ id: stored.id });
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

    if (stored.userType === 'administrator') {
      await this.administratorRepo.update(stored.userId, {
        password: newPasswordHash,
      });
    } else {
      await this.patientRepo.update(stored.userId, {
        password: newPasswordHash,
      });
    }

    // Invalidate all existing refresh tokens for this user
    await this.refreshTokenRepo.delete({ userId: stored.userId });
    // Clean up the used reset token
    await this.passwordResetTokenRepo.delete({ id: stored.id });

    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  // ── OAuth 2.0 ──────────────────────────────────────────────────────────────

  getOAuthUrl(provider: OAuthProvider): OAuthUrlResponse {
    if (provider === OAuthProvider.GOOGLE) {
      const client = new OAuth2Client(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        this.configService.get<string>('GOOGLE_CALLBACK_URL'),
      );
      const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['openid', 'profile', 'email'],
        prompt: 'consent',
      });
      return { url };
    }
    throw new BadRequestException(`Unsupported OAuth provider: ${provider}`);
  }

  async oauthLogin(input: OAuthLoginInput): Promise<AuthResponse> {
    if (input.provider === OAuthProvider.GOOGLE) {
      return this.googleLogin(input.code);
    }
    throw new BadRequestException(
      `Unsupported OAuth provider: ${input.provider}`,
    );
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async googleLogin(code: string): Promise<AuthResponse> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')!;
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL')!;

    const client = new OAuth2Client(clientId, clientSecret, callbackUrl);

    let googleUser: {
      sub: string;
      email: string;
      given_name?: string;
      family_name?: string;
    };
    try {
      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) throw new Error('No email in OAuth payload');
      googleUser = {
        sub: payload.sub,
        email: payload.email,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };
    } catch {
      throw new UnauthorizedException('Failed to verify Google OAuth token');
    }

    // 1. Look up administrator by OAuth ID
    let admin = await this.administratorRepo.findOneBy({
      oauthId: googleUser.sub,
      oauthProvider: OAuthProvider.GOOGLE,
    });

    // 2. Fall back to email match (link OAuth to existing admin account)
    if (!admin) {
      admin = await this.administratorRepo.findOneBy({
        email: googleUser.email,
      });
      if (admin) {
        await this.administratorRepo.update(admin.id, {
          oauthId: googleUser.sub,
          oauthProvider: OAuthProvider.GOOGLE,
        });
        admin.oauthId = googleUser.sub;
      }
    }

    if (admin) {
      return this.issueFullTokens(
        admin.id,
        admin.firstName,
        admin.lastName,
        admin.email,
        admin.role,
        'administrator',
      );
    }

    // 3. Look up patient by OAuth ID
    let patient = await this.patientRepo.findOneBy({
      oauthId: googleUser.sub,
      oauthProvider: OAuthProvider.GOOGLE,
    });

    // 4. Fall back to email match (link OAuth to existing patient account)
    if (!patient) {
      patient = await this.patientRepo.findOneBy({ email: googleUser.email });
      if (patient) {
        await this.patientRepo.update(patient.id, {
          oauthId: googleUser.sub,
          oauthProvider: OAuthProvider.GOOGLE,
        });
        patient.oauthId = googleUser.sub;
      }
    }

    // 5. Auto-register a new patient account for first-time Google users
    if (!patient) {
      patient = await this.patientRepo.save(
        this.patientRepo.create({
          firstName: googleUser.given_name ?? 'Unknown',
          lastName: googleUser.family_name ?? 'Unknown',
          email: googleUser.email,
          password: null,
          phoneNumber: '',
          dateOfBirth: '',
          gender: Gender.OTHER,
          address: { street: '', city: '', region: '', country: '' },
          role: PatientRole.PATIENT,
          oauthId: googleUser.sub,
          oauthProvider: OAuthProvider.GOOGLE,
        }),
      );
    }

    return this.issueFullTokens(
      patient.id,
      patient.firstName,
      patient.lastName,
      patient.email,
      patient.role,
      'patient',
    );
  }

  private async issueFullTokens(
    userId: string,
    firstName: string,
    lastName: string,
    email: string,
    role: string,
    userType: 'administrator' | 'patient',
  ): Promise<AuthResponse> {
    const jti = randomUUID();
    const basePayload: JwtPayload = { sub: userId, role, type: userType };

    const accessToken = this.jwtService.sign(basePayload, {
      expiresIn: '15m',
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
    });

    const refreshToken = this.jwtService.sign(
      { ...basePayload, jti },
      {
        expiresIn: '7d',
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      },
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        userType,
        jti,
        tokenHash,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: { id: userId, firstName, lastName, email, role },
    };
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private hashOtp(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async storeTwoFactorToken(
    adminId: string,
    otp: string,
  ): Promise<void> {
    await this.twoFactorTokenRepo.delete({ adminId });
    const codeHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.twoFactorTokenRepo.save(
      this.twoFactorTokenRepo.create({ adminId, codeHash, expiresAt }),
    );
  }
}
