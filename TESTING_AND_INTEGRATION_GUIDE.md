# Authentication System - Testing & Integration Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and npm/yarn installed
- PostgreSQL running on localhost:5432
- All dependencies installed with `yarn install`

### Starting the Development Environment

#### 1. Start PostgreSQL & Redis (using Docker)
```bash
docker-compose up -d
```

#### 2. Set up the Database
```bash
cd packages/backend
npm run setup:db
```

This will:
- Create all necessary tables
- Run seed data for vocabulary categories
- Initialize the authentication tables

#### 3. Start the Backend Server
```bash
cd packages/backend
npm run dev
```

The backend will start on http://localhost:5000 with auto-reload.

#### 4. Start the Frontend Development Server
```bash
cd packages/frontend
npm run dev
```

The frontend will start on http://localhost:3000.

---

## 📋 Authentication Flows - Step by Step

### Test 1: User Registration

**URL**: http://localhost:3000/register

**Steps**:
1. Fill in the form:
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john@example.com"
   - Password: "SecurePass123!" (must meet requirements)
   - Confirm Password: "SecurePass123!"

2. Observe:
   - ✅ Real-time password requirements checking
   - ✅ Green checkmark when all requirements met
   - ✅ "Passwords match" confirmation
   - ✅ Submit button enabled when form is valid

3. Click "Create Account"

**Expected Result**:
- User created in database
- Tokens stored in localStorage
- Zustand auth store updated
- Redirect to `/dashboard`

**Test Database Check**:
```sql
SELECT * FROM users WHERE email = 'john@example.com';
SELECT * FROM sessions WHERE user_id = <user_id>;
```

---

### Test 2: User Login

**URL**: http://localhost:3000/login

**Steps**:
1. Fill in the form:
   - Email: "john@example.com" (from registration)
   - Password: "SecurePass123!"

2. Click "Sign In"

**Expected Result**:
- User authenticated
- Tokens retrieved from backend
- Tokens stored in localStorage
- Zustand auth store updated
- Redirect to `/dashboard`
- User information displayed

---

### Test 3: Magic Link Authentication

**URL**: http://localhost:3000/login/magic-link

**Steps**:
1. Enter email: "jane@example.com"
2. Click "Send sign-in link"

**Expected Result**:
- Success message showing email sent
- In development, check backend logs for the token (or use email service)

**To Complete Magic Link Flow**:
1. Backend will attempt to send email (configure SMTP for production)
2. In development mode, the token is logged to console

**Manual Test**:
- Get the magic link token from backend logs
- Navigate to: `http://localhost:3000/login/magic-link/verify?token=<token>`
- Page will verify token and auto-login user
- Redirect to dashboard

---

### Test 4: Protected Routes

**URL**: http://localhost:3000/dashboard

**Test Unauthenticated Access**:
1. Clear localStorage or open in private/incognito window
2. Navigate to http://localhost:3000/dashboard
3. Should redirect to `/login`

**Test Authenticated Access**:
1. After successful login/registration
2. Navigate to http://localhost:3000
3. Should redirect to `/dashboard` (due to root page redirect)

**Test Logout**:
1. On dashboard, click "Sign out" button
2. Auth store should be cleared
3. localStorage should be cleared
4. Redirect to login page

---

### Test 5: Token Refresh

**How It Works**:
1. Frontend makes API request with access token
2. If token expired, axios interceptor catches 401
3. Automatically calls `/api/auth/refresh` with refresh token
4. New tokens received and stored
5. Original request retried with new access token

**To Test**:
1. Set `JWT_EXPIRATION=10` in .env.local (10 seconds)
2. Login to application
3. Wait 10+ seconds
4. Make any API call that requires authentication
5. Should automatically refresh without user interaction

---

### Test 6: OAuth Integration (Google/GitHub)

**Status**: Currently buttons are visible but not fully functional (OAuth setup required)

**To Enable Google OAuth**:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create OAuth 2.0 credentials (Web application)
3. Add `http://localhost:3000` to authorized redirect URIs
4. Add `http://localhost:5000/api/auth/oauth/google` to redirect URIs
5. Add credentials to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

**To Enable GitHub OAuth**:
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create New OAuth App
3. Set Authorization callback URL to: `http://localhost:5000/api/auth/oauth/github`
4. Add credentials to `.env.local`:
   ```
   GITHUB_CLIENT_ID=your-client-id
   GITHUB_CLIENT_SECRET=your-client-secret
   ```

---

## 🧪 API Testing with cURL

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```

### Login User
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### Get User Profile (Protected)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

### Refresh Tokens
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token>"
  }'
```

### Send Magic Link
```bash
curl -X POST http://localhost:5000/api/auth/magic-link/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### Verify Magic Link
```bash
curl -X POST http://localhost:5000/api/auth/magic-link/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<magic_link_token>"
  }'
```

---

## 🐛 Debugging

### Frontend Debugging
1. Open DevTools (F12)
2. Check Console tab for errors
3. Check Application > LocalStorage > `authStore` to see stored tokens
4. Check Network tab for API requests/responses

### Backend Debugging
1. Check server logs for detailed error messages
2. Database queries logged if `DEBUG=*` is set
3. Error responses include error messages

### Common Issues

**Issue**: "Cannot find module '@/..'"
- **Solution**: Path aliases are configured in tsconfig.json. Ensure you're in the correct directory.

**Issue**: "CORS error"
- **Solution**: Check `CORS_ORIGINS` in .env.local includes frontend URL

**Issue**: "Token expired"
- **Solution**: Frontend automatically handles refresh. Check network tab for refresh request.

**Issue**: "Magic link not received"
- **Solution**: Configure SMTP credentials or check backend logs for token

---

## 📦 Building for Production

### Frontend
```bash
cd packages/frontend
yarn build
yarn start
```

### Backend
```bash
cd packages/backend
npm run build
npm start
```

### Environment Variables for Production
- Set `NODE_ENV=production`
- Update `JWT_SECRET` to a strong random string
- Configure real SMTP credentials
- Add OAuth credentials for production domains
- Set proper `CORS_ORIGINS` for production domains

---

## ✅ Checklist Before Going to Production

- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] OAuth credentials set up
- [ ] SMTP credentials configured
- [ ] Frontend and backend builds successful
- [ ] All authentication tests passing
- [ ] Token refresh working
- [ ] Password reset flow tested
- [ ] Magic link flow tested
- [ ] Error handling verified
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Database backups configured

---

## 📞 Support Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Express.js Docs**: https://expressjs.com/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **JWT Guide**: https://tools.ietf.org/html/rfc7519
- **OAuth 2.0 Guide**: https://tools.ietf.org/html/rfc6749

---

**Status**: Ready for integration testing and production deployment!
