# Project Setup Documentation

## Overview

This document describes the initial setup of the Dialysis Scheduler Backend, a NestJS application using GraphQL, PostgreSQL (via TypeORM), and Redis (via BullMQ).

---

## GraphQL

**Package:** `@nestjs/graphql`, `@nestjs/apollo`, `@apollo/server`, `graphql`

**Configuration** (`src/app.module.ts`):

```ts
GraphQLModule.forRoot<ApolloDriverConfig>({
  autoSchemaFile: true,
  introspection: true,
  playground: true,
  driver: ApolloDriver,
  resolvers: {},
})
```

- `autoSchemaFile: true` — generates the GraphQL schema in memory from decorators at runtime.
- `introspection: true` — allows clients to query the schema (needed for tools like GraphQL Playground).
- `playground: true` — enables the GraphQL Playground UI at `/graphql`.

---

## Environment Variables

**Package:** `@nestjs/config`, `joi`

**Configuration** (`src/app.module.ts`):

```ts
ConfigModule.forRoot({
  envFilePath: [
    process.env.STAGE === 'development'
      ? `.env.${process.env.STAGE}.local`
      : '.env',
  ],
  validationSchema: configValidationSchema,
})
```

### Why `process.env.STAGE` and not `ConfigService`?

`ConfigModule.forRoot` is itself the bootstrap step that makes `ConfigService` available. It runs before any NestJS module is instantiated, so `ConfigService` does not exist yet when `envFilePath` is evaluated — there is no way to use it here.

The solution is to embed `STAGE` directly in the npm scripts using `cross-env` (cross-platform compatible). Developers just run `npm run start:dev` — no manual prefix needed:

```json
"start:dev": "cross-env STAGE=development nest start --watch",
"start:prod": "cross-env STAGE=production node dist/main"
```

`cross-env` sets the environment variable before the process starts, so `process.env.STAGE` is populated by the time Node reads the config.

### Env file resolution

| Script          | `STAGE`       | Env file loaded           |
|-----------------|---------------|---------------------------|
| `start:dev`     | `development` | `.env.development.local`  |
| `start:debug`   | `development` | `.env.development.local`  |
| `start`         | `development` | `.env.development.local`  |
| `start:prod`    | `production`  | `.env`                    |

### Validation Schema (`src/config/config.schema.ts`)

| Variable       | Type   | Required | Default       | Description                              |
|----------------|--------|----------|---------------|------------------------------------------|
| `NODE_ENV`     | string | No       | `development` | Runtime environment                      |
| `STAGE`        | string | No       | `development` | Deployment stage                         |
| `DATABASE_URL` | string | Yes      | —             | Full Postgres connection URL (TypeORM)   |
| `REDIS_URL`    | string | Yes      | —             | Full Redis connection URL (BullMQ)       |
| `DB_USERNAME`  | string | Yes      | —             | Postgres username (used for DB creation) |
| `DB_HOST`      | string | Yes      | —             | Postgres host (used for DB creation)     |
| `DB_PASSWORD`  | string | Yes      | —             | Postgres password (used for DB creation) |
| `DB_PORT`      | number | No       | `5432`        | Postgres port (used for DB creation)     |
| `DB_NAME`      | string | Yes      | —             | Primary database name (`schedular-db`)   |
| `DB_NAME_TEST` | string | Yes      | —             | Test database name (`schedular-db-test`) |

---

## Database

### Auto-create Databases on Startup

Before NestJS initialises, `main.ts` calls `createDatabase` for each required database using the raw `pg` `Client` (no target database specified, so it can issue `CREATE DATABASE`):

```ts
// Create main database
await createDatabase(process.env.DB_NAME);

// Create test database
await createDatabase(process.env.DB_NAME_TEST);
```

If a database already exists (Postgres error code `42P04`) it logs a notice and continues. Other errors are logged but do not crash the process.

### PostgreSQL (TypeORM)

**Package:** `@nestjs/typeorm`, `typeorm`, `pg`

Configured via `TypeOrmModule.forRootAsync` using the `DATABASE_URL` env variable.

- `autoLoadEntities: true` — automatically loads entities registered with `TypeOrmModule.forFeature`.
- `synchronize: true` in non-production — auto-syncs schema changes (do not use in production).
- SSL is enabled with `rejectUnauthorized: false` to support self-signed AWS RDS certificates.

### Redis (BullMQ)

**Package:** `@nestjs/bullmq`, `bullmq`

Configured via `BullModule.forRootAsync` using the `REDIS_URL` env variable.

---

## File Structure

```
src/
├── config/
│   └── config.schema.ts       # Joi validation schema for environment variables
├── database/
│   ├── database.module.ts     # NestJS module that imports database providers
│   └── database.provider.ts   # TypeORM and BullMQ connection factories
├── app.module.ts              # Root module — wires together Config, GraphQL, Database
├── app.controller.ts
├── app.service.ts
└── main.ts                    # Bootstrap — creates DBs then starts the app
```
