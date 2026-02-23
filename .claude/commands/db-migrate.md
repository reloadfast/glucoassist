# Database Migration

Generate and apply an Alembic migration.

Usage: `/db-migrate <short description of schema change>`

## Steps

1. **Generate**
   ```bash
   cd backend
   alembic revision --autogenerate -m "<description>"
   ```

2. **Review** — read the generated file in `alembic/versions/`. Confirm:
   - Upgrade and downgrade operations look correct
   - No unintended table/column drops
   - Data types match the SQLAlchemy model definitions

3. **Apply**
   ```bash
   alembic upgrade head
   ```

4. **Verify**
   ```bash
   alembic current
   ```
   Confirm the revision ID matches the generated file.

## Rollback (if needed)

```bash
alembic downgrade -1
```

Always read the migration file before applying. If autogenerate produces unexpected drops, investigate the model definition before proceeding.
