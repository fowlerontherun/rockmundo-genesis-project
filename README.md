# Rockmundo Beta 

## Project info

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```
**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Skills data pipeline

The Supabase schema now includes a `public.skills` table that stores the canonical skill tree used by the game. The table is
managed by the `20261201090000_create_skills_table.sql` migration and contains the following columns:

- `skill_id`: primary key that matches the slug defined in the frontend skill tree data
- `skill_name`: human-readable name sourced from the definition `display_name`
- `skill_child_id`: array of direct child skill slugs for traversing the tree
- `skill_parent_id`: nullable reference to the immediate prerequisite tier
- Impact columns (`learning_impact`, `performance_impact`, `xp_impact`, `recording_impact`, `writing_impact`, `fame_impact`, `sales_impact`)

Seed data is generated automatically from the frontend definitions:

```sh
# Rebuild the deterministic seed SQL after editing src/data/skillTree.ts
bun run scripts/seedSkillsTable.ts

# Apply the schema and seed data locally
supabase db reset
```

The migration pulls in the generated `supabase/seed/skills_seed.sql` file, so running the script keeps migrations and runtime data
in sync.

## Profile data reset for the new flow

Deployments that introduce the refreshed profile flow must run the `20270431150000_reset_profile_data.sql` migration before
serving traffic. The migration truncates all profile-linked XP, attribute, skill, wallet, and progression tables (using
`TRUNCATE ... RESTART IDENTITY CASCADE`) and then clears `public.profiles`. This guarantees dependent sequences are reset and no
stale profile data survives the reset.

Run the Supabase migrations in your target environment prior to rollout:

```sh
supabase db push
# or for a full local refresh
supabase db reset
```

This data-only migration does not change the schema, so the generated Supabase TypeScript definitions stay in sync without any
additional regeneration.

## Pull request workflow & field reference

Use short, descriptive branches, commit frequently, and open PRs that clearly link to their related tasks. Every PR should
summarize the change, outline testing, and note deployment considerations (migrations, environment variables, or flags). Include
screenshots for visible UI updates and call out any Supabase table impacts so reviewers can validate PR data views.

Key PR fields to keep consistent:

- **Title**: Action-oriented summary (e.g., "Add PR analytics rollups to dashboard").
- **Description**: Context, approach, and risks, including schema/config changes.
- **Testing notes**: Commands you ran and their outcomes.
- **Deployment considerations**: Environment variable updates or migrations.

See `docs/pr-workflow-guide.md` for a full checklist, environment variable expectations, and backlog items.
