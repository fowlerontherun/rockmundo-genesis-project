# Pull Request Workflow Guide

## Workflow overview
1. **Create a branch** using a short, descriptive name (e.g., `feature/pr-insights` or `bugfix/reputation-rollups`).
2. **Commit frequently** with meaningful messages that explain the intent of each change.
3. **Open a pull request (PR)** that links to the relevant task or issue and clearly states the scope of the change.
4. **Request review** from the appropriate reviewer(s) and resolve feedback with follow-up commits.
5. **Validate checks** by confirming lint/tests pass and that the Supabase-connected PR data views still load.
6. **Merge when green** after approvals and CI checks succeed, following your repository's merge strategy.

## PR field descriptions
- **Title**: One-line summary of the change. Use action verbs and include scope (e.g., "Add PR analytics rollups to dashboard").
- **Description**: Context, approach, and risks. Call out data changes (Supabase tables, seeds) and any feature flags.
- **Linked issue/task**: URL or ID for the planning artifact that the PR fulfills.
- **Testing notes**: Commands run (lint, type-check, unit/e2e tests) and a brief outcome summary.
- **Screenshots/recordings**: Visual confirmation for UI changes, including before/after when relevant.
- **Deployment considerations**: Migrations, environment variable updates, or config flags that operators must apply.

## Environment configuration for PR data
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`: Required for fetching and mutating PR campaign data stored in Supabase tables.
- `VITE_PR_API_BASE_URL`, `VITE_PR_API_TOKEN`: Optional gateway to external PR metadata (e.g., GitHub/GitLab endpoints) when augmenting in-app dashboards.
- `VITE_MAPBOX_PUBLIC_TOKEN`: Needed if you surface PR coverage by geography via the map widget.

## Backlog & future enhancements
- TODO: **Analytics integration** that aggregates Supabase metrics (reach, sentiment, conversions) and renders comparative trends per campaign.
- TODO: **AI-assisted pitch drafting** to pre-populate campaign proposals and media responses with on-brand copy suggestions.
- TODO: **Webhook listener** for external PR events to keep Supabase tables in sync with newsroom or CI alerts.
