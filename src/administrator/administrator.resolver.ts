import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdministratorService } from './administrator.service';
import { Administrator } from './entities/administrator.entity';
import { Facility } from '../facility/entities/facility.entity';
import { FacilityPatient } from '../patient/entities/facility-patient.entity';
import { FacilityPhysician } from '../physician/entities/facility-physician.entity';
import { RegisterAdministratorInput } from './dto/register-administrator.input';
import { CreateFacilityInput } from './dto/create-facility.input';
import { AddFacilityAdminInput } from './dto/add-facility-admin.input';
import { AddFacilityPatientInput } from './dto/add-facility-patient.input';
import { UpdatePasswordInput } from './dto/update-password.input';
import { AddFacilityPhysicianInput } from '../physician/dto/add-facility-physician.input';
import { StatsResponse } from './dto/stats-response.type';
import { ListFacilityPatientsInput } from '../patient/dto/list-facility-patients.input';
import { PaginatedFacilityPatientsResponse } from '../patient/dto/paginated-facility-patients.type';
import { ListFacilityPhysiciansInput } from '../physician/dto/list-facility-physicians.input';
import { PaginatedFacilityPhysiciansResponse } from '../physician/dto/paginated-facility-physicians.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Resolver(() => Administrator)
export class AdministratorResolver {
  constructor(private readonly administratorService: AdministratorService) {}

  @Query(() => String)
  administratorHealth(): string {
    return 'ok';
  }

  @Mutation(() => Administrator)
  registerAdministrator(
    @Args('input') input: RegisterAdministratorInput,
  ): Promise<Administrator> {
    return this.administratorService.registerAdministrator(input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN')
  @Mutation(() => Facility)
  createFacility(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: CreateFacilityInput,
  ): Promise<Facility> {
    return this.administratorService.createFacility(user.id, input);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN')
  @Mutation(() => Administrator)
  addFacilityAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Args('facilityId') facilityId: string,
    @Args('input') input: AddFacilityAdminInput,
  ): Promise<Administrator> {
    return this.administratorService.addFacilityAdmin(user.id, facilityId, input);
  }

  /** Returns the profile of the currently authenticated administrator. */
  @UseGuards(JwtAuthGuard)
  @Query(() => Administrator)
  adminProfile(@CurrentUser() user: AuthenticatedUser): Promise<Administrator> {
    return this.administratorService.adminProfile(user.id);
  }

  /** Updates the password of the currently authenticated administrator. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => Administrator)
  updateAdminPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: UpdatePasswordInput,
  ): Promise<Administrator> {
    return this.administratorService.updatePassword(user.id, input);
  }

  /**
   * Dashboard statistics for the current month vs last month.
   * ROOT_ADMIN sees all facilities; FACILITY_ADMIN sees only their facility.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Query(() => StatsResponse)
  getStats(@CurrentUser() user: AuthenticatedUser): Promise<StatsResponse> {
    return this.administratorService.getStats(user);
  }

  /**
   * Enrols a patient at a facility.
   * Pass email to enrol an existing patient, or full patient fields to create and enrol a new one.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => FacilityPatient)
  addFacilityPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: AddFacilityPatientInput,
  ): Promise<FacilityPatient> {
    return this.administratorService.addFacilityPatient(user, input);
  }

  /**
   * Paginated list of patients enrolled at a facility.
   * ROOT_ADMIN can query any facility; FACILITY_ADMIN is scoped to their own.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Query(() => PaginatedFacilityPatientsResponse)
  listFacilityPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: ListFacilityPatientsInput,
  ): Promise<PaginatedFacilityPatientsResponse> {
    return this.administratorService.listFacilityPatients(user, input);
  }

  /**
   * Enrols a physician at a facility.
   * Pass email to enrol an existing physician, or full physician fields to create and enrol a new one.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => FacilityPhysician)
  addFacilityPhysician(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: AddFacilityPhysicianInput,
  ): Promise<FacilityPhysician> {
    return this.administratorService.addFacilityPhysician(user, input);
  }

  /**
   * Paginated list of physicians enrolled at a facility.
   * ROOT_ADMIN can query any facility; FACILITY_ADMIN is scoped to their own.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Query(() => PaginatedFacilityPhysiciansResponse)
  listFacilityPhysicians(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: ListFacilityPhysiciansInput,
  ): Promise<PaginatedFacilityPhysiciansResponse> {
    return this.administratorService.listFacilityPhysicians(user, input);
  }
}
