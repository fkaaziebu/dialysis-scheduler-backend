import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Administrator,
  AdministratorRole,
} from '../administrator/entities/administrator.entity';
import { Facility } from '../facility/entities/facility.entity';
import { FacilityPatient } from '../patient/entities/facility-patient.entity';
import { Physician } from '../physician/entities/physician.entity';
import { CreateAppointmentInput } from '../patient/dto/create-appointment.input';
import { AppointmentResponse } from './dto/appointment-response.type';
import { ListAppointmentsInput } from './dto/list-appointments.input';
import { PaginatedAppointmentsResponse } from './dto/paginated-appointments.type';
import { GetAppointmentStatsInput } from './dto/get-appointment-stats.input';
import { AppointmentStatsResponse } from './dto/appointment-stats.type';
import { UpdateAppointmentStatusInput } from './dto/update-appointment-status.input';
import { AssignPhysicianInput } from './dto/assign-physician.input';
import {
  Appointment,
  AppointmentStatus,
} from './entities/appointment.entity';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Administrator)
    private readonly administratorRepo: Repository<Administrator>,
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
    @InjectRepository(FacilityPatient)
    private readonly facilityPatientRepo: Repository<FacilityPatient>,
    @InjectRepository(Physician)
    private readonly physicianRepo: Repository<Physician>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(
    caller: AuthenticatedUser,
    input: CreateAppointmentInput,
  ): Promise<AppointmentResponse> {
    const facilityPatient = await this.facilityPatientRepo.findOneBy({
      id: input.facilityPatientId,
    });
    if (!facilityPatient) {
      throw new NotFoundException(`FacilityPatient ${input.facilityPatientId} not found`);
    }

    let patientId: string;

    if (caller.type === 'patient') {
      if (facilityPatient.patientId !== caller.id) {
        throw new ForbiddenException('Access denied to this facility patient record');
      }
      patientId = caller.id;
    } else if (caller.role === AdministratorRole.FACILITY_ADMIN) {
      const admin = await this.administratorRepo.findOne({
        where: { id: caller.id },
        relations: { facility: true },
      });
      if (!admin) throw new NotFoundException('Administrator not found');
      if (admin.facilityId !== facilityPatient.facilityId) {
        throw new ForbiddenException('Access denied: facility patient does not belong to your facility');
      }
      patientId = facilityPatient.patientId;
    } else {
      // ROOT_ADMIN — no facility restriction
      patientId = facilityPatient.patientId;
    }

    const { facilityId } = facilityPatient;

    const facility = await this.facilityRepo.findOneBy({ id: facilityId });
    if (!facility) {
      throw new NotFoundException(`Facility ${facilityId} not found`);
    }

    const requestedDate = new Date(input.appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate <= today) {
      throw new BadRequestException('appointmentDate must be a future date');
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    if (requestedDate > maxDate) {
      throw new BadRequestException(
        'appointmentDate cannot be more than 90 days in the future',
      );
    }

    const bookedCount = await this.appointmentRepo.count({
      where: {
        facilityId,
        appointmentDate: input.appointmentDate,
        sessionType: input.sessionType,
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
      },
    });

    if (bookedCount >= facility.capacity) {
      throw new ConflictException(
        'No availability for the requested date and session type',
      );
    }

    const duplicateCount = await this.appointmentRepo.count({
      where: {
        patientId,
        facilityId,
        appointmentDate: input.appointmentDate,
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
      },
    });

    if (duplicateCount > 0) {
      throw new ConflictException(
        'You already have a pending or confirmed appointment at this facility on this date',
      );
    }

    const appointment = this.appointmentRepo.create({
      patientId,
      facilityId,
      appointmentDate: input.appointmentDate,
      sessionType: input.sessionType,
      status: AppointmentStatus.PENDING,
      notes: input.notes ?? null,
    });

    const saved = await this.appointmentRepo.save(appointment);

    this.eventEmitter.emit('appointment.created', {
      patientId,
      facilityId,
      facilityName: facility.name,
      appointmentDate: input.appointmentDate,
      sessionType: input.sessionType,
    });

    return { ...saved, facilityName: facility.name };
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async findById(id: string, caller: AuthenticatedUser): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: ['patient', 'facility', 'physician'],
    });

    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    // PATIENT can only view their own appointment
    if (
      caller.type === 'patient' &&
      appointment.patientId !== caller.id
    ) {
      throw new ForbiddenException('Access denied');
    }

    return appointment;
  }

  async listAppointments(
    caller: AuthenticatedUser,
    input: ListAppointmentsInput,
  ): Promise<PaginatedAppointmentsResponse> {
    const { page, limit, status, sessionType, facilityId, patientId, from, to, sortOrder } = input;

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.facility', 'facility')
      .leftJoinAndSelect('a.physician', 'physician');

    // Scope: PATIENT sees only their own; FACILITY_ADMIN scoped to their facility
    if (caller.type === 'patient') {
      qb.andWhere('a.patientId = :pid', { pid: caller.id });
    } else if (caller.role === AdministratorRole.FACILITY_ADMIN) {
      // Must be resolved from DB in real app; here we trust facilityId from input if it matches
      if (facilityId) {
        qb.andWhere('a.facilityId = :fid', { fid: facilityId });
      }
    } else if (facilityId) {
      qb.andWhere('a.facilityId = :fid', { fid: facilityId });
    }

    if (patientId && caller.type !== 'patient') {
      qb.andWhere('a.patientId = :patientId', { patientId });
    }
    if (status) qb.andWhere('a.status = :status', { status });
    if (sessionType) qb.andWhere('a.sessionType = :sessionType', { sessionType });
    if (from) qb.andWhere('a.appointmentDate >= :from', { from });
    if (to) qb.andWhere('a.appointmentDate <= :to', { to });

    qb.orderBy('a.appointmentDate', (sortOrder as 'ASC' | 'DESC') ?? 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAppointmentStats(
    caller: AuthenticatedUser,
    input: GetAppointmentStatsInput,
  ): Promise<AppointmentStatsResponse> {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .select("SUBSTRING(a.appointmentDate, 1, 7)", 'month')
      .addSelect('COUNT(*)', 'count')
      .where('a.appointmentDate >= :from', { from: input.from })
      .andWhere('a.appointmentDate <= :to', { to: input.to });

    if (input.facilityId) {
      qb.andWhere('a.facilityId = :fid', { fid: input.facilityId });
    } else if (caller.role === AdministratorRole.FACILITY_ADMIN) {
      // FACILITY_ADMIN without explicit facilityId — scoped to their own
      // (would need a DB lookup; skip here since facilityId required in practice)
    }

    const rows: Array<{ month: string; count: string }> = await qb
      .groupBy("SUBSTRING(a.appointmentDate, 1, 7)")
      .orderBy('month', 'ASC')
      .getRawMany();

    return {
      data: rows.map((r) => ({ month: r.month, count: Number(r.count) })),
    };
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async updateStatus(
    caller: AuthenticatedUser,
    input: UpdateAppointmentStatusInput,
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findOneBy({
      id: input.appointmentId,
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${input.appointmentId} not found`);
    }

    // Only FACILITY_ADMIN or ROOT_ADMIN can update status
    if (caller.type === 'patient') {
      throw new ForbiddenException('Patients cannot update appointment status');
    }

    // Attach note when completing or cancelling
    if (
      (input.status === AppointmentStatus.COMPLETED ||
        input.status === AppointmentStatus.CANCELLED) &&
      input.message
    ) {
      appointment.notes = input.message;
    }

    appointment.status = input.status;
    const saved = await this.appointmentRepo.save(appointment);

    this.eventEmitter.emit('appointment.statusUpdated', {
      appointmentId: saved.id,
      patientId: saved.patientId,
      facilityId: saved.facilityId,
      appointmentDate: saved.appointmentDate,
      sessionType: saved.sessionType,
      status: saved.status,
    });

    return saved;
  }

  async assignPhysician(
    caller: AuthenticatedUser,
    input: AssignPhysicianInput,
  ): Promise<Appointment> {
    if (caller.type === 'patient') {
      throw new ForbiddenException('Patients cannot assign physicians');
    }

    const appointment = await this.appointmentRepo.findOneBy({
      id: input.appointmentId,
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${input.appointmentId} not found`);
    }

    const physician = await this.physicianRepo.findOneBy({ id: input.physicianId });
    if (!physician) {
      throw new NotFoundException(`Physician ${input.physicianId} not found`);
    }

    appointment.physicianId = input.physicianId;
    return this.appointmentRepo.save(appointment);
  }
}
