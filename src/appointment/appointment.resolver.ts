import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppointmentService } from './appointment.service';
import { Appointment } from './entities/appointment.entity';
import { ListAppointmentsInput } from './dto/list-appointments.input';
import { PaginatedAppointmentsResponse } from './dto/paginated-appointments.type';
import { GetAppointmentStatsInput } from './dto/get-appointment-stats.input';
import { AppointmentStatsResponse } from './dto/appointment-stats.type';
import { UpdateAppointmentStatusInput } from './dto/update-appointment-status.input';
import { AssignPhysicianInput } from './dto/assign-physician.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Resolver(() => Appointment)
export class AppointmentResolver {
  constructor(private readonly appointmentService: AppointmentService) {}

  /** Full appointment detail including patient, facility, and physician. */
  @UseGuards(JwtAuthGuard)
  @Query(() => Appointment)
  getAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Args('id') id: string,
  ): Promise<Appointment> {
    return this.appointmentService.findById(id, user);
  }

  /**
   * Paginated appointment list.
   * - PATIENT: sees only their own appointments.
   * - FACILITY_ADMIN: scoped to their facility.
   * - ROOT_ADMIN: sees everything (filterable).
   */
  @UseGuards(JwtAuthGuard)
  @Query(() => PaginatedAppointmentsResponse)
  listAppointments(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input', { nullable: true }) input: ListAppointmentsInput,
  ): Promise<PaginatedAppointmentsResponse> {
    return this.appointmentService.listAppointments(user, input);
  }

  /**
   * Per-month appointment counts for a given date range.
   * Requires ROOT_ADMIN or FACILITY_ADMIN role.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Query(() => AppointmentStatsResponse)
  getAppointmentStats(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: GetAppointmentStatsInput,
  ): Promise<AppointmentStatsResponse> {
    return this.appointmentService.getAppointmentStats(user, input);
  }

  /**
   * Update the status of an appointment.
   * Requires FACILITY_ADMIN or ROOT_ADMIN role.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => Appointment)
  updateAppointmentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: UpdateAppointmentStatusInput,
  ): Promise<Appointment> {
    return this.appointmentService.updateStatus(user, input);
  }

  /**
   * Assign a physician to an appointment.
   * Requires FACILITY_ADMIN or ROOT_ADMIN role.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ROOT_ADMIN', 'FACILITY_ADMIN')
  @Mutation(() => Appointment)
  assignPhysicianToAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Args('input') input: AssignPhysicianInput,
  ): Promise<Appointment> {
    return this.appointmentService.assignPhysician(user, input);
  }
}
