# Administrator Module

## Overview

Bootstraps the system with a root admin account, creates facilities, delegates facility management to facility admins, and exposes dashboard analytics and patient management for facility staff.

---

## Entities

### `Administrator` (`src/administrator/entities/administrator.entity.ts`)

| Column               | Type                                  | Notes                                        |
|----------------------|---------------------------------------|----------------------------------------------|
| `id`                 | uuid (PK)                             | Auto-generated                               |
| `firstName`          | string                                |                                              |
| `lastName`           | string                                |                                              |
| `email`              | string (unique)                       |                                              |
| `password`           | string                                | bcrypt hashed, never returned via GraphQL    |
| `phoneNumber`        | string                                | E.164 format                                 |
| `role`               | enum: `ROOT_ADMIN \| FACILITY_ADMIN`  | System-assigned                              |
| `facilityId`         | uuid (FK, nullable)                   | Null for ROOT_ADMIN                          |
| `twoFactorEnabled`   | boolean (default false)               | Whether 2FA is active                        |
| `twoFactorMethod`    | varchar (nullable)                    | `'EMAIL'` \| `'PHONE'` \| `'TOTP'`          |
| `twoFactorSecret`    | varchar (nullable)                    | Base32 TOTP secret — never in GraphQL output |
| `createdAt`          | timestamp                             | Auto-set on insert                           |

### `Facility` (`src/facility/entities/facility.entity.ts`)

| Column       | Type           | Notes              |
|--------------|----------------|--------------------|
| `id`         | uuid (PK)      |                    |
| `name`       | string (unique)|                    |
| `address`    | string         |                    |
| `city`       | string         |                    |
| `region`     | string         |                    |
| `country`    | string         |                    |
| `phoneNumber`| string         | E.164 format       |
| `email`      | string         |                    |
| `capacity`   | integer        | Slots per session  |
| `createdAt`  | timestamp      |                    |

---

## GraphQL Operations

### `registerAdministrator(input: RegisterAdministratorInput): Administrator` — Mutation (public)

Creates the first ROOT_ADMIN. Returns 409 if one already exists.

---

### `createFacility(input: CreateFacilityInput): Facility` — Mutation (ROOT_ADMIN)

Creates a new facility. `name` must be unique (409 on duplicate).

---

### `addFacilityAdmin(facilityId: String!, input: AddFacilityAdminInput): Administrator` — Mutation (ROOT_ADMIN)

Creates a FACILITY_ADMIN and assigns them to a facility. Emits `administrator.facilityAdminCreated` event.

---

### `adminProfile: Administrator` — Query (any admin)

Returns the profile of the currently authenticated administrator.

---

### `getStats: StatsResponse` — Query (ROOT_ADMIN | FACILITY_ADMIN)

Returns appointment counts for the current calendar month and percentage change vs the previous month.

**Scoping:** ROOT_ADMIN sees all facilities; FACILITY_ADMIN sees only their facility.

**Response:**
```
{
  totalAppointments:     { count: Int, changePercent: Float }
  completedAppointments: { count: Int, changePercent: Float }
  pendingAppointments:   { count: Int, changePercent: Float }
  noShowAppointments:    { count: Int, changePercent: Float }
}
```

`changePercent` is positive for an increase and negative for a decrease. If the previous month had 0, returns 100 when current > 0.

---

### `listFacilityPatients(input: ListFacilityPatientsInput): PaginatedFacilityPatientsResponse` — Query (ROOT_ADMIN | FACILITY_ADMIN)

Returns enrolled patients at a facility with their FacilityPatient records.

**Input:** `facilityId` (required), `page`, `limit`, `search`, `status`

**Scoping:** FACILITY_ADMIN can only query their own facilityId — 403 otherwise.

---

## Module Wiring

- `AdministratorModule` imports `TypeOrmModule.forFeature([Administrator, Appointment, FacilityPatient])`, `FacilityModule`, `AuthModule`
- `FacilityModule` exports `TypeOrmModule` and `FacilityService`
- `EventEmitterModule.forRoot()` registered globally in `AppModule`

---

## Roles Reference

| Role             | Created via              | Access                            |
|------------------|--------------------------|-----------------------------------|
| `ROOT_ADMIN`     | `registerAdministrator`  | Full system access                |
| `FACILITY_ADMIN` | `addFacilityAdmin`       | Scoped to their assigned facility |
