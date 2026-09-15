# System Requirements

## User Roles

| Role | Permitted Areas |
|---|---|
| Admin | Employees, menu, tables, inventory, orders, and reports |
| Cashier | Ordering, payments, receipts, tables, and order history |
| Kitchen staff | Kitchen queue and order-status updates |

## Functional Requirements

### Authentication and Authorization

- **FR-01:** Employees shall log in using a username and password.
- **FR-02:** The system shall show navigation and actions appropriate to the employee's role.
- **FR-03:** The server shall reject operations that the employee's role cannot perform.
- **FR-04:** An admin shall create, edit, activate, and deactivate employee accounts.

### Menu Management

- **FR-05:** An admin shall create, edit, archive, and view menu categories.
- **FR-06:** An admin shall create, edit, archive, and view menu items.
- **FR-07:** Each menu item shall have a category, name, price, and availability status.
- **FR-08:** Only available and active items shall be selectable in a new order.

### Ordering and Payments

- **FR-09:** A cashier shall create dine-in and takeout orders.
- **FR-10:** A dine-in order shall be assigned to an available table.
- **FR-11:** A cashier shall add menu items, quantities, and optional notes to an order.
- **FR-12:** The server shall calculate each subtotal and the final order total.
- **FR-13:** A cashier shall record cash, GCash, or Maya as the payment method.
- **FR-14:** For cash payments, the system shall calculate the customer's change.
- **FR-15:** The system shall save the order and all of its items as one transaction.
- **FR-16:** The system shall create a printable receipt for a confirmed order.
- **FR-17:** Employees with permission shall view order history.

### Kitchen and Tables

- **FR-18:** Confirmed orders shall appear in the kitchen queue.
- **FR-19:** Kitchen staff shall change an order through Pending, Preparing, Ready, and Completed statuses.
- **FR-20:** The kitchen queue shall refresh automatically at a short interval.
- **FR-21:** Assigning a dine-in order shall mark its table as occupied.
- **FR-22:** Completing the dine-in order shall make its table available again.

### Inventory

- **FR-23:** An admin shall create, edit, archive, and view inventory items.
- **FR-24:** An inventory item shall have a name, unit, current quantity, and low-stock level.
- **FR-25:** An admin shall record stock additions and deductions.
- **FR-26:** Every stock change shall create a stock-movement record.
- **FR-27:** The system shall identify items at or below their low-stock level.

### Reports

- **FR-28:** An admin shall view sales for a selected date range.
- **FR-29:** The sales report shall include completed-order count and total sales.
- **FR-30:** The system shall summarize sales by payment method.
- **FR-31:** The system shall identify best-selling menu items.
- **FR-32:** The admin shall view and print a low-stock report.

## Business Rules

- **BR-01:** Menu prices and totals are stored as decimal currency values, never floating-point approximations.
- **BR-02:** The backend recalculates totals instead of trusting totals sent by the browser.
- **BR-03:** An unavailable or archived menu item cannot be added to a new order.
- **BR-04:** A table can have only one active dine-in order.
- **BR-05:** Payment must cover the final total before a cash order is confirmed.
- **BR-06:** GCash and Maya are manually confirmed payment records, not gateway transactions.
- **BR-07:** Completed orders are included in sales reports; cancelled orders are excluded.
- **BR-08:** Transactional records are retained. Referenced users and menu items are deactivated or archived instead of deleted.
- **BR-09:** A stock deduction cannot reduce an inventory quantity below zero.

## Non-Functional Requirements

- **NFR-01 Usability:** The system shall use simple labels, clear status colors, and touch-friendly controls.
- **NFR-02 Performance:** Normal local API requests should complete within two seconds with typical restaurant data.
- **NFR-03 Offline Operation:** Core functions shall work without an internet connection.
- **NFR-04 Persistence:** Saved data shall remain available after restarting the application.
- **NFR-05 Security:** Passwords shall be stored as hashes, and protected actions shall be checked on the server.
- **NFR-06 Reliability:** Multi-record operations, such as saving an order, shall use a database transaction.
- **NFR-07 Maintainability:** Frontend, API, business rules, and database access shall be separated.
- **NFR-08 Compatibility:** The interface shall support a current desktop version of Chrome, Edge, or Firefox.
- **NFR-09 Backup:** The SQLite database shall have a documented backup and restore procedure.

## Phase 2 Acceptance Criteria

- The React development server starts successfully.
- The Express API starts successfully.
- The API creates or opens the local SQLite database.
- The database contains the initial tables without automatically inserting accounts or restaurant records.
- The first administrator can be created securely from the host terminal.
- The React application retrieves and displays administrator-configured menu data from the API.
- Restarting the server does not remove saved restaurant data.

## Phase 3 Acceptance Criteria

- Active employees can log in and log out with their username and password.
- Passwords and authentication tokens are not stored as plain text.
- Admin, cashier, and kitchen staff see navigation appropriate to their role.
- The server returns `401` for unauthenticated administration requests and `403` for authenticated users without the admin role.
- An admin can create, edit, activate, and deactivate employee accounts.
- An admin can create, edit, archive, restore, and view menu categories and menu items.
- An admin can control a menu item's category, price, availability, and active status.
- An admin can create, edit, archive, restore, and view restaurant tables.
- The currently signed-in administrator cannot deactivate their own account, and the system retains at least one active administrator.
- Archived or unavailable menu items are excluded from the cashier-facing menu endpoint.

## Phase 4 Acceptance Criteria

- A cashier can create dine-in and takeout orders from active, available menu items.
- Each order can contain item quantities and optional notes.
- Dine-in orders require an active table without another pending, preparing, or ready order.
- The server retrieves current prices and calculates line subtotals and the final total.
- Cash payments are rejected when the amount received is below the total, and change is calculated by the server.
- GCash and Maya can be recorded as manually confirmed payment methods without an external gateway.
- The order and all order items are saved in one SQLite transaction.
- Saved orders appear in order history for cashiers and administrators.
- A saved receipt includes the order number, time, order type, table, cashier, items, totals, payment details, and cash change where applicable.
- Receipts can be printed using the browser's print dialog.
- Kitchen staff cannot create or view cashier transactions through the API.

## Phase 5 Acceptance Criteria

- Confirmed dine-in and takeout orders appear in the kitchen queue with their items, quantities, order type, table number where applicable, timestamps, and notes.
- The kitchen queue refreshes automatically every five seconds and also provides a manual refresh action.
- Only kitchen staff can read the kitchen queue or update preparation statuses.
- Order statuses move forward one step at a time from Pending to Preparing, Ready, and Completed; skipped, backward, stale, and post-completion updates are rejected.
- Cashier sessions poll for status changes and display an on-screen notification when the kitchen updates an existing order.
- Saving a dine-in order marks its assigned table occupied in the same database transaction.
- The table remains occupied while the order is Pending, Preparing, or Ready, and becomes available when the kitchen completes the order.
- Completed orders leave the active kitchen queue and retain their final status in order history.

## Phase 6 Acceptance Criteria

- An administrator can create, edit, archive, restore, search, and filter inventory items.
- Every inventory item stores a name, unit, current quantity, configurable low-stock level, and active status.
- A non-zero initial quantity and every later addition or deduction create a stock-movement record that identifies the administrator, timestamp, quantity, type, and optional notes.
- Quantity updates and their movement records are saved in one database transaction.
- Invalid deductions are rejected before the stored quantity can fall below zero, and archived items cannot receive movements.
- Active items at or below their low-stock level are clearly identified on the inventory screen, admin dashboard, and low-stock report.
- Administrators can filter sales by a valid daily or date range and see completed-order count, total sales, average order, and items sold.
- Sales reports include only Completed orders and group totals by cash, GCash, and Maya.
- Best-selling menu items are ranked by completed-order quantity, with their sales amounts shown.
- The administrator can print the selected sales and low-stock report and a full active-inventory report using the browser print dialog.
- Cashier and kitchen accounts receive `403` responses for protected inventory and reporting endpoints.
