import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Patient } from './entities/patient.entity';
import { FacilityPatient } from './entities/facility-patient.entity';
import { RegisterPatientInput } from './dto/register-patient.input';
import { ListFacilitiesInput } from './dto/list-facilities.input';
import { CreateAppointmentInput } from './dto/create-appointment.input';
import { PaginatedFacilitiesResponse } from './dto/paginated-facilities.type';
import { FacilityService } from '../facility/facility.service';
import { AppointmentService } from '../appointment/appointment.service';
import { AppointmentResponse } from '../appointment/dto/appointment-response.type';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(FacilityPatient)
    private readonly facilityPatientRepo: Repository<FacilityPatient>,
    private readonly facilityService: FacilityService,
    private readonly appointmentService: AppointmentService,
  ) {}

  async registerPatient(input: RegisterPatientInput): Promise<Patient> {
    const emailTaken = await this.patientRepo.existsBy({ email: input.email });
    if (emailTaken) {
      throw new ConflictException('A patient with this email already exists');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(input.dateOfBirth) >= today) {
      throw new Error('dateOfBirth must be a date in the past');
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const patient = this.patientRepo.create({
      ...input,
      password: hashedPassword,
    });

    return this.patientRepo.save(patient);
  }

  listFacilities(input: ListFacilitiesInput): Promise<PaginatedFacilitiesResponse> {
    return this.facilityService.findPaginated(input);
  }

  createAppointment(
    caller: AuthenticatedUser,
    input: CreateAppointmentInput,
  ): Promise<AppointmentResponse> {
    return this.appointmentService.create(caller, input);
  }

  async patientProfile(patientId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOneBy({ id: patientId });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async getPatientStatusAtFacility(
    caller: AuthenticatedUser,
    facilityPatientId: string,
  ): Promise<FacilityPatient> {
    const record = await this.facilityPatientRepo.findOne({
      where: { id: facilityPatientId },
      relations: ['facility', 'patient'],
    });

    if (!record) {
      throw new NotFoundException(
        'No enrollment record found for this facilityPatientId',
      );
    }

    // Patients can only view their own record
    if (caller.role === 'PATIENT' && record.patientId !== caller.id) {
      throw new ForbiddenException('Access denied');
    }

    return record;
  }
}
