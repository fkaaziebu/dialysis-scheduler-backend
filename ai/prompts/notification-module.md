# Notification Module

## Overview
The notification module stores and serves in-app notifications for both patients and administrators. It listens to domain events emitted by other modules and persists a notification record for each. It also exposes a query endpoint so any authenticated user can retrieve their own notifications.

---

## Features

---

### 1. `ListNotifications` — Paginated Notification List

**Description**
Returns a paginated list of notifications belonging to the authenticated user.

**Authorization:** Any authenticated user (JWT required).

**Filters (all optional):**
| Filter   | Behaviour                                             |
|----------|-------------------------------------------------------|
| `search` | Case-insensitive match on notification title or message |
| `type`   | Exact match on NotificationType enum                  |
| `read`   | Boolean — filter by read/unread status                |

**Pagination:** page (default 1), limit (default 10, max 50). Results ordered by createdAt DESC (newest first).

---

## Event Listeners

The NotificationService listens to the following events emitted via EventEmitter2:

| Event                              | Notification Created For |
|------------------------------------|--------------------------|
| `appointment.created`              | Patient — appointment booked confirmation |
| `appointment.statusUpdated`        | Patient — status change (CONFIRMED, CANCELLED, COMPLETED, NO_SHOW) |
| `administrator.facilityAdminCreated` | System log notification (audit trail) |

---

## Notification Types Reference

| Type                        | Triggered By                             |
|-----------------------------|------------------------------------------|
| `APPOINTMENT_CREATED`       | Patient books an appointment             |
| `APPOINTMENT_CONFIRMED`     | Admin confirms an appointment            |
| `APPOINTMENT_CANCELLED`     | Admin or patient cancels                 |
| `APPOINTMENT_COMPLETED`     | Admin marks appointment completed        |
| `APPOINTMENT_NO_SHOW`       | Admin marks patient as no-show           |
| `FACILITY_ADMIN_CREATED`    | Root admin creates a facility admin      |
| `TWO_FACTOR_OTP`            | 2FA OTP sent during login or setup       |
| `PASSWORD_RESET`            | Password reset requested                 |

---

## Module Wiring

- `NotificationModule` imports `TypeOrmModule.forFeature([Notification])` and `AuthModule` (for guards)
- `EventEmitterModule.forRoot()` is registered globally in `AppModule` — no explicit import needed
- `NotificationModule` does not export anything (self-contained)
