# Notification Module

## Overview

Stores in-app notifications for patients and administrators. Driven entirely by events — no module calls `NotificationService` directly. Exposes a single paginated query so users can retrieve their own notifications.

---

## Entity

### `Notification` (`src/notification/entities/notification.entity.ts`)

| Column     | Type                    | Notes                                     |
|------------|-------------------------|-------------------------------------------|
| `id`       | uuid (PK)               |                                           |
| `userId`   | string                  | ID of the owning patient or administrator |
| `userType` | string                  | `'patient'` or `'administrator'`          |
| `title`    | string                  |                                           |
| `message`  | text                    |                                           |
| `type`     | enum: `NotificationType`|                                           |
| `read`     | boolean (default false) |                                           |
| `createdAt`| timestamp               | Auto-set on insert                        |

### NotificationType Enum

| Value                     | Description                              |
|---------------------------|------------------------------------------|
| `APPOINTMENT_CREATED`     | Patient booked an appointment            |
| `APPOINTMENT_CONFIRMED`   | Appointment confirmed by admin           |
| `APPOINTMENT_CANCELLED`   | Appointment cancelled                    |
| `APPOINTMENT_COMPLETED`   | Appointment completed                    |
| `APPOINTMENT_NO_SHOW`     | Patient marked as no-show               |
| `FACILITY_ADMIN_CREATED`  | New facility admin account created       |
| `TWO_FACTOR_OTP`          | 2FA OTP sent (future: when email delivery is wired) |
| `PASSWORD_RESET`          | Password reset OTP sent (future)         |

---

## GraphQL Operations

### `listNotifications(input: ListNotificationsInput): PaginatedNotificationsResponse` — Query (authenticated)

Returns the calling user's notifications, newest first.

**Filters:**
| Field    | Behaviour                                                     |
|----------|---------------------------------------------------------------|
| `search` | Case-insensitive match on `title` or `message`                |
| `type`   | Exact match on `NotificationType` enum                        |
| `read`   | Boolean — filter by read/unread status                        |

**Pagination:** page (default 1), limit (default 10, max 50).

---

## Event Listeners

| Event                                | Action                                                           |
|--------------------------------------|------------------------------------------------------------------|
| `appointment.created`                | Creates APPOINTMENT_CREATED notification for the patient         |
| `appointment.statusUpdated`          | Creates appropriate status notification for the patient          |
| `administrator.facilityAdminCreated` | Creates FACILITY_ADMIN_CREATED notification (audit log)          |

---

## Module Wiring

- `NotificationModule` imports `TypeOrmModule.forFeature([Notification])` and `AuthModule` (for JwtAuthGuard in resolver)
- Uses `@OnEvent()` decorators from `@nestjs/event-emitter` — no explicit injection of other services needed
