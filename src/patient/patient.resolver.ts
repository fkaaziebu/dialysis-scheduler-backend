import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PatientService } from './patient.service';
import { Patient } from './entities/patient.entity';
import { FacilityPatient } from './entities/facility-patient.entity';
import { RegisterPatientInput } from './dto/register-patient.input';
import { ListFacilitiesInput } from './dto/list-facilities.input';
import { CreateAppointmentInput } from './dto/create-appointment.input';
import { PaginatedFacilitiesResponse } from './dto/paginated-facilities.type';
import { AppointmentResponse } from '../appointment/dto/appointment-response.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Resolver(() => Patient)
export class PatientResolver {
  constructor(private readonly patientService: PatientService) {}

  @Mutation(() => Patient)
  registerPatient(
    @Args('input') input: RegisterPatientInput,
  ): Promise<Patient> {
    return this.patientService.registerPatient(input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Query(() => PaginatedFacilitiesResponse)
  listFacilities(
    @Args('input', { nullable: true }) input: ListFacilitiesInput = {},
  ): Promise<PaginatedFacilitiesResponse> {
    return this.patientService.listFacilities(input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'FACILITY_ADMIN', 'ROOT_ADMIN')
  @Mutation(() => AppointmentResponse)
  createAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateAppointmentInput,
  ): Promise<AppointmentResponse> {
    return this.patientService.createAppointment(user, input);
  }

  /** Returns the profile of the currently authenticated patient. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Query(() => Patient)
  patientProfile(@CurrentUser() user: AuthenticatedUser): Promise<Patient> {
    return this.patientService.patientProfile(user.id);
  }

  /**
   * Returns a facility-patient enrollment record by facilityPatientId.
   * Patients can only fetch their own record; admins can fetch any record.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'FACILITY_ADMIN', 'ROOT_ADMIN')
  @Query(() => FacilityPatient)
  getPatientStatusAtFacility(
    @CurrentUser() user: AuthenticatedUser,
    @Args('facilityPatientId') facilityPatientId: string,
  ): Promise<FacilityPatient> {
    return this.patientService.getPatientStatusAtFacility(user, facilityPatientId);
  }
}
