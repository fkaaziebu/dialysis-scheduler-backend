import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Setup default connection in the application
 * @param config {ConfigService}
 */
const defaultPostgresDBConnection = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  autoLoadEntities: true,
  synchronize: configService.get('NODE_ENV') !== 'production',
  url: configService.get('DATABASE_URL'),
  ssl: {
    rejectUnauthorized: false, // allow self-signed AWS certs
  },
});

const defaultRedisDBConnection = async (configService: ConfigService) => ({
  connection: {
    url: configService.get<string>('REDIS_URL'),
  },
});

export const databaseProviders = [
  TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: defaultPostgresDBConnection,
  }),
  BullModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: defaultRedisDBConnection,
  }),
];
