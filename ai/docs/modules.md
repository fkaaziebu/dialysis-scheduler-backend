# Backend Modules

## Overview

The application is split into 7 domain modules, each with a single clear responsibility. All modules are imported in `app.module.ts`.

---

## Module Map

| Module          | Core Responsibility                                              |
|-----------------|------------------------------------------------------------------|
| `auth`          | Login, JWT, guards                                               |
| `administrator` | Admin accounts, root/sub hierarchy                               |
| `facility`      | Facility CRUD, patient-facility enrollment & health data         |
| `physician`     | Physician/technician accounts, facility assignment               |
| `patient`       | Patient accounts and core profile                                |
| `appointment`   | Scheduling, walk-ins, status transitions                         |
| `notification`  | Event-driven message dispatch (no resolver — BullMQ/EventEmitter)|

---

## Module Details

### `auth`

Handles JWT/session logic, guards, token refresh, two-factor authentication, password reset flows, and OAuth 2.0 login via Google. Both admins and patients authenticate through here — authentication logic is not duplicated in `administrator` or `patient`.

**Files:**
- `auth.module.ts`
- `auth.service.ts`
- `auth.resolver.ts`
- `entities/` — `RefreshToken`, `TwoFactorToken`, `PasswordResetToken`
- `dto/` — login, 2FA, password reset, and OAuth types

**See also:** [OAuth 2.0 Integration](./oauth.md)

---

### `administrator`

Manages admin account creation (root admin seeding, admin-by-admin creation), role assignment, and the admin↔facility relationship.

**Files:**
- `administrator.module.ts`
- `administrator.service.ts`
- `administrator.resolver.ts`
- `entities/` — `Administrator` entity, root/sub-admin hierarchy
- `dto/` — create/update admin inputs

---

### `facility`

Manages facility CRUD and everything scoped to a facility. The join entities `PatientFacilityStatus`, `PatientFacilityHealthInfo`, and `PatientFacilityContact` live here because they describe a *patient's relationship with a facility*, not the patient in isolation.

**Files:**
- `facility.module.ts`
- `facility.service.ts`
- `facility.resolver.ts`
- `entities/` — `Facility`, `PatientFacilityStatus`, `PatientFacilityHealthInfo`, `PatientFacilityContact`
- `dto/` — create/update facility and enrollment inputs

---

### `physician`

Manages physician and technician accounts. The `FacilityPhysician` join entity belongs here since it describes physician assignment to a facility.

**Files:**
- `physician.module.ts`
- `physician.service.ts`
- `physician.resolver.ts`
- `entities/` — `Physician`, `FacilityPhysician`
- `dto/` — create/update physician inputs

---

### `patient`

Manages patient account creation and core patient profile. Intentionally thin — patient-facility data lives in `facility`, not here.

**Files:**
- `patient.module.ts`
- `patient.service.ts`
- `patient.resolver.ts`
- `entities/` — `Patient`
- `dto/` — create/update patient inputs

---

### `appointment`

Handles appointment creation (patient-initiated and admin walk-in), scheduling logic, status transitions, and appointment queries. Depends on `patient`, `facility`, and `physician`.

**Files:**
- `appointment.module.ts`
- `appointment.service.ts`
- `appointment.resolver.ts`
- `entities/` — `Appointment`
- `dto/` — create/update appointment inputs

---

### `notification`

Dispatches notifications (SMS, email, in-app). Other modules emit events; this module listens and sends. No GraphQL resolver — fully decoupled from business logic via BullMQ or `EventEmitter2`.

**Pattern:** `appointment` emits `appointment.created` → `notification` handles it. Neither module imports the other directly.

**Files:**
- `notification.module.ts`
- `notification.service.ts`
- `entities/` — notification log if persisted
- `dto/` — internal event payload types

---

## File Structure

```
src/
├── auth/
│   ├── dto/
│   ├── entities/
│   ├── auth.module.ts
│   ├── auth.resolver.ts
│   └── auth.service.ts
├── administrator/
│   ├── dto/
│   ├── entities/
│   ├── administrator.module.ts
│   ├── administrator.resolver.ts
│   └── administrator.service.ts
├── facility/
│   ├── dto/
│   ├── entities/
│   ├── facility.module.ts
│   ├── facility.resolver.ts
│   └── facility.service.ts
├── physician/
│   ├── dto/
│   ├── entities/
│   ├── physician.module.ts
│   ├── physician.resolver.ts
│   └── physician.service.ts
├── patient/
│   ├── dto/
│   ├── entities/
│   ├── patient.module.ts
│   ├── patient.resolver.ts
│   └── patient.service.ts
├── appointment/
│   ├── dto/
│   ├── entities/
│   ├── appointment.module.ts
│   ├── appointment.resolver.ts
│   └── appointment.service.ts
└── notification/
    ├── dto/
    ├── entities/
    ├── notification.module.ts
    └── notification.service.ts
```
