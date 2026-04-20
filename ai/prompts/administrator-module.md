# Administrator Module

## Overview
The administrator module is responsible for bootstrapping the system with a root admin account, creating and managing facilities, delegating facility management to other administrators, and exposing dashboard analytics. It forms the top of the administrative hierarchy in the dialysis scheduler.

---

## Features

---

### 1. `RegisterAdministrator` — Root Admin Registration

**Description**
Creates the first administrator account in the system with the `ROOT_ADMIN` role. Subsequent calls are rejected if a root admin already exists.

**Authorization:** Public (no token required)

**Business Rules & Validations**
- Only one root admin may exist — 409 if one already exists.
- `email` must be unique — 409 on duplicate.
- `password`: min 8 chars, 1 uppercase, 1 number, 1 special character.
- `phoneNumber`: E.164 format.
- Password stored as bcrypt hash.

---

### 2. `CreateFacility` — Create a Dialysis Facility

**Authorization:** ROOT_ADMIN role required.

**Business Rules & Validations**
- `name` must be unique — 409 on duplicate.
- `capacity` must be a positive integer > 0.

---

### 3. `AddFacilityAdmin` — Assign an Administrator to a Facility

**Authorization:** ROOT_ADMIN role required.

**Business Rules & Validations**
- `facilityId` must reference an existing facility — 404 if not found.
- `email` must be unique — 409 on duplicate.
- Password stored as bcrypt hash.
- Emits `administrator.facilityAdminCreated` event for notification module.

---

### 4. `AdminProfile` — Get Logged-In Admin Profile

**Description**
Returns the full profile of the currently authenticated administrator.

**Authorization:** Any authenticated admin (JWT required).

**Response fields:** id, firstName, lastName, email, phoneNumber, role, facilityId, twoFactorEnabled, twoFactorMethod, createdAt.

---

### 5. `GetStats` — Dashboard Statistics

**Description**
Returns appointment counts for the current calendar month alongside a percentage change compared to the previous month. Provides four stat categories: total, completed, pending, and no-show appointments.

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Scoping:**
- ROOT_ADMIN: sees stats across all facilities.
- FACILITY_ADMIN: sees stats scoped to their assigned facility.

**Response shape:**
```
{
  totalAppointments:     { count: Int, changePercent: Float }
  completedAppointments: { count: Int, changePercent: Float }
  pendingAppointments:   { count: Int, changePercent: Float }
  noShowAppointments:    { count: Int, changePercent: Float }
}
```

**Business Rules:**
- `changePercent` is positive for an increase, negative for a decrease.
- If last month had 0 appointments: changePercent = 100 when current > 0, else 0.
- "This month" = from the 1st of the current calendar month to today.
- "Last month" = full previous calendar month (1st through last day).

---

### 6. `ListFacilityPatients` — Paginated Patient List for a Facility

**Description**
Returns a paginated list of patients enrolled at a specific facility, including their FacilityPatient status and diagnostic information.

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Scoping:**
- ROOT_ADMIN: can query any facilityId.
- FACILITY_ADMIN: can only query their own facilityId — 403 otherwise.

**Filters (all optional):**
| Filter   | Behaviour                                               |
|----------|---------------------------------------------------------|
| `search` | Case-insensitive match on patient firstName, lastName, or email |
| `status` | Exact match on FacilityPatientStatus enum (ACTIVE, INACTIVE, DISCHARGED) |

**Pagination:** page (default 1), limit (default 10, max 50). Results ordered by enrolledAt DESC.

---

## Roles Reference

| Role             | Created via              | Access                                  |
|------------------|--------------------------|-----------------------------------------|
| `ROOT_ADMIN`     | `registerAdministrator`  | Full system access                      |
| `FACILITY_ADMIN` | `addFacilityAdmin`       | Scoped to their assigned facility       |
