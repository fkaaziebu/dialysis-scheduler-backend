# Appointment Module

## Overview

Owns the full appointment lifecycle — scheduling, status transitions, physician assignment, and analytics queries. Patient-facing booking is surfaced through `PatientModule` which delegates to `AppointmentService`.

---

## Entities

### `Appointment` (`src/appointment/entities/appointment.entity.ts`)

| Column            | Type                                                          | Notes                           |
|-------------------|---------------------------------------------------------------|---------------------------------|
| `id`              | uuid (PK)                                                     |                                 |
| `patientId`       | string (FK → Patient)                                         |                                 |
| `facilityId`      | string (FK → Facility)                                        |                                 |
| `appointmentDate` | varchar (YYYY-MM-DD)                                          |                                 |
| `sessionType`     | enum: `MORNING \| AFTERNOON \| EVENING`                       |                                 |
| `status`          | enum: `PENDING \| CONFIRMED \| CANCELLED \| COMPLETED \| NO_SHOW` | Default: PENDING            |
| `notes`           | varchar (nullable)                                            | Set by admin on cancel/complete |
| `physicianId`     | varchar (nullable FK → Physician)                             | Set by AssignPhysicianToAppointment |
| `createdAt`       | timestamp                                                     | Auto-set on insert              |

### `Physician` (`src/physician/entities/physician.entity.ts`)

| Column          | Type          | Notes          |
|-----------------|---------------|----------------|
| `id`            | uuid (PK)     |                |
| `firstName`     | string        |                |
| `lastName`      | string        |                |
| `email`         | string (unique)|               |
| `phoneNumber`   | string        |                |
| `specialization`| string        |                |
| `createdAt`     | timestamp     |                |

### `FacilityPhysician` (`src/physician/entities/facility-physician.entity.ts`)

Junction table linking physicians to facilities.

| Column        | Type                  | Notes                                    |
|---------------|-----------------------|------------------------------------------|
| `id`          | uuid (PK)             |                                          |
| `physicianId` | string (FK → Physician)| Unique with facilityId                  |
| `facilityId`  | string (FK → Facility) | Unique with physicianId                 |
| `startDate`   | varchar (nullable)    | ISO date when physician joined facility  |
| `createdAt`   | timestamp             |                                          |

---

## GraphQL Operations

### `getAppointment(id: String!): Appointment` — Query (authenticated)

Returns full appointment with `patient`, `facility`, and `physician` relations loaded.

**Access control:**
- PATIENT: own appointments only — 403 for others.
- FACILITY_ADMIN / ROOT_ADMIN: any appointment.

---

### `listAppointments(input: ListAppointmentsInput): PaginatedAppointmentsResponse` — Query (authenticated)

Paginated, filterable appointment list.

**Filters:** `status`, `sessionType`, `facilityId`, `patientId`, `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `sortOrder` (ASC|DESC, default DESC).

**Scoping:** PATIENT → own; FACILITY_ADMIN → their facility; ROOT_ADMIN → all.

**Pagination:** page (default 1), limit (default 10, max 50).

---

### `getAppointmentStats(input: GetAppointmentStatsInput): AppointmentStatsResponse` — Query (ROOT_ADMIN | FACILITY_ADMIN)

Returns per-month appointment counts for a date range.

**Input:** `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `facilityId?`

**Output:** `{ data: [{ month: "YYYY-MM", count: Int }] }`

Months with zero appointments are omitted.

---

### `updateAppointmentStatus(input: UpdateAppointmentStatusInput): Appointment` — Mutation (ROOT_ADMIN | FACILITY_ADMIN)

Transitions an appointment to a new status.

**Input:** `appointmentId`, `status`, `message?` (stored as notes on COMPLETED/CANCELLED).

Emits `appointment.statusUpdated` event consumed by NotificationService.

---

### `assignPhysicianToAppointment(input: AssignPhysicianInput): Appointment` — Mutation (ROOT_ADMIN | FACILITY_ADMIN)

Links a physician to an appointment.

**Input:** `appointmentId`, `physicianId`. Both must exist — 404 otherwise.

---

## Module Wiring

- `AppointmentModule` imports `TypeOrmModule.forFeature([Appointment, FacilityPatient])`, `FacilityModule`, `PhysicianModule`
- `PhysicianModule` exports `TypeOrmModule` (so PhysicianRepo is injectable) and `PhysicianService`
- `AppointmentModule` exports `AppointmentService` (imported by PatientModule)
