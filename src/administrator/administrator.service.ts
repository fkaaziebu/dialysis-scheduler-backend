import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  Administrator,
  AdministratorRole,
} from './entities/administrator.entity';
import { Facility } from '../facility/entities/facility.entity';
import {
  Appointment,
  AppointmentStatus,
} from '../appointment/entities/appointment.entity';
import {
  FacilityPatient,
  FacilityPatientStatus,
} from '../patient/entities/facility-patient.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Physician } from '../physician/entities/physician.entity';
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
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AdministratorService {
  constructor(
    @InjectRepository(Administrator)
    private readonly administratorRepo: Repository<Administrator>,
    @InjectRepository(Facility)
    private readonly facilityRepo: Repository<Facility>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(FacilityPatient)
    private readonly facilityPatientRepo: Repository<FacilityPatient>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Physician)
    private readonly physicianRepo: Repository<Physician>,
    @InjectRepository(FacilityPhysician)
    private readonly facilityPhysicianRepo: Repository<FacilityPhysician>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async registerAdministrator(
    input: RegisterAdministratorInput,
  ): Promise<Administrator> {
    const emailTaken = await this.administratorRepo.existsBy({
      email: input.email,
    });
    if (emailTaken) {
      throw new ConflictException(
        'An administrator with this email already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const admin = this.administratorRepo.create({
      ...input,
      password: hashedPassword,
      role: AdministratorRole.ROOT_ADMIN,
    });

    return this.administratorRepo.save(admin);
  }

  async createFacility(
    adminId: string,
    input: CreateFacilityInput,
  ): Promise<Facility> {
    await this.requireRole(adminId, AdministratorRole.ROOT_ADMIN);

    const nameTaken = await this.facilityRepo.existsBy({ name: input.name });
    if (nameTaken) {
      throw new ConflictException('A facility with this name already exists');
    }

    const admin = await this.administratorRepo.findOne({
      where: { id: adminId },
      relations: { facility: true },
    });

    if (!admin) {
      throw new NotFoundException('Administrator not found');
    }

    const facility = this.facilityRepo.create(input);

    const savedFacility = await this.facilityRepo.save(facility);

    admin.facility = savedFacility;
    this.administratorRepo.save(admin);

    return savedFacility;
  }

  async addFacilityAdmin(
    adminId: string,
    facilityId: string,
    input: AddFacilityAdminInput,
  ): Promise<Administrator> {
    await this.requireRole(adminId, AdministratorRole.ROOT_ADMIN);

    const facility = await this.facilityRepo.findOneBy({ id: facilityId });
    if (!facility) {
      throw new NotFoundException(`Facility ${facilityId} not found`);
    }

    const emailTaken = await this.administratorRepo.existsBy({
      email: input.email,
    });
    if (emailTaken) {
      throw new ConflictException(
        'An administrator with this email already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const facilityAdmin = this.administratorRepo.create({
      ...input,
      password: hashedPassword,
      role: AdministratorRole.FACILITY_ADMIN,
      facilityId,
    });

    const saved = await this.administratorRepo.save(facilityAdmin);

    this.eventEmitter.emit('administrator.facilityAdminCreated', {
      id: saved.id,
      email: saved.email,
      firstName: saved.firstName,
      lastName: saved.lastName,
      password: input.password,
      facilityName: facility.name,
    });

    return saved;
  }

  async adminProfile(adminId: string): Promise<Administrator> {
    const admin = await this.administratorRepo.findOne({
      where: { id: adminId },
      relations: { facility: true },
    });
    if (!admin) {
      throw new NotFoundException('Administrator not found');
    }

    return admin;
  }

  async updatePassword(
    adminId: string,
    input: UpdatePasswordInput,
  ): Promise<Administrator> {
    const admin = await this.administratorRepo.findOne({
      where: { id: adminId },
      select: [
        'id',
        'password',
        'firstName',
        'lastName',
        'email',
        'phoneNumber',
        'role',
        'facilityId',
        'twoFactorEnabled',
        'twoFactorMethod',
        'createdAt',
      ],
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    const isMatch = await bcrypt.compare(input.currentPassword, admin.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    admin.password = await bcrypt.hash(input.newPassword, 10);
    return this.administratorRepo.save(admin);
  }

  async getStats(caller: AuthenticatedUser): Promise<StatsResponse> {
    const admin = await this.administratorRepo.findOne({
      where: { id: caller.id },
      relations: { facility: true },
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    // Scope: ROOT_ADMIN sees all, FACILITY_ADMIN sees only their facility
    const facilityId =
      admin.role === AdministratorRole.FACILITY_ADMIN
        ? admin.facilityId!
        : undefined;

    const now = new Date();
    const thisMonthStart = this.monthStart(now);
    const thisMonthEnd = `${
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0]
    }T23:59:59`;

    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = this.monthStart(prevMonth);
    const lastMonthEnd = `${
      new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    }T23:59:59`;

    const [
      total,
      totalLast,
      completed,
      completedLast,
      pending,
      pendingLast,
      noShow,
      noShowLast,
    ] = await Promise.all([
      this.countAppointments(
        undefined,
        thisMonthStart,
        thisMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        undefined,
        lastMonthStart,
        lastMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.COMPLETED,
        thisMonthStart,
        thisMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.COMPLETED,
        lastMonthStart,
        lastMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.PENDING,
        thisMonthStart,
        thisMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.PENDING,
        lastMonthStart,
        lastMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.NO_SHOW,
        thisMonthStart,
        thisMonthEnd,
        facilityId,
      ),
      this.countAppointments(
        AppointmentStatus.NO_SHOW,
        lastMonthStart,
        lastMonthEnd,
        facilityId,
      ),
    ]);

    return {
      totalAppointments: {
        count: total,
        changePercent: this.pctChange(total, totalLast),
      },
      completedAppointments: {
        count: completed,
        changePercent: this.pctChange(completed, completedLast),
      },
      pendingAppointments: {
        count: pending,
        changePercent: this.pctChange(pending, pendingLast),
      },
      noShowAppointments: {
        count: noShow,
        changePercent: this.pctChange(noShow, noShowLast),
      },
    };
  }

  async addFacilityPatient(
    caller: AuthenticatedUser,
    input: AddFacilityPatientInput,
  ): Promise<FacilityPatient> {
    const admin = await this.administratorRepo.findOne({
      where: { id: caller.id },
      relations: { facility: true },
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    if (
      admin.role === AdministratorRole.FACILITY_ADMIN &&
      admin.facilityId !== input.facilityId
    ) {
      throw new ForbiddenException('Access denied to this facility');
    }

    const facility = await this.facilityRepo.findOneBy({
      id: input.facilityId,
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${input.facilityId} not found`);
    }

    let patient: Patient;

    if (!input.isNewPatient) {
      // Existing patient path
      const found = await this.patientRepo.findOneBy({ email: input.email });
      if (!found) {
        throw new NotFoundException(
          `No patient found with email ${input.email}`,
        );
      }
      patient = found;
    } else {
      // New patient path — validate required fields are present
      const {
        firstName,
        lastName,
        password,
        phoneNumber,
        dateOfBirth,
        gender,
        address,
        email,
      } = input;
      if (
        !firstName ||
        !lastName ||
        !password ||
        !phoneNumber ||
        !dateOfBirth ||
        !gender ||
        !address
      ) {
        throw new BadRequestException(
          'Provide either an existing patient email or all new patient fields: firstName, lastName, password, phoneNumber, dateOfBirth, gender, address',
        );
      }

      const emailTaken = await this.patientRepo.existsBy({
        email: input.email,
      });
      if (emailTaken) {
        throw new ConflictException('A patient with this email already exists');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(dateOfBirth) >= today) {
        throw new BadRequestException('dateOfBirth must be a date in the past');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      patient = await this.patientRepo.save(
        this.patientRepo.create({
          firstName,
          lastName,
          password: hashedPassword,
          phoneNumber,
          dateOfBirth,
          gender,
          address,
          email,
        }),
      );
    }

    const existing = await this.facilityPatientRepo.findOneBy({
      patientId: patient.id,
      facilityId: input.facilityId,
    });
    if (existing) {
      throw new ConflictException(
        'Patient is already enrolled at this facility',
      );
    }

    const { status, currentDiagnosis, diagnosticStatus, notes } =
      input.facilityPatientInfo;

    const facilityPatient = await this.facilityPatientRepo.save(
      this.facilityPatientRepo.create({
        patientId: patient.id,
        facilityId: input.facilityId,
        status: status ?? FacilityPatientStatus.ACTIVE,
        currentDiagnosis: currentDiagnosis ?? null,
        diagnosticStatus: diagnosticStatus ?? null,
        notes: notes ?? null,
      }),
    );

    return facilityPatient;
  }

  async listFacilityPatients(
    caller: AuthenticatedUser,
    input: ListFacilityPatientsInput,
  ): Promise<PaginatedFacilityPatientsResponse> {
    const admin = await this.administratorRepo.findOne({
      where: { id: caller.id },
      relations: { facility: true },
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    // FACILITY_ADMIN can only query their own facility
    if (
      admin.role === AdministratorRole.FACILITY_ADMIN &&
      admin.facilityId !== input.facilityId
    ) {
      throw new ForbiddenException('Access denied to this facility');
    }

    const { page, limit, search, status, facilityId } = input;

    const qb = this.facilityPatientRepo
      .createQueryBuilder('fp')
      .leftJoinAndSelect('fp.patient', 'patient')
      .leftJoinAndSelect('fp.facility', 'facility')
      .where('fp.facilityId = :facilityId', { facilityId });

    if (status) {
      qb.andWhere('fp.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        `(LOWER(patient.firstName) LIKE :s OR LOWER(patient.lastName) LIKE :s OR LOWER(patient.email) LIKE :s)`,
        { s: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('fp.enrolledAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addFacilityPhysician(
    caller: AuthenticatedUser,
    input: AddFacilityPhysicianInput,
  ): Promise<FacilityPhysician> {
    const admin = await this.administratorRepo.findOne({
      where: { id: caller.id },
      relations: { facility: true },
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    if (
      admin.role === AdministratorRole.FACILITY_ADMIN &&
      admin.facilityId !== input.facilityId
    ) {
      throw new ForbiddenException('Access denied to this facility');
    }

    const facility = await this.facilityRepo.findOneBy({
      id: input.facilityId,
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${input.facilityId} not found`);
    }

    let physician: Physician;

    if (!input.isNewPhysician) {
      const found = await this.physicianRepo.findOneBy({ email: input.email });
      if (!found) {
        throw new NotFoundException(
          `No physician found with email ${input.email}`,
        );
      }
      physician = found;
    } else {
      const { firstName, lastName, phoneNumber, specialization, email } = input;
      if (!firstName || !lastName || !phoneNumber) {
        throw new BadRequestException(
          'Provide either an existing physician email or all new physician fields: firstName, lastName, phoneNumber',
        );
      }

      const emailTaken = await this.physicianRepo.existsBy({ email });
      if (emailTaken) {
        throw new ConflictException(
          'A physician with this email already exists',
        );
      }

      physician = await this.physicianRepo.save(
        this.physicianRepo.create({
          firstName,
          lastName,
          email,
          phoneNumber,
          specialization: specialization ?? '',
        }),
      );
    }

    const existing = await this.facilityPhysicianRepo.findOneBy({
      physicianId: physician.id,
      facilityId: input.facilityId,
    });
    if (existing) {
      throw new ConflictException(
        'Physician is already enrolled at this facility',
      );
    }

    return this.facilityPhysicianRepo.save(
      this.facilityPhysicianRepo.create({
        physicianId: physician.id,
        facilityId: input.facilityId,
        startDate: input.startDate ?? null,
      }),
    );
  }

  async listFacilityPhysicians(
    caller: AuthenticatedUser,
    input: ListFacilityPhysiciansInput,
  ): Promise<PaginatedFacilityPhysiciansResponse> {
    const admin = await this.administratorRepo.findOne({
      where: { id: caller.id },
      relations: { facility: true },
    });
    if (!admin) throw new NotFoundException('Administrator not found');

    if (
      admin.role === AdministratorRole.FACILITY_ADMIN &&
      admin.facilityId !== input.facilityId
    ) {
      throw new ForbiddenException('Access denied to this facility');
    }

    const { page, limit, search, facilityId } = input;

    const qb = this.facilityPhysicianRepo
      .createQueryBuilder('fp')
      .leftJoinAndSelect('fp.physician', 'physician')
      .where('fp.facilityId = :facilityId', { facilityId });

    if (search) {
      qb.andWhere(
        `(LOWER(physician.firstName) LIKE :s OR LOWER(physician.lastName) LIKE :s OR LOWER(physician.email) LIKE :s)`,
        { s: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('fp.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async countAppointments(
    status: AppointmentStatus | undefined,
    from: string,
    to: string,
    facilityId?: string,
  ): Promise<number> {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.appointmentDate >= :from', { from })
      .andWhere('a.appointmentDate <= :to', { to });

    if (status) qb.andWhere('a.status = :status', { status });
    if (facilityId) qb.andWhere('a.facilityId = :facilityId', { facilityId });

    return qb.getCount();
  }

  private monthStart(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100 * 10) / 10;
  }

  private async requireRole(
    adminId: string,
    requiredRole: AdministratorRole,
  ): Promise<Administrator> {
    const admin = await this.administratorRepo.findOneBy({ id: adminId });
    if (!admin) {
      throw new NotFoundException('Administrator not found');
    }
    if (admin.role !== requiredRole) {
      throw new ForbiddenException(
        `This action requires the ${requiredRole} role`,
      );
    }
    return admin;
  }
}
