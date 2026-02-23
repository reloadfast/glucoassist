# Start a New Feature

Usage: `/new-feature <issue-number> <brief-description>`

Example: `/new-feature 3 docker-single-container`

## Steps

1. **Verify clean state**
   ```bash
   git status
   git pull origin main
   ```
   If there are uncommitted changes, stop and ask the user to resolve them first.

2. **Create branch**
   ```bash
   git checkout -b feature/<brief-description>
   ```
   Branch naming: `feature/`, `fix/`, `chore/`, `docs/` prefixes.

3. **Link issue**
   Remind the user: reference `Closes #<issue-number>` in the PR description (not the commit).

4. **Checklist before opening PR**
   - [ ] `/run-tests` passes (≥80% BE coverage)
   - [ ] `/security-scan` passes (no HIGH/CRITICAL)
   - [ ] Conventional commit messages (`feat:`, `fix:`, `chore:`, etc.)
   - [ ] `.env.example` updated if new env vars added
   - [ ] If ports/volumes changed: `/unraid-sync` done
   - [ ] No `.env`, secrets, or personal data committed

5. **Open PR**
   ```bash
   gh pr create --assignee @me
   ```
   Title format: `feat: <description> (#<issue-number>)`
