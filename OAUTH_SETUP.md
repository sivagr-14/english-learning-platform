# OAuth Integration Setup Guide

This guide explains how to set up Google and GitHub OAuth for the English Learning Platform.

## Overview

The platform supports two OAuth providers:
- **Google OAuth 2.0** - For Google account login
- **GitHub OAuth** - For GitHub account login

## Setup Instructions

### 1. Google OAuth Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named "English Learning Platform"
3. Enable the Google+ API

#### Step 2: Create OAuth 2.0 Credentials
1. Go to "Credentials" in the left sidebar
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback/google` (development)
   - `http://localhost:5000/api/auth/oauth/google/callback` (backend callback)
   - Your production domain URLs

#### Step 3: Update Environment Variables
Add to `.env.local`:
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/callback/google
```

### 2. GitHub OAuth Setup

#### Step 1: Create GitHub OAuth App
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: English Learning Platform
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:3000/auth/callback/github

#### Step 2: Get Credentials
Copy the generated:
- Client ID
- Client secret (generate if needed)

#### Step 3: Update Environment Variables
Add to `.env.local`:
```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/callback/github
```

## API Endpoints

### Google OAuth
**POST** `/api/auth/oauth/google`

Request body:
```json
{
  "code": "authorization-code-from-google"
}
```

Response:
```json
{
  "message": "Google OAuth successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "profile_picture_url": "https://..."
  },
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

### GitHub OAuth
**POST** `/api/auth/oauth/github`

Request body:
```json
{
  "code": "authorization-code-from-github"
}
```

Response:
```json
{
  "message": "GitHub OAuth successful",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "profile_picture_url": "https://..."
  },
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

## Frontend Integration

### Google OAuth Flow

```typescript
// 1. Redirect user to Google OAuth consent screen
window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?
  client_id=${GOOGLE_CLIENT_ID}&
  redirect_uri=http://localhost:3000/auth/callback/google&
  response_type=code&
  scope=profile email&
  access_type=offline`;

// 2. In /auth/callback/google, extract code from URL
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

// 3. Send code to backend
const response = await fetch('/api/auth/oauth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code })
});

const { user, token, refreshToken } = await response.json();

// 4. Store tokens and redirect to dashboard
localStorage.setItem('token', token);
localStorage.setItem('refreshToken', refreshToken);
navigate('/dashboard');
```

### GitHub OAuth Flow

```typescript
// 1. Redirect user to GitHub OAuth screen
window.location.href = `https://github.com/login/oauth/authorize?
  client_id=${GITHUB_CLIENT_ID}&
  redirect_uri=http://localhost:3000/auth/callback/github&
  scope=user:email`;

// 2. In /auth/callback/github, extract code from URL
const params = new URLSearchParams(window.location.search);
const code = params.get('code');

// 3. Send code to backend
const response = await fetch('/api/auth/oauth/github', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code })
});

const { user, token, refreshToken } = await response.json();

// 4. Store tokens and redirect to dashboard
localStorage.setItem('token', token);
localStorage.setItem('refreshToken', refreshToken);
navigate('/dashboard');
```

## Database Schema

### oauth_accounts Table
Stores OAuth provider information linked to users.

```sql
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  provider VARCHAR(50) NOT NULL,          -- 'google' or 'github'
  provider_user_id VARCHAR(255) NOT NULL, -- ID from provider
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);
```

## How OAuth Works in This App

### Account Linking
1. User attempts OAuth login
2. App checks if OAuth account exists in database
3. If exists: logs in with existing user
4. If not exists:
   - Checks if email already registered
   - If registered: links OAuth account to existing user
   - If not registered: creates new user account and links OAuth

### User Creation
When a new user is created via OAuth:
- Email is marked as verified (email_verified = true)
- User is assigned default learning level (A1)
- Native language is set to Tamil
- Profile picture is saved from OAuth provider

### Token Management
- Access token: 1 hour (configurable via JWT_EXPIRATION)
- Refresh token: 30 days (configurable via JWT_REFRESH_EXPIRATION)
- Tokens follow same JWT system as email/password auth
- Both OAuth and email/password users use same JWT mechanism

## Troubleshooting

### Google OAuth Issues

**Error: "Google OAuth credentials not configured"**
- Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env.local
- Verify credentials are copied correctly from Google Cloud Console

**Error: "Invalid code"**
- Authorization code may have expired (valid for ~10 minutes)
- Code is single-use; attempting to reuse will fail
- Ensure redirect_uri matches exactly between frontend and backend

**Error: "Email not provided"**
- User's Google account doesn't have public email
- Request additional OAuth scopes in frontend

### GitHub OAuth Issues

**Error: "GitHub OAuth credentials not configured"**
- Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set in .env.local
- Verify credentials are copied from GitHub Settings

**Error: "No public email"**
- User's GitHub account has no public email
- Request scope: "user:email" to access private emails

## Production Deployment

### Update Callback URLs

Update OAuth provider settings for production:

**Google:**
- Add production domain to authorized redirect URIs
- Update GOOGLE_CALLBACK_URL in environment variables

**GitHub:**
- Update Authorization callback URL in GitHub OAuth settings

### Secure Environment Variables

Store OAuth secrets in production safely:
- Use GitHub Secrets for CI/CD
- Use Railway/Vercel environment variables
- Never commit .env files with real credentials

## Advanced Configuration

### Custom Scopes

Modify strategies to request additional scopes:

**Google:**
```typescript
return new GoogleStrategy({
  scope: ['profile', 'email', 'https://www.googleapis.com/auth/user.birthday.read']
});
```

**GitHub:**
```typescript
return new GitHubStrategy({
  scope: ['user:email', 'read:user']
});
```

### Token Refresh

If storing refresh tokens from OAuth providers:
```typescript
await db('oauth_accounts')
  .where('id', oauthAccountId)
  .update({
    refresh_token: newRefreshToken,
    token_expires_at: newExpiresAt,
    updated_at: new Date()
  });
```

## Testing OAuth Locally

1. Start backend: `yarn dev`
2. Ensure .env.local has correct OAuth credentials
3. Use OAuth in frontend to test complete flow
4. Check database oauth_accounts table for new entries

## Security Considerations

1. **Authorization Code Only**: Frontend gets code from redirect, not tokens
2. **Backend Exchange**: Only backend exchanges code for tokens
3. **Scope Minimization**: Request only necessary scopes
4. **HTTPS in Production**: Mandatory for OAuth redirect URIs
5. **CSRF Protection**: Implement state parameter in frontend for additional security
