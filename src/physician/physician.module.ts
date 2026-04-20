import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicianService } from './physician.service';
import { PhysicianResolver } from './physician.resolver';
import { Physician } from './entities/physician.entity';
import { FacilityPhysician } from './entities/facility-physician.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Physician, FacilityPhysician])],
  providers: [PhysicianService, PhysicianResolver],
  exports: [TypeOrmModule, PhysicianService],
})
export class PhysicianModule {}
