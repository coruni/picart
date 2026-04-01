# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

PicArt is a picture community backend API built with NestJS. It provides user management, article management, comment system, real-time messaging (WebSocket), achievements, points, favorites, and payment integration.

## Common Commands

```bash
# Development
pnpm run dev              # Start development server with watch mode
pnpm run start:debug      # Start with debugger attached

# Build & Production
pnpm run build            # Build the project
pnpm run start:prod       # Run production build

# Code Quality
pnpm run lint             # Run ESLint
pnpm run format           # Format with Prettier

# Testing
pnpm run test             # Run unit tests
pnpm run test:watch       # Run tests in watch mode
pnpm run test:cov         # Run tests with coverage
pnpm run test:e2e         # Run E2E tests
```

## Architecture

### Module Structure

The application follows NestJS modular architecture with 20+ feature modules under `src/modules/`:

- **Core**: user, article, comment, category, tag
- **Social**: message (WebSocket), report, favorite
- **Gamification**: achievement, points, decoration, emoji
- **Commerce**: order, payment, invite
- **Admin**: role, permission, config, banner, upload

### Key Patterns

**Authentication Flow:**
- JWT dual-token mechanism (Access Token + Refresh Token)
- `JwtAuthGuard` validates tokens globally
- Use `@NoAuth()` decorator to allow unauthenticated access
- Use `@Permissions('resource:action')` with `PermissionGuard` for authorization

**Controller Pattern:**
```typescript
@Controller('resource')
@ApiTags('Resource Management')
@ApiBearerAuth()
export class ResourceController {
  @Get()
  @UseGuards(JwtAuthGuard)  // Or @NoAuth() for public endpoints
  @ApiOperation({ summary: 'Description' })
  findAll(@Req() req: Request & { user: User }) {
    return this.service.findAll(req.user);
  }
}
```

**Event-Driven Architecture:**
Uses `@nestjs/event-emitter` for cross-module communication. Events follow `module.action` naming:
- `article.created`, `article.liked`, `article.receivedLike`
- `comment.created`, `comment.liked`
- `user.dailyLogin`, `user.followed`, `user.levelUp`

Event handlers are in `*-event.service.ts` files (e.g., `PointsEventService`, `AchievementEventService`).

**Response Format:**
All responses are transformed by `TransformInterceptor`:
```typescript
{
  code: 200,
  message: 'success',
  data: T,
  timestamp: number
}
```

Pagination uses `PaginationDto` from `src/common/dto/pagination.dto.ts`.

### Key Files

- `src/main.ts` - Application bootstrap, global pipes, filters, interceptors
- `src/app.module.ts` - Root module importing all feature modules
- `src/config/` - Configuration factories (database, jwt, cache, mailer, etc.)
- `src/common/` - Shared utilities, guards, decorators, interceptors, exceptions

### Database

- MySQL 8.0+ with TypeORM
- Entities in each module's `entities/` directory
- Uses `synchronize: false` in production (set via `DB_SYNC` env var)

### Cache

- Redis + in-memory cache via `@nestjs/cache-manager`
- Cache utilities in `src/common/utils/cache.util.ts`

### WebSocket

- Socket.io gateway at `/ws-message` endpoint
- JWT authentication in `message.gateway.ts`
- Test page available at `/static/public/websocket-test.html`

## Environment Setup

1. Copy `.env.example` to `.env`
2. Configure MySQL, Redis, and other services
3. Run `pnpm install`
4. Start with `pnpm run dev`

## API Documentation

Swagger available at `/api` when the server is running.