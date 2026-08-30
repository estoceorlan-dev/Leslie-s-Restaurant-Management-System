# Initial Wireframes

These wireframes define layout and information priority. They are not final visual designs.

## Login

```text
+--------------------------------------------------+
|       LESLIE'S RESTAURANT MANAGEMENT SYSTEM      |
|                                                  |
|                Username [____________]           |
|                Password [____________]           |
|                                                  |
|                     [ Log In ]                   |
|                                                  |
|             Local system • Offline ready         |
+--------------------------------------------------+
```

## Admin Dashboard

```text
+----------------+-----------------------------------------------+
| Leslie's       | Admin Dashboard               [Admin] [Logout]|
|----------------|-----------------------------------------------|
| Dashboard      | [Today's Sales] [Orders] [Low Stock]          |
| Employees      |                                               |
| Menu           | Sales Overview                                |
| Tables         | [          simple sales chart              ]  |
| Inventory      |                                               |
| Reports        | Low-stock Items                               |
|                | Item             Quantity           Status    |
|                | Cooking Oil     2 bottles          LOW        |
+----------------+-----------------------------------------------+
```

## Cashier Ordering Screen

```text
+---------------------------------------------------------------+
| Cashier • New Order                           [Order History]  |
| Order type: ( Dine-in ) ( Takeout )  Table: [ 4 v ]           |
|---------------------------------------------------------------|
| Menu Categories              | Current Order                  |
| [Meals] [Drinks] [Desserts]  | 2 x Fried Chicken    240.00   |
|                              | 1 x Iced Tea          45.00   |
| [Fried Chicken] 120.00 [+]   |-------------------------------|
| [Pancit]         95.00 [+]   | Total                285.00   |
| [Iced Tea]       45.00 [+]   | Payment [Cash v]              |
|                              | Received [500.00]              |
|                              | Change    215.00               |
|                              | [Confirm and Print Receipt]   |
+---------------------------------------------------------------+
```

## Kitchen Queue

```text
+---------------------------------------------------------------+
| Kitchen Queue                                  Auto refresh: ON|
|---------------------------------------------------------------|
| #1004 • Table 4 • 10:35 AM     PENDING                       |
| 2 x Fried Chicken                                              |
| 1 x Iced Tea                                                   |
| Note: No gravy                         [Start Preparing]       |
|---------------------------------------------------------------|
| #1003 • Takeout • 10:30 AM     PREPARING                     |
| 1 x Pancit                              [Mark Ready]            |
+---------------------------------------------------------------+
```

## Menu Management

```text
+---------------------------------------------------------------+
| Menu Management                              [+ Add Menu Item] |
| Search [________________] Category [All v] Status [All v]      |
|---------------------------------------------------------------|
| Name              Category       Price      Available  Actions |
| Fried Chicken     Meals          120.00       Yes      Edit    |
| Pancit            Meals           95.00       Yes      Edit    |
| Iced Tea          Drinks          45.00       Yes      Edit    |
+---------------------------------------------------------------+
```

## Inventory

```text
+---------------------------------------------------------------+
| Inventory                                  [+ Add Stock Item]  |
|---------------------------------------------------------------|
| Item              Quantity       Low Level      Status  Action |
| Rice              15 kg          5 kg           OK      Adjust |
| Cooking Oil       2 bottles      3 bottles      LOW     Adjust |
| Chicken           10 kg          4 kg           OK      Adjust |
+---------------------------------------------------------------+
```

