import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { PatientService } from './patient.service';
import { Patient, Gender, PatientRole } from './entities/patient.entity';
import { FacilityService } from '../facility/facility.service';
import { AppointmentService } from '../appointment/appointment.service';
import { FacilityPatient } from './entities/facility-patient.entity';
import { RegisterPatientInput } from './dto/register-patient.input';
import { ListFacilitiesInput } from './dto/list-facilities.input';
import { CreateAppointmentInput } from './dto/create-appointment.input';
import { SessionType } from '../appointment/entities/appointment.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const savedPatient: Patient = {
  id: 'patient-uuid',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'hashed-password',
  phoneNumber: '+12345678901',
  dateOfBirth: '1990-04-12',
  gender: Gender.MALE,
  address: { street: '1 Main St', city: 'Accra', region: 'Greater Accra', country: 'Ghana' },
  role: PatientRole.PATIENT,
  oauthProvider: null,
  oauthId: null,
  createdAt: new Date(),
};

const registerInput: RegisterPatientInput = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'Password1!',
  phoneNumber: '+12345678901',
  dateOfBirth: '1990-04-12',
  gender: Gender.MALE,
  address: { street: '1 Main St', city: 'Accra', region: 'Greater Accra', country: 'Ghana' },
};

const listInput: ListFacilitiesInput = { page: 1, limit: 10, search: 'kidney' };

const appointmentInput: CreateAppointmentInput = {
  facilityId: 'facility-uuid',
  appointmentDate: '2099-12-01',
  sessionType: SessionType.MORNING,
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockPatientRepo = () => ({
  existsBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockFacilityPatientRepo = () => ({
  findOneBy: jest.fn(),
});

const mockFacilityService = () => ({
  findPaginated: jest.fn(),
});

const mockAppointmentService = () => ({
  create: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientService', () => {
  let service: PatientService;
  let patientRepo: ReturnType<typeof mockPatientRepo>;
  let facilityService: ReturnType<typeof mockFacilityService>;
  let appointmentService: ReturnType<typeof mockAppointmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientService,
        { provide: getRepositoryToken(Patient), useFactory: mockPatientRepo },
        { provide: getRepositoryToken(FacilityPatient), useFactory: mockFacilityPatientRepo },
        { provide: FacilityService, useFactory: mockFacilityService },
        { provide: AppointmentService, useFactory: mockAppointmentService },
      ],
    }).compile();

    service = module.get<PatientService>(PatientService);
    patientRepo = module.get(getRepositoryToken(Patient));
    facilityService = module.get(FacilityService);
    appointmentService = module.get(AppointmentService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // registerPatient
  // -------------------------------------------------------------------------

  describe('registerPatient', () => {
    it('creates and returns a patient with a hashed password', async () => {
      patientRepo.existsBy.mockResolvedValue(false);
      patientRepo.create.mockReturnValue(savedPatient);
      patientRepo.save.mockResolvedValue(savedPatient);

      const result = await service.registerPatient(registerInput);

      expect(patientRepo.existsBy).toHaveBeenCalledWith({ email: registerInput.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, 10);
      expect(patientRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-password' }),
      );
      expect(result).toEqual(savedPatient);
    });

    it('throws ConflictException when email is already taken', async () => {
      patientRepo.existsBy.mockResolvedValue(true);

      await expect(service.registerPatient(registerInput)).rejects.toThrow(ConflictException);
      expect(patientRepo.save).not.toHaveBeenCalled();
    });

    it('throws when dateOfBirth is today or in the future', async () => {
      patientRepo.existsBy.mockResolvedValue(false);
      const futureInput = { ...registerInput, dateOfBirth: '2099-01-01' };

      await expect(service.registerPatient(futureInput)).rejects.toThrow();
      expect(patientRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // listFacilities
  // -------------------------------------------------------------------------

  describe('listFacilities', () => {
    it('delegates to FacilityService.findPaginated and returns result', async () => {
      const mockResult = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      facilityService.findPaginated.mockResolvedValue(mockResult);

      const result = await service.listFacilities(listInput);

      expect(facilityService.findPaginated).toHaveBeenCalledWith(listInput);
      expect(result).toEqual(mockResult);
    });
  });

  // -------------------------------------------------------------------------
  // createAppointment
  // -------------------------------------------------------------------------

  describe('createAppointment', () => {
    it('delegates to AppointmentService.create with the patient id and input', async () => {
      const mockAppointment = { id: 'appt-uuid', patientId: 'patient-uuid' };
      appointmentService.create.mockResolvedValue(mockAppointment);

      const result = await service.createAppointment('patient-uuid', appointmentInput);

      expect(appointmentService.create).toHaveBeenCalledWith('patient-uuid', appointmentInput);
      expect(result).toEqual(mockAppointment);
    });
  });
});
