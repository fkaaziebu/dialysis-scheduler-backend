# Appointment Module

## Overview
The appointment module owns all appointment lifecycle logic. It is consumed by PatientModule (booking) and exposed directly via its own resolver for admin operations (stats, listing, status updates, physician assignment).

---

## Features

---

### 1. `GetAppointment` — Retrieve a Single Appointment

**Description**
Returns full appointment details including the related patient, facility, and assigned physician (if any).

**Authorization:** Any authenticated user.

**Business Rules:**
- PATIENT: can only view their own appointment — 403 for others.
- FACILITY_ADMIN / ROOT_ADMIN: can view any appointment.
- Returns 404 if the appointment ID does not exist.

---

### 2. `ListAppointments` — Paginated Appointment List

**Description**
Returns a paginated, filterable list of appointments.

**Authorization:** Any authenticated user.

**Scoping:**
- PATIENT: always scoped to their own appointments (`patientId` filter ignored).
- FACILITY_ADMIN: scoped to their facility (can provide optional `facilityId` to confirm).
- ROOT_ADMIN: sees all (can filter by `facilityId` or `patientId`).

**Filters (all optional):**
| Filter        | Behaviour                                    |
|---------------|----------------------------------------------|
| `status`      | AppointmentStatus enum                       |
| `sessionType` | SessionType enum                             |
| `facilityId`  | UUID — exact match                           |
| `patientId`   | UUID — admin use only                        |
| `from`        | ISO date (YYYY-MM-DD), inclusive lower bound |
| `to`          | ISO date (YYYY-MM-DD), inclusive upper bound |
| `sortOrder`   | "ASC" or "DESC" (default "DESC" — latest first) |

**Pagination:** page (default 1), limit (default 10, max 50).

---

### 3. `GetAppointmentStats` — Time-Range Monthly Counts

**Description**
Returns the count of appointments grouped by calendar month for a specified date range. Useful for rendering bar/line charts on the admin dashboard.

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:**
- `from`: ISO date (start of range, inclusive)
- `to`: ISO date (end of range, inclusive)
- `facilityId` (optional): scope to a specific facility (ROOT_ADMIN only)

**Response shape:**
```
{
  data: [
    { month: "2024-11", count: 42 },
    { month: "2024-12", count: 38 },
    ...
  ]
}
```

**Business Rules:**
- Months with zero appointments are not included in the response (use the client to fill gaps).
- FACILITY_ADMIN without an explicit facilityId is implicitly scoped to their facility.

---

### 4. `UpdateAppointmentStatus` — Change Appointment Status

**Description**
Allows facility staff to move an appointment through its lifecycle states.

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:**
- `appointmentId`: UUID
- `status`: AppointmentStatus enum (PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW)
- `message` (optional): notes/reason, strongly recommended when status is CANCELLED or COMPLETED

**Business Rules:**
- Returns 404 if the appointment is not found.
- When `message` is provided and status is COMPLETED or CANCELLED, the value is stored in the appointment's `notes` field.
- Emits `appointment.statusUpdated` event for the notification module to inform the patient.

---

### 5. `AssignPhysicianToAppointment` — Link a Physician

**Description**
Assigns a physician to a specific appointment.

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:**
- `appointmentId`: UUID
- `physicianId`: UUID

**Business Rules:**
- Returns 404 if the appointment or physician is not found.
- Replaces any previously assigned physician.
- Does not require the physician to be linked to the same facility (no cross-facility validation at this time).

---

## Appointment Status Reference

| Status      | Description                                   |
|-------------|-----------------------------------------------|
| `PENDING`   | Submitted, awaiting facility confirmation     |
| `CONFIRMED` | Confirmed by facility admin                   |
| `CANCELLED` | Cancelled by patient or facility admin        |
| `COMPLETED` | Session completed                             |
| `NO_SHOW`   | Patient did not attend                        |

---

## Appointment Entity additions (vs initial scaffold)

- `physicianId` (varchar, nullable FK → Physician) — populated by AssignPhysicianToAppointment
- `NO_SHOW` added to the AppointmentStatus enum

---

## Module Wiring

- `AppointmentModule` imports `TypeOrmModule.forFeature([Appointment, FacilityPatient])`, `FacilityModule`, `PhysicianModule`
- `AppointmentModule` exports `AppointmentService` (consumed by PatientModule)
