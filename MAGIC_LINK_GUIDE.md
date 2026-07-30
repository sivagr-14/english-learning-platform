# Magic Link Authentication Guide

## Overview

Magic Link authentication is a passwordless authentication method that allows users to log in by clicking a link sent to their email address. It's more secure than password-based authentication and provides a seamless user experience.

## Features

- **Passwordless Login**: No need to remember passwords
- **Secure Tokens**: Uses cryptographically secure tokens
- **Time-Limited Links**: Links expire after 15 minutes
- **One-Time Use**: Each link can only be used once
- **Email Verification**: Email is automatically verified on first use
- **Automatic Account Creation**: New users are created if email doesn't exist
- **HTML & Text Email Templates**: Beautiful email templates with fallback text

## API Endpoints

### POST /api/auth/magic-link/send
Send a magic link to a user's email address

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Magic link sent to your email",
  "email": "user@example.com"
}
```

**Error (400):**
```json
{
  "message": "Invalid email address"
}
```

---

### POST /api/auth/magic-link/verify
Verify magic link token and authenticate user

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Response (200):**
```json
{
  "message": "Magic link verified successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": null,
    "last_name": null
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error (400):**
```json
{
  "message": "Invalid or expired magic link"
}
```

## Implementation Flow

### User Perspective

1. **Request Link**: User enters email on login screen
2. **Receive Email**: Magic link is sent to their inbox
3. **Click Link**: User clicks the link in the email
4. **Verify**: Link is verified and user is automatically logged in
5. **Dashboard**: User is redirected to dashboard

### Technical Flow

```
User Input Email
    ↓
POST /api/auth/magic-link/send
    ↓
Generate cryptographic token
    ↓
Save token to magic_links table with expiration (15 min)
    ↓
Send HTML email with magic link URL
    ↓
User clicks link in email
    ↓
Frontend extracts token from URL
    ↓
POST /api/auth/magic-link/verify with token
    ↓
Backend verifies:
  - Token exists
  - Not yet used
  - Not expired
    ↓
Find or create user:
  - If user exists: update email_verified = true
  - If user doesn't exist: create new user with email_verified = true
    ↓
Mark magic link as used
    ↓
Generate JWT access token & refresh token
    ↓
Create session in database
    ↓
Return tokens to frontend
    ↓
Frontend stores tokens & redirects to dashboard
```

## Frontend Implementation

### Request Magic Link
```typescript
async function requestMagicLink(email: string) {
  const response = await fetch('/api/auth/magic-link/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  
  const data = await response.json();
  if (response.ok) {
    // Show message: "Check your email for magic link"
    navigate('/auth/check-email');
  } else {
    // Handle error
    alert(data.message);
  }
}
```

### Verify Magic Link
```typescript
// In /auth/callback/magic-link/:token component
useEffect(() => {
  const verifyMagicLink = async () => {
    const token = useParams().token;
    
    const response = await fetch('/api/auth/magic-link/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    
    const data = await response.json();
    if (response.ok) {
      // Store tokens
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } else {
      // Show error message
      navigate('/auth/login?error=invalid_link');
    }
  };
  
  verifyMagicLink();
}, []);
```

## Email Configuration

### Environment Variables

Add to `.env.local`:

```env
# Email Service (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@englishlearning.com
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable 2-Step Verification
   - Generate App Password for "Mail"
   - Use this password in SMTP_PASSWORD

### Other Email Providers

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-api-key
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-user
SMTP_PASSWORD=your-ses-password
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.com
SMTP_PASSWORD=your-password
```

## Database Schema

### magic_links Table

```sql
CREATE TABLE magic_links (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- **id**: Unique identifier
- **email**: User's email address (lowercase stored)
- **token**: Cryptographic token (64-character hex string)
- **expires_at**: When link expires (15 minutes from creation)
- **used_at**: When link was used (null = not yet used)
- **created_at**: When link was created

## Security Considerations

### Token Security

1. **Cryptographic Generation**: Uses `crypto.randomBytes(32)` for 256-bit entropy
2. **Unique Constraint**: Each token can only exist once in database
3. **Single Use**: `used_at` field prevents reuse
4. **Time Limited**: Tokens expire after 15 minutes
5. **No Replication**: Lost emails can't be replayed

### Email Security

1. **HTTPS Only**: Magic links contain tokens in URLs
2. **Secure Transport**: Tokens sent only via HTTPS in production
3. **No Token in Email Subject**: Token is only in link URL, not visible in email preview
4. **IP Logging**: Consider logging IP addresses for suspicious activity

### Database Security

1. **Token Hashing** (Optional): Hash tokens in database
   ```typescript
   const hashedToken = crypto
     .createHash('sha256')
     .update(token)
     .digest('hex');
   ```

2. **Rate Limiting**: Limit link generation per email
   ```typescript
   const recentLinks = await db('magic_links')
     .where('email', email)
     .where('created_at', '>', new Date(Date.now() - 3600000))
     .count('*')[0].count;
   
   if (recentLinks > 5) {
     throw new Error('Too many magic link requests. Please try again later.');
   }
   ```

3. **Cleanup**: Delete expired links periodically
   ```typescript
   await db('magic_links')
     .where('expires_at', '<', new Date())
     .del();
   ```

## Testing

### cURL Examples

**Request Magic Link:**
```bash
curl -X POST http://localhost:5000/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Verify Magic Link:**
```bash
curl -X POST http://localhost:5000/api/auth/magic-link/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"}'
```

### Testing Without Email

For development/testing without email:

```typescript
// In test environment, return token in response
if (process.env.NODE_ENV === 'development') {
  return {
    message: "Magic link generated",
    email,
    // Include token in response for testing
    token: token,
    magicLinkUrl: `http://localhost:3000/auth/magic-link/${token}`
  };
}
```

## User Experience Flow

### Screens Needed

1. **Magic Link Request Screen** (`/auth/magic-link`)
   - Email input field
   - "Send Magic Link" button
   - Link to password login

2. **Check Email Screen** (`/auth/check-email`)
   - Confirmation message
   - Estimated wait time
   - Link to request new link
   - "Back to login" link

3. **Verifying Screen** (`/auth/callback/magic-link/:token`)
   - Loading indicator
   - "Signing you in..." message
   - Fallback link if auto-redirect fails

4. **Success Screen** (redirect to dashboard)
   - Dashboard with user data

## Analytics & Monitoring

### Track Key Metrics

```sql
-- Links sent today
SELECT COUNT(*) FROM magic_links
WHERE created_at > NOW() - INTERVAL '1 day';

-- Links used
SELECT COUNT(*) FROM magic_links
WHERE used_at IS NOT NULL;

-- Expired links
SELECT COUNT(*) FROM magic_links
WHERE expires_at < NOW() AND used_at IS NULL;

-- Most active emails
SELECT email, COUNT(*) as attempts
FROM magic_links
GROUP BY email
ORDER BY attempts DESC
LIMIT 10;
```

## Troubleshooting

### "Magic link not received"
- Check SMTP configuration in .env.local
- Verify email address is correct
- Check spam/junk folder
- Test email service manually

### "Invalid or expired magic link"
- Link may have expired (15 min limit)
- Link may have already been used
- User tried different link format
- Solution: Request new link

### "Email service not configured"
- Check SMTP variables are set in .env.local
- Verify email credentials are correct
- Test SMTP connection

## Advanced Features

### Implement Email Verification Reminder

```typescript
// Send verification reminder after 3 days if email not verified
const user = await db('users').where('id', userId).first();
if (!user.email_verified && new Date(user.created_at) < new Date(Date.now() - 3 * 86400000)) {
  await emailService.sendMagicLink(user.email, token);
}
```

### Link Expiration Customization

Change expiration time in MagicLinkService:
```typescript
const expiresAt = new Date();
expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes instead of 15
```

### Maximum Link Requests Per Email

Add rate limiting to prevent abuse:
```typescript
const recentLinks = await db('magic_links')
  .where('email', email)
  .where('created_at', '>', new Date(Date.now() - 3600000))
  .count('*')[0];

if (recentLinks >= 5) {
  throw new Error('Too many magic link requests. Please try again in 1 hour.');
}
```
