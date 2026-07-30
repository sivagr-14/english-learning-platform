# OAuth API Reference

## Endpoints

### POST /api/auth/oauth/google
Authenticate user via Google OAuth

**Request:**
```json
{
  "code": "authorization-code-from-google"
}
```

**Response (200):**
```json
{
  "message": "Google OAuth successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@gmail.com",
    "first_name": "John",
    "last_name": "Doe",
    "profile_picture_url": "https://..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error (400):**
```json
{
  "message": "Invalid authorization code",
  "error": "..."
}
```

---

### POST /api/auth/oauth/github
Authenticate user via GitHub OAuth

**Request:**
```json
{
  "code": "authorization-code-from-github"
}
```

**Response (200):**
```json
{
  "message": "GitHub OAuth successful",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "user@github.com",
    "first_name": "Jane",
    "last_name": "Developer",
    "profile_picture_url": "https://..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error (400):**
```json
{
  "message": "Invalid authorization code",
  "error": "..."
}
```

---

## cURL Examples

### Google OAuth
```bash
curl -X POST http://localhost:5000/api/auth/oauth/google \
  -H "Content-Type: application/json" \
  -d '{"code":"4/0AY0e-g7..."}'
```

### GitHub OAuth
```bash
curl -X POST http://localhost:5000/api/auth/oauth/github \
  -H "Content-Type: application/json" \
  -d '{"code":"Ov23liHX2z..."}'
```

---

## Implementation Flow

### Frontend
1. User clicks "Sign in with Google/GitHub"
2. Redirect to OAuth provider's consent screen
3. User approves and is redirected back with authorization code
4. Extract code from URL query parameter
5. Send code to backend

### Backend
1. Receive authorization code
2. Exchange code for access token with OAuth provider
3. Fetch user profile from OAuth provider
4. Check if user exists in database:
   - If OAuth account exists: log them in
   - If email exists: link OAuth to existing account
   - If new: create user and link OAuth
5. Generate JWT tokens
6. Return user and tokens to frontend

### Frontend (after response)
1. Store JWT tokens (localStorage, sessionStorage, or memory)
2. Redirect to dashboard
3. Use token in Authorization header for protected endpoints

---

## Storage Recommendations

### Access Token
- Store in memory or sessionStorage
- Short-lived (1 hour by default)
- Sent with every API request

### Refresh Token
- Store in secure HttpOnly cookie (preferred)
- Long-lived (30 days by default)
- Used only to get new access tokens

### Example Storage
```typescript
// Save tokens after OAuth
const { token, refreshToken } = response;

// Option 1: sessionStorage (cleared on browser close)
sessionStorage.setItem('accessToken', token);
sessionStorage.setItem('refreshToken', refreshToken);

// Option 2: localStorage (persistent)
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);

// Option 3: Memory + HttpOnly cookie (most secure)
// - Frontend stores nothing
// - Backend sets HttpOnly cookie with refreshToken
// - Frontend sends Authorization header with accessToken
```

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid code" | Code expired or already used | Request new authorization from user |
| "Invalid client_id" | Wrong credentials in backend | Check .env.local OAuth credentials |
| "Invalid redirect_uri" | Mismatch with provider settings | Verify callback URL matches exactly |
| "Email not provided" | User account lacks public email | Handle gracefully, ask for manual entry |

---

## Testing Checklist

- [ ] Google OAuth credentials configured
- [ ] GitHub OAuth credentials configured
- [ ] OAuth endpoints respond correctly
- [ ] User created on first OAuth login
- [ ] Existing user linked on subsequent OAuth login
- [ ] Profile picture saved from OAuth provider
- [ ] JWT tokens generated and returned
- [ ] User can access protected endpoints with token
- [ ] Token refresh works correctly
- [ ] Logout revokes session

---

## Database Verification

Check OAuth accounts:
```sql
SELECT 
  u.id,
  u.email,
  u.first_name,
  o.provider,
  o.provider_user_id,
  o.created_at
FROM users u
LEFT JOIN oauth_accounts o ON u.id = o.user_id
ORDER BY u.created_at DESC;
```

---

## Security Notes

1. **Authorization Code**: One-time use, expires in 10 minutes
2. **Confidentiality**: Exchange code for tokens on backend only
3. **HTTPS**: Required in production for OAuth
4. **Scope**: Request minimal scopes needed
5. **State Parameter**: Implement to prevent CSRF attacks
6. **Token Expiration**: Access tokens should be short-lived
