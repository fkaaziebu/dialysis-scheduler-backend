# Auth Module

## Overview
The auth module is the single entry point for authentication across the entire system. Both administrators and patients authenticate through here. It is responsible for issuing JWTs, handling token refresh, managing password resets, providing OAuth 2.0 login via Google, and providing guards that protect routes in all other modules. No other module handles login or session logic.

---

## Features

---

### 1. `Login` — Authenticate a User

**Description**
Authenticates either an administrator or a patient using their email and password. On success, returns a short-lived access token and a long-lived refresh token. The caller's `role` is embedded in the token payload so guards downstream can make authorization decisions without an extra database lookup.

**Request Body**
```json
{ "email": "string", "password": "string" }
```

**Response**
```json
{
  "accessToken": "string (JWT)",
  "refreshToken": "string (JWT)",
  "user": { "id": "uuid", "firstName": "string", "lastName": "string", "email": "string", "role": "ROOT_ADMIN | FACILITY_ADMIN | PATIENT" }
}
```

**Business Rules & Validations**
- Lookup is performed across both the administrator and patient tables by email.
- If no account is found, or password does not match, or the account has no password (OAuth-only), return `401 Unauthorized`. Do not distinguish between these cases (avoid user enumeration).
- Access token expiry: `15 minutes`. Refresh token expiry: `7 days`.
- JWT payload must include: `sub` (user id), `role`, `type` (`administrator` or `patient`).
- Refresh token must be stored server-side (bcrypt hashed) and associated with the user to support invalidation.

---

### 2. `RefreshToken` — Obtain a New Access Token

**Description**
Accepts a valid refresh token and issues a new access token.

**Business Rules & Validations**
- The refresh token must be valid (signature check) and not expired.
- The refresh token must exist in the server-side store. If revoked or missing → `401`.
- A new access token is issued with a fresh `15 minute` expiry.
- The refresh token is **not** rotated — it retains its original expiry.

---

### 3. `Logout` — Revoke a Session

**Description**
Invalidates the user's refresh token server-side.

**Authorization:** Requires a valid JWT (any role).

**Business Rules & Validations**
- The refresh token is removed from the server-side store.
- If the token is not found or already expired → return `200 OK` silently.
- The access token is not explicitly revoked; clients discard it locally.

---

### 4. `SetupTwoFactor` — Initiate 2FA Setup

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:** `{ method: EMAIL | PHONE | TOTP }`

**Business Rules:**
- For TOTP: generates a base32 secret and returns both the secret and the `otpauth://` URL to encode as a QR code. Does **not** enable 2FA until `verifyTwoFactorSetup` is called.
- For EMAIL/PHONE: generates a 6-digit OTP, stores a SHA-256 hash with a 10-minute expiry. Does **not** enable 2FA until `verifyTwoFactorSetup` is called.
- Only one pending setup can exist at a time per admin (previous tokens are deleted on new request).

---

### 5. `VerifyTwoFactorSetup` — Confirm and Activate 2FA

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:** `{ code: string }`

**Business Rules:**
- For TOTP: verifies the code against the stored secret using `otplib.authenticator.verify`.
- For EMAIL/PHONE: SHA-256 hashes the provided code and compares with the stored hash. Deletes the token after use.
- On success: sets `twoFactorEnabled = true` on the Administrator record.
- Returns 401 if the code is invalid or expired.

---

### 6. `DisableTwoFactor` — Deactivate 2FA

**Authorization:** ROOT_ADMIN or FACILITY_ADMIN role required.

**Input:** `{ password: string }` — current password required to confirm identity.

**Business Rules:**
- Verifies the provided password via bcrypt before making any changes.
- On success: sets `twoFactorEnabled = false`, clears `twoFactorMethod` and `twoFactorSecret`.

---

### 7. `CompleteTwoFactorLogin` — Finish 2FA-Protected Login

**Authorization:** Public (uses the challenge token for identity).

**Input:** `{ challengeToken: string, code: string }`

**Business Rules:**
- The challenge token is a short-lived JWT (5 minutes) signed with `JWT_ACCESS_SECRET` containing `twoFactorPending: true`.
- Returns 401 if the challenge token is invalid, expired, or does not contain `twoFactorPending`.
- For TOTP: verifies `code` against the admin's stored `twoFactorSecret` via `authenticator.verify`.
- For EMAIL/PHONE: SHA-256 hashes the code, finds the stored `TwoFactorToken`, checks expiry. Deletes token on use.
- On success: issues full access + refresh tokens (same flow as normal login).

---

### 8. `RequestTwoFactorBypass` — TOTP Bypass via Email or Phone

**Authorization:** Public (uses the challenge token for identity).

**Input:** `{ challengeToken: string, method: TwoFactorMethod }` — method must be `EMAIL` or `PHONE`.

**When to use:** An administrator configured TOTP and has lost access to their authenticator app.

**Business Rules:**
- Reject with `400 BadRequest` if `method === TOTP`.
- Verify the `challengeToken` (must be a valid short-lived JWT with `twoFactorPending: true`). Return 401 on failure.
- Look up the admin by `payload.sub`. Return 401 if not found.
- Reject with `400 BadRequest` if the admin's `twoFactorMethod !== TOTP` (EMAIL/PHONE users already receive codes via their configured channel).
- Generate a 6-digit OTP, call `storeTwoFactorToken(adminId, otp)` (replaces any existing token).
- Emit `auth.twoFactorBypassRequested` with `{ adminId, firstName, email, phoneNumber, method, otp }`.
- Return `{ message: 'A bypass code has been sent to your email/phone.' }`.

**Completing bypass login:** After calling this mutation, the admin passes the bypass code to the **existing** `completeTwoFactorLogin` mutation. No separate completion mutation is needed.

**`completeTwoFactorLogin` unified logic (updated):**
1. SHA-256 hash the provided `code` and look for a `TwoFactorToken` matching `{ adminId, codeHash }`.
2. If found and not expired → consume the token and proceed (covers EMAIL/PHONE normal AND TOTP bypass).
3. If not found and `twoFactorMethod === TOTP` → verify against `twoFactorSecret` using `authenticator.verify` (normal TOTP path).
4. If not found and `twoFactorMethod !== TOTP` → clean up tokens and return 401.

**New DTOs (add to `src/auth/dto/two-factor.types.ts`):**
- `RequestTwoFactorBypassInput` — `{ challengeToken: string, method: TwoFactorMethod }` (IsString, IsEnum)
- `TwoFactorBypassResponse` — `{ message: string }`

**`NotificationService`** — add `@OnEvent('auth.twoFactorBypassRequested')` handler that stores a `TWO_FACTOR_OTP` notification record with the raw OTP and delivery channel in the message body.

---

### 10. `ForgotPassword` — Request a Password Reset

**Authorization:** Public.

**Input:** `{ email: string }`

**Business Rules:**
- Searches administrator table first, then patient table by email.
- If found: generates a cryptographically random 32-byte hex token (`crypto.randomBytes(32).toString('hex')`), stores its SHA-256 hash in `PasswordResetToken` with a **1-hour expiry**, and emits `auth.passwordResetRequested` event containing the raw token for the notification layer to deliver.
- Any existing reset token for the user is deleted before creating the new one (single active token per user).
- **Always return the same response message** regardless of whether the account exists — prevents user enumeration.

**New entity:** `PasswordResetToken` (`src/auth/entities/password-reset-token.entity.ts`)
- Columns: `id` (uuid PK), `userId` (string, indexed), `userType` (string), `tokenHash` (string), `expiresAt` (timestamp), `createdAt` (timestamp).

---

### 11. `ResetPassword` — Complete a Password Reset

**Authorization:** Public.

**Input:** `{ token: string, newPassword: string }`

**Validation:**
- `newPassword` must be at least 8 characters with one uppercase letter, one number, and one special character (class-validator `@Matches` decorator on DTO).

**Business Rules:**
- SHA-256 hash the provided token and look it up in `PasswordResetToken`.
- If not found or expired: delete the expired token and return `400 BadRequest`.
- bcrypt-hash the new password and update the user's record in either `Administrator` or `Patient` table based on `userType`.
- Delete **all** `RefreshToken` records for the user (forces re-login on all devices).
- Delete the used `PasswordResetToken` record.

---

### 12. `OAuthLoginUrl` — Get OAuth Authorization URL (Query)

**Authorization:** Public.

**Arguments:** `provider: OAuthProvider` (enum: `GOOGLE`)

**Business Rules:**
- Uses `google-auth-library` `OAuth2Client.generateAuthUrl` with scopes `['openid', 'profile', 'email']` and `access_type: 'offline'`.
- The redirect URI is read from `GOOGLE_CALLBACK_URL` in the environment — not provided by the client.
- Returns `{ url: string }` — the client opens this URL in a browser/webview.
- Throws `400 BadRequest` for unsupported providers.

---

### 13. `OAuthLogin` — Exchange OAuth Code for Tokens

**Authorization:** Public.

**Input:** `{ provider: OAuthProvider, code: string }`

The redirect URI used for the token exchange is read from `GOOGLE_CALLBACK_URL` in the environment. It must match the URI registered with the provider and used when generating the auth URL.

**Business Rules (Google flow):**
1. Call `OAuth2Client.getToken(code)` to exchange the code for Google tokens.
2. Call `OAuth2Client.verifyIdToken({ idToken, audience })` to verify and decode the ID token. Extract `sub`, `email`, `given_name`, `family_name`. Return `401` if this step fails.
3. **Administrator resolution:** find by `{ oauthId: sub, oauthProvider: 'GOOGLE' }`. If not found, find by `email` and link (`update oauthId + oauthProvider`). If still not found → `401` (admins cannot self-register via OAuth).
4. **Patient resolution:** find by `{ oauthId: sub, oauthProvider: 'GOOGLE' }`. If not found, find by `email` and link. If still not found → **auto-register** a new Patient with: `firstName: given_name`, `lastName: family_name`, `email`, `password: null`, `phoneNumber: ''`, `dateOfBirth: ''`, `gender: Gender.OTHER`, empty address, `oauthId: sub`, `oauthProvider: 'GOOGLE'`.
5. Issue our own access + refresh tokens and return `AuthResponse`.

**Entity additions (both `Administrator` and `Patient`):**
- `oauthProvider: string | null` — `@Column({ type: 'varchar', nullable: true })`
- `oauthId: string | null` — `@Index() @Column({ type: 'varchar', nullable: true })`

**`Patient.password`** must be changed to `@Column({ type: 'varchar', nullable: true })` since OAuth patients have no password. The TypeScript type becomes `string | null`.

---

## Modified Login Behaviour

When 2FA is enabled for an administrator account, the `login` mutation returns a `TwoFactorChallengeResponse` instead of `AuthResponse`. The GraphQL return type is a union: `LoginResult = AuthResponse | TwoFactorChallengeResponse`.

---

## New DTOs

### `src/auth/dto/password-reset.types.ts`
- `ForgotPasswordInput` — `{ email: string }` (IsEmail)
- `ResetPasswordInput` — `{ token: string, newPassword: string }` (newPassword: MinLength(8), Matches regex)
- `ForgotPasswordResponse` — `{ message: string }`
- `ResetPasswordResponse` — `{ message: string }`

### `src/auth/dto/oauth.types.ts`
- `OAuthProvider` enum — `GOOGLE` (registered with `registerEnumType`)
- `OAuthLoginInput` — `{ provider: OAuthProvider, code: string }` (no redirectUri — read from env)
- `OAuthUrlResponse` — `{ url: string }`

---

## Module Wiring Changes

- `TypeOrmModule.forFeature` in `AuthModule` must include `PasswordResetToken`.
- `AuthService` constructor gets two new injections: `@InjectRepository(PasswordResetToken)` and `EventEmitter2` (globally provided, no module import needed).
- `AuthResolver` gets two new mutations (`forgotPassword`, `resetPassword`) and one new query (`oauthLoginUrl`) plus one new mutation (`oauthLogin`).

---

## Environment Variables

| Variable               | Required | Description                                                        |
|------------------------|----------|--------------------------------------------------------------------|
| `JWT_ACCESS_SECRET`    | Yes      | Signs access tokens and 2FA challenge tokens                       |
| `JWT_REFRESH_SECRET`   | Yes      | Signs refresh tokens                                               |
| `TOTP_ISSUER_NAME`     | No       | Issuer name shown in authenticator apps (default: `DialysisScheduler`) |
| `GOOGLE_CLIENT_ID`     | Yes      | Google OAuth 2.0 client ID                                        |
| `GOOGLE_CLIENT_SECRET` | Yes      | Google OAuth 2.0 client secret                                    |
| `GOOGLE_CALLBACK_URL`  | Yes      | Redirect URI registered with Google (used server-side, not by the client) |

Add to `src/config/config.schema.ts` as `Joi.string().optional()`.

---

## Guards

### `JwtAuthGuard`
Validates the `Authorization: Bearer <token>` header. Rejects with `401` if missing, malformed, or expired.

### `RolesGuard`
Checks the `role` claim against roles specified via `@Roles()`. Returns `403` if role does not match.

---

## Events Emitted

| Event                          | Payload fields                                                    | Consumer            |
|--------------------------------|-------------------------------------------------------------------|---------------------|
| `auth.twoFactorBypassRequested`| `{ adminId, firstName, email, phoneNumber, method, otp }`        | NotificationService |
| `auth.passwordResetRequested`  | `{ userId, userType, email, firstName, token }`                  | NotificationService |

`NotificationService` should add an `@OnEvent('auth.passwordResetRequested')` handler that stores a `PASSWORD_RESET` notification record (the `NotificationType.PASSWORD_RESET` enum value already exists).

---

## Roles Reference

| Role             | Created via                        | Access                            |
|------------------|------------------------------------|-----------------------------------|
| `ROOT_ADMIN`     | `registerAdministrator`            | Full system access                |
| `FACILITY_ADMIN` | `addFacilityAdmin`                 | Scoped to their assigned facility |
| `PATIENT`        | `registerPatient` or OAuth auto-registration | Patient-facing operations |
