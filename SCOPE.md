# Project Scope: Schemas & Anomaly Detectors

This document breaks down the database schemas and details exactly how each of the 14 anomaly detectors works. It's written in plain English to show the logic behind the code.

---

## 1. Database Schemas (Mongoose)

We decided to use a relational-style layout with references rather than embedding everything. This makes it a lot easier to query and update things individually without having to save massive, nested documents.

### User Schema (`User.js`)
Stores basic authentication and profile details.
- `name`: String (required). Display name.
- `email`: String (required, unique). Used for login.
- `passwordHash`: String (required). Bcrypt hashed password.
- `createdAt`: Date. Automatically defaulted to the current time.

### Group Schema (`Group.js`)
Represents a group of people sharing expenses.
- `name`: String (required). e.g., "Flat 302 Expenses".
- `description`: String. A brief note about what the group is.
- `createdBy`: ObjectId (refers to `User`). The user who created the group.
- `createdAt`: Date. Default to current time.

### Group Member Schema (`GroupMember.js`)
Maps users to groups. This is a separate junction table so we can track when people join and leave.
- `groupId`: ObjectId (refers to `Group`, required).
- `userId`: ObjectId (refers to `User`, required).
- `joinDate`: Date (required). When the user became part of the group.
- `leaveDate`: Date (optional). When the user left the group (like Meera leaving at the end of March).
- `addedBy`: ObjectId (refers to `User`). Who added this member.

### Expense Schema (`Expense.js`)
Represents an individual transaction or settlement.
- `groupId`: ObjectId (refers to `Group`, required).
- `description`: String (required). What it was for.
- `amount`: Number (required). The raw amount entered.
- `currency`: String (enum: `['INR', 'USD']`, default: `INR`).
- `amountInINR`: Number (required). The final amount in rupees, converted if necessary.
- `exchangeRateUsed`: Number (default: 1). The conversion multiplier.
- `date`: Date (required). When the expense occurred.
- `paidBy`: ObjectId (refers to `User`, required). Who paid the bill.
- `splitType`: String (enum: `['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES']`, default: `EQUAL`).
- `splits`: Array of objects:
  - `userId`: ObjectId (refers to `User`, required).
  - `amount`: Number (required). Their share in INR.
- `isSettlement`: Boolean (default: `false`). True if this is just a payment to clear debt.
- `isDeleted`: Boolean (default: `false`). Used for soft deletes.
- `importRowIndex`: Number (optional). Keeps track of the CSV row number if it was imported.
- `notes`: String. Any extra details.
- `createdAt`: Date. Default to current time.

### Import Log Schema (`ImportLog.js`)
Tracks the status of CSV file uploads and their parsed contents.
- `groupId`: ObjectId (refers to `Group`, required).
- `uploadedBy`: ObjectId (refers to `User`, required).
- `fileName`: String (required). The uploaded CSV name.
- `importedAt`: Date (default: current time).
- `totalRows`: Number. Total lines in the CSV.
- `successCount`: Number. Number of rows successfully turned into expenses.
- `errorCount`: Number. Number of rows skipped or blocked.
- `skippedCount`: Number. Number of rejected rows.
- `anomalies`: Array of objects (the detected issues):
  - `rowIndex`: Number. The line number in the CSV.
  - `issueType`: String. The code representing the error (e.g., `DUPLICATE_ROW`).
  - `description`: String. Human-readable explanation.
  - `rawRow`: Object. The key-value pairs parsed from that CSV row.
  - `suggestedAction`: String. Default solution recommendation.
  - `status`: String (enum: `['pending', 'approved', 'rejected']`, default: `pending`). The user's choice.

---

## 2. The 14 Anomaly Detectors

Every row in the CSV goes through these 14 checks. If a row triggers any of them, it gets flagged and stored in the `ImportLog` so the user can review and fix it in the UI.

### 1. `DUPLICATE_ROW`
- **What it checks**: If a row looks exactly like another row in the same CSV file.
- **Trigger**: We generate a hash using `Date + Description + Amount + PaidBy`. If we see this exact hash twice in the same upload, it's flagged.
- **Default Action**: Skip the duplicate row, keeping only the first instance.

### 2. `NEGATIVE_AMOUNT`
- **What it checks**: If the amount is less than 0.
- **Trigger**: `amount < 0`.
- **Default Action**: Flag it. Usually, negative amounts are refunds or settlements, so we suggest treating it as a settlement or reversing it.

### 3. `SETTLEMENT_AS_EXPENSE`
- **What it checks**: If someone logged a "pay back" or "settlement" as a regular expense, which ruins the balance calculations.
- **Trigger**: A regex match on the Description column for keywords like `settle`, `paid back`, `reimburse`, `settlement`, `returned`.
- **Default Action**: Suggest changing `isSettlement` to `true` and setting the split type to `EXACT` with the receiver as the sole split target.

### 4. `CURRENCY_MISMATCH`
- **What it checks**: If the amount column has a dollar sign (`$`) but the Currency column says `USD`, or vice-versa, or if we have to do an implicit conversion.
- **Trigger**: Amount starts with `$` AND Currency is explicitly `USD`.
- **Default Action**: Strip the `$` sign and auto-convert to INR using the fixed exchange rate of `83.50`.

### 5. `DOLLAR_AS_RUPEE`
- **What it checks**: A critical issue where a dollar sign (`$`) is written in the amount column, but the Currency column says `INR` or is left empty.
- **Trigger**: Amount starts with `$` but the Currency column is blank or explicitly says `INR`.
- **Default Action**: Flag for manual review. If they confirm it, we treat it as USD and convert it using the `83.50` rate.

### 6. `MEMBER_NOT_IN_GROUP`
- **What it checks**: If the person who paid (or someone mentioned in the split details) is not registered in the group.
- **Trigger**: We normalize the name and compare it to the group's current members. If no match is found, it triggers.
- **Default Action**: Flag and offer to create a new user profile and add them to the group automatically.

### 7. `EXPENSE_AFTER_LEAVE`
- **What it checks**: If a member is included in a split (or listed as payer) for an expense dated *after* their official leave date.
- **Trigger**: `expenseDate > member.leaveDate`. (e.g. Meera left end of March, but was charged for an April expense).
- **Default Action**: Remove this member from the split calculation and recalculate the shares among the remaining active members.

### 8. `EXPENSE_BEFORE_JOIN`
- **What it checks**: If a member is included in a split (or listed as payer) for an expense dated *before* they joined.
- **Trigger**: `expenseDate < member.joinDate`. (e.g. Sam joined mid-April, but is charged for a February expense).
- **Default Action**: Exclude them from the split list and recalculate among the active members.

### 9. `MISSING_FIELDS`
- **What it checks**: If critical fields like Date, Description, Amount, or PaidBy are missing.
- **Trigger**: Any of these columns are empty or contain only whitespace.
- **Default Action**: High-priority flag. The row is blocked from import until the user enters the missing info in the review table.

### 10. `INVALID_DATE`
- **What it checks**: If the date column has a garbled or un-parseable string.
- **Trigger**: `isNaN(Date.parse(row.Date))`.
- **Default Action**: Flag and ask the user to correct the date string (e.g., convert "yesterday" or "Jan 35th" to a proper YYYY-MM-DD date).

### 11. `PERCENTAGE_NOT_100`
- **What it checks**: For percentage-based splits, if the sum of all percentages doesn't equal 100%.
- **Trigger**: `SplitType === 'PERCENTAGE'` and the sum of percentages parsed from SplitDetails is not exactly 100.
- **Default Action**: Flag and suggest adjusting the percentages proportionally so they sum to 100%.

### 12. `EXACT_MISMATCH`
- **What it checks**: For exact-amount splits, if the sum of individual shares doesn't add up to the total expense amount.
- **Trigger**: `SplitType === 'EXACT'` and the sum of individual amounts doesn't match the total Amount.
- **Default Action**: Flag and prompt the user to adjust the amounts or split the remainder evenly.

### 13. `ZERO_AMOUNT`
- **What it checks**: If someone logged an expense with a value of 0.
- **Trigger**: `amount === 0`.
- **Default Action**: Flag as suspicious (usually a placeholder or double-entry mistake). Suggest skipping or updating the amount.

### 14. `NAME_VARIANT`
- **What it checks**: If a name is written slightly differently (e.g., "Aisha S.", "aisha", "AISHA") but refers to an existing member.
- **Trigger**: Fuzzy name matching (lowercase, trim, stripping trailing initials) matches a group member, but isn't an exact match.
- **Default Action**: Auto-normalize the name to the canonical spelling ("Aisha") and log it as resolved.
