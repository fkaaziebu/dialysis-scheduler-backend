import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppointmentService } from './appointment.service';
import {
  Appointment,
  AppointmentStatus,
  SessionType,
} from './entities/appointment.entity';
import {
  Administrator,
  AdministratorRole,
} from '../administrator/entities/administrator.entity';
import { Facility } from '../facility/entities/facility.entity';
import { FacilityPatient, FacilityPatientStatus } from '../patient/entities/facility-patient.entity';
import { Physician } from '../physician/entities/physician.entity';
import { CreateAppointmentInput } from '../patient/dto/create-appointment.input';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const facility: Facility = {
  id: 'facility-uuid',
  name: 'Sunrise Dialysis',
  address: '1 Main St',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  phoneNumber: '+23300000000',
  email: 'sunrise@clinic.com',
  capacity: 5,
  createdAt: new Date(),
};

const otherFacility: Facility = {
  ...facility,
  id: 'other-facility-uuid',
  name: 'Other Dialysis',
};

const facilityPatient: FacilityPatient = {
  id: 'fp-uuid',
  patientId: 'patient-uuid',
  facilityId: facility.id,
  status: FacilityPatientStatus.ACTIVE,
  currentDiagnosis: null,
  diagnosticStatus: null,
  notes: null,
  patient: null as any,
  facility: null as any,
  enrolledAt: new Date(),
};

const facilityAdmin: Administrator = {
  id: 'facility-admin-uuid',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@clinic.com',
  password: 'hashed',
  phoneNumber: '+23311111111',
  role: AdministratorRole.FACILITY_ADMIN,
  facilityId: facility.id,
  facility: null,
  twoFactorEnabled: false,
  twoFactorMethod: null,
  twoFactorSecret: null,
  oauthProvider: null,
  oauthId: null,
  createdAt: new Date(),
};

const rootAdmin: Administrator = {
  ...facilityAdmin,
  id: 'root-admin-uuid',
  role: AdministratorRole.ROOT_ADMIN,
  facilityId: null,
};

// A date 30 days from now — always valid (future, within 90 days)
const futureDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
})();

const appointmentInput: CreateAppointmentInput = {
  facilityPatientId: facilityPatient.id,
  appointmentDate: futureDate,
  sessionType: SessionType.MORNING,
};

const savedAppointment: Appointment = {
  id: 'appt-uuid',
  patientId: 'patient-uuid',
  facilityId: facility.id,
  appointmentDate: futureDate,
  sessionType: SessionType.MORNING,
  status: AppointmentStatus.PENDING,
  notes: null,
  patient: null as any,
  facility: null as any,
  createdAt: new Date(),
};

const patientCaller: AuthenticatedUser = {
  id: 'patient-uuid',
  role: 'PATIENT',
  type: 'patient',
};

const facilityAdminCaller: AuthenticatedUser = {
  id: facilityAdmin.id,
  role: AdministratorRole.FACILITY_ADMIN,
  type: 'administrator',
};

const rootAdminCaller: AuthenticatedUser = {
  id: rootAdmin.id,
  role: AdministratorRole.ROOT_ADMIN,
  type: 'administrator',
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockAppointmentRepo = () => ({
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockAdministratorRepo = () => ({
  findOneBy: jest.fn(),
  findOne: jest.fn(),
});

const mockFacilityRepo = () => ({
  findOneBy: jest.fn(),
});

const mockFacilityPatientRepo = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockPhysicianRepo = () => ({
  findOneBy: jest.fn(),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentService', () => {
  let service: AppointmentService;
  let appointmentRepo: ReturnType<typeof mockAppointmentRepo>;
  let administratorRepo: ReturnType<typeof mockAdministratorRepo>;
  let facilityRepo: ReturnType<typeof mockFacilityRepo>;
  let facilityPatientRepo: ReturnType<typeof mockFacilityPatientRepo>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: getRepositoryToken(Appointment), useFactory: mockAppointmentRepo },
        { provide: getRepositoryToken(Administrator), useFactory: mockAdministratorRepo },
        { provide: getRepositoryToken(Facility), useFactory: mockFacilityRepo },
        { provide: getRepositoryToken(FacilityPatient), useFactory: mockFacilityPatientRepo },
        { provide: getRepositoryToken(Physician), useFactory: mockPhysicianRepo },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    appointmentRepo = module.get(getRepositoryToken(Appointment));
    administratorRepo = module.get(getRepositoryToken(Administrator));
    facilityRepo = module.get(getRepositoryToken(Facility));
    facilityPatientRepo = module.get(getRepositoryToken(FacilityPatient));
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Helpers for happy-path mocks ──────────────────────────────────────────

  function mockHappyPath() {
    facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
    facilityRepo.findOneBy.mockResolvedValue(facility);
    appointmentRepo.count.mockResolvedValueOnce(0); // capacity check
    appointmentRepo.count.mockResolvedValueOnce(0); // duplicate check
    appointmentRepo.create.mockReturnValue(savedAppointment);
    appointmentRepo.save.mockResolvedValue(savedAppointment);
  }

  describe('create', () => {
    // ── Patient caller ───────────────────────────────────────────────────────

    it('creates an appointment for a patient caller and emits notification event', async () => {
      mockHappyPath();

      const result = await service.create(patientCaller, appointmentInput);

      expect(facilityPatientRepo.findOneBy).toHaveBeenCalledWith({ id: facilityPatient.id });
      expect(facilityRepo.findOneBy).toHaveBeenCalledWith({ id: facility.id });
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'appointment.created',
        expect.objectContaining({
          patientId: 'patient-uuid',
          facilityId: facility.id,
          facilityName: facility.name,
        }),
      );
      expect(result).toMatchObject({ facilityName: facility.name, status: AppointmentStatus.PENDING });
    });

    it('throws ForbiddenException when patient calls with a facilityPatient that belongs to another patient', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue({
        ...facilityPatient,
        patientId: 'other-patient-uuid',
      });

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow(ForbiddenException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    // ── FACILITY_ADMIN caller ────────────────────────────────────────────────

    it('creates an appointment when FACILITY_ADMIN belongs to the same facility as the facilityPatient', async () => {
      mockHappyPath();
      administratorRepo.findOne.mockResolvedValue(facilityAdmin);

      const result = await service.create(facilityAdminCaller, appointmentInput);

      expect(administratorRepo.findOne).toHaveBeenCalledWith({
        where: { id: facilityAdmin.id },
        relations: { facility: true },
      });
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ facilityName: facility.name });
    });

    it('throws ForbiddenException when FACILITY_ADMIN belongs to a different facility than the facilityPatient', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient); // facilityId: facility.id
      administratorRepo.findOne.mockResolvedValue({
        ...facilityAdmin,
        facilityId: otherFacility.id, // different facility
      });

      await expect(
        service.create(facilityAdminCaller, appointmentInput),
      ).rejects.toThrow(ForbiddenException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when FACILITY_ADMIN record cannot be found', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      administratorRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(facilityAdminCaller, appointmentInput),
      ).rejects.toThrow(NotFoundException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    // ── ROOT_ADMIN caller ────────────────────────────────────────────────────

    it('creates an appointment for ROOT_ADMIN without any facility restriction', async () => {
      mockHappyPath();

      const result = await service.create(rootAdminCaller, appointmentInput);

      expect(administratorRepo.findOneBy).not.toHaveBeenCalled();
      expect(appointmentRepo.save).toHaveBeenCalled();
      expect(result).toMatchObject({ facilityName: facility.name });
    });

    // ── Common validations ───────────────────────────────────────────────────

    it('throws NotFoundException when facilityPatient does not exist', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow(NotFoundException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when facility does not exist', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow(NotFoundException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when appointmentDate is today', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      const today = new Date().toISOString().split('T')[0];

      await expect(
        service.create(patientCaller, { ...appointmentInput, appointmentDate: today }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when appointmentDate is in the past', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);

      await expect(
        service.create(patientCaller, { ...appointmentInput, appointmentDate: '2000-01-01' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when appointmentDate is more than 90 days in the future', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      const over90 = new Date();
      over90.setDate(over90.getDate() + 91);

      await expect(
        service.create(patientCaller, { ...appointmentInput, appointmentDate: over90.toISOString().split('T')[0] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when facility is at full capacity for the session', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      appointmentRepo.count.mockResolvedValueOnce(facility.capacity); // at capacity

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow(ConflictException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when patient already has a booking on that date', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      appointmentRepo.count
        .mockResolvedValueOnce(0)  // capacity — available
        .mockResolvedValueOnce(1); // duplicate — exists

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow(ConflictException);
      expect(appointmentRepo.save).not.toHaveBeenCalled();
    });

    it('does not emit event when save fails', async () => {
      facilityPatientRepo.findOneBy.mockResolvedValue(facilityPatient);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      appointmentRepo.count.mockResolvedValueOnce(0);
      appointmentRepo.count.mockResolvedValueOnce(0);
      appointmentRepo.create.mockReturnValue(savedAppointment);
      appointmentRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.create(patientCaller, appointmentInput),
      ).rejects.toThrow('DB error');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
