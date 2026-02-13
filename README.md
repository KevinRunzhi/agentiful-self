# Agentiful Monorepo

<p>
  <img alt="Node version" src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen">
  <img alt="PNPM version" src="https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8+-blue">
</p>

Multi-tenant AI agent platform with authentication, group management, and SSO support.

## Project Structure

```
agentiful/
├── apps/
│   ├── web/          # Next.js 16 + React 19 frontend
│   ├── api/          # Fastify 5.x backend service
│   └── worker/       # BullMQ background worker
├── packages/
│   ├── shared/       # Shared TypeScript types
│   ├── ui/           # shadcn/ui components
│   └── db/           # Drizzle ORM schemas
└── docs/
    └── tech/         # Architecture documentation
```

## Quick Start

### Prerequisites

- Node.js 22.x LTS
- pnpm 9.x
- PostgreSQL 18
- Redis 7.x

### Installation

```bash
pnpm install
```

### Development

```bash
# Start all services
pnpm dev

# Start specific service
pnpm --filter @agentifui/web dev
pnpm --filter @agentifui/api dev
```

### Database

```bash
# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio
pnpm db:studio
```

### Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Linting
pnpm lint
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, Zustand, shadcn/ui, Tailwind CSS v4
- **Backend**: Fastify 5.x, better-auth, Drizzle ORM
- **Database**: PostgreSQL 18, Redis 7.x
- **Testing**: Vitest, Playwright

## License

Proprietary - All rights reserved
