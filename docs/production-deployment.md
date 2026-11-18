# Deployment guide

## Vercel and Neon

The production frontend is [leslies-restaurant.vercel.app](https://leslies-restaurant.vercel.app). It uses the `leslies-restaurant` Vercel project and the Neon `restaurant` function on the production branch.

Vercel hosts the frontend. Neon hosts the restaurant API and PostgreSQL database. Set up Neon first so you have the API address when Vercel asks for its environment variables.

### 1. Create the Neon project

In the [Neon Console](https://console.neon.tech/), choose **New Project**. Enter a name such as `leslies-restaurant`, choose **AWS Asia Pacific (Singapore)**, and enable **Postgres database** and **Functions**. Create the project and note the production branch name. The app manages its own employee accounts and stores menu photos in PostgreSQL. [Neon Functions documentation](https://neon.com/docs/compute/functions/overview)

### 2. Initialize the database

Use Node.js 24. In a terminal at the repository root, install the dependencies and run the release checks:

```sh
npm ci
npm run check
```

If the Neon CLI is missing, install it with `npm install -g neon`. Then link this checkout to the project and production branch you selected:

```sh
neon auth
neon link --no-env-pull
neon env pull -s postgres --file .env
npm run db:init
```

Look for **PostgreSQL schema initialized**. The ignored root `.env` contains the pooled `DATABASE_URL` for the API and the direct `DATABASE_URL_UNPOOLED` for setup and migration. Keep this file private. In Windows PowerShell, use `npm.cmd` and `neon.cmd` if local script execution is restricted.

The application commands also load `.env.local`, which Neon uses when `.env` is absent. Vite development and preview use the pulled branch variables to proxy API requests to the deployed `restaurant` function. Set `RESTAURANT_API_ORIGIN` to override that target.

Choose one path for your records:

- **New installation.** Run `npm run admin:create` in an interactive terminal. Enter the first administrator's name, username, and password. The command masks the password and works only while the user table is empty.
- **Existing SQLite installation.** Before creating an account in PostgreSQL, import a backup into an initialized, empty destination. Rehearse on a preview branch and compare employee counts, stock balances, and a known receipt. At cutover, stop writes on the SQLite host, take a final backup with `npm run db:backup` on that host, and run the following against the production Neon branch:

  ```sh
  npm run db:import-sqlite -- "/path/to/restaurant-backup.db"
  ```

  The import preserves record IDs, password hashes, orders, inventory history, and menu photos. Employees sign in again after cutover. Keep the original backup until the new installation has been verified.

### 3. Publish the API

```sh
neon deploy
neon functions get restaurant
```

Copy the function's HTTPS invocation URL. Append `/api/health` and visit it in a browser. The response should include `"status":"ok"` and `"database":"PostgreSQL connected"`. Use the base HTTPS origin for the Vercel setting below.

### 4. Import the frontend into Vercel

Open the [Vercel dashboard](https://vercel.com/dashboard), select **Add New → Project**, and import this GitHub repository. Configure the project before choosing **Deploy**. [Vercel Git deployment documentation](https://vercel.com/docs/git)

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `client` |
| Framework preset | Vite |
| Node.js version | 24.x |
| Build and output | The [tracked configuration](../client/vercel.mjs) builds the client workspace and publishes `dist`. |
| Production environment variable | `RESTAURANT_API_ORIGIN` = the Neon Function HTTPS origin, with no path, query, or credentials |

For Vercel previews, set the same variable in the **Preview** environment to the function URL from a separate Neon branch. Deploy again after changing the origin. PostgreSQL connection strings belong in the backend environment.

### 5. Verify the release

1. Open `/api/health` on the **Vercel domain**. A PostgreSQL response confirms that the frontend rewrite reaches the API.
2. Sign in as an administrator. Add a category and a menu item with a photo. Create cashier and kitchen accounts.
3. As the cashier, place a test order and open its receipt. As kitchen staff, advance it to **Completed**. Confirm the table becomes available for a dine-in order and that the completed sale appears in **Reports**.
4. For automated PostgreSQL checks, set `TEST_POSTGRES_URL` in your shell to a direct connection for a test database and run `npm run check`. The suite creates and removes an isolated schema.

For cloud recovery, use Neon branch restore or a PostgreSQL backup made with the direct connection. Menu photos are part of the database. When rolling back a release, pair the previous Vercel build with its compatible API revision and database schema.

## Private-network deployment with SQLite

Use one host with Node.js 24 on the restaurant's private LAN. Give it a stable hostname or reserved IP address. Place the database on its local disk and give the service account write access to that directory.

1. Install dependencies with `npm ci`. Copy [the example environment](../.env.example) to `.env` in the repository root. Leave both PostgreSQL connection variables unset and configure a durable local database path. For example, on Windows:

   ```dotenv
   HOST=0.0.0.0
   PORT=3000
   DATABASE_PATH=C:\ProgramData\LesliesRMS\data\restaurant.db
   ```

2. For a new installation, run `npm run db:init` and `npm run admin:create`. Run `npm run check` to build the frontend and exercise the application against disposable data.
3. Run `npm run start:production`. Allow TCP port 3000 on the private network profile. Staff can open the printed LAN address from their browsers. Check `/api/health` for `SQLite connected`.
4. For unattended Windows startup, create a Task Scheduler task under the service account with an **At startup** trigger. Set the program to the installed `npm.cmd`, arguments to `run start:production`, and **Start in** to the repository root.

### Backup, restore, and upgrade

Create a consistent backup while the server is running. Store a copy on a separate device:

```powershell
npm run db:backup -- "D:\LesliesBackups"
```

To restore, stop the server and supply the actual backup filename:

```powershell
npm run db:restore -- "D:\LesliesBackups\restaurant-backup-YYYYMMDD-HHMMSS.db"
npm run start:production
```

Restore validates the backup and preserves a safety copy of the current database. To upgrade, take a backup, stop the server, install the new release with `npm ci`, run `npm run check`, and restart. Verify sign-in, a saved receipt, and table availability before resuming service.
