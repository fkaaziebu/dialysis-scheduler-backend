import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { AdministratorService } from './administrator.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));
import {
  Administrator,
  AdministratorRole,
} from './entities/administrator.entity';
import { Facility } from '../facility/entities/facility.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { FacilityPatient } from '../patient/entities/facility-patient.entity';
import { Patient } from '../patient/entities/patient.entity';
import { RegisterAdministratorInput } from './dto/register-administrator.input';
import { CreateFacilityInput } from './dto/create-facility.input';
import { AddFacilityAdminInput } from './dto/add-facility-admin.input';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rootAdmin: Administrator = {
  id: 'root-admin-uuid',
  firstName: 'Root',
  lastName: 'Admin',
  email: 'root@example.com',
  password: 'hashed-password',
  phoneNumber: '+12345678901',
  role: AdministratorRole.ROOT_ADMIN,
  facilityId: null,
  facility: null,
  twoFactorEnabled: false,
  twoFactorMethod: null,
  twoFactorSecret: null,
  oauthProvider: null,
  oauthId: null,
  createdAt: new Date(),
};

const facility: Facility = {
  id: 'facility-uuid',
  name: 'Sunrise Dialysis',
  address: '123 Main St',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  phoneNumber: '+23300000000',
  email: 'sunrise@clinic.com',
  capacity: 20,
  createdAt: new Date(),
};

const facilityAdmin: Administrator = {
  id: 'facility-admin-uuid',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@clinic.com',
  password: 'hashed-password',
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

const registerInput: RegisterAdministratorInput = {
  firstName: 'Root',
  lastName: 'Admin',
  email: 'root@example.com',
  password: 'Password1!',
  phoneNumber: '+12345678901',
};

const facilityInput: CreateFacilityInput = {
  name: 'Sunrise Dialysis',
  address: '123 Main St',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  phoneNumber: '+23300000000',
  email: 'sunrise@clinic.com',
  capacity: 20,
};

const addAdminInput: AddFacilityAdminInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@clinic.com',
  password: 'Password1!',
  phoneNumber: '+23311111111',
};

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockAdministratorRepo = () => ({
  existsBy: jest.fn(),
  findOneBy: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockFacilityRepo = () => ({
  existsBy: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockAppointmentRepo = () => ({
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
});

const mockFacilityPatientRepo = () => ({
  createQueryBuilder: jest.fn(),
  findOneBy: jest.fn(),
});

const mockPatientRepo = () => ({
  findOneBy: jest.fn(),
  existsBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdministratorService', () => {
  let service: AdministratorService;
  let administratorRepo: ReturnType<typeof mockAdministratorRepo>;
  let facilityRepo: ReturnType<typeof mockFacilityRepo>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministratorService,
        {
          provide: getRepositoryToken(Administrator),
          useFactory: mockAdministratorRepo,
        },
        {
          provide: getRepositoryToken(Facility),
          useFactory: mockFacilityRepo,
        },
        {
          provide: getRepositoryToken(Appointment),
          useFactory: mockAppointmentRepo,
        },
        {
          provide: getRepositoryToken(FacilityPatient),
          useFactory: mockFacilityPatientRepo,
        },
        {
          provide: getRepositoryToken(Patient),
          useFactory: mockPatientRepo,
        },
        {
          provide: EventEmitter2,
          useFactory: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<AdministratorService>(AdministratorService);
    administratorRepo = module.get(getRepositoryToken(Administrator));
    facilityRepo = module.get(getRepositoryToken(Facility));
    eventEmitter = module.get(EventEmitter2);

  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // registerAdministrator
  // -------------------------------------------------------------------------

  describe('registerAdministrator', () => {
    it('creates and returns a root admin when no root admin exists', async () => {
      administratorRepo.existsBy.mockResolvedValueOnce(false); // no root admin
      administratorRepo.existsBy.mockResolvedValueOnce(false); // email free
      administratorRepo.create.mockReturnValue(rootAdmin);
      administratorRepo.save.mockResolvedValue(rootAdmin);

      const result = await service.registerAdministrator(registerInput);

      expect(administratorRepo.existsBy).toHaveBeenCalledWith({
        role: AdministratorRole.ROOT_ADMIN,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerInput.password, 10);
      expect(administratorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-password',
          role: AdministratorRole.ROOT_ADMIN,
        }),
      );
      expect(result).toEqual(rootAdmin);
    });

    it('throws ConflictException when a root admin already exists', async () => {
      administratorRepo.existsBy.mockResolvedValueOnce(true);

      await expect(
        service.registerAdministrator(registerInput),
      ).rejects.toThrow(ConflictException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the email is already taken', async () => {
      administratorRepo.existsBy.mockResolvedValueOnce(false); // no root admin
      administratorRepo.existsBy.mockResolvedValueOnce(true);  // email taken

      await expect(
        service.registerAdministrator(registerInput),
      ).rejects.toThrow(ConflictException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('stores a bcrypt hash, never the plain-text password', async () => {
      administratorRepo.existsBy.mockResolvedValue(false);
      administratorRepo.create.mockReturnValue(rootAdmin);
      administratorRepo.save.mockResolvedValue(rootAdmin);

      await service.registerAdministrator(registerInput);

      const createCall = administratorRepo.create.mock.calls[0][0];
      expect(createCall.password).toBe('hashed-password');
      expect(createCall.password).not.toBe(registerInput.password);
    });
  });

  // -------------------------------------------------------------------------
  // createFacility
  // -------------------------------------------------------------------------

  describe('createFacility', () => {
    it('creates and returns a facility when called by a ROOT_ADMIN', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.existsBy.mockResolvedValue(false);
      facilityRepo.create.mockReturnValue(facility);
      facilityRepo.save.mockResolvedValue(facility);

      const result = await service.createFacility(rootAdmin.id, facilityInput);

      expect(administratorRepo.findOneBy).toHaveBeenCalledWith({
        id: rootAdmin.id,
      });
      expect(facilityRepo.existsBy).toHaveBeenCalledWith({
        name: facilityInput.name,
      });
      expect(result).toEqual(facility);
    });

    it('throws NotFoundException when the calling admin does not exist', async () => {
      administratorRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.createFacility('unknown-id', facilityInput),
      ).rejects.toThrow(NotFoundException);
      expect(facilityRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not ROOT_ADMIN', async () => {
      administratorRepo.findOneBy.mockResolvedValue(facilityAdmin);

      await expect(
        service.createFacility(facilityAdmin.id, facilityInput),
      ).rejects.toThrow(ForbiddenException);
      expect(facilityRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when facility name is already taken', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.existsBy.mockResolvedValue(true);

      await expect(
        service.createFacility(rootAdmin.id, facilityInput),
      ).rejects.toThrow(ConflictException);
      expect(facilityRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // addFacilityAdmin
  // -------------------------------------------------------------------------

  describe('addFacilityAdmin', () => {
    it('creates a FACILITY_ADMIN and emits the notification event', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      administratorRepo.existsBy.mockResolvedValue(false);
      administratorRepo.create.mockReturnValue(facilityAdmin);
      administratorRepo.save.mockResolvedValue(facilityAdmin);

      const result = await service.addFacilityAdmin(
        rootAdmin.id,
        facility.id,
        addAdminInput,
      );

      expect(administratorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-password',
          role: AdministratorRole.FACILITY_ADMIN,
          facilityId: facility.id,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'administrator.facilityAdminCreated',
        expect.objectContaining({
          email: facilityAdmin.email,
          firstName: facilityAdmin.firstName,
          lastName: facilityAdmin.lastName,
          password: addAdminInput.password,
          facilityName: facility.name,
        }),
      );
      expect(result).toEqual(facilityAdmin);
    });

    it('throws NotFoundException when the calling admin does not exist', async () => {
      administratorRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.addFacilityAdmin('unknown-id', facility.id, addAdminInput),
      ).rejects.toThrow(NotFoundException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not ROOT_ADMIN', async () => {
      administratorRepo.findOneBy.mockResolvedValue(facilityAdmin);

      await expect(
        service.addFacilityAdmin(facilityAdmin.id, facility.id, addAdminInput),
      ).rejects.toThrow(ForbiddenException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the facility does not exist', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.addFacilityAdmin(rootAdmin.id, 'unknown-facility', addAdminInput),
      ).rejects.toThrow(NotFoundException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the email is already taken', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      administratorRepo.existsBy.mockResolvedValue(true);

      await expect(
        service.addFacilityAdmin(rootAdmin.id, facility.id, addAdminInput),
      ).rejects.toThrow(ConflictException);
      expect(administratorRepo.save).not.toHaveBeenCalled();
    });

    it('stores a bcrypt hash, never the plain-text password', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      administratorRepo.existsBy.mockResolvedValue(false);
      administratorRepo.create.mockReturnValue(facilityAdmin);
      administratorRepo.save.mockResolvedValue(facilityAdmin);

      await service.addFacilityAdmin(rootAdmin.id, facility.id, addAdminInput);

      const createCall = administratorRepo.create.mock.calls[0][0];
      expect(createCall.password).toBe('hashed-password');
      expect(createCall.password).not.toBe(addAdminInput.password);
    });

    it('does not emit the notification event when save fails', async () => {
      administratorRepo.findOneBy.mockResolvedValue(rootAdmin);
      facilityRepo.findOneBy.mockResolvedValue(facility);
      administratorRepo.existsBy.mockResolvedValue(false);
      administratorRepo.create.mockReturnValue(facilityAdmin);
      administratorRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.addFacilityAdmin(rootAdmin.id, facility.id, addAdminInput),
      ).rejects.toThrow('DB error');
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
