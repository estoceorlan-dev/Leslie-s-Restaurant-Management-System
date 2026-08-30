# System Architecture

## Project

Leslie's Restaurant Management System

## Architecture Overview

The system will use a simple three-layer web architecture. It will run locally and remain usable without an internet connection.

```text
Users
  Admin | Cashier | Kitchen Staff
                    |
                    v
          React Web Application
                    |
              HTTP/JSON API
                    |
                    v
          Node.js + Express Server
                    |
                    v
              SQLite Database
```

All users access the same React application. The application displays different dashboards and actions according to the logged-in employee's role.

## Deployment Model

The recommended school-project setup is offline-only:

- The React application, Express server, and SQLite database run on one computer.
- The application is opened through a web browser.
- Internet access is not required for normal operation.
- If desired, other computers on the same local network may connect to the host computer.
- The SQLite database is backed up by copying its database file while the application is stopped or through a backup function in the server.

## Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React with Vite | Screens, forms, navigation, and client-side interaction |
| Styling | Plain CSS | Lightweight, responsive initial interface |
| Backend | Node.js with Express | API endpoints, validation, authentication, and business rules |
| Database | SQLite | Local storage of users, menu items, orders, and inventory |
| Data access | better-sqlite3 | SQLite queries, transactions, and local persistence |
| Authentication | Hashed bearer-token sessions | Employee identity and role-based access |
| Charts | React and CSS | Lightweight offline sales charts without an external runtime dependency |
| Printing | Browser print styles | Receipts and reports |

SQLite is the default database. MySQL may replace it later if it is required by the instructor or if the system is expanded for heavier multi-computer use.

## Application Modules

### Authentication Module

- Employee login and logout
- Password verification
- Admin, cashier, and kitchen roles
- Protected routes and API endpoints
- Random 12-hour session tokens, stored as SHA-256 hashes in SQLite

### Administration Module

- Employee accounts
- Menu categories
- Menu items, prices, and availability
- Restaurant tables

### Ordering Module

- Dine-in and takeout orders
- Order items and quantities
- Order notes
- Automatic total calculation
- Table assignment
- Order history

### Payment and Receipt Module

- Cash, GCash, and Maya payment records
- Amount received and change calculation
- Printable receipts

The application records GCash and Maya payments but does not communicate with their external payment systems.

The ordering workflow saves an order and its item rows in one SQLite transaction. The API loads current menu prices and calculates totals and cash change on the server. Browser-provided totals are ignored. Saving a dine-in order marks its table occupied in that same transaction.

### Kitchen Module

- Kitchen order queue
- Pending, Preparing, Ready, and Completed statuses
- Guarded forward-only status transitions
- Automatic five-second screen refresh
- Order timestamps and notes
- Cashier-facing status polling and notifications
- Automatic table release when a dine-in order is completed

### Inventory Module

- Inventory items and quantities
- Transactional stock additions and deductions
- Low-stock thresholds
- Stock-movement history with employee attribution and notes
- Archived-item retention and below-zero deduction protection

### Reporting Module

- Daily and date-range sales
- Sales by payment method
- Best-selling menu items
- Completed-order counts, totals, averages, and item quantities
- Low-stock and out-of-stock inventory
- Printable report views

Phase 6 treats `stock_movements` as the audit trail for quantity changes. A non-zero initial quantity creates an addition record, and later quantities can change only through an addition or deduction transaction. Sales queries include only orders whose status is Completed; Pending, Preparing, Ready, and Cancelled orders do not contribute to sales totals.

## Frontend Structure

A suggested React structure is:

```text
src/
  components/
  layouts/
  pages/
    auth/
    admin/
    cashier/
    kitchen/
    reports/
  services/
  hooks/
  context/
  utils/
  App.jsx
  main.jsx
```

The `services` directory contains functions that communicate with the Express API. Pages should not directly access the database.

## Backend Structure

A suggested Express structure is:

```text
server/
  src/
    routes/
    controllers/
    services/
    middleware/
    database/
    utils/
    app.js
  data/
    restaurant.db
```

- Routes define the API addresses.
- Controllers receive and validate requests.
- Services contain business rules.
- Middleware checks authentication and roles.
- The database layer performs SQLite operations.

## Core Database Tables

| Table | Important Data |
|---|---|
| `users` | Name, username, password hash, role, active status |
| `auth_sessions` | User, hashed session token, and expiration time |
| `categories` | Category name and active status |
| `menu_items` | Category, name, price, availability, active status |
| `restaurant_tables` | Table number and availability status |
| `orders` | Order number, type, table, status, totals, payment method, timestamps |
| `order_items` | Order, menu item, quantity, unit price, subtotal, notes |
| `inventory_items` | Item name, unit, quantity, and low-stock level |
| `stock_movements` | Inventory item, movement type, quantity, date, and employee |

Records used by previous transactions should normally be archived rather than permanently deleted.

## Main Data Flow

### Ordering Flow

1. The cashier requests available menu items from the API.
2. The React application builds the order and calculates a visible total.
3. The backend validates the order and recalculates the final total.
4. The backend saves the order and its items in one database transaction.
5. The order appears in the kitchen queue.
6. Kitchen staff update its status.
7. The completed order becomes part of sales reports.

### Inventory Flow

1. The admin creates an inventory item and its low-stock level.
2. Stock additions or deductions are recorded as movements.
3. The server updates the current quantity.
4. Items at or below their low-stock level appear in the warning list.

## Offline Operation

Offline operation means that the system does not depend on internet services. It does not mean that every browser keeps a separate copy of the database.

The Express server and SQLite database act as the local source of truth. If several devices are used, they connect to the same server over the local network. This prevents separate devices from creating conflicting copies of orders and inventory.

## Basic Security

- Store password hashes, not plain-text passwords.
- Validate all API input on the server.
- Require authentication for protected operations.
- Check the user's role on the server, not only in React.
- Use parameterized database queries or an ORM.
- Keep a record of the employee who created or updated important transactions.

## Backup and Recovery

- Provide an admin action or documented procedure for copying the SQLite database.
- Add the current date and time to backup filenames.
- Store at least one backup outside the main project directory.
- Test that a backup can be restored before the final demonstration.

## Out-of-Scope Architecture

The initial version will not require:

- Cloud hosting
- React Native, Kotlin, or Swift applications
- Real payment-gateway integration
- Webhooks
- SMS, email, or push-notification services
- Multi-branch synchronization
- Complex offline conflict resolution
