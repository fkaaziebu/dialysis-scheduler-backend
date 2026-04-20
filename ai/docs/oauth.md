# OAuth 2.0 Integration

## Overview

The application supports OAuth 2.0 login via Google. The flow uses the **authorization code** grant type: the client redirects the user to Google, receives a short-lived code in the callback, then exchanges that code through our backend for our own JWT tokens (access + refresh). No OAuth tokens are stored server-side after exchange.

Supported providers: `GOOGLE`

---

## How It Fits Into the Auth Module

OAuth login is an alternative to password-based login. Both paths ultimately produce the same `AuthResponse` (access token + refresh token + user object). OAuth-authenticated users are subject to the same JWT lifecycle (15-min access token, 7-day refresh token) as password-authenticated users.

The two GraphQL operations involved are:

| Operation       | Type     | Authorization | Purpose                                             |
|-----------------|----------|---------------|-----------------------------------------------------|
| `oauthLoginUrl` | Query    | Public        | Get the provider consent URL to redirect the user to |
| `oauthLogin`    | Mutation | Public        | Exchange the authorization code for our JWT tokens  |

---

## Client Integration Flow

```
Client                          Backend                        Google
  │                                │                              │
  │─ oauthLoginUrl(provider) ─────>│                              │
  │<─ { url } ─────────────────────│                              │
  │                                │                              │
  │─ redirect user to url ─────────────────────────────────────> │
  │              (user sees Google consent screen)               │
  │<─ redirect to GOOGLE_CALLBACK_URL?code=AUTH_CODE ──────────  │
  │                                │                              │
  │─ oauthLogin(provider, code) ──>│                              │
  │                                │─ getToken(code) ──────────> │
  │                                │<─ { id_token, ... } ───────  │
  │                                │─ verifyIdToken(id_token) ──> │
  │                                │<─ { sub, email, name } ───── │
  │                                │                              │
  │                                │ [resolve user — see below]   │
  │                                │                              │
  │<─ { accessToken, refreshToken, │                              │
  │     user } ────────────────────│                              │
```

The callback URI (`GOOGLE_CALLBACK_URL`) is configured once in the environment and must be registered in the Google Cloud Console. Clients do not pass it at call time.

---

## GraphQL Operations

### `oauthLoginUrl(provider: OAuthProvider!): OAuthUrlResponse`

**Authorization:** Public

Returns the Google authorization URL for the user to visit. The client opens this URL in a browser or webview. After granting consent, Google redirects to `GOOGLE_CALLBACK_URL` (from the environment) with `?code=<auth_code>` appended.

**Arguments:**

| Argument   | Type            | Required | Description         |
|------------|-----------------|----------|---------------------|
| `provider` | `OAuthProvider` | Yes      | Must be `GOOGLE`    |

**Response:**

```graphql
type OAuthUrlResponse {
  url: String!  # Full Google authorization URL
}
```

**Errors:**

| Condition                   | Response            |
|-----------------------------|---------------------|
| `provider` is not `GOOGLE`  | `400 BadRequest`    |

---

### `oauthLogin(input: OAuthLoginInput!): AuthResponse`

**Authorization:** Public

Exchanges the authorization code for our own JWT tokens. This is the final step of the OAuth flow.

**Input:**

```graphql
input OAuthLoginInput {
  provider: OAuthProvider!  # GOOGLE
  code:     String!         # Authorization code from the OAuth redirect
}
```

The redirect URI used for the token exchange is read from `GOOGLE_CALLBACK_URL` in the environment — it must match the URI registered in the Google Cloud Console and used when generating the auth URL.

**Response:** Same `AuthResponse` as password login:

```graphql
type AuthResponse {
  accessToken:  String!
  refreshToken: String!
  user: AuthUser!
}

type AuthUser {
  id:        String!
  firstName: String!
  lastName:  String!
  email:     String!
  role:      Role!
}
```

**Errors:**

| Condition                                      | Response          |
|------------------------------------------------|-------------------|
| Google token verification fails                | `401 Unauthorized`|
| Admin not found by `oauthId` or `email`        | `401 Unauthorized`|

---

## User Resolution Logic

The backend attempts to resolve the authenticated Google user to a local account in two stages, with different rules for administrators and patients.

### Stage 1 — Administrator Lookup

1. Find `Administrator` where `oauthId = sub AND oauthProvider = 'GOOGLE'`.
2. If not found, find `Administrator` where `email = email` (the Google-verified email) and **link** by setting `oauthId = sub`, `oauthProvider = 'GOOGLE'`.
3. If still not found → **`401 Unauthorized`**. Administrators cannot self-register through OAuth; an account must already exist.

### Stage 2 — Patient Lookup (only if no admin found)

1. Find `Patient` where `oauthId = sub AND oauthProvider = 'GOOGLE'`.
2. If not found, find `Patient` where `email = email` and **link** by setting `oauthId = sub`, `oauthProvider = 'GOOGLE'`.
3. If still not found → **auto-register** a new `Patient` with the Google profile data (see below).

### Identity Linking

When a user logs in via OAuth for the first time but already has a password-based account with the same email, the OAuth identity is silently linked to their existing account. Subsequent logins via OAuth or password both work.

---

## Auto-Registration for Patients

If a patient's Google account has no matching local record (by `oauthId` or `email`), a new `Patient` is created automatically:

| Field          | Value                         |
|----------------|-------------------------------|
| `firstName`    | `given_name` from Google      |
| `lastName`     | `family_name` from Google     |
| `email`        | `email` from Google           |
| `password`     | `null` (no password set)      |
| `phoneNumber`  | `''` (empty string)           |
| `dateOfBirth`  | `''` (empty string)           |
| `gender`       | `OTHER`                       |
| `oauthId`      | `sub` from Google ID token    |
| `oauthProvider`| `'GOOGLE'`                    |

Auto-registered patients have incomplete profiles. They can use the application but should complete their profile (phone number, date of birth, address) before booking appointments.

---

## Entity Changes

### `Administrator` — New Columns

| Column          | Type                       | Default | Notes                           |
|-----------------|----------------------------|---------|---------------------------------|
| `oauthProvider` | varchar nullable           | null    | `'GOOGLE'` or null              |
| `oauthId`       | varchar nullable, indexed  | null    | Google `sub` claim or null      |

### `Patient` — New and Modified Columns

| Column          | Type                       | Default | Notes                              |
|-----------------|----------------------------|---------|------------------------------------|
| `password`      | varchar **nullable**       | —       | Null for OAuth-only accounts       |
| `oauthProvider` | varchar nullable           | null    | `'GOOGLE'` or null                 |
| `oauthId`       | varchar nullable, indexed  | null    | Google `sub` claim or null         |

`Patient.password` was previously non-nullable. Changing it to nullable is required to support OAuth-only patients who never set a password. Password-based login guards against this: if `password` is null, login returns `401 Invalid credentials`.

---

## DTOs

### `OAuthProvider` Enum

```typescript
enum OAuthProvider {
  GOOGLE = 'GOOGLE'
}
```

Registered with `registerEnumType` for GraphQL schema exposure.

### `OAuthLoginInput`

```typescript
@InputType()
class OAuthLoginInput {
  @IsEnum(OAuthProvider)
  provider: OAuthProvider;

  @IsString()
  code: string;
}
```

### `OAuthUrlResponse`

```typescript
@ObjectType()
class OAuthUrlResponse {
  url: string;
}
```

---

## Environment Variables

| Variable               | Description                                                       |
|------------------------|-------------------------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | Google OAuth 2.0 client ID                                        |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret                                    |
| `GOOGLE_CALLBACK_URL`  | Redirect URI registered in Google Cloud Console (e.g. `http://localhost:3000/api/v1/students/auth/google/callback`) |

All three are declared as `Joi.string().required()` in `src/config/config.schema.ts`.

---

## Google OAuth Scopes

The authorization URL is generated with the following scopes:

```
openid  profile  email
```

These are the minimum scopes needed to extract `sub`, `email`, `given_name`, and `family_name` from the ID token. No additional Google API access is requested.

`access_type: 'offline'` is included so that Google issues a refresh token — this is required when using `OAuth2Client.getToken()` to exchange the code.

---

## Security Notes

- The Google ID token is **verified** via `OAuth2Client.verifyIdToken()` before any user data is trusted. Any failure (signature mismatch, wrong audience, expired token) returns `401`.
- The authorization `code` is single-use. Replaying it will be rejected by Google.
- `redirectUri` must match the registered URI exactly (including trailing slashes). A mismatch causes Google to reject the code exchange before the backend processes anything.
- Google tokens (`access_token`, `refresh_token`) are **not stored** by the backend. Only the `sub` claim is persisted as `oauthId` to link the Google identity to the local account.
- OAuth-only patients (`password: null`) cannot use password-based login. Attempting to do so returns `401 Invalid credentials` (same error as a wrong password — no enumeration risk).
