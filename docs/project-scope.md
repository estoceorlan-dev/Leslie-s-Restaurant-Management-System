# Project Scope

## Project Title

Leslie's Restaurant Management System

## Project Type

Offline restaurant-management web application for a school project.

## Problem Statement

Leslie's Restaurant currently depends on handwritten orders, verbal kitchen updates, manual calculations, and notebook-based inventory records. These methods can cause missing orders, incorrect totals, unclear kitchen status, and slow report preparation.

## Proposed Solution

Build one local React web application for three employee roles:

- Admin
- Cashier
- Kitchen staff

The application will use a local Express API and SQLite database. It will work without an internet connection and can be demonstrated on one computer.

## Included Features

- Employee login and role-based access
- Employee-account administration
- Menu category and item management
- Menu price and availability management
- Dine-in and takeout order entry
- Table assignment for dine-in orders
- Automatic totals, cash received, and change
- Recording of cash, GCash, or Maya as the payment method
- Browser-printable receipts
- Kitchen order queue and status updates
- Basic table availability
- Basic inventory and stock movements
- Low-stock warnings
- Daily and date-range sales reports
- Best-selling-item and payment-method summaries
- Local SQLite backup procedure

## Excluded Features

- Real GCash or Maya integration
- Customer accounts or online ordering
- Mobile applications
- Reservations, delivery, or map tracking
- SMS, email, and push notifications
- Staff scheduling and attendance
- Cloud hosting and synchronization
- Multiple restaurant branches
- Advanced accounting and forecasting

## Project Constraints

- The application must work without internet access.
- The first version will use SQLite as its database.
- The interface will be browser-based and built with React.
- Payment providers will only be recorded as payment methods.
- The project must remain small enough to build and demonstrate within an academic term.

## Core Demonstration Scenario

1. An admin logs in and creates or updates a menu item.
2. A cashier logs in and creates a dine-in order.
3. The system calculates the total and records payment.
4. The order appears in the kitchen queue.
5. Kitchen staff move the order from Pending to Completed.
6. The cashier prints the receipt and releases the table.
7. The completed sale appears in the admin report.

