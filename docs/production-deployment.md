# Production Deployment Plan

## Deployment Boundary

Leslie's Restaurant Management System is designed for one dedicated Windows host on a
trusted private network. The host runs the React build, Express API, and SQLite database;
cashier and kitchen computers connect through a browser. Do not expose port 3000 through
router port forwarding, a public Wi-Fi network, or the public internet.

The application records cash, GCash, and Maya payment selections. It does not initiate or
verify external electronic-payment transactions.

## 1. Prepare the Host and Release

1. Install the supported Node.js 22 release and npm 10 on a dedicated Windows computer.
2. Use a dedicated, non-administrator Windows account to run the application. Give that
   account modify access only to the application folder and `C:\ProgramData\LesliesRMS`.
3. Reserve the host's IPv4 address in the router or provide a stable local hostname.
4. From the application directory, install the locked dependencies and run the release
   checks:

   ```powershell
   npm ci
   npm run check
   npm audit --omit=dev
   ```

5. Copy `.env.example` to `.env`. Keep the database on the host's local disk, outside the
   Git checkout:

   ```dotenv
   HOST=0.0.0.0
   PORT=3000
   DATABASE_PATH=C:\ProgramData\LesliesRMS\data\restaurant.db
   ```

Do not place the SQLite database on a mapped drive, network share, Dropbox, OneDrive, or
another synchronized folder.

## 2. Create Clean Production Data

For a new installation, create the schema and the first administrator:

```powershell
npm run db:init
npm run admin:create
```

The administrator command requires a local interactive terminal, masks both password
entries, requires 12-128 characters, and refuses to run after any account exists. Do not
save the password in `.env`, documentation, scripts, or the source tree.

For a host that previously contained demonstration data:

1. Stop the server and confirm no `.server.lock` file belongs to a running process.
2. Back up the old database to removable or otherwise separate storage:

   ```powershell
   npm run db:backup -- D:\LesliesBackups\pre-production.db
   ```

3. Verify that the backup command reports a successful, valid standalone backup.
4. Remove the old active `.db`, `.db-wal`, and `.db-shm` files. Never reuse that database
   as the production database.
5. Run `npm run db:init` and `npm run admin:create` against the configured production path.

After the administrator signs in, configure data in this order: employees, menu
categories, menu items, restaurant tables, and inventory opening balances. Give each
employee a unique account and password.

## 3. Build, Start, and Validate

Build once for each release, then start the already-built server:

```powershell
npm run build
npm run start:production
```

The server refuses to start if `client/dist/index.html` or an active administrator is
missing. A successful startup prints the local URLs and database path.

Allow Node.js through Windows Firewall on the **Private** profile only. Validate from both
the host and one client device:

- `http://HOST:3000/api/health` returns HTTP 200 and reports SQLite connected.
- The login page loads without development credentials.
- The administrator can create and edit each type of setup record.
- A cashier can save and print a test order.
- Kitchen staff can advance that order through Completed.
- The table is released and the completed order appears in sales reports.

Archive or clearly identify the validation transaction before normal operations begin.

## 4. Unattended Startup and Operations

Create a Windows Task Scheduler task under the dedicated application account:

- Trigger: **At startup**, delayed 30 seconds.
- Program: the full path to `npm.cmd` (normally `C:\Program Files\nodejs\npm.cmd`).
- Arguments: `run start:production`.
- Start in: the application directory.
- Settings: restart after one minute on failure, attempt three restarts, and do not start a
  second instance while the task is already running.

Create a separate daily scheduled task with `run db:backup -- D:\LesliesBackups` and the
same **Start in** directory. Keep at least seven daily and four weekly backups, with one
current copy off the host computer. Once per month, restore a recent backup to a temporary
database path and run the application checks against it.

Operational checks:

- At opening: confirm the scheduled task is running, the health endpoint succeeds, and
  cashier/kitchen devices can connect.
- At closing: confirm the day's completed-order totals and the latest backup timestamp.
- After a power interruption: confirm health, table statuses, and the SQLite backup before
  accepting new orders.

## 5. Upgrade, Recovery, and Rollback

Before every upgrade, create a named backup and retain the previous source release. Then
stop the scheduled task, run `npm ci`, `npm run check`, and `npm run build`, and restart the
task. Confirm health and perform one role-based smoke test.

To restore data, stop the server and run:

```powershell
npm run db:restore -- D:\LesliesBackups\restaurant-backup-YYYYMMDD-HHMMSS.db
```

Restore validates the selected database and creates a safety backup of the current
database. If an application upgrade fails, stop the task, restore the previous source
release and its matching backup when required, rebuild, restart, and repeat the health and
workflow checks.

The release is production-ready only when the automated checks pass, the active database
contains no sample accounts or transactions, the first real administrator can log in, a
backup has been verified, and client devices can complete the full order workflow.
