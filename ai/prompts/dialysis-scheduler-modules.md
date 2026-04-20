# Dialysis Scheduler — Backend Modules

## Suggested Modules

### `auth`
Handles JWT/session logic, guards, and token refresh. Keeps authentication concerns out of both `administrator` and `patient`. Both user types authenticate through here.

### `administrator`
Manages admin account creation (root admin seeding, admin-by-admin creation), role assignment, and the admin↔facility relationship. The `Administrator` entity and the root/sub-admin hierarchy live here.

### `facility`
Manages facility CRUD and everything scoped to a facility. This is where the join entities — `PatientFacilityStatus`, `PatientFacilityHealthInfo`, and `PatientFacilityContact` — belong, since they describe a *patient's relationship with a facility*, not the patient in isolation.

### `physician`
Manages physician and technician accounts. The `FacilityPhysician` join entity belongs here since it describes physician assignment to a facility.

### `patient`
Manages patient account creation and core patient profile. Intentionally kept thin — patient-facility data lives in `facility`, not here.

### `appointment`
Handles appointment creation (patient-initiated and admin walk-in), scheduling logic, status transitions, and appointment queries. Depends on `patient`, `facility`, and `physician`.

### `notification`
Handles dispatching notifications (SMS, email, in-app). Other modules emit events; this module listens and sends. Keeps delivery logic fully decoupled from business logic.

---

## Key Design Decisions

**Join entities go in `facility`, not `patient`**
The join entities (`PatientFacilityStatus`, `PatientFacilityHealthInfo`, `PatientFacilityContact`) are tempting to put in `patient`, but they describe *enrollment and clinical context at a specific facility* — so they belong in `facility`. This way the `patient` module stays a clean identity/profile concern.

**`auth` as its own module**
Both admins and patients authenticate, and you don't want login logic duplicated or bleeding into either domain module.

**`notification` should be event-driven**
Use NestJS `EventEmitter2` or a queue via BullMQ. For example, `appointment` emits `appointment.created` and `notification` handles it — neither module knows about the other directly.

---

## Module Summary

| Module | Core Responsibility |
|---|---|
| `auth` | Login, JWT, guards |
| `administrator` | Admin accounts, root/sub hierarchy |
| `facility` | Facility CRUD, patient-facility enrollment & health data |
| `physician` | Physician/technician accounts, facility assignment |
| `patient` | Patient accounts and core profile |
| `appointment` | Scheduling, walk-ins, status transitions |
| `notification` | Event-driven message dispatch |
