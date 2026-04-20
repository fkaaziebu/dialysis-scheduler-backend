import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientService } from './patient.service';
import { PatientResolver } from './patient.resolver';
import { Patient } from './entities/patient.entity';
import { FacilityPatient } from './entities/facility-patient.entity';
import { FacilityModule } from '../facility/facility.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, FacilityPatient]),
    FacilityModule,
    AppointmentModule,
    AuthModule,
  ],
  providers: [PatientService, PatientResolver],
})
export class PatientModule {}
