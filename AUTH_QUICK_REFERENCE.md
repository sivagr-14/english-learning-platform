# Quick Reference - Authentication API

## Getting Started

### 1. Initialize Database
```bash
cd /Users/siva/gpt/english-learning-platform

# Run migrations and seeds
yarn run setup:db
```

### 2. Start Server
```bash
yarn dev
```

### 3. Test Endpoints

#### Register a New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPass123",
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe"
  }'
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe"
  },
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "TestPass123"
  }'
```

#### Get Current User (Protected)
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer {token}"
```

#### Refresh Token
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "{refresh-token}"
  }'
```

#### Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer {token}"
```

## Database Commands

```bash
# List migrations
yarn knex migrate:list

# Run migrations
yarn knex migrate:latest

# Rollback migrations
yarn knex migrate:rollback

# Run seeds
yarn knex seed:run

# Setup everything (migrations + seeds)
yarn run setup:db

# Reset database
yarn run db:reset
```

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## JWT Token Config (in .env.local)

- JWT_SECRET - Your secret key for signing tokens
- JWT_EXPIRATION - Access token expiration (default: 3600 seconds / 1 hour)
- JWT_REFRESH_EXPIRATION - Refresh token expiration (default: 2592000 seconds / 30 days)

## File Locations

- Auth Service: `packages/backend/src/services/auth.service.ts`
- Auth Routes: `packages/backend/src/routes/auth.ts`
- Auth Middleware: `packages/backend/src/middleware/auth.middleware.ts`
- Auth Validations: `packages/backend/src/validations/auth.validations.ts`
- Database: `packages/backend/src/utils/db.ts`
- Migrations: `packages/backend/src/database/migrations/`
- Seeds: `packages/backend/src/database/seeds/`

## What's Implemented

✅ User Registration (email/password)
✅ User Login  
✅ JWT Token Generation
✅ Token Refresh
✅ User Logout
✅ Protected Routes (Auth Middleware)
✅ Input Validation (Zod)
✅ Error Handling
✅ Database Migrations (Knex.js)
✅ Database Seeds (25 vocab categories + sample words)
✅ Password Hashing (Bcrypt)
✅ Session Management

## What's Next

- [ ] Google OAuth
- [ ] GitHub OAuth
- [ ] Magic Link Authentication
- [ ] Frontend Login Page
- [ ] Frontend Registration Page
- [ ] Zustand Auth Store

## Architecture Overview

```
Frontend                Backend                Database
=========               =======               ========

Login Page  ------>  POST /api/auth/login
                          |
                     AuthService
                          |
                     Validate Input (Zod)
                          |
                     Query users table
                          |
                     Verify password
                          |
                     Create session
                          |
                     Generate tokens
                     
     <------ JWT Token + Refresh Token
```

Protected routes use the `authMiddleware` which:
1. Extracts token from Authorization header
2. Verifies JWT signature and expiration
3. Sets userId on request object
4. Proceeds to route handler

## Error Handling

All errors are handled by the centralized `errorHandler` middleware:

- **400 Bad Request** - Validation errors
- **401 Unauthorized** - Invalid/missing token
- **404 Not Found** - User not found
- **409 Conflict** - Email/username already registered
- **500 Internal Server Error** - Unexpected errors

## TypeScript Safety

All code is fully typed with TypeScript - run type checking:
```bash
yarn run type-check
```

## Type Definitions

All types are exported from respective files:
- `AuthService` types from `auth.service.ts`
- Request types from `auth.middleware.ts`
- Validation types from `auth.validations.ts`
