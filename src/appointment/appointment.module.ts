import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentService } from './appointment.service';
import { AppointmentResolver } from './appointment.resolver';
import { Appointment } from './entities/appointment.entity';
import { Administrator } from '../administrator/entities/administrator.entity';
import { FacilityPatient } from '../patient/entities/facility-patient.entity';
import { FacilityModule } from '../facility/facility.module';
import { PhysicianModule } from '../physician/physician.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Administrator, FacilityPatient]),
    FacilityModule,
    PhysicianModule,
  ],
  providers: [AppointmentService, AppointmentResolver],
  exports: [AppointmentService],
})
export class AppointmentModule {}
