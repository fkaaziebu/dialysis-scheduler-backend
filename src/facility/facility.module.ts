import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacilityService } from './facility.service';
import { FacilityResolver } from './facility.resolver';
import { Facility } from './entities/facility.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Facility])],
  providers: [FacilityService, FacilityResolver],
  exports: [TypeOrmModule, FacilityService],
})
export class FacilityModule {}
