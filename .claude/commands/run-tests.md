# Run GlucoAssist Test Suite

Run all tests and report results. Stop at first suite failure.

## Backend

```bash
cd backend
python -m pytest tests/ -v --cov=app --cov-report=term-missing
```

- Fail if coverage < 80%
- Report count: passed / failed / skipped
- List any failing test names

## Frontend

```bash
cd frontend
npm run test -- --coverage --reporter=verbose
```

- Report pass/fail count
- Note any uncovered critical paths

## Summary

After both suites complete:
- Overall pass/fail status
- Coverage percentages (BE + FE)
- Any HIGH/CRITICAL issues to fix before PR

Do not mark passing if any test is failing.
