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

Initialize the local database, create the first administrator, and start the development servers:

```bash
npm run db:init
npm run admin:create
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:3000` by default.

For normal use on the restaurant network, build and run the production application on
the dedicated host computer:

```bash
npm run build
npm run start:production
```

The server prints the addresses that other computers can open, such as
`http://192.168.1.50:3000`. All devices use the same SQLite database on the host computer.
See the [production deployment guide](docs/production-deployment.md) before installing
the application for restaurant use.

## First Administrator

No accounts or restaurant records are created automatically. Run the following command
once on the host computer and enter the administrator name, username, and a unique
password when prompted:

```bash
npm run admin:create
```

The password is masked while it is entered. After the first account exists, create all
additional administrator, cashier, and kitchen accounts from the Employees screen.

## Application Workflow

1. An administrator configures employees, menu items, tables, and inventory.
2. A cashier creates a dine-in or takeout order and records its payment.
3. Kitchen staff move the order from Pending to Preparing, Ready, and Completed.
4. Completed dine-in orders release their assigned tables automatically.
5. Administrators review inventory movements and reports for completed sales.

The cashier and kitchen views refresh automatically so menu, order, and table changes
appear without a manual reload. Returning focus to the cashier window also triggers an
immediate refresh.

## Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite frontend and Express API in development mode |
| `npm run build` | Create a production frontend build |
| `npm run db:init` | Create or update the empty SQLite schema without adding accounts or restaurant records |
| `npm run admin:create` | Securely create the first administrator in an empty database |
| `npm run check` | Build the frontend and run the server integration checks |
| `npm start` | Build and start the complete application for the local network |
| `npm run start:production` | Start an already-built production application |
| `npm run db:backup` | Create a consistent, timestamped SQLite backup |
| `npm run db:restore -- <file>` | Restore a validated backup while the server is stopped |

## Configuration

Copy `.env.example` to `.env` on the production host and adjust it for that computer.
The server accepts these environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Network interface used by the production server |
| `PORT` | `3000` | Express API port |
| `DATABASE_PATH` | `server/data/restaurant.db` | SQLite database file location; use a durable path outside the source checkout in production |

The Vite development server proxies `/api` requests to `http://localhost:3000`. If the API port changes, update the proxy target in `client/vite.config.js` as well.

## Local Network Setup

Use one dedicated Windows computer as the host. Install Node.js and this project only on
that computer, connect it to the restaurant's private network, build the application, and
run `npm run start:production` from the project directory. Stop it safely with `Ctrl+C`.
For unattended startup and restart behavior, follow the Windows Task Scheduler procedure
in the production deployment guide.

On every other computer, open one of the LAN addresses printed by the server. For a stable
address, reserve the host computer's IPv4 address in the router's DHCP settings or use a
hostname that the other computers can resolve.

If Windows asks for network access, allow Node.js on **Private networks** only. Otherwise,
create an inbound Windows Firewall rule for TCP port `3000` on the Private profile. Do not
enable router port forwarding or expose this HTTP application to the public internet.

If a client cannot connect, confirm that:

- The host and client are connected to the same private network.
- `npm start` is still running on the host.
- The client is using the printed LAN address, not `localhost`.
- Windows Firewall permits TCP port `3000` on the Private profile.

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
|       |-- database/       Schema, connection, bootstrap, backup, and restore logic
|       |-- middleware/     Authentication and authorization
|       `-- routes/         REST API route modules
|-- docs/                   Scope, requirements, diagrams, and wireframes
|-- Architecture.md         Technical architecture notes
`-- implementation-phases.md
```

## Local Data

The SQLite database is created at `server/data/restaurant.db`. Database files, journals, backups, dependencies, generated builds, logs, and local environment files are intentionally excluded from Git.

`npm run db:init` is safe to run more than once: it applies the schema and reconciles
table occupancy without inserting users or business data.

SQLite is sufficient for the intended small LAN installation because only the Express
server opens the database file. Client computers communicate with Express over HTTP and
must never open, copy, or place `restaurant.db` on a shared network drive.

Create a backup at any time, including while the server is running:

```bash
npm run db:backup
```

The default destination is `server/data/backups/restaurant-backup-<timestamp>.db`. To use
another folder or exact `.db` filename, pass it after `--`:

```bash
npm run db:backup -- D:\LesliesBackups
npm run db:backup -- D:\LesliesBackups\friday-closing.db
```

Store at least one current backup outside the project directory. To restore, first stop
the server with `Ctrl+C`, then run:

```bash
npm run db:restore -- D:\LesliesBackups\friday-closing.db
```

Restore validates the backup before making changes and saves the current database under
`server/data/backups/before-restore-<timestamp>.db`. A running server, corrupt SQLite file,
or database without the required application tables is rejected.

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
- [Production deployment guide](docs/production-deployment.md)
- [Architecture](Architecture.md)
- [Project goals](goals.md)
- [Implementation phases](implementation-phases.md)
