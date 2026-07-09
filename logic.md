# Database Logic & Design

This document outlines the database design, schema, and core logic for the Expenses web application. The application relies on a PostgreSQL relational database.

## 1. Overview and Core Entities

The database is designed to manage shared expenses among users. The core entities are:

- **Users**: Individuals who participate in groups and expenses.
- **Groups**: Collections of users who share related expenses (e.g., "Trip to Goa", "Apartment Utilities").
- **Group Members**: The relationship mapping which users belong to which groups, including temporal data (when they joined or left).
- **Expenses**: Individual transaction records within a group, paid by one user.
- **Expense Splits**: The detailed breakdown of how much each user owes for a specific expense.
- **Import Logs**: Audit logs for bulk expense imports (e.g., from CSV files).

## 2. Entity-Relationship Diagram (ERD) Flow

- **User to Group**: 
  - A User can create many Groups (1:N).
  - A User can be a member of many Groups (M:N, managed by `group_members`).
- **Group to Expense**:
  - A Group contains many Expenses (1:N).
- **User to Expense**:
  - A User pays for many Expenses (1:N).
  - A User owes for many Expenses (M:N, managed by `expense_splits`).
- **Expense to Splits**:
  - An Expense is divided into many Expense Splits (1:N).
- **Group to Import Log**:
  - A Group can have many Import Logs (1:N).

## 3. Detailed Schema Design

### `users` Table
Handles user identity and authentication.
- `id` (SERIAL, PK): Unique identifier.
- `name` (TEXT): Full name of the user.
- `email` (TEXT, UNIQUE): User's email address (used for login).
- `password_hash` (TEXT): Securely hashed password.
- `created_at` (TIMESTAMP): Account creation date.

### `groups` Table
Represents a collection of shared expenses.
- `id` (SERIAL, PK): Unique identifier.
- `name` (TEXT): Name of the group.
- `description` (TEXT): Optional description.
- `created_by` (INTEGER, FK -> users(id)): The user who created the group.
- `created_at` (TIMESTAMP): Group creation date.

### `group_members` Table
Junction table for Users and Groups, supporting historical tracking of membership.
- `id` (SERIAL, PK): Unique identifier.
- `group_id` (INTEGER, FK -> groups(id)): Reference to the group.
- `user_id` (INTEGER, FK -> users(id)): Reference to the user.
- `join_date` (TIMESTAMP): When the user joined the group.
- `leave_date` (TIMESTAMP, nullable): When the user left the group (allows for past members to still be accounted for in old expenses).
- `added_by` (INTEGER, FK -> users(id)): The user who added this member.
- **Constraints**: Unique combination of `(group_id, user_id)`.

### `expenses` Table
The core transactional data.
- `id` (SERIAL, PK): Unique identifier.
- `group_id` (INTEGER, FK -> groups(id)): The group this expense belongs to.
- `description` (TEXT): What the expense was for.
- `amount` (REAL): The original amount of the expense.
- `currency` (TEXT): The currency of the original amount (default 'INR').
- `amount_in_inr` (REAL): Normalized amount in base currency (INR) for consistent calculation.
- `exchange_rate_used` (REAL): The exchange rate applied if currency was not INR.
- `date` (TIMESTAMP): Date the expense occurred.
- `paid_by` (INTEGER, FK -> users(id)): The user who paid the bill.
- `split_type` (TEXT): How the expense is divided ('EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES').
- `is_settlement` (BOOLEAN): Flag indicating if this is a payment to settle a debt rather than a standard expense.
- `is_deleted` (BOOLEAN): Soft-delete flag (expenses are rarely hard-deleted for audit purposes).
- `import_row_index` (INTEGER, nullable): Reference to the CSV row if imported.
- `notes` (TEXT): Additional comments.

### `expense_splits` Table
Details exactly how an expense is divided among group members.
- `id` (SERIAL, PK): Unique identifier.
- `expense_id` (INTEGER, FK -> expenses(id)): Reference to the expense. On delete cascades.
- `user_id` (INTEGER, FK -> users(id)): The user who owes this portion.
- `amount` (REAL): The exact calculated amount this user owes for this expense.

### `import_logs` Table
Audit trail for CSV imports.
- `id` (SERIAL, PK): Unique identifier.
- `group_id` (INTEGER, FK -> groups(id)): Group the import was for.
- `uploaded_by` (INTEGER, FK -> users(id)): User who performed the import.
- `file_name` (TEXT): Original file name.
- `total_rows`, `success_count`, `error_count`, `skipped_count` (INTEGER): Metrics of the import.
- `anomalies` (JSONB): Structured data about rows that need user review/correction.
- `parsed_rows` (JSONB): The successfully parsed rows ready for confirmation.
- `is_confirmed` (BOOLEAN): Whether the user has finalized and applied this import.

## 4. Key Logic & Behaviors

1. **Balance Calculation**: 
   - A user's balance in a group is calculated by summing all `expense_splits.amount` where they are the `user_id` (money they owe) and subtracting it from the sum of `expenses.amount_in_inr` where they are the `paid_by` user (money they paid).
2. **Soft Deletion**: 
   - Expenses use the `is_deleted` flag instead of `DELETE` statements. This ensures financial history is maintained and balances can be accurately reconstructed if needed.
3. **Temporal Memberships**: 
   - The `join_date` and `leave_date` in `group_members` ensure that expenses can only be split among users who were active members of the group *at the time the expense occurred*.
4. **Normalized Currency**:
   - While expenses can be entered in various currencies, the `amount_in_inr` is calculated immediately based on exchange rates and stored. All balances and settlements are calculated using this normalized INR value to avoid floating exchange rate discrepancies.
5. **Transactions**:
   - Creating an expense and its related expense splits is done within a single SQL `BEGIN ... COMMIT` transaction block to ensure data integrity (no orphaned expenses or splits).
6. **Cascading Deletes**:
   - Deleting an expense automatically deletes its associated `expense_splits` via `ON DELETE CASCADE`.

## 5. Performance Optimizations (Indexes)

To ensure queries remain fast as data grows, the following indexes are used:
- `idx_expenses_group`: On `expenses(group_id, is_deleted, date)` for quickly fetching a group's expense feed.
- `idx_expenses_paidby`: On `expenses(group_id, paid_by)` for quickly finding what a user paid in a group.
- `idx_group_members_group`: On `group_members(group_id)` for listing members of a group.
- `idx_group_members_user`: On `group_members(user_id)` for finding all groups a user belongs to.
- `idx_expense_splits_expense`: On `expense_splits(expense_id)` for joining splits to their parent expense.
