# English Learning & Mastery Platform

An AI-powered web application for comprehensive English vocabulary mastery with ChatGPT-4 integration, spaced repetition learning, and Tamil translation support.

## Features

- **ChatGPT-4 AI Generation**: Generate complete vocabulary lessons on-demand with automatic validation
- **Interactive Lessons**: 6-section vocabulary teaching framework (Memory Mastery, Meaning Expansion, Usage Mastery, Application, Mastery)
- **In-App Spaced Repetition**: SM-2 algorithm for optimal flashcard scheduling and vocabulary recall practice
- **Tamil Translation**: Automatic translation of English vocabulary to Tamil using Google Translate API
- **Multi-Method Authentication**: Email/password, OAuth (Google/GitHub), and magic links
- **Progress Tracking**: Detailed analytics on learning progress, mastery levels, and retention
- **25 Vocabulary Categories**: Organized across 6 CEFR levels (A1-C2)

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (React 18+, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand + React Query
- **UI Components**: Framer Motion, Recharts

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **APIs**: OpenAI ChatGPT-4, Google Translate

### DevOps
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Deployment**: Vercel (Frontend) + Railway (Backend)

## Quick Start (macOS)

### Prerequisites
```bash
brew install node postgresql redis docker
brew services start postgresql
brew services start redis
```

### Development Setup

```bash
# Clone and install
git clone <repo-url>
cd english-learning-platform
yarn install

# Set up environment variables
cp .env.example .env.local

# Start with Docker
docker-compose up -d

# Or run locally
yarn dev
```

### Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Project Structure

```
english-learning-platform/
├── packages/
│   ├── frontend/           # Next.js app
│   │   ├── app/           # Next.js app directory
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and hooks
│   │   └── public/        # Static assets
│   └── backend/           # Express API
│       ├── src/
│       │   ├── database/  # Database schema & migrations
│       │   ├── routes/    # API endpoints
│       │   ├── services/  # Business logic
│       │   ├── middleware/# Auth, validation
│       │   └── utils/     # Helper functions
│       └── tests/         # Test files
├── docker-compose.yml     # Local development containers
├── .gitignore
└── package.json
```

## Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/english_learning
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
GOOGLE_TRANSLATE_API_KEY=...
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
NODE_ENV=development
```

## Development

### Running Tests
```bash
yarn test
```

### Linting & Type Checking
```bash
yarn lint
yarn type-check
```

### Building for Production
```bash
yarn build
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/oauth/google` - Google OAuth
- `POST /api/auth/magic-link/send` - Send magic link
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Vocabulary Endpoints
- `GET /api/vocabulary/categories` - List all categories
- `GET /api/vocabulary/categories/:id/words` - Get words in category
- `GET /api/vocabulary/words/:id/lesson` - Get complete lesson

### ChatGPT Integration
- `POST /api/ai/generate-vocabulary` - Generate lesson with AI
- `GET /api/ai/generation-status/:id` - Check generation progress
- `GET /api/ai/generation-history` - View past generations

### Progress & Learning
- `GET /api/progress/user` - Get user progress
- `POST /api/progress/word/:wordId/review` - Record word review
- `GET /api/flashcards/queue` - Get due flashcards
- `POST /api/flashcards/review` - Submit flashcard review

See [API Documentation](./docs/API.md) for complete endpoint details.

## Implementation Phases

- **Phase 1** (Weeks 1-4): Foundation - Project setup, auth, database
- **Phase 2** (Weeks 5-8): Core Learning - Vocabulary, lessons, ChatGPT integration
- **Phase 3** (Weeks 9-12): Spaced Repetition - In-app flashcards, SM-2 algorithm
- **Phase 4** (Weeks 13-16): Enhanced Features - Translations, search, filtering
- **Phase 5** (Weeks 17-20): Advanced Features - Grammar, communication, analytics
- **Phase 6** (Weeks 21-24): Polish & Deployment - Testing, optimization, launch

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for English language learners worldwide**
