# Auth Module

## Overview

The auth module is the single entry point for authentication across the entire system. Both administrators and patients authenticate through here. It issues JWTs, handles token refresh, provides guards for all other modules, manages server-side refresh token storage, enforces two-factor authentication for administrator accounts, supports password reset flows, and provides OAuth 2.0 login via Google.

---

## Entities

### `RefreshToken` (`src/auth/entities/refresh-token.entity.ts`)

| Column      | Type                     | Notes                                                    |
|-------------|--------------------------|----------------------------------------------------------|
| `id`        | uuid (PK)                | Auto-generated                                           |
| `userId`    | string                   | ID of the owning administrator or patient                |
| `userType`  | string                   | `'administrator'` or `'patient'`                         |
| `jti`       | string (unique, indexed) | JWT ID — included in token payload for O(1) lookup       |
| `tokenHash` | string                   | bcrypt hash of the raw refresh token                     |
| `expiresAt` | timestamp                | 7 days from issuance                                     |
| `createdAt` | timestamp                | Auto-set on insert                                       |

### `TwoFactorToken` (`src/auth/entities/two-factor-token.entity.ts`)

Stores pending OTP hashes for EMAIL and PHONE 2FA methods. Not used for TOTP (time-based).

| Column     | Type             | Notes                            |
|------------|------------------|----------------------------------|
| `id`       | uuid (PK)        |                                  |
| `adminId`  | string (indexed) | ID of the administrator          |
| `codeHash` | string           | SHA-256 hash of the 6-digit OTP  |
| `expiresAt`| timestamp        | 10 minutes from creation         |
| `createdAt`| timestamp        |                                  |

### `PasswordResetToken` (`src/auth/entities/password-reset-token.entity.ts`)

Stores pending password reset token hashes for administrators and patients.

| Column      | Type             | Notes                                          |
|-------------|------------------|------------------------------------------------|
| `id`        | uuid (PK)        |                                                |
| `userId`    | string (indexed) | ID of the administrator or patient             |
| `userType`  | string           | `'administrator'` or `'patient'`               |
| `tokenHash` | string           | SHA-256 hash of the raw reset token            |
| `expiresAt` | timestamp        | 1 hour from creation                           |
| `createdAt` | timestamp        |                                                |

Only one reset token may exist per user at a time — previous tokens are deleted when a new request is made. Tokens are deleted after use.

---

## JWT Payload

```json
{
  "sub": "uuid",
  "role": "ROOT_ADMIN | FACILITY_ADMIN | PATIENT",
  "type": "administrator | patient",
  "jti": "uuid (refresh tokens only)",
  "twoFactorPending": true, // only in challenge tokens
  "iat": "unix timestamp",
  "exp": "unix timestamp"
}
```

- **Access tokens** — 15 minutes. Signed with `JWT_ACCESS_SECRET`.
- **Refresh tokens** — 7 days. Signed with `JWT_REFRESH_SECRET`. Include `jti`.
- **2FA challenge tokens** — 5 minutes. Signed with `JWT_ACCESS_SECRET`. Include `twoFactorPending: true`.

---

## GraphQL Operations

### `login(input: LoginInput): LoginResult`

Searches administrator table first, then patient table.

- If 2FA is **disabled** (or user is a patient): returns `AuthResponse` with full access + refresh tokens.
- If 2FA is **enabled** (administrator only): returns `TwoFactorChallengeResponse` with a 5-minute challenge token. For EMAIL/PHONE methods, an OTP is generated and stored at this point.
- Users who registered via OAuth and have no password receive `401 Invalid credentials`.

`LoginResult` is a GraphQL union: `AuthResponse | TwoFactorChallengeResponse`.

**Validation:** Email not found → 401; password mismatch → 401; OAuth-only account (no password) → 401. Same message for all cases to avoid user enumeration.

---

### `completeTwoFactorLogin(input: CompleteTwoFactorLoginInput): AuthResponse`

Second step of the 2FA login flow.

**Input:** `challengeToken` (the value from `TwoFactorChallengeResponse`), `code` (OTP or TOTP).

**Validation:**
- Challenge token verified (signature + expiry + `twoFactorPending` flag).
- For TOTP: `authenticator.verify({ token, secret })`.
- For EMAIL/PHONE: SHA-256 hash of `code` compared to stored `TwoFactorToken.codeHash`. Token deleted after use.
- Returns 401 on any failure.

---

### `refreshToken(input: RefreshTokenInput): RefreshResponse`

Issues a new access token for a valid, non-revoked refresh token.

**Validation:** JWT signature → jti lookup → bcrypt comparison. Refresh token is not rotated.

---

### `logout(input: LogoutInput): LogoutResponse`

Requires a valid JWT. Deletes the refresh token record by `jti`. Always succeeds silently.

---

### `setupTwoFactor(input: SetupTwoFactorInput): SetupTwoFactorResponse` — (ROOT_ADMIN | FACILITY_ADMIN)

Initiates 2FA setup for the authenticated administrator.

- **TOTP:** generates base32 secret + `otpauth://` URL (encode client-side as QR). Stores secret. Does **not** activate 2FA.
- **EMAIL/PHONE:** generates 6-digit OTP, stores SHA-256 hash (10 min expiry). Does **not** activate 2FA.

---

### `verifyTwoFactorSetup(input: VerifyTwoFactorSetupInput): SetupTwoFactorResponse` — (ROOT_ADMIN | FACILITY_ADMIN)

Confirms the setup code and activates 2FA (`twoFactorEnabled = true`).

---

### `disableTwoFactor(input: DisableTwoFactorInput): DisableTwoFactorResponse` — (ROOT_ADMIN | FACILITY_ADMIN)

Requires current password. Clears `twoFactorEnabled`, `twoFactorMethod`, `twoFactorSecret`.

---

### `requestTwoFactorBypass(input: RequestTwoFactorBypassInput): TwoFactorBypassResponse` — Public

Allows a TOTP administrator who has lost access to their authenticator app to receive a one-time bypass code via EMAIL or PHONE.

**Input:** `{ challengeToken: string, method: EMAIL | PHONE }`

**Business Rules:**
- `challengeToken` must be valid (signature, expiry, `twoFactorPending: true`).
- `method` must be `EMAIL` or `PHONE` — `TOTP` is rejected with `400 BadRequest`.
- The admin's configured `twoFactorMethod` must be `TOTP`; admins using EMAIL/PHONE 2FA already receive codes through their configured channel and do not need a bypass. Returns `400 BadRequest` otherwise.
- Generates a 6-digit OTP, stores it in `TwoFactorToken` (replacing any existing one), and emits `auth.twoFactorBypassRequested` event containing `adminId`, `email`, `phoneNumber`, `method`, and the raw `otp`.
- The bypass OTP is valid for 10 minutes (same as standard 2FA OTPs).
- After calling this mutation, the admin completes sign-in with the **existing** `completeTwoFactorLogin` mutation using the bypass code.

---

### `forgotPassword(input: ForgotPasswordInput): ForgotPasswordResponse` — Public

Initiates a password reset for an administrator or patient.

**Input:** `{ email: string }`

**Business Rules:**
- Searches administrator table first, then patient table by email.
- If a user is found: generates a cryptographically random 32-byte hex token, stores its SHA-256 hash in `PasswordResetToken` with a 1-hour expiry, and emits `auth.passwordResetRequested` event (the raw token is included in the event payload for the notification layer to deliver).
- Previous reset tokens for the same user are deleted before creating the new one.
- **Always returns the same message** regardless of whether the email was found — prevents user enumeration.

---

### `resetPassword(input: ResetPasswordInput): ResetPasswordResponse` — Public

Completes the password reset using the token delivered out-of-band.

**Input:** `{ token: string, newPassword: string }`

**Validation:**
- `newPassword`: 8+ characters, 1 uppercase, 1 number, 1 special character.
- Token is SHA-256 hashed and looked up in `PasswordResetToken`.
- Returns `400 BadRequest` if token is not found or expired (expired token is also deleted).
- On success: bcrypt-hashes the new password, updates the user record, deletes **all** refresh tokens for the user (forces re-login on all devices), and deletes the used reset token.

---

### `oauthLoginUrl(provider: OAuthProvider!): OAuthUrlResponse` — Query, Public

Returns the OAuth authorization URL to redirect the user to for provider consent.

**Supported providers:** `GOOGLE`

The client opens this URL in a browser or webview. After the user consents, the provider redirects to `GOOGLE_CALLBACK_URL` (from the environment) with an authorization `code` in the query string. That code is then passed to `oauthLogin`.

---

### `oauthLogin(input: OAuthLoginInput): AuthResponse` — Public

Exchanges an OAuth authorization code for our own JWT tokens.

**Input:** `{ provider: OAuthProvider, code: string }`

The redirect URI is read from `GOOGLE_CALLBACK_URL` in the environment — clients do not pass it.

**Business Rules (Google):**
1. Exchanges `code` for Google tokens via `OAuth2Client.getToken()`.
2. Verifies the ID token via `OAuth2Client.verifyIdToken()` to extract the user profile (`sub`, `email`, `given_name`, `family_name`).
3. **Administrator lookup:** find by `oauthId + oauthProvider`. If not found, find by `email` and link the OAuth identity to the existing account. If still not found → return 401 (admins cannot self-register via OAuth).
4. **Patient lookup:** find by `oauthId + oauthProvider`. If not found, find by `email` and link the OAuth identity. If still not found → **auto-register** a new patient account with the available Google profile data.
5. Issues our own access + refresh tokens on success.

**Auto-registered patients** have `password: null`, `phoneNumber: ''`, `dateOfBirth: ''`, `gender: OTHER`, and empty address fields. They should complete their profile before booking appointments.

Returns 401 if Google token verification fails.

---

## `completeTwoFactorLogin` — Unified Verification Logic

The `completeTwoFactorLogin` mutation uses a unified OTP-first verification strategy:

1. SHA-256 hash the provided `code` and look it up in `TwoFactorToken` for this admin.
2. **If a stored OTP is found** → verify expiry and consume the token. This covers:
   - Normal EMAIL/PHONE 2FA (OTP sent during `login`).
   - TOTP bypass (OTP sent during `requestTwoFactorBypass`).
3. **If no stored OTP is found and method is TOTP** → verify `code` against the admin's `twoFactorSecret` using `authenticator.verify`.
4. **If no stored OTP and method is EMAIL/PHONE** → the code was wrong; clean up and return 401.

This means there is **no separate mutation** for bypass completion — `completeTwoFactorLogin` handles all cases.

---

## Modified Login Behaviour

When 2FA is enabled for an administrator account, the `login` mutation returns a `TwoFactorChallengeResponse` instead of `AuthResponse`:
```
{
  challengeToken: string   // 5-min JWT
  twoFactorMethod: string  // 'EMAIL' | 'PHONE' | 'TOTP'
  message: string          // human-readable instruction
}
```
The GraphQL return type is a union: `LoginResult = AuthResponse | TwoFactorChallengeResponse`.

---

## Entity Additions for OAuth

Both `Administrator` and `Patient` entities have two new columns:

| Column          | Type                       | Notes                             |
|-----------------|----------------------------|-----------------------------------|
| `oauthProvider` | varchar nullable           | `'GOOGLE'` or null                |
| `oauthId`       | varchar nullable (indexed) | Provider's unique user ID or null |

`Patient.password` is `varchar nullable` — null for OAuth-only accounts.

---

## 2FA Entity Additions (`Administrator`)

| Column             | Type                       | Notes                                |
|--------------------|----------------------------|--------------------------------------|
| `twoFactorEnabled` | boolean (default false)    | Whether 2FA is active                |
| `twoFactorMethod`  | varchar nullable           | `'EMAIL'` \| `'PHONE'` \| `'TOTP'`  |
| `twoFactorSecret`  | varchar nullable           | Base32 TOTP secret — never in GraphQL|
| `oauthProvider`    | varchar nullable           | `'GOOGLE'`                           |
| `oauthId`          | varchar nullable (indexed) | Provider's unique user ID            |

---

## Guards & Decorators

All guards are exported from `AuthModule`.

### `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`)
Extends `AuthGuard('jwt')`. Overrides `getRequest` to use `GqlExecutionContext`.

### `RolesGuard` (`src/auth/guards/roles.guard.ts`)
Reads `@Roles()` metadata and checks `req.user.role`. Passes if no roles are specified.

### `@Roles(...roles)` / `@CurrentUser()`
Standard NestJS metadata decorator and GraphQL context extractor.

---

## Module Wiring

- `AuthModule` imports `ConfigModule`, `PassportModule`, `JwtModule` (async), `TypeOrmModule.forFeature([Administrator, Patient, RefreshToken, TwoFactorToken, PasswordResetToken])`
- `AuthModule` exports `JwtAuthGuard`, `RolesGuard`, `JwtStrategy`, `PassportModule`
- `EventEmitter2` is provided globally via `EventEmitterModule.forRoot()` in `AppModule`

---

## Environment Variables

| Variable               | Required | Description                                                        |
|------------------------|----------|--------------------------------------------------------------------|
| `JWT_ACCESS_SECRET`    | Yes      | Signs access tokens and 2FA challenge tokens                       |
| `JWT_REFRESH_SECRET`   | Yes      | Signs refresh tokens                                               |
| `TOTP_ISSUER_NAME`     | No       | Issuer name in authenticator apps (default: `DialysisScheduler`)  |
| `GOOGLE_CLIENT_ID`     | No*      | Google OAuth 2.0 client ID (*required to use `oauthLogin`)        |
| `GOOGLE_CLIENT_SECRET` | No*      | Google OAuth 2.0 client secret (*required to use `oauthLogin`)    |

---

## Events Emitted

| Event                          | Payload                                                               | Consumer            |
|--------------------------------|-----------------------------------------------------------------------|---------------------|
| `auth.twoFactorBypassRequested`| `{ adminId, firstName, email, phoneNumber, method, otp }`            | NotificationService |
| `auth.passwordResetRequested`  | `{ userId, userType, email, firstName, token }`                      | NotificationService |

---

## Roles Reference

| Role             | Created via              | Access                            |
|------------------|--------------------------|-----------------------------------|
| `ROOT_ADMIN`     | `registerAdministrator`  | Full system access                |
| `FACILITY_ADMIN` | `addFacilityAdmin`       | Scoped to their assigned facility |
| `PATIENT`        | `registerPatient` or OAuth auto-registration | Patient-facing operations |
