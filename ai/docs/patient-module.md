# Patient Module

## Overview

The patient module handles patient account registration and the patient-facing experience — discovering facilities and booking appointments. It is intentionally thin: patient profile data lives here, but facility-patient enrollment data lives in `facility`, and scheduling logic lives in `appointment`. `ListFacilities` and `CreateAppointment` are patient-facing use cases that delegate to those modules internally.

---

## Entities

### `Patient` (`src/patient/entities/patient.entity.ts`)

| Column        | Type                          | Notes                              |
|---------------|-------------------------------|------------------------------------|
| `id`          | uuid (PK)                     | Auto-generated                     |
| `firstName`   | string                        |                                    |
| `lastName`    | string                        |                                    |
| `email`       | string (unique)               |                                    |
| `password`    | string                        | bcrypt hashed, never in GraphQL    |
| `phoneNumber` | string                        | E.164 format                       |
| `dateOfBirth` | date                          | Must be in the past                |
| `gender`      | enum: `MALE \| FEMALE \| OTHER`|                                   |
| `address`     | embedded (`Address`)          | street, city, region, country      |
| `role`        | enum: `PATIENT`               | System-assigned                    |
| `createdAt`   | timestamp                     | Auto-set on insert                 |

### `Address` (`src/patient/entities/address.embedded.ts`)

TypeORM embedded entity stored as prefixed columns (`address_street`, `address_city`, etc.). Exposed as a GraphQL `@ObjectType`.

---

## GraphQL Operations

### `registerPatient(input: RegisterPatientInput): Patient` — Mutation (public)

Creates a new patient account.

**Validation:**
- `email` unique — 409 on duplicate
- `password`: 8+ chars, 1 uppercase, 1 number, 1 special character
- `phoneNumber`: E.164 format
- `dateOfBirth`: ISO8601, must be in the past
- `gender`: `MALE | FEMALE | OTHER`
- `address`: all subfields required

---

### `listFacilities(input: ListFacilitiesInput): PaginatedFacilitiesResponse` — Query (PATIENT)

Returns a paginated list of facilities. Delegates to `FacilityService.findPaginated`.

**Filters (all optional, combined as AND):**

| Field     | Behaviour                                        |
|-----------|--------------------------------------------------|
| `page`    | Defaults to 1                                    |
| `limit`   | Defaults to 10, capped at 50                     |
| `search`  | Case-insensitive partial match on facility `name`|
| `region`  | Exact, case-insensitive match                    |
| `city`    | Exact, case-insensitive match                    |
| `country` | Exact, case-insensitive match                    |

Results are ordered by `name ASC`.

---

### `createAppointment(input: CreateAppointmentInput): AppointmentResponse` — Mutation (PATIENT)

Books an appointment at a facility. Delegates to `AppointmentService.create`.

**Validation:**
- `facilityId` must reference an existing facility — 404 if not found
- `appointmentDate` must be a future date — 400 if today or past
- `appointmentDate` must be within 90 days — 400 if exceeded
- Facility must have available capacity for the date + session type — 409 if full
- Patient may not have an existing PENDING or CONFIRMED appointment at the same facility on the same date — 409 on duplicate
- Appointment created with `status: PENDING`
- **Patient–facility enrollment**: after saving the appointment, a `FacilityPatient` record is upserted (created only if one doesn't already exist for the `patientId + facilityId` pair)
- Emits `appointment.created` event to notification module

---

## FacilityPatient Entity (`src/patient/entities/facility-patient.entity.ts`)

Junction table that records a patient's enrollment at a facility. Created automatically the first time a patient books an appointment at a facility; never created explicitly by the patient. Serves as the anchor for future sub-entities (health info, contact details, session status).

| Column       | Type              | Notes                                 |
|--------------|-------------------|---------------------------------------|
| `id`         | uuid (PK)         | Auto-generated                        |
| `patientId`  | string (FK → Patient) | Unique together with `facilityId` |
| `facilityId` | string (FK → Facility)| Unique together with `patientId`  |
| `enrolledAt` | timestamp         | Auto-set on insert                    |

Unique constraint: `(patientId, facilityId)` — a patient can only have one enrollment record per facility.

---

## Appointment Entity (`src/appointment/entities/appointment.entity.ts`)

| Column            | Type                                           | Notes                  |
|-------------------|------------------------------------------------|------------------------|
| `id`              | uuid (PK)                                      |                        |
| `patientId`       | string (FK → Patient)                          |                        |
| `facilityId`      | string (FK → Facility)                         |                        |
| `appointmentDate` | varchar (ISO8601 date string)                  |                        |
| `sessionType`     | enum: `MORNING \| AFTERNOON \| EVENING`        |                        |
| `status`          | enum: `PENDING \| CONFIRMED \| CANCELLED \| COMPLETED` | Default: `PENDING` |
| `notes`           | string (nullable)                              |                        |
| `createdAt`       | timestamp                                      | Auto-set on insert     |

---

## Appointment Status Reference

| Status      | Description                                   |
|-------------|-----------------------------------------------|
| `PENDING`   | Submitted, awaiting facility confirmation     |
| `CONFIRMED` | Confirmed by facility admin                   |
| `CANCELLED` | Cancelled by patient or facility admin        |
| `COMPLETED` | Session completed                             |

---

## New GraphQL Operations

### `patientProfile: Patient` — Query (PATIENT)

Returns the profile of the authenticated patient. All fields except `password`.

### `getPatientStatusAtFacility(facilityId: String!): FacilityPatient` — Query (PATIENT)

Returns the patient's `FacilityPatient` enrollment record at a specific facility including `status`, `currentDiagnosis`, `diagnosticStatus`, `notes`. Returns 404 if no enrollment exists.

---

## Module Wiring

- `PatientModule` imports `TypeOrmModule.forFeature([Patient, FacilityPatient])`, `FacilityModule`, `AppointmentModule`, `AuthModule`
- `AppointmentModule` imports `TypeOrmModule.forFeature([Appointment, FacilityPatient])`, `FacilityModule`, `PhysicianModule`
- `FacilityModule` exports both `TypeOrmModule` and `FacilityService`
- `AppointmentModule` exports `AppointmentService`

## Module Boundary Design

| Responsibility          | Module        |
|-------------------------|---------------|
| Patient profile         | `patient`     |
| Facility list/search    | `facility`    |
| Appointment scheduling  | `appointment` |
| Notification dispatch   | `notification`|

The patient module is a thin façade — it surfaces patient-facing use cases but owns none of the underlying business logic beyond profile creation.
