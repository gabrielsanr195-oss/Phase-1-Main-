# API Contracts

> Base URL: `http://localhost:3000`
> All protected routes require `Authorization: Bearer <access_token>`

---

## Auth

### POST /auth/register
Creates a new venue and its first admin user.

**Request**
```json
{
  "email": "admin@myvenue.com",
  "password": "securepassword123",
  "firstName": "Gabriel",
  "lastName": "Sanchez",
  "phone": "+50212345678",
  "venueName": "Club Nocturno XYZ",
  "venueSlug": "club-xyz"
}
```

**Response 201**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-token>",
  "user": {
    "id": "<uuid>",
    "email": "admin@myvenue.com",
    "firstName": "Gabriel",
    "lastName": "Sanchez",
    "role": "admin",
    "venueId": "<uuid>"
  }
}
```

**Errors**
| Code | Reason |
|------|--------|
| 409  | Email or venue slug already in use |
| 400  | Validation failure |

---

### POST /auth/login

**Request**
```json
{
  "email": "admin@myvenue.com",
  "password": "securepassword123",
  "venueSlug": "club-xyz"
}
```

**Response 200** — same shape as `/register` response

**Errors**
| Code | Reason |
|------|--------|
| 401  | Invalid credentials |
| 403  | Account disabled |

---

### POST /auth/refresh
Exchange a refresh token for a new access token.

**Request**
```json
{ "refreshToken": "<opaque-token>" }
```

**Response 200**
```json
{ "accessToken": "<new-jwt>" }
```

**Errors**
| Code | Reason |
|------|--------|
| 401  | Invalid or expired refresh token |

---

### POST /auth/logout
Revokes the refresh token. Returns 204 with no body.

**Request**
```json
{ "refreshToken": "<opaque-token>" }
```

---

## Health

### GET /health
```json
{ "status": "ok", "ts": "2026-05-21T00:00:00.000Z", "env": "development" }
```

---

## JWT Access Token Payload
```json
{
  "sub": "<user-uuid>",
  "venue_id": "<venue-uuid>",
  "role": "admin | keyholder | door | waiter | warehouse | bartender",
  "iat": 1234567890,
  "exp": 1234567890
}
```

## QR JWT Payload (RS256 — packages/qr-lib)
```json
{
  "sub": "<entity-uuid>",
  "venue_id": "<venue-uuid>",
  "event_id": "<event-uuid>",
  "type": "guest | keyholder | staff | table",
  "iat": 1234567890,
  "exp": 1234567890
}
```

> **Rule**: The QR payload never contains table number or sensitive data.
> Table assignment is resolved server-side on scan.
