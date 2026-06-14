# SplitLedger — Shared Expenses Tracker

## 🚀 Try it Live

Check out the live deployment here: [shared-expenses-app-ecru.vercel.app](https://shared-expenses-app-ecru.vercel.app)

### Demo Accounts
Here are the pre-configured accounts you can use to test the application immediately:

| Name | Email | Password |
| :--- | :--- | :--- |
| **Aisha** | `aisha@flatmates.com` | `password123` |
| Rohan | `rohan@flatmates.com` | `password123` |
| Priya | `priya@flatmates.com` | `password123` |
| Meera | `meera@flatmates.com` | `password123` |
| Sam | `sam@flatmates.com` | `password123` |
| Dev | `dev@flatmates.com` | `password123` |

We recommend logging in as Aisha — she has the most complete view of all expenses.

---

So here's the backstory. Four flatmates — Aisha, Rohan, Priya, and Meera — were sharing a flat and tracking expenses in a CSV spreadsheet. Dev tagged along for a trip and got added temporarily. Then Meera moved out at the end of March. Sam moved in mid-April. The spreadsheet turned into a mess pretty fast: duplicate rows, dollar amounts mixed in with rupees (Priya kept paying for Netflix in USD), and someone logged a settlement as a regular expense. Nobody knew who owed whom anymore.

This app was built to import that exact CSV, catch all those problems automatically, let the user review and fix each one, and then show clean balances with settlement suggestions. It handles the tricky stuff — like knowing that Sam shouldn't be included in any expense before his join date, or that Meera's post-March expenses need to be flagged, not silently ignored.

## Tech Stack

- **Frontend:** React 18 with Vite, TailwindCSS v3, React Router v6
- **Backend:** Node.js + Express.js, REST API
- **Database:** MongoDB Atlas with Mongoose (using references between collections, not embedded docs)
- **Auth:** JWT tokens with bcrypt password hashing
- **CSV Parsing:** multer for file upload, papaparse for parsing
- **Icons:** lucide-react
- **Notifications:** react-hot-toast

## Getting It Running

You'll need Node.js 18+ and a MongoDB Atlas account (the free tier works fine).

### 1. Clone and install

```bash
git clone <your-repo-url>
cd shared-expenses

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Set up your environment variables

Copy the example files and fill in your values:

```bash
# In /server
cp .env.example .env

# In /client
cp .env.example .env
```

**Server `.env` — here's what each one does:**

```
MONGO_URI=mongodb+srv://...       # Your MongoDB Atlas connection string. 
                                   # Go to Atlas → Connect → Drivers → copy the string.
                                   # Replace <password> with your actual password.

JWT_SECRET=some_random_string      # Any random string. Used to sign login tokens.
                                   # Run `openssl rand -hex 32` to generate one, 
                                   # or just mash your keyboard honestly.

PORT=5000                          # The port the backend runs on. 5000 is the default.

USD_TO_INR_RATE=83.50              # The exchange rate used when converting dollar 
                                   # amounts from the CSV. I picked 83.50 because that 
                                   # was roughly the rate when I built this. It's fixed 
                                   # on purpose — using a live API would make imports 
                                   # non-reproducible.
```

**Client `.env`:**

```
VITE_API_BASE_URL=http://localhost:5000    # Points to wherever your backend is running.
                                           # Change this to your Render URL in production.
```

### 3. Run it

Open two terminals:

```bash
# Terminal 1 — backend
cd server
npm run dev

# Terminal 2 — frontend
cd client
npm run dev
```

The frontend will be at `http://localhost:5173` and it proxies API requests to the backend at port 5000 automatically (configured in vite.config.js).

### 4. First-time setup in the app

1. Register an account
2. Create a group (e.g., "Flat Expenses 2024")
3. Add your members with their join dates (and leave dates if they left)
4. Go to the Import tab and upload your CSV
5. Review the anomalies it finds, approve or reject each one
6. Check the Balances page to see who owes whom

## The CSV Format

The importer expects these columns:

```
Date, Description, Amount, Currency, PaidBy, SplitType, SplitDetails, Notes
```

`SplitDetails` format depends on the split type:
- **EQUAL:** leave it empty
- **EXACT:** `Aisha:500,Rohan:300,Priya:200`
- **PERCENTAGE:** `Aisha:40,Rohan:30,Priya:30`
- **SHARES:** `Aisha:2,Rohan:1,Priya:1`

The importer handles messy headers too — `paid by`, `Paid_By`, `payer` all map to the same field.

## What the Anomaly Detector Catches

The CSV importer runs 14 checks on every row. Here are some of the interesting ones:

- **Dollar as Rupee** — if someone typed `$45` in the amount but left the currency column blank, the app flags it instead of silently treating 45 dollars as 45 rupees. This was Priya's whole problem.
- **Ghost members** — expenses listing someone who isn't in the group get flagged with an option to add them.
- **Time-travel expenses** — if an expense is dated after Meera left or before Sam joined, it gets caught.
- **Settlements disguised as expenses** — if the description says "paid back" or "settlement", it gets reclassified.
- **Name variants** — "aisha", "Aisha", and "AISHA" all get normalized to the same person.

Nothing gets imported silently. Every anomaly shows up in a review table where you approve or reject it before anything touches the database.

## Project Structure

```
/server                        
  /models        → Mongoose schemas (User, Group, GroupMember, Expense, ImportLog)
  /routes        → API endpoints (auth, groups, expenses, import, balances)
  /services      → Business logic (csvImporter, balanceCalculator, settlementOptimizer)
  /middleware     → JWT auth, error handler
  /utils         → Date parsing, name normalization

/client
  /src/pages     → Login, Register, Dashboard, GroupPage, ImportPage, BalancePage
  /src/components → Reusable UI (ExpenseForm, CSVUploader, AnomalyReviewTable, etc.)
  /src/api       → Axios calls for each resource
  /src/context   → Auth and Group state management
  /src/hooks     → useAuth, useGroup, useBalance
```

## Deployment

- **Backend** → Render.com (free tier). Set the env vars in the Render dashboard.
- **Frontend** → Vercel. Set `VITE_API_BASE_URL` to your Render URL.

Build commands:
- Server: `npm install` then `node server.js`
- Client: `npm run build` (outputs to `/dist`)

## What I Found Interesting

The balance calculator was trickier than I expected. The key insight is that settlements are NOT expenses — they're direct transfers between two people. If you treat them like regular expenses and try to split them, the math breaks. So settlements get their own code path: credit the payer, debit the receiver, done. No splitting involved.

The greedy settlement optimizer was fun to implement. It sorts creditors and debtors by how much they're owed/owe, then matches the biggest debtor with the biggest creditor, transfers the minimum of the two, and repeats. It doesn't always give the mathematically optimal number of transactions, but it's close and it's easy to trace through by hand — which matters when someone asks "why does this say I owe Rohan ₹2,300?"

## AI Tools Used

- Claude Opus 4 (via Antigravity IDE) — used for code generation, architecture decisions, and debugging. See [AI_USAGE.md](./AI_USAGE.md) for details and honest mistakes.
