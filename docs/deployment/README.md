# Deployment Guide

## Prerequisites

- Node.js 22.x LTS
- PostgreSQL 18.x
- Redis 7.x
- pnpm 9.x

## Environment Variables

Create `.env` files for each app:

### API (apps/api/.env)
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agentiful

# Redis
REDIS_URL=redis://localhost:6379

# Auth
SESSION_SECRET=your-secret-key-min-32-chars
BCRYPT_ROUNDS=12

# Email
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Agentiful

# App
APP_URL=http://localhost:3000
API_PORT=3001
NODE_ENV=development
```

### Web (apps/web/.env)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Setup

```bash
# Create database
createdb agentiful

# Run migrations
pnpm --filter @agentifui/db db:migrate

# Seed initial data
pnpm --filter @agentifui/db db:seed
```

## Development

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev

# Or start individually:
pnpm --filter @agentifui/api dev
pnpm --filter @agentifui/web dev
pnpm --filter @agentifui/worker dev
```

## Production

### Build

```bash
pnpm build
```

### Run

```bash
# Start API
pnpm --filter @agentifui/api start

# Start Web
pnpm --filter @agentifui/web start

# Start Worker
pnpm --filter @agentifui/worker start
```

### Docker

```bash
docker-compose up -d
```

## Health Checks

- API: `GET /health`
- Ready: `GET /ready`
