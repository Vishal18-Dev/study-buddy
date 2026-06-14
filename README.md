# StudyBuddy AI

Personalised AI study companion — generates day-by-day study plans, tracks progress with daily check-ins, maintains streaks, and auto-generates MCQ quizzes.

---

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd studybuddy
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `GEMINI_API_KEY` — get a free key at https://aistudio.google.com
- `JWT_SECRET` — any random 32+ char string
- `NEXTAUTH_SECRET` — any random 32+ char string

All other vars can stay as-is for local dev.

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

Wait for both containers to be healthy:
```bash
docker compose ps
```

### 4. Set up the database

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed test user (test@studybuddy.com / password123)
npm run prisma:seed
```

### 5. Run the apps

```bash
# Run both API and web in parallel
npm run dev
```

- **API:** http://localhost:4000
- **Web:** http://localhost:3000
- **Prisma Studio:** `npm run prisma:studio`

---

## Project Structure

```
studybuddy/
├── apps/
│   ├── web/               # Next.js 14 frontend (App Router)
│   └── api/               # Express backend API
├── packages/
│   └── shared/            # Shared TypeScript types
├── prisma/
│   ├── schema.prisma      # Database schema (source of truth)
│   └── seed.ts            # Test data seeder
├── .env.example           # All required env vars
├── docker-compose.yml     # PostgreSQL (pgvector) + Redis
└── package.json           # Root npm workspace
```

---

## API Overview

All routes prefixed `/api`. Auth routes are public; all others require `Authorization: Bearer <jwt>` header.

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT |
| GET | `/api/auth/me` | Current user |
| POST | `/api/plans/create` | Generate AI study plan |
| GET | `/api/plans/active` | Active plan |
| GET | `/api/plans/:id` | Plan detail |
| POST | `/api/plans/:id/replan` | Recalculate plan |
| POST | `/api/checkin` | Submit daily check-in |
| GET | `/api/checkin/today` | Today's check-in status |
| PATCH | `/api/topics/:id/status` | Update topic status |
| POST | `/api/quiz/generate` | Generate MCQs for topic |
| POST | `/api/quiz/submit` | Submit quiz answers |
| GET | `/api/streaks/me` | Streak data |
| POST | `/api/streaks/grace` | Use grace day |
| POST | `/api/upload/syllabus` | Upload PDF syllabus |
| GET | `/api/dashboard` | Aggregated dashboard data |

---

## Railway Deployment

The project is structured for Railway's multi-service deployment:

1. **Create two Railway services:** `studybuddy-api` and `studybuddy-web`
2. **Add Railway PostgreSQL plugin** → set `DATABASE_URL`
3. **Add Railway Redis plugin** → set `REDIS_URL`
4. **API service:** set root dir to `apps/api`, start command `npm start`
5. **Web service:** set root dir to `apps/web`, start command `npm start`
6. Set all env vars from `.env.example` in Railway dashboard

See `railway.toml` for per-service configuration.

---

## Test User

After seeding:
- **Email:** `test@studybuddy.com`
- **Password:** `password123`
