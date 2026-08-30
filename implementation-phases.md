# Implementation Phases

## Project

Leslie's Restaurant Management System

## Development Approach

The project will be developed as a small, offline restaurant-management web application. Work will be divided into short phases so that each major feature can be demonstrated and tested before the next phase begins.

The initial version will use React, Node.js, Express, and SQLite. It will run on one local computer and will not require an internet connection.

## Current Implementation Status

| Phase | Status | Completed Output |
|---|---|---|
| Phase 1: Requirements and Planning | Complete | Scope, numbered requirements, business rules, Mermaid diagrams, and wireframes in `docs/` |
| Phase 2: Project and Database Setup | Complete | React/Vite frontend, Express API, SQLite schema, seed data, starter endpoints, and verification script |
| Phase 3: Login and Administration | Complete | Employee login/logout, SQLite-backed sessions, server-enforced roles, role-aware navigation, and employee, category, menu-item, and table management |
| Phase 4: Ordering and Cashier Module | Complete | Dine-in/takeout ordering, item quantities and notes, table validation, server-calculated totals and change, cash/GCash/Maya records, printable receipts, and order history |
| Phase 5: Kitchen and Table Workflow | Complete | Auto-refreshing kitchen queue, guarded order-status controls, cashier status notifications, and transactional table occupancy/release |
| Phase 6: Inventory and Reports | Complete | Inventory CRUD, audited stock movements, low-stock warnings, completed-sales summaries, payment and best-seller reports, date filters, and printable report views |
| Phase 7 | Not started | Reserved for final testing, documentation, backup, and demonstration preparation |

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

## Phase 7: Testing, Documentation, and Demonstration

### Activities

- Test each user role and permission.
- Test menu, order, payment, kitchen, table, inventory, and report workflows.
- Test invalid input and common error cases.
- Verify that the application works without internet access.
- Create a local database-backup function or documented backup procedure.
- Fix discovered defects.
- Prepare sample data for the presentation.
- Complete the user manual and technical documentation.

### Deliverables

- Tested final application
- Test cases and results
- User manual
- Technical documentation
- Demonstration data and presentation flow

### Completion Criteria

- All core workflows pass their test cases.
- The application runs locally without internet access.
- The database can be backed up and restored.
- The project is ready for demonstration and evaluation.

## Suggested Eight-Week Schedule

| Week | Main Work |
|---|---|
| 1 | Requirements, scope, diagrams, and wireframes |
| 2 | React, Express, and SQLite setup |
| 3 | Login, roles, employees, menu, and tables |
| 4 | Cashier ordering and payment recording |
| 5 | Kitchen queue, order statuses, and table workflow |
| 6 | Inventory and low-stock warnings |
| 7 | Reports, receipts, and user-interface improvements |
| 8 | Testing, documentation, fixes, and demonstration preparation |

## Optional Enhancements

These features should only be attempted after all core requirements are complete:

- Recipe-based ingredient deduction
- Reservation and waiting-list management
- Customer self-service ordering
- Real-time updates with Socket.IO
- Barcode or QR-code scanning
- Export to PDF
- MySQL database support
- Multiple restaurant branches
