# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c3d67299-48a1-4744-a78e-1169f70eea31

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c3d67299-48a1-4744-a78e-1169f70eea31) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

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

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

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

## Testing and QA

Run the suites locally with the following commands:

- Unit/logic tests: `npm run test` (uses Bun under the hood)
- Component tests: `npm run test:component`
- End-to-end tests: `npm run test:e2e`

The E2E suite uses Playwright and a mock Supabase layer. Start the dev server with the same settings used in CI to expose the
app on all interfaces:

```sh
npm run dev -- --host 0.0.0.0 --port 4173
```

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

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c3d67299-48a1-4744-a78e-1169f70eea31) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
