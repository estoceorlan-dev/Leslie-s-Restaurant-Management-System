# Implementation Phases

## Project

Leslie's Restaurant Management System

## Development Approach

The project will be developed as a small, offline restaurant-management web application. Work will be divided into short phases so that each major feature can be demonstrated and tested before the next phase begins.

The initial version uses React, Node.js, Express, and SQLite. One dedicated local computer hosts the application and database, and staff computers on the same private network connect through their browsers without requiring internet access.

## Current Implementation Status

| Phase | Status | Completed Output |
|---|---|---|
| Phase 1: Requirements and Planning | Complete | Scope, numbered requirements, business rules, Mermaid diagrams, and wireframes in `docs/` |
| Phase 2: Project and Database Setup | Complete | React/Vite frontend, LAN-facing Express application/API, persistent SQLite schema and seed data, backup/restore commands, and verification scripts |
| Phase 3: Login and Administration | Complete | Employee login/logout, SQLite-backed sessions, server-enforced roles, role-aware navigation, and employee, category, menu-item, and table management |
| Phase 4: Ordering and Cashier Module | Complete | Dine-in/takeout ordering, item quantities and notes, table validation, server-calculated totals and change, cash/GCash/Maya records, printable receipts, and order history |
| Phase 5: Kitchen and Table Workflow | Complete | Auto-refreshing kitchen queue, guarded order-status controls, cashier status notifications, and transactional table occupancy/release |
| Phase 6: Inventory and Reports | Complete | Inventory CRUD, audited stock movements, low-stock warnings, completed-sales summaries, payment and best-seller reports, date filters, and printable report views |
| Phase 7 | Not started | Reserved for final testing |

The completed foundation through Phase 6 can be verified at any time by running `npm run check` from the project root.

## Phase 1: Requirements and Planning

### Activities

- Confirm the three user roles: admin, cashier, and kitchen staff.
- Finalize the features included in the school-project version.
- Define the dine-in and takeout order workflows.
- Define menu, payment, order-status, table, and inventory rules.
- Prepare simple use-case, context, and activity diagrams.
- Create initial screen sketches or wireframes.

### Deliverables

- Approved project scope
- List of functional and non-functional requirements
- Basic system diagrams
- Initial user-interface wireframes

### Completion Criteria

- The required users, screens, and workflows are clearly defined.
- Optional production features have been removed from the scope.

## Phase 2: Project and Database Setup

### Activities

- Create the React application with Vite.
- Create the Node.js and Express server.
- Configure SQLite and the selected ORM or database library.
- Create the initial database schema.
- Add sample employee, menu, table, and inventory data.
- Establish the basic frontend and backend folder structure.

### Deliverables

- Running React frontend
- Running Express API
- Connected SQLite database
- Initial database tables and sample records

### Completion Criteria

- The frontend can request and display test data from the backend.
- Data remains available after the application is restarted.

## Phase 3: Login and Administration

### Activities

- Implement employee login and logout.
- Apply role-based access for admin, cashier, and kitchen staff.
- Create employee-account management.
- Create menu-category management.
- Create menu-item management.
- Create restaurant-table management.

### Deliverables

- Login page
- Role-based navigation
- Employee management screen
- Menu and category management screens
- Table management screen

### Completion Criteria

- Employees can log in with the correct role.
- Users cannot access screens outside their assigned role.
- The admin can add, edit, archive, and view menu items.

## Phase 4: Ordering and Cashier Module

### Activities

- Create dine-in and takeout orders.
- Select menu items and quantities.
- Add simple order notes.
- Assign a table to dine-in orders.
- Calculate subtotals, totals, cash received, and change.
- Record cash, GCash, or Maya as the payment method.
- Save orders and their individual items.
- Create a browser-printable receipt.

GCash and Maya will only be recorded as payment methods. The school-project version will not connect to a real payment gateway.

### Deliverables

- Cashier ordering screen
- Order calculation logic
- Payment-recording form
- Printable receipt
- Saved order history

### Completion Criteria

- A cashier can complete a dine-in or takeout transaction.
- Order totals and change are calculated correctly.
- The completed transaction appears in order history.

## Phase 5: Kitchen and Table Workflow

### Activities

- Create the kitchen order queue.
- Display order items, quantities, order type, table, and notes.
- Add the order statuses Pending, Preparing, Ready, and Completed.
- Refresh the kitchen queue automatically at a short interval.
- Notify the cashier screen when an order status changes.
- Mark assigned tables as occupied and release them after completion.

### Deliverables

- Kitchen dashboard
- Order-status controls
- Automatic order refresh
- Table occupancy workflow

### Completion Criteria

- Confirmed orders appear on the kitchen screen.
- Kitchen staff can update an order through all required statuses.
- Table availability reflects the active dine-in order.

## Phase 6: Inventory and Reports

### Activities

- Create inventory-item management.
- Record stock additions and deductions.
- Add a configurable low-stock level.
- Show low-stock warnings.
- Create daily and date-range sales reports.
- Show totals grouped by payment method.
- Show best-selling menu items.
- Create a printable inventory report.

Automatic ingredient deduction from recipes will be treated as an optional enhancement. Manual stock movements are sufficient for the initial version.

### Deliverables

- Inventory screen
- Stock-movement history
- Low-stock report
- Sales dashboard and reports

### Completion Criteria

- The admin can update and review inventory quantities.
- Sales totals match completed transactions.
- Reports can be filtered by date and printed.

## Phase 7: Testing

### Activities

- Test each user role and permission.
- Test menu, order, payment, kitchen, table, inventory, and report workflows.
- Test invalid input and common error cases.
- Verify that the application works without internet access.
- Fix discovered defects.


### Deliverables

- Tested final application
- Test cases and results

### Completion Criteria

- All core workflows pass their test cases.
- The application runs locally without internet access.
- The database can be backed up and restored.

## Phase 8: Documentation, and Demonstration

### Activities

- Create a local database-backup function or documented backup procedure.
- Prepare sample data for the presentation.
- Complete the user manual and technical documentation.

### Deliverables

- User manual
- Technical documentation
- Demonstration data and presentation flow

### Completion Criteria

- The project is ready for demonstration and evaluation.

## Optional Enhancements

These features should only be attempted after all core requirements are complete. Each
enhancement below is a separate work package that assumes only the Phase 1-6 baseline.
An enhancement must not require another optional enhancement, and its database changes,
API routes, user-interface entry points, tests, and documentation must be kept separate
so it can be accepted, postponed, or removed on its own.

Phase 7 must test any enhancement that is selected for the final build. Phase 8 must
document only the enhancements that are actually included. Optional work does not
replace the Phase 7 and Phase 8 completion criteria.

### OE-1: Recipe-Based Ingredient Deduction

#### Scope

- Allow an administrator to define the inventory ingredients and quantity used by one
  unit of a menu item.
- Deduct the calculated ingredient quantities when an order is completed.
- Reverse only the related automatic deductions if a completed order is cancelled or
  corrected through an approved workflow.
- Keep manual stock additions and deductions working as they do in the baseline.

#### Implementation Activities

- Add a recipe-component table linking menu items to inventory items with a required
  positive quantity per serving.
- Extend stock movements with an automatic-recipe source and an order reference while
  preserving the existing audit history.
- Add admin controls for creating, editing, and removing recipe components.
- Calculate all required deductions from the saved order-item quantities and apply them
  in the same database transaction as the qualifying order-status change.
- Define and enforce the insufficient-stock rule: block completion and show the missing
  quantities, unless the project owner explicitly approves a different rule.
- Add checks for duplicate ingredients, invalid quantities, repeated status requests,
  and reversal attempts.

#### Verification

- Verify deductions for single- and multi-item orders, quantities greater than one, and
  fractional ingredient amounts.
- Verify atomic rollback when any ingredient is unavailable or any write fails.
- Verify that retrying the same status update cannot deduct stock twice.
- Verify that manual stock movements and menu items without recipes still work.

#### Deliverables and Completion Criteria

- Recipe editor, transactional deduction service, linked stock-movement audit records,
  automated checks, and updated inventory documentation.
- Complete when calculated stock changes are correct, traceable to an order, safely
  reversible, and do not change baseline ordering for menu items without recipes.

#### Independence and Removal

- Depends only on menu items, orders, inventory, and status handling from Phases 3-6.
- Can be removed by hiding the recipe editor and disabling the recipe-deduction hook;
  reservations, self-service, sockets, scanning, PDF, MySQL, and branches are unaffected.

### OE-2: Reservation and Waiting-List Management

#### Scope

- Let authorized employees create, edit, seat, cancel, and complete reservations.
- Maintain a walk-in waiting list with party size, arrival time, and status.
- Suggest suitable active tables by capacity and availability; employees make the final
  table assignment.
- Exclude online booking, SMS/email reminders, deposits, and customer accounts.

#### Implementation Activities

- Add reservation and waiting-list tables with guest name, contact details, party size,
  scheduled/arrival time, notes, status, and optional assigned table.
- Add protected API routes with server-side validation and role authorization.
- Add an employee-facing schedule/list view, filters, status controls, and table
  assignment action.
- Reuse current table occupancy rules when a guest is seated, and prevent conflicting
  active assignments.
- Keep reservation status separate from order status so either feature can operate
  without changing the other.

#### Verification

- Test overlapping reservations, invalid dates and party sizes, inactive tables,
  cancellation, wait-list ordering, seating, and table release.
- Test concurrent attempts to assign the same table.
- Confirm existing dine-in and takeout ordering remains unchanged when no reservation is
  involved.

#### Deliverables and Completion Criteria

- Reservation/wait-list schema, protected API, management screen, test cases, and user
  instructions.
- Complete when employees can manage the full reservation and walk-in lifecycle without
  creating table conflicts or requiring an order in advance.

#### Independence and Removal

- Depends only on authentication and restaurant tables from Phases 3-5.
- Uses ordinary polling or manual refresh by default and does not require Socket.IO,
  customer self-service, scanning, multiple branches, or any other enhancement.

### OE-3: Customer Self-Service Ordering

#### Scope

- Provide a separate local kiosk/customer screen for browsing available menu items,
  building a cart, choosing dine-in or takeout, adding notes, and submitting an order.
- Send submitted orders into the existing cashier/kitchen workflow with a clearly marked
  source.
- Keep payment as cashier-recorded cash, GCash, or Maya; do not add an online gateway.

#### Implementation Activities

- Add a restricted public menu endpoint that exposes only active, available items and no
  employee or administrative data.
- Add a narrowly scoped order-submission endpoint with server-calculated prices, input
  limits, rate limiting suitable for the local network, and duplicate-submit protection.
- Add an order source and a customer-order confirmation identifier without weakening
  the existing cashier ownership and audit rules.
- Build a kiosk route with large touch targets, cart review, validation, confirmation,
  and a reset after submission or inactivity.
- Define dine-in table selection independently: an employee-configured kiosk may be tied
  to one table, or the customer may select from validated available tables.
- Continue using the baseline short-interval refresh for staff screens.

#### Verification

- Test unavailable items, changed prices, invalid tables, duplicate taps, empty carts,
  excessive quantities/notes, session reset, and loss of server connection.
- Confirm customers cannot access protected endpoints or view other orders.
- Confirm accepted orders behave like cashier-created orders in the kitchen and reports.

#### Deliverables and Completion Criteria

- Kiosk screen, restricted endpoints, source/audit fields, abuse safeguards, automated
  checks, and kiosk operating instructions.
- Complete when a customer can submit a valid local order without employee permissions
  and all totals and availability rules remain server-controlled.

#### Independence and Removal

- Depends only on the existing menu, order, table, and kitchen workflow.
- Does not require QR scanning, Socket.IO, reservations, recipe deduction, or branches;
  its route and public endpoints can be disabled without affecting cashier ordering.

### OE-4: Real-Time Updates with Socket.IO

#### Scope

- Replace or supplement short-interval polling with server-pushed updates for kitchen
  orders, cashier status notifications, and table availability.
- Retain a polling fallback so the local workflow still functions if the socket is
  disconnected.

#### Implementation Activities

- Add Socket.IO to the existing HTTP server and client application.
- Authenticate employee socket connections with the current session token and authorize
  subscriptions by role.
- Publish minimal domain events only after a database transaction commits; do not send
  sensitive employee or payment details in event payloads.
- Update relevant screens to invalidate/refetch their existing API data when an event is
  received rather than treating socket payloads as the permanent data source.
- Add reconnect handling, connection-state feedback, event deduplication, and polling
  fallback.

#### Verification

- Test create/status/table events across two browser sessions and all allowed roles.
- Test expired or invalid sessions, disconnect/reconnect, duplicate events, server
  restart, and missed-event recovery through refetching.
- Confirm the application remains usable with sockets disabled.

#### Deliverables and Completion Criteria

- Authenticated socket server, client connection service, event integration, fallback
  behavior, automated checks, and configuration notes.
- Complete when authorized screens update promptly and reliably while the API remains
  the source of truth and polling fallback preserves the baseline workflow.

#### Independence and Removal

- Depends only on existing session authentication and API workflows.
- Adds no business entities and can be removed by disabling the socket client/server and
  restoring the baseline polling interval.

### OE-5: Barcode or QR-Code Scanning

#### Scope

- Let an administrator assign a unique barcode or QR value to an inventory item and use
  a scanner to locate that item quickly when recording stock movements.
- Support keyboard-wedge scanners first; camera scanning may be added behind the same
  lookup interface if browser and device testing proves reliable.
- Do not make scanning mandatory; typed search and manual stock entry remain available.

#### Implementation Activities

- Add an optional unique scan code to inventory items and validate its normalized format
  and maximum length.
- Add an authorized exact-match lookup endpoint that returns only the inventory data
  needed by the stock-movement form.
- Add scan focus, submit, success/error feedback, and duplicate-read suppression to the
  inventory screen.
- If camera scanning is selected, isolate it in a client component, request permission
  only on user action, and provide clear unsupported/denied fallbacks.
- Add printable code labels only if label generation is explicitly included in this
  enhancement's acceptance scope; it must not depend on the PDF enhancement.

#### Verification

- Test unique and duplicate codes, normalization, unknown codes, rapid repeated scans,
  inactive items, scanner suffix keys, manual fallback, and permission denial.
- Confirm that scanning selects an item but all stock validation and auditing still occur
  through the existing server endpoint.

#### Deliverables and Completion Criteria

- Scan-code field and migration, lookup endpoint, scanner-assisted inventory UI, tests,
  device/setup notes, and optional browser-printable labels if selected.
- Complete when a supported scan reliably selects the correct inventory item and cannot
  bypass stock-movement validation or auditing.

#### Independence and Removal

- Depends only on Phase 6 inventory management.
- Does not require self-service ordering, recipes, PDF export, sockets, or branch support;
  removing scan controls leaves manual inventory workflows intact.

### OE-6: Export to PDF

#### Scope

- Export receipts, sales reports, and inventory reports as consistently formatted PDFs.
- Generate PDFs locally without a cloud service or internet connection.
- Preserve the existing browser-printable views as a fallback.

#### Implementation Activities

- Define shared export data models so displayed totals and exported totals come from the
  same server-calculated report/order data.
- Select and pin an offline-capable PDF library, then implement receipt, sales-report,
  and inventory-report templates.
- Add export buttons, descriptive filenames, page headers/footers, generation timestamp,
  date-filter labels, pagination, and empty-state handling.
- Protect export endpoints or client data with the same roles as the source screens and
  sanitize all text written into a document.

#### Verification

- Compare PDF totals and line items with the corresponding receipt/report data.
- Test long item names, notes, multi-page reports, empty reports, fractional inventory,
  special characters, date ranges, and offline generation.
- Render representative PDFs and visually inspect clipping, page breaks, readability,
  and print sizing.

#### Deliverables and Completion Criteria

- PDF templates and export actions for the three document types, automated content
  checks, visual test samples, and user instructions.
- Complete when each PDF opens in a standard viewer, matches its source data, prints
  legibly, and can be generated with no internet connection.

#### Independence and Removal

- Depends only on existing receipt and report data from Phases 4 and 6.
- Does not provide services to the other optional enhancements; removing PDF actions
  leaves all browser-printable views working.

### OE-7: MySQL Database Support

#### Scope

- Allow the application to run against either the existing SQLite database or a supported
  MySQL version selected through configuration.
- Keep SQLite as the default offline/single-computer option.
- Do not include live production migration, hosting, replication, or multi-branch logic.

#### Implementation Activities

- Introduce a small database adapter/query layer for connection handling, transactions,
  placeholders, inserted IDs, date expressions, and other dialect differences.
- Create equivalent, versioned SQLite and MySQL schema migrations with the same
  constraints, indexes, seed intent, and money/quantity behavior.
- Remove SQLite-specific SQL from routes and services or provide tested dialect-specific
  statements where a common query is impractical.
- Add validated database-driver configuration, startup diagnostics, safe connection
  shutdown, and separate initialization instructions.
- Provide an explicit one-time export/import utility only if moving existing SQLite data
  is included in acceptance scope; otherwise document that databases start separately.

#### Verification

- Run the same API/integration test suite against fresh SQLite and MySQL databases.
- Compare authentication, concurrency-sensitive table/order transactions, reporting date
  filters, decimal inventory quantities, constraints, and rollback behavior.
- Verify that choosing MySQL does not silently fall back to SQLite and that SQLite remains
  fully usable offline.

#### Deliverables and Completion Criteria

- Database abstraction, dual migration sets, MySQL configuration, cross-database test
  matrix, and setup/backup/restore documentation.
- Complete when the unmodified application feature set passes the same checks on both
  databases and database choice requires configuration rather than source edits.

#### Independence and Removal

- Depends only on the Phase 1-6 persistence requirements and reproduces that baseline on
  MySQL.
- Must not assume branches, sockets, reservations, or any other optional schema; each
  later-selected enhancement remains responsible for adding migrations for both enabled
  database engines.

### OE-8: Multiple Restaurant Branches

#### Scope

- Partition operational data by restaurant branch and let authorized employees work in
  one assigned branch at a time.
- Include branch-specific tables, orders, inventory, and reports, with optional menu-item
  availability per branch.
- Run on the existing SQLite deployment for the school-project version; central cloud
  synchronization and cross-site offline conflict resolution are excluded.

#### Implementation Activities

- Add a branches table and branch assignment for users, tables, orders, inventory stock,
  and other operational records; explicitly classify each entity as global or
  branch-owned before migration.
- Backfill all existing records into a required default branch, then add branch-aware
  unique constraints and indexes.
- Derive the active branch from the authenticated server session or an authorized admin
  choice; never trust an unrestricted client-supplied branch identifier.
- Apply branch filters and authorization centrally to every affected read and write,
  including reports and kitchen queues.
- Add admin branch management and a clear active-branch indicator; limit cross-branch
  summaries and reassignment to explicitly authorized administrators.

#### Verification

- Test two branches with overlapping table numbers and inventory/menu availability.
- Test that each role cannot read, modify, receive notifications for, or report on data
  outside its active branch.
- Test default-branch backfill, branch switching, inactive branches, transaction safety,
  and baseline workflows within each branch.

#### Deliverables and Completion Criteria

- Branch data model and migration, centralized branch authorization, branch-aware API and
  screens, isolation tests, and administration/backup documentation.
- Complete when all operational workflows are correctly scoped and automated tests prove
  that records cannot leak or be changed across branches.

#### Independence and Removal

- Depends only on Phase 1-6 entities and works with SQLite; it does not require MySQL or
  real-time sockets.
- Because it changes most core tables, removal after real branch data is entered requires
  a documented data-consolidation migration rather than simply hiding the user interface.

### Selection and Scheduling Rules

- Select enhancements individually using their value, risk, effort, and available test
  time; selecting one does not automatically select any other.
- Give each selected enhancement its own branch or change set, schema migration, test
  cases, acceptance result, and documentation update.
- Implement and verify one enhancement against the Phase 1-6 baseline before merging it.
- After multiple enhancements are selected, add integration tests only for the shared
  core workflows they both touch; this does not turn either into a prerequisite.
- Freeze optional feature work before final Phase 7 regression testing. Any enhancement
  that misses its own completion criteria is excluded from the final demonstration build.
