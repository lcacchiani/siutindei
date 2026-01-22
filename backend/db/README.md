# Database migrations (Alembic)

This directory contains Alembic migrations for the Aurora PostgreSQL
schema.

## Requirements

- Python 3.11+
- `alembic` and `sqlalchemy` installed in your environment.

## Run migrations

Set your database URL (UTC only):

```
export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"
```

Apply migrations:

```
alembic -c backend/db/alembic.ini upgrade head
```

Generate a new migration:

```
alembic -c backend/db/alembic.ini revision -m "add new table"
```
