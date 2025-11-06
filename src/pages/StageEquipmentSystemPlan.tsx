import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const architectureLayers = [
  {
    layer: "Backend (FastAPI)",
    description: "RESTful API managing equipment CRUD, player inventory, wear updates, and show-performance modifiers.",
  },
  {
    layer: "Database (SQLite -> Postgres for prod)",
    description: "Tables for equipment types, owned items, maintenance logs, vehicles, and shops.",
  },
  {
    layer: "Frontend (React/Vite + Tailwind)",
    description: "Player UI for viewing/buying/upgrading equipment and admin UI for managing types.",
  },
  {
    layer: "Scheduler Jobs (XP / World Pulse system)",
    description: "Daily wear, maintenance, repair, and sale updates triggered via cron or async tasks.",
  },
  {
    layer: "Microservices Integration",
    description: "Gig system calls equipment service for show quality modifiers; WorldPulse logs sales.",
  },
];

const databaseTables = [
  {
    name: "equipment_types",
    description: "Stores all possible equipment in the game (admin-managed).",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "name", type: "TEXT", description: "e.g. "Loudspeaker 2000W"" },
      { column: "category", type: "TEXT", description: ""Sound", "Lighting", "Visuals", "Effects", "Decor"" },
      { column: "base_power", type: "INTEGER", description: "Base power output (e.g. 2000)" },
      { column: "base_condition", type: "INTEGER", description: "Max condition value, defaults to 100" },
      { column: "purchase_cost", type: "INTEGER", description: "Cost in game currency" },
      { column: "maintenance_cost", type: "INTEGER", description: "Cost per maintenance action" },
      { column: "size_units", type: "INTEGER", description: "Used to calculate transport capacity" },
      { column: "image_url", type: "TEXT", description: "CDN image asset" },
      { column: "description", type: "TEXT", description: "Short info text" },
      { column: "required_vehicle_type", type: "TEXT", description: "Optional e.g. "Tour Bus"" },
      { column: "required_band_level", type: "INTEGER", description: "Optional progression gate" },
      { column: "rarity", type: "TEXT", description: "e.g. "Common", "Epic"" },
      { column: "created_at / updated_at", type: "DATETIME", description: "Record metadata" },
    ],
  },
  {
    name: "equipment_variants",
    description: "Optional upgraded versions of base types.",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "equipment_type_id", type: "INTEGER", description: "FK -> equipment_types" },
      { column: "variant_name", type: "TEXT", description: "e.g. "Deluxe 5000W"" },
      { column: "modifier_power", type: "INTEGER", description: "+ power bonus (e.g. +3000)" },
      { column: "modifier_cost", type: "INTEGER", description: "Additional purchase cost" },
      { column: "modifier_maintenance_cost", type: "INTEGER", description: "Additional maintenance cost" },
      { column: "created_at", type: "DATETIME", description: "Timestamp" },
    ],
  },
  {
    name: "player_equipment",
    description: "Represents owned items by players or bands.",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "band_id", type: "INTEGER", description: "FK -> bands" },
      { column: "equipment_type_id", type: "INTEGER", description: "FK -> equipment_types" },
      { column: "variant_id", type: "INTEGER", description: "FK -> equipment_variants (nullable)" },
      { column: "condition", type: "INTEGER", description: "0-100 condition score" },
      { column: "power_output", type: "INTEGER", description: "Calculated (base + variant + bonuses)" },
      { column: "city_id", type: "INTEGER", description: "FK -> cities" },
      { column: "in_vehicle_id", type: "INTEGER", description: "FK -> vehicles (nullable)" },
      { column: "is_in_use", type: "BOOLEAN", description: "Whether currently active for shows" },
      { column: "last_used_at", type: "DATETIME", description: "For wear updates" },
      { column: "purchased_at", type: "DATETIME", description: "For age tracking" },
    ],
  },
  {
    name: "equipment_maintenance_logs",
    description: "Tracks all repairs or breakdowns.",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "equipment_id", type: "INTEGER", description: "FK -> player_equipment" },
      { column: "action", type: "TEXT", description: ""repair", "maintenance", "breakdown"" },
      { column: "cost", type: "INTEGER", description: "Currency spent" },
      { column: "performed_at", type: "DATETIME", description: "Timestamp" },
      { column: "performed_by", type: "INTEGER", description: "FK -> player/admin" },
    ],
  },
  {
    name: "vehicles",
    description: "Link equipment to transport assets.",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "band_id", type: "INTEGER", description: "FK -> bands" },
      { column: "type", type: "TEXT", description: "e.g. "Van", "Tour Bus", "Truck"" },
      { column: "capacity", type: "INTEGER", description: "Total size units capacity" },
      { column: "location_city_id", type: "INTEGER", description: "FK -> cities" },
      { column: "condition", type: "INTEGER", description: "Optional vehicle condition" },
      { column: "created_at", type: "DATETIME", description: "Timestamp" },
    ],
  },
  {
    name: "equipment_shops",
    description: "Defines which equipment types are sold where.",
    columns: [
      { column: "id", type: "INTEGER", description: "Primary key" },
      { column: "city_id", type: "INTEGER", description: "FK -> cities" },
      { column: "equipment_type_id", type: "INTEGER", description: "FK -> equipment_types" },
      { column: "price_modifier", type: "FLOAT", description: "e.g. 1.1 for +10% markup" },
      { column: "available", type: "BOOLEAN", description: "Stock availability" },
    ],
  },
];

const backendEndpoints = [
  { path: "/equipment/types", method: "GET", description: "List all equipment types (filtered by category or shop)." },
  { path: "/equipment/types/{id}", method: "GET", description: "Get detail of a specific equipment type." },
  { path: "/equipment/purchase", method: "POST", description: "Buy an equipment item (requires band, type, city, transport check)." },
  { path: "/equipment/my", method: "GET", description: "List player's owned equipment." },
  { path: "/equipment/repair/{id}", method: "POST", description: "Repair or maintain equipment." },
  { path: "/equipment/load/{id}", method: "POST", description: "Load item into vehicle." },
  { path: "/equipment/unload/{id}", method: "POST", description: "Unload item." },
  { path: "/equipment/use/{id}", method: "POST", description: "Mark item as active." },
  { path: "/equipment/wear", method: "POST", description: "Apply wear after show (called by gig system)." },
  { path: "/admin/equipment", method: "POST", description: "Add new equipment type." },
  { path: "/admin/equipment/{id}", method: "PUT", description: "Update existing equipment type." },
  { path: "/admin/equipment/variant", method: "POST", description: "Add variant." },
  { path: "/admin/equipment/shoplink", method: "POST", description: "Add item to shop/city." },
];

const playerPages = [
  {
    name: "Stage Equipment Dashboard",
    url: "/band/:bandId/equipment",
    summary:
      "Lists all owned items grouped by category, shows condition bars, power output, and usage status with actions for load, repair, sell, and upgrade.",
  },
  {
    name: "Equipment Shop",
    url: "/city/:cityId/shop/equipment",
    summary:
      "Grid of available equipment for purchase in current city with pricing, stats, prerequisites, and purchase workflow.",
  },
  {
    name: "Maintenance/Repair Modal",
    url: "In-context modal",
    summary: "Shows repair costs, supports partial repairs, and animates progress feedback.",
  },
  {
    name: "Vehicle Loadout",
    url: "/band/:bandId/vehicles",
    summary: "Visual load planner with drag-and-drop into transport slots and capacity usage feedback.",
  },
  {
    name: "Condition Alerts",
    url: "Global notifications",
    summary: "Alerts trigger when any equipment drops below 20% condition to prompt maintenance.",
  },
];

const adminPages = [
  {
    name: "Equipment Type Manager",
    url: "/admin/equipment/types",
    summary: "CRUD for equipment types with search and modal-driven creation flows.",
  },
  {
    name: "Variant Manager",
    url: "/admin/equipment/variants",
    summary: "Filterable variant management tied to parent types.",
  },
  {
    name: "Shop Manager",
    url: "/admin/equipment/shops",
    summary: "Assign city availability and price modifiers for equipment stock.",
  },
  {
    name: "Balance Dashboard",
    url: "/admin/equipment/analytics",
    summary: "Charts covering usage rates, condition averages, revenue, and total power per band via WorldPulse/XP feeds.",
  },
];

const gameplayHighlights = [
  {
    title: "Show Quality Modifier",
    details: [
      "Formula: (Σ (equipment_power * condition%) / 100) * (Variety Bonus) * (Transport Bonus)",
      "Variety Bonus = +10% if at least one item from each major category.",
      "Transport Bonus = +10% when equipment is properly loaded and co-located with the show city.",
    ],
  },
  {
    title: "Wear & Tear",
    details: [
      "Condition Loss = base_loss + (gig_intensity / 10)",
      "base_loss ranges 1-3 based on gig size with slight randomized variance per item.",
    ],
  },
  {
    title: "Maintenance",
    details: [
      "Repair Cost = ((100 - condition) / 100) * maintenance_cost",
      "If condition < 20%, each gig adds 10% breakdown chance marking equipment temporarily unusable.",
    ],
  },
];

const backgroundJobs = [
  {
    job: "wear_update_job",
    frequency: "After each gig",
    description: "Decreases condition based on show size and gig intensity.",
  },
  {
    job: "repair_job",
    frequency: "Daily",
    description: "Applies pending maintenance tasks or clears breakdown flags when repaired.",
  },
  {
    job: "equipment_sale_refresh",
    frequency: "Weekly",
    description: "Refreshes shop stock and rotates rare equipment inventory.",
  },
  {
    job: "analytics_update",
    frequency: "Daily",
    description: "Syncs equipment stats to WorldPulse for leaderboards and analytics dashboards.",
  },
];

const StageEquipmentSystemPlan = () => {
  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-4 text-center">
        <Badge variant="outline" className="text-sm uppercase tracking-widest">Deployment &amp; Development Plan</Badge>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">ROCKMUNDO STAGE EQUIPMENT SYSTEM</h1>
          <p className="text-muted-foreground">Full Deployment &amp; Development Plan - Version 1.0 (November 2025)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Purpose</CardTitle>
          <CardDescription>Guiding goals for the end-to-end equipment lifecycle.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-6 text-left">
            <li>Manage equipment ownership, purchasing, upgrading, maintenance, and wear/tear for bands and artists.</li>
            <li>Integrate equipment status with vehicles and city locations to inform logistics gameplay.</li>
            <li>Influence gig/show performance, fame, and economic balance through equipment stats.</li>
            <li>Provide admin tooling to add new equipment, manage balancing, and track the in-game economy.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Overview</CardTitle>
          <CardDescription>Major components and responsibilities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Layer</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {architectureLayers.map((item) => (
                <TableRow key={item.layer}>
                  <TableCell className="font-medium">{item.layer}</TableCell>
                  <TableCell>{item.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Database Schema</h2>
          <p className="text-muted-foreground">Core tables supporting inventory, logistics, and commerce.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {databaseTables.map((table) => (
            <Card key={table.name}>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">{table.name}</CardTitle>
                <CardDescription>{table.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {table.columns.map((column) => (
                      <TableRow key={column.column}>
                        <TableCell className="font-medium">{column.column}</TableCell>
                        <TableCell>{column.type}</TableCell>
                        <TableCell>{column.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Backend Functionality</h2>
          <p className="text-muted-foreground">RESTful FastAPI surface for player and admin operations.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Primary routes consumed by gameplay, admin tools, and schedulers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backendEndpoints.map((endpoint) => (
                  <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                    <TableCell className="font-medium">{endpoint.method}</TableCell>
                    <TableCell className="font-mono text-sm">{endpoint.path}</TableCell>
                    <TableCell>{endpoint.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Frontend Implementation</h2>
          <p className="text-muted-foreground">Experience touchpoints for players and administrators.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Player-Facing Experiences</CardTitle>
              <CardDescription>UI surfaces guiding bands through acquisition, upkeep, and logistics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {playerPages.map((page) => (
                <div key={page.name} className="rounded-md border p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{page.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground">{page.url}</p>
                    <p className="text-sm text-muted-foreground">{page.summary}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Admin Consoles</CardTitle>
              <CardDescription>Tools for balancing content, pricing, and analytics oversight.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminPages.map((page) => (
                <div key={page.name} className="rounded-md border p-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{page.name}</h3>
                    <p className="text-sm font-mono text-muted-foreground">{page.url}</p>
                    <p className="text-sm text-muted-foreground">{page.summary}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Gameplay Logic</h2>
          <p className="text-muted-foreground">Formulas connecting equipment stats to show outcomes.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {gameplayHighlights.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {item.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Background Jobs &amp; Schedulers</h2>
          <p className="text-muted-foreground">Automations that keep the equipment ecosystem dynamic.</p>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backgroundJobs.map((job) => (
                  <TableRow key={job.job}>
                    <TableCell className="font-medium">{job.job}</TableCell>
                    <TableCell>{job.frequency}</TableCell>
                    <TableCell>{job.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <p className="text-center text-sm text-muted-foreground">
        This roadmap anchors the November 2025 launch scope for the Rockmundo Stage Equipment System and guides iteration across backend, frontend, and live operations.
      </p>
    </div>
  );
};

export default StageEquipmentSystemPlan;
