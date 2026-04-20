import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RefreshToken } from './entities/refresh-token.entity';
import { TwoFactorToken } from './entities/two-factor-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { Administrator } from '../administrator/entities/administrator.entity';
import { Patient } from '../patient/entities/patient.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    TypeOrmModule.forFeature([
      Administrator,
      Patient,
      RefreshToken,
      TwoFactorToken,
      PasswordResetToken,
    ]),
  ],
  providers: [AuthService, AuthResolver, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard, JwtStrategy, PassportModule],
})
export class AuthModule {}
