# Project Goals

## Project Title

Leslie's Restaurant Management System

## Project Purpose

The purpose of the project is to create a simple offline restaurant-management web application for Leslie's Restaurant. It will replace selected paper-based activities with a centralized system that is easier to demonstrate, operate, and maintain as a school project.

## Main Goal

Develop a React-based system that allows restaurant employees to manage menu items, orders, kitchen preparation, payments, tables, inventory, and basic reports from one local application.

## Specific Goals

### 1. Reduce order errors

- Store orders digitally instead of relying on handwritten slips.
- Show item quantities and notes clearly.
- Keep a searchable history of transactions.

### 2. Improve cashier operations

- Calculate order totals automatically.
- Calculate change for cash payments.
- Record cash, GCash, and Maya as payment methods.
- Generate a clear printable receipt.

### 3. Improve kitchen coordination

- Display confirmed orders in a kitchen queue.
- Allow staff to update each order's preparation status.
- Reduce the need for verbal status requests between staff.

### 4. Improve table monitoring

- Show whether a table is available or occupied.
- Associate dine-in orders with table numbers.
- Release tables after orders are completed.

### 5. Improve basic inventory monitoring

- Store current quantities of ingredients or supplies.
- Record stock additions and deductions.
- Warn the admin when an item reaches its low-stock level.

### 6. Simplify reporting

- Calculate daily and date-range sales.
- Group transactions by payment method.
- Identify best-selling menu items.
- Show low-stock inventory items.

### 7. Support employee responsibilities

- Provide separate admin, cashier, and kitchen roles.
- Limit screens and actions according to the employee's role.
- Record which employee handled important transactions.

### 8. Work without internet access

- Run the application and database on a local computer.
- Avoid dependence on cloud services or external APIs.
- Provide a simple database-backup procedure.

## Intended Users

| User | Primary Goals |
|---|---|
| Admin | Manage employees, menu, tables, inventory, and reports |
| Cashier | Create orders, receive payments, print receipts, and monitor tables |
| Kitchen staff | View orders and update preparation status |

## Core Functional Goals

The completed project should allow users to:

- Log in using an employee account.
- Access features according to their role.
- Add, edit, archive, and view menu items.
- Create dine-in and takeout orders.
- Assign a table to a dine-in order.
- Calculate totals and cash change.
- Record the selected payment method.
- Print a basic receipt.
- View orders in a kitchen queue.
- Update order status from Pending to Completed.
- Add and deduct inventory quantities.
- View low-stock warnings.
- View and print basic sales and inventory reports.

## Non-Functional Goals

### Usability

- Use clear labels, large buttons, and simple navigation.
- Keep the cashier and kitchen screens easy to operate.
- Display understandable validation and error messages.

### Performance

- Load normal screens and records quickly on the local computer.
- Refresh the kitchen queue frequently enough for a classroom demonstration.

### Reliability

- Save orders and payments without creating incomplete transaction records.
- Preserve data after the application or computer is restarted.
- Allow the SQLite database to be backed up and restored.

### Security

- Require employees to log in.
- Store passwords securely as hashes.
- Enforce role permissions in the backend.

### Maintainability

- Separate the React interface, Express API, and database logic.
- Use readable names and reusable components.
- Document installation, secure account bootstrap, and normal workflows.

## Success Criteria

The project will be considered successful when:

1. An admin can manage employees, menu items, tables, and inventory.
2. A cashier can complete and print a dine-in or takeout order.
3. A kitchen user can see the order and update its status.
4. Completed transactions appear correctly in sales reports.
5. Low-stock inventory items are clearly identified.
6. Role restrictions prevent unauthorized actions.
7. The application works locally without an internet connection.
8. Project data can be backed up and restored for demonstration.

## Scope Limitations

The first version will not include:

- Real GCash or Maya processing
- Customer online ordering
- Mobile applications
- Reservations or delivery tracking
- SMS, email, or push notifications
- Staff scheduling and attendance
- Multiple restaurant branches
- Cloud synchronization
- Advanced accounting or sales forecasting

These items may be documented as possible future improvements, but they are not required for the initial school-project implementation.
