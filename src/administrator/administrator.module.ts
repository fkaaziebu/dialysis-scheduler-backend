import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministratorService } from './administrator.service';
import { AdministratorResolver } from './administrator.resolver';
import { Administrator } from './entities/administrator.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { FacilityPatient } from '../patient/entities/facility-patient.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Physician } from '../physician/entities/physician.entity';
import { FacilityPhysician } from '../physician/entities/facility-physician.entity';
import { FacilityModule } from '../facility/facility.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Administrator,
      Appointment,
      FacilityPatient,
      Patient,
      Physician,
      FacilityPhysician,
    ]),
    FacilityModule,
    AuthModule,
  ],
  providers: [AdministratorService, AdministratorResolver],
})
export class AdministratorModule {}
