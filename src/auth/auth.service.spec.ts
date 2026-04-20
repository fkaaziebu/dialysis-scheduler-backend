import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Administrator, AdministratorRole } from '../administrator/entities/administrator.entity';
import { Patient, PatientRole } from '../patient/entities/patient.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { TwoFactorToken } from './entities/two-factor-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { LoginInput } from './dto/login.input';
import { RefreshTokenInput } from './dto/refresh-token.input';
import { LogoutInput } from './dto/logout.input';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-token'),
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('mock-jti-uuid'),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-reset-token-hex')),
}));

jest.mock('otplib', () => ({
  // Standalone functions used by the service (moduleResolution: nodenext)
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generateSecret: jest.fn().mockReturnValue('MOCK_TOTP_SECRET'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/mock'),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/mock-auth-url'),
    getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'mock-id-token' } }),
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-id',
        email: 'oauth@example.com',
        given_name: 'OAuth',
        family_name: 'User',
      }),
    }),
    setCredentials: jest.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const admin: Administrator = {
  id: 'admin-uuid',
  firstName: 'Root',
  lastName: 'Admin',
  email: 'root@example.com',
  password: 'hashed-password',
  phoneNumber: '+12345678901',
  role: AdministratorRole.ROOT_ADMIN,
  facilityId: null,
  facility: null,
  twoFactorEnabled: false,
  twoFactorMethod: null,
  twoFactorSecret: null,
  oauthProvider: null,
  oauthId: null,
  createdAt: new Date(),
};

const patient: Patient = {
  id: 'patient-uuid',
  firstName: 'John',
  lastName: 'Patient',
  email: 'john@example.com',
  password: 'hashed-password',
  phoneNumber: '+23300000001',
  dateOfBirth: '1990-01-01',
  gender: 'MALE' as any,
  address: { street: '1 Main St', city: 'Accra', region: 'Greater Accra', country: 'Ghana' },
  role: PatientRole.PATIENT,
  oauthProvider: null,
  oauthId: null,
  createdAt: new Date(),
};

const storedRefreshToken: RefreshToken = {
  id: 'token-uuid',
  userId: admin.id,
  userType: 'administrator',
  jti: 'mock-jti-uuid',
  tokenHash: 'hashed-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

const loginInput: LoginInput = {
  email: 'root@example.com',
  password: 'Password1!',
};

const refreshInput: RefreshTokenInput = { refreshToken: 'mock-refresh-token' };
const logoutInput: LogoutInput = { refreshToken: 'mock-refresh-token' };

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockAdministratorRepo = () => ({
  findOneBy: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockPatientRepo = () => ({
  findOneBy: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockRefreshTokenRepo = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const mockTwoFactorTokenRepo = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const mockPasswordResetTokenRepo = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      GOOGLE_CLIENT_ID: 'mock-google-client-id',
      GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
      GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/students/auth/google/callback',
    };
    return map[key];
  }),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let service: AuthService;
  let administratorRepo: ReturnType<typeof mockAdministratorRepo>;
  let patientRepo: ReturnType<typeof mockPatientRepo>;
  let refreshTokenRepo: ReturnType<typeof mockRefreshTokenRepo>;
  let passwordResetTokenRepo: ReturnType<typeof mockPasswordResetTokenRepo>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Administrator), useFactory: mockAdministratorRepo },
        { provide: getRepositoryToken(Patient), useFactory: mockPatientRepo },
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRefreshTokenRepo },
        { provide: getRepositoryToken(TwoFactorToken), useFactory: mockTwoFactorTokenRepo },
        { provide: getRepositoryToken(PasswordResetToken), useFactory: mockPasswordResetTokenRepo },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    administratorRepo = module.get(getRepositoryToken(Administrator));
    patientRepo = module.get(getRepositoryToken(Patient));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    passwordResetTokenRepo = module.get(getRepositoryToken(PasswordResetToken));
    jwtService = module.get(JwtService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  describe('login', () => {
    it('authenticates an administrator and returns tokens with user payload', async () => {
      administratorRepo.findOneBy.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepo.create.mockReturnValue(storedRefreshToken);
      refreshTokenRepo.save.mockResolvedValue(storedRefreshToken);

      const result = await service.login(loginInput);

      expect(administratorRepo.findOneBy).toHaveBeenCalledWith({ email: loginInput.email });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginInput.password, admin.password);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(refreshTokenRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
        user: {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
        },
      });
    });

    it('authenticates a patient when no matching administrator is found', async () => {
      administratorRepo.findOneBy.mockResolvedValue(null);
      patientRepo.findOneBy.mockResolvedValue(patient);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepo.create.mockReturnValue(storedRefreshToken);
      refreshTokenRepo.save.mockResolvedValue(storedRefreshToken);

      const result = await service.login({ email: patient.email, password: 'Password1!' });

      expect(patientRepo.findOneBy).toHaveBeenCalledWith({ email: patient.email });
      expect(result.user.id).toBe(patient.id);
      expect(result.user.role).toBe(PatientRole.PATIENT);
    });

    it('throws UnauthorizedException when no user is found for the email', async () => {
      administratorRepo.findOneBy.mockResolvedValue(null);
      patientRepo.findOneBy.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password does not match', async () => {
      administratorRepo.findOneBy.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('stores a bcrypt-hashed refresh token, not the raw token', async () => {
      administratorRepo.findOneBy.mockResolvedValue(admin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      refreshTokenRepo.create.mockReturnValue(storedRefreshToken);
      refreshTokenRepo.save.mockResolvedValue(storedRefreshToken);

      await service.login(loginInput);

      const createCall = refreshTokenRepo.create.mock.calls[0][0];
      expect(createCall.tokenHash).toBe('hashed-token');
      expect(createCall.jti).toBe('mock-jti-uuid');
    });
  });

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('returns a new access token for a valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: admin.id,
        role: admin.role,
        type: 'administrator',
        jti: 'mock-jti-uuid',
      });
      refreshTokenRepo.findOneBy.mockResolvedValue(storedRefreshToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshToken(refreshInput);

      expect(jwtService.verify).toHaveBeenCalledWith(
        refreshInput.refreshToken,
        { secret: 'refresh-secret' },
      );
      expect(refreshTokenRepo.findOneBy).toHaveBeenCalledWith({ jti: 'mock-jti-uuid' });
      expect(result).toEqual({ accessToken: 'mock-token' });
    });

    it('throws UnauthorizedException when JWT verification fails (invalid/expired)', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(service.refreshToken(refreshInput)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when token is not found in store (revoked)', async () => {
      jwtService.verify.mockReturnValue({ sub: admin.id, role: admin.role, type: 'administrator', jti: 'mock-jti-uuid' });
      refreshTokenRepo.findOneBy.mockResolvedValue(null);

      await expect(service.refreshToken(refreshInput)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when bcrypt hash comparison fails', async () => {
      jwtService.verify.mockReturnValue({ sub: admin.id, role: admin.role, type: 'administrator', jti: 'mock-jti-uuid' });
      refreshTokenRepo.findOneBy.mockResolvedValue(storedRefreshToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshToken(refreshInput)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------

  describe('logout', () => {
    it('deletes the refresh token and returns a success message', async () => {
      jwtService.verify.mockReturnValue({ jti: 'mock-jti-uuid' });
      refreshTokenRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.logout(logoutInput);

      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ jti: 'mock-jti-uuid' });
      expect(result).toEqual({ message: 'Logged out successfully.' });
    });

    it('returns success silently when the refresh token is invalid or already expired', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      const result = await service.logout(logoutInput);

      expect(refreshTokenRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully.' });
    });

    it('returns success silently when the token is not found in the store', async () => {
      jwtService.verify.mockReturnValue({ jti: 'mock-jti-uuid' });
      refreshTokenRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.logout(logoutInput);

      expect(result).toEqual({ message: 'Logged out successfully.' });
    });
  });

  // -------------------------------------------------------------------------
  // forgotPassword
  // -------------------------------------------------------------------------

  describe('forgotPassword', () => {
    it('generates a reset token and emits event when admin email is found', async () => {
      administratorRepo.findOneBy.mockResolvedValue(admin);
      passwordResetTokenRepo.delete.mockResolvedValue({ affected: 1 });
      passwordResetTokenRepo.create.mockReturnValue({});
      passwordResetTokenRepo.save.mockResolvedValue({});

      const result = await service.forgotPassword({ email: admin.email });

      expect(passwordResetTokenRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.passwordResetRequested',
        expect.objectContaining({ userId: admin.id, userType: 'administrator' }),
      );
      expect(result.message).toContain('If an account');
    });

    it('returns the same message when no account is found (prevents enumeration)', async () => {
      administratorRepo.findOneBy.mockResolvedValue(null);
      patientRepo.findOneBy.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'notfound@example.com' });

      expect(passwordResetTokenRepo.save).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result.message).toContain('If an account');
    });
  });

  // -------------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------------

  describe('resetPassword', () => {
    const storedResetToken: PasswordResetToken = {
      id: 'reset-token-uuid',
      userId: admin.id,
      userType: 'administrator',
      tokenHash: 'mock-hash',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
    };

    it('resets the password and invalidates all refresh tokens', async () => {
      passwordResetTokenRepo.findOneBy.mockResolvedValue(storedResetToken);
      administratorRepo.update.mockResolvedValue({ affected: 1 });
      refreshTokenRepo.delete.mockResolvedValue({ affected: 1 });
      passwordResetTokenRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword({ token: 'raw-token', newPassword: 'NewPass1!' });

      expect(administratorRepo.update).toHaveBeenCalledWith(
        admin.id,
        expect.objectContaining({ password: 'hashed-token' }),
      );
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({ userId: admin.id });
      expect(result.message).toContain('reset successfully');
    });

    it('throws BadRequestException when token is not found', async () => {
      passwordResetTokenRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'NewPass1!' }),
      ).rejects.toThrow('Invalid or expired password reset token');
    });

    it('throws BadRequestException when token is expired', async () => {
      passwordResetTokenRepo.findOneBy.mockResolvedValue({
        ...storedResetToken,
        expiresAt: new Date(Date.now() - 1000),
      });
      passwordResetTokenRepo.delete.mockResolvedValue({ affected: 1 });

      await expect(
        service.resetPassword({ token: 'expired-token', newPassword: 'NewPass1!' }),
      ).rejects.toThrow('Invalid or expired password reset token');
    });
  });

  // -------------------------------------------------------------------------
  // requestTwoFactorBypass
  // -------------------------------------------------------------------------

  describe('requestTwoFactorBypass', () => {
    const totpAdmin = {
      ...admin,
      twoFactorEnabled: true,
      twoFactorMethod: 'TOTP',
      twoFactorSecret: 'MOCK_TOTP_SECRET',
    };

    it('generates and stores a bypass OTP when TOTP admin requests EMAIL bypass', async () => {
      jwtService.verify.mockReturnValue({
        sub: admin.id,
        role: admin.role,
        type: 'administrator',
        twoFactorPending: true,
      });
      administratorRepo.findOneBy.mockResolvedValue(totpAdmin);
      // twoFactorTokenRepo.delete + create + save from storeTwoFactorToken
      // (mockTwoFactorTokenRepo has all three)

      const result = await service.requestTwoFactorBypass({
        challengeToken: 'mock-challenge-token',
        method: 'EMAIL' as any,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.twoFactorBypassRequested',
        expect.objectContaining({ adminId: admin.id, method: 'EMAIL' }),
      );
      expect(result.message).toContain('email');
    });

    it('throws BadRequestException when method is TOTP', async () => {
      await expect(
        service.requestTwoFactorBypass({
          challengeToken: 'mock-challenge-token',
          method: 'TOTP' as any,
        }),
      ).rejects.toThrow('Bypass method must be EMAIL or PHONE');
    });

    it('throws UnauthorizedException when challenge token is invalid', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(
        service.requestTwoFactorBypass({
          challengeToken: 'bad-token',
          method: 'EMAIL' as any,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when admin does not have TOTP configured', async () => {
      jwtService.verify.mockReturnValue({
        sub: admin.id,
        role: admin.role,
        type: 'administrator',
        twoFactorPending: true,
      });
      administratorRepo.findOneBy.mockResolvedValue({
        ...admin,
        twoFactorEnabled: true,
        twoFactorMethod: 'EMAIL',
      });

      await expect(
        service.requestTwoFactorBypass({
          challengeToken: 'mock-challenge-token',
          method: 'EMAIL' as any,
        }),
      ).rejects.toThrow('Bypass is only available for accounts with TOTP');
    });
  });

  // -------------------------------------------------------------------------
  // getOAuthUrl
  // -------------------------------------------------------------------------

  describe('getOAuthUrl', () => {
    it('returns a Google authorization URL', () => {
      const result = service.getOAuthUrl('GOOGLE' as any);

      expect(result).toMatchObject({ url: expect.any(String) });
    });
  });
});
