# Patient Module

## Overview
The patient module handles patient account registration and the patient-facing experience — discovering facilities and booking appointments. It is intentionally kept thin: patient profile data lives here, but patient-facility enrollment data lives in the `facility` module, and appointment scheduling logic lives in the `appointment` module. The `ListFacilities` and `CreateAppointment` features are surfaced here as patient-facing use cases that delegate to those modules internally.

---

## Features

---

### 1. `RegisterPatient` — Create a Patient Account

**Description**
Allows a new patient to create an account in the system. Once registered, the patient can log in via the `auth` module, browse facilities, and book appointments.

**Endpoint**
```
POST /patients/register
```

**Request Body**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "phoneNumber": "string",
  "dateOfBirth": "string (ISO8601 date, e.g. 1990-04-12)",
  "gender": "MALE | FEMALE | OTHER",
  "address": {
    "street": "string",
    "city": "string",
    "region": "string",
    "country": "string"
  }
}
```

**Response — `201 Created`**
```json
{
  "id": "uuid",
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "phoneNumber": "string",
  "dateOfBirth": "ISO8601 date",
  "gender": "MALE | FEMALE | OTHER",
  "address": {
    "street": "string",
    "city": "string",
    "region": "string",
    "country": "string"
  },
  "createdAt": "ISO8601 timestamp"
}
```

**Business Rules & Validations**
- `email` must be unique across all patient accounts. Duplicate email returns `409 Conflict`.
- `email` must be a valid email format.
- `password` must be at least 8 characters, include one uppercase letter, one number, and one special character.
- `phoneNumber` must be a valid E.164 format.
- `dateOfBirth` must be a valid date in the past. Future dates return `400 Bad Request`.
- `gender` must be one of the accepted enum values.
- Password must be hashed (bcrypt) before persistence — never stored in plain text.
- The `role` is system-assigned as `PATIENT` and is not accepted from the caller.

---

### 2. `ListFacilities` — Browse Available Facilities

**Description**
Returns a paginated list of dialysis facilities available in the system. Patients can filter by location attributes and search by facility name to find a facility that suits them before booking an appointment.

**Endpoint**
```
GET /patients/facilities
```

**Authorization**
Requires a valid JWT with role `PATIENT`.

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `page` | number | No | Page number. Defaults to `1`. |
| `limit` | number | No | Results per page. Defaults to `10`. Max `50`. |
| `search` | string | No | Search by facility name (partial, case-insensitive). |
| `region` | string | No | Filter by region. |
| `city` | string | No | Filter by city. |
| `country` | string | No | Filter by country. |

**Example Request**
```
GET /patients/facilities?page=1&limit=10&region=Greater+Accra&search=kidney
```

**Response — `200 OK`**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "address": "string",
      "city": "string",
      "region": "string",
      "country": "string",
      "phoneNumber": "string",
      "email": "string",
      "capacity": "number"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

**Business Rules & Validations**
- `page` must be a positive integer. Defaults to `1` if not provided or invalid.
- `limit` must be between `1` and `50`. If a value above `50` is supplied, cap it at `50`.
- `search` performs a case-insensitive partial match on the facility `name` field.
- Filters (`region`, `city`, `country`) are applied as exact, case-insensitive matches.
- Multiple filters can be combined — they are applied as `AND` conditions.
- Only active facilities are returned. Deactivated facilities are excluded.
- Results are ordered by facility `name` ascending by default.

---

### 3. `CreateAppointment` — Book an Appointment at a Facility

**Description**
Allows an authenticated patient to create an appointment at a specific facility. The patient specifies the facility, preferred date, and session type. The facility must exist and have available capacity on the requested date for the appointment to be accepted.

**Endpoint**
```
POST /patients/appointments
```

**Authorization**
Requires a valid JWT with role `PATIENT`.

**Request Body**
```json
{
  "facilityId": "uuid",
  "appointmentDate": "string (ISO8601 date, e.g. 2026-04-20)",
  "sessionType": "MORNING | AFTERNOON | EVENING",
  "notes": "string (optional)"
}
```

**Response — `201 Created`**
```json
{
  "id": "uuid",
  "patientId": "uuid",
  "facilityId": "uuid",
  "facilityName": "string",
  "appointmentDate": "ISO8601 date",
  "sessionType": "MORNING | AFTERNOON | EVENING",
  "status": "PENDING",
  "notes": "string | null",
  "createdAt": "ISO8601 timestamp"
}
```

**Business Rules & Validations**
- `facilityId` must reference an existing, active facility. If not found or inactive, return `404 Not Found`.
- `appointmentDate` must be a future date. Past or present dates return `400 Bad Request`.
- `appointmentDate` cannot be more than 90 days in the future. Return `400 Bad Request` if exceeded.
- `sessionType` must be one of the accepted enum values.
- The facility must have available capacity for the requested `appointmentDate` and `sessionType`. If fully booked, return `409 Conflict` with a message indicating no availability.
- A patient may not have more than one `PENDING` or `CONFIRMED` appointment at the same facility on the same date. Duplicate booking returns `409 Conflict`.
- Appointment is created with an initial `status` of `PENDING`.
- On successful creation, an event is emitted to the `notification` module to notify the patient (email/SMS) that their appointment is pending confirmation.

---

---

### 4. `PatientProfile` — Get Logged-In Patient Profile

**Description**
Returns the full profile of the currently authenticated patient.

**Authorization:** PATIENT role required.

**Response fields:** id, firstName, lastName, email, phoneNumber, dateOfBirth, gender, address, role, createdAt.

---

### 5. `GetPatientStatusAtFacility` — Patient's Status at a Facility

**Description**
Returns the patient's `FacilityPatient` enrollment record for a specific facility, including their clinical status and diagnostic information.

**Authorization:** PATIENT role required.

**Input:** `facilityId` (UUID as a GraphQL argument)

**Response fields:** id, patientId, facilityId, status, currentDiagnosis, diagnosticStatus, notes, enrolledAt, facility (related Facility object).

**Business Rules:**
- Returns 404 if no enrollment record exists for this patient at the given facility.
- A patient's enrollment record is automatically created when they first book an appointment at that facility.
- Diagnostic fields (currentDiagnosis, diagnosticStatus, notes) are managed by facility staff — patients can view but not edit them.

---

## FacilityPatient Status Reference

| Status       | Description                                    |
|--------------|------------------------------------------------|
| `ACTIVE`     | Currently receiving treatment at the facility  |
| `INACTIVE`   | Enrolled but not currently active              |
| `DISCHARGED` | Discharged from the facility                   |

---

## Appointment Status Reference

| Status    | Description                                    |
|-----------|------------------------------------------------|
| `PENDING` | Appointment submitted, awaiting confirmation   |
| `CONFIRMED` | Confirmed by the facility admin              |
| `CANCELLED` | Cancelled by patient or facility admin       |
| `COMPLETED` | Session has been completed                   |
| `NO_SHOW` | Patient did not attend                         |

---

## Notes on Module Boundaries

- **`ListFacilities`** delegates to the `facility` module. The patient module does not own `Facility`.
- **`CreateAppointment`** delegates to the `appointment` module. Scheduling, capacity, and status logic stays in `appointment`.
- **`GetPatientStatusAtFacility`** reads from `FacilityPatient` which is also owned conceptually by the patient domain but written to by `AppointmentModule` on first booking.
