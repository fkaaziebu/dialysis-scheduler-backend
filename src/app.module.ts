import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configValidationSchema } from './config/config.schema';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AdministratorModule } from './administrator/administrator.module';
import { FacilityModule } from './facility/facility.module';
import { PhysicianModule } from './physician/physician.module';
import { PatientModule } from './patient/patient.module';
import { AppointmentModule } from './appointment/appointment.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [
        process.env.STAGE === 'development'
          ? `.env.${process.env.STAGE}.local`
          : '.env',
      ],
      validationSchema: configValidationSchema,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      autoSchemaFile: true,
      introspection: true,
      playground: true,
      driver: ApolloDriver,
      resolvers: {},
      csrfPrevention: false,
      context: ({ req }: { req: Request }) => ({ req }),
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    AdministratorModule,
    FacilityModule,
    PhysicianModule,
    PatientModule,
    AppointmentModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
