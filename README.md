# Leslie's Restaurant Management System

A full-stack, offline-first restaurant operations application created as a school project for Leslie's Restaurant. It brings administration, cashier ordering, kitchen workflow, inventory tracking, and sales reporting into one local system.

## Features

- Role-based authentication for administrators, cashiers, and kitchen staff
- Employee, menu category, menu item, and restaurant table management
- Dine-in and takeout ordering with cash, GCash, and Maya payment records
- Printable receipts and searchable order history
- Live kitchen queue with guarded order-status progression
- Automatic table occupation and release for dine-in orders
- Inventory quantities, low-stock alerts, and audited stock movements
- Date-range sales summaries, payment breakdowns, daily charts, and best-seller reports
- Printable sales and inventory reports

## Technology

- React 19 and Vite 7
- Node.js and Express 5
- SQLite through `better-sqlite3`
- npm workspaces
- Plain CSS

## Requirements

- Node.js 22 or later
- npm 10 or later

## Getting Started

Clone the repository, then install the workspace dependencies:

```bash
git clone https://github.com/estoceorlan-dev/Restaurant-Management-System.git
cd Restaurant-Management-System
npm install
```

Initialize the local database and start the frontend and API together:

```bash
npm run db:init
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3000` by default.

## Demo Accounts

| Role | Username | Password | Primary workspace |
|---|---|---|---|
| Administrator | `admin` | `demo123` | Administration, inventory, and reports |
| Cashier | `cashier` | `demo123` | Orders, payments, receipts, and order history |
| Kitchen staff | `kitchen` | `demo123` | Kitchen queue and order preparation |

Dedicated test accounts are also seeded as `test_admin`, `test_cashier`, and `test_kitchen`, each with the password `test123`. These credentials are for local development and classroom demonstrations only; do not use them in production.

## Application Workflow

1. An administrator configures employees, menu items, tables, and inventory.
2. A cashier creates a dine-in or takeout order and records its payment.
3. Kitchen staff move the order from Pending to Preparing, Ready, and Completed.
4. Completed dine-in orders release their assigned tables automatically.
5. Administrators review inventory movements and reports for completed sales.

The cashier and kitchen views refresh automatically so order and table status changes appear without a manual reload.

## Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite frontend and Express API in development mode |
| `npm run build` | Create a production frontend build |
| `npm run db:init` | Create the SQLite schema and seed local demonstration data |
| `npm run check` | Build the frontend and run the server integration checks |
| `npm start` | Start only the Express API |

## Configuration

The server accepts these optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Express API port |
| `DATABASE_PATH` | `server/data/restaurant.db` | SQLite database file location |

The Vite development server proxies `/api` requests to `http://localhost:3000`. If the API port changes, update the proxy target in `client/vite.config.js` as well.

## Project Structure

```text
.
|-- client/                 React/Vite frontend
|   `-- src/
|       |-- components/     Shared interface components
|       |-- pages/          Role-specific application screens
|       `-- services/       API client
|-- server/                 Express and SQLite backend
|   `-- src/
|       |-- database/       Schema, connection, and seed logic
|       |-- middleware/     Authentication and authorization
|       `-- routes/         REST API route modules
|-- docs/                   Scope, requirements, diagrams, and wireframes
|-- Architecture.md         Technical architecture notes
`-- implementation-phases.md
```

## Local Data

The SQLite database is created at `server/data/restaurant.db`. Database files, journals, backups, dependencies, generated builds, logs, and local environment files are intentionally excluded from Git.

`npm run db:init` is safe to run more than once: it creates the schema and inserts missing seed records without duplicating existing records.

## Verification

Run the complete project check before submitting changes:

```bash
npm run check
```

The check builds the React application and verifies authentication, role permissions, administration CRUD, cashier orders, kitchen transitions, table updates, inventory, reports, API responses, and database behavior.

## Documentation

- [Project scope](docs/project-scope.md)
- [System requirements](docs/requirements.md)
- [System diagrams](docs/system-diagrams.md)
- [Initial wireframes](docs/wireframes.md)
- [Architecture](Architecture.md)
- [Project goals](goals.md)
- [Implementation phases](implementation-phases.md)
