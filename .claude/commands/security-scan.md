# Security Scan

Run all security checks. Report findings grouped by severity.

## Python — static analysis

```bash
cd backend
bandit -r app/ -ll -f text
```

Fail on any HIGH severity finding. MEDIUM findings: report but do not block.

## Python — dependency audit

```bash
cd backend
pip-audit -r requirements.txt
```

Fail on any known CVE regardless of severity.

## Frontend — dependency audit

```bash
cd frontend
npm audit --audit-level=high
```

Fail on CRITICAL or HIGH. Report MODERATE for awareness.

## Summary

- List each finding: tool / severity / file:line / description
- State overall: PASS or FAIL
- For failures: suggest remediation (update package version, fix code pattern)
- Never suppress findings with noqa/eslint-disable without a justification comment in the code
