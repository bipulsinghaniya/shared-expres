# AI Usage — How I Actually Used It

I used Claude Opus 4 through the Antigravity IDE for most of this project. It helped with scaffolding, writing boilerplate, and working through the trickier logic. I want to be straightforward about how I used it and where it went wrong, because pretending I didn't use AI would be dishonest, and pretending it was perfect would be worse.

## How I Worked With It

My general workflow was: I'd describe what I needed in pretty specific detail — the schema fields, the algorithm steps, the edge cases I was worried about — and then review what came back line by line. I didn't just paste output into my codebase. I read through every function, traced through the logic with sample data in my head, and caught several things that would have broken in production.

For the backend, I'd usually describe the API contract first (what the endpoint receives, what it returns, what errors it should handle) and let Claude write the Express route. Then I'd go through and check the error handling, make sure Mongoose queries were using the right operators, and verify that edge cases like empty arrays or null dates wouldn't crash anything.

For the frontend, I described the design system I wanted (dark theme, glassmorphism cards, indigo/violet palette) and the component structure, then had it generate the JSX. The styling was mostly right on the first try, but the state management and data flow between components needed manual fixes — more on that below.

## Three Times the AI Got It Wrong

### 1. The Balance Calculator Forgot About Deleted Expenses

The first version of `calculateBalances` in `balanceCalculator.js` iterated over all expenses and calculated balances from them. It completely ignored the `isDeleted` flag. I caught this because I was mentally walking through a scenario: "If I delete a ₹1,000 grocery expense, does Aisha's balance change?" In the original code, it wouldn't — the deleted expense would still count toward everyone's balance.

The fix was straightforward — I added an `if (expense.isDeleted) continue;` check at the top of the loop. But it's the kind of bug that would have gone unnoticed in a demo and only blown up when someone actually deleted an expense and wondered why their balance didn't change. It taught me that AI-generated code tends to handle the happy path well but misses the "what happens when data is in a weird state" cases.

### 2. The CSV Importer Had Overlapping Currency Detectors

This one was subtle. The importer has two currency-related detectors: CURRENCY_MISMATCH (for when the amount says `$45` and the Currency column says `USD`) and DOLLAR_AS_RUPEE (for when the amount says `$45` but there's no currency column value). In the first version, both detectors would fire on the same row because they both checked for a dollar sign in the amount string, and neither checked whether the other had already handled it.

So if someone had a row like `$45, USD` — which is perfectly valid — it would get flagged twice: once as a currency mismatch AND once as a dollar-treated-as-rupee. That's confusing and wrong. I fixed this by making the DOLLAR_AS_RUPEE detector check `rawCurrency !== 'USD'` before firing. If the currency column already says USD, the first detector handles it; the second one only fires when the currency column is empty or says something else.

I caught this by writing out a matrix of test cases on paper: "$ + USD column", "$ + INR column", "$ + empty column", "no $ + USD column". When I traced through the detector sequence for each case, the overlap became obvious.

### 3. The Settlement Suggestions Included Members With Zero Balance

The settlement optimizer originally included everyone in the balance map, even members with a balance of exactly zero. This meant the greedy algorithm would sometimes try to create a settlement transaction of ₹0.00 — which is technically correct but looks dumb in the UI and would create a pointless expense document in the database.

I found this when I tested with a group where two members had already settled up. The suggestions page showed "Priya pays ₹0.00 to Rohan" as an actual suggestion. The fix was adding a threshold check: any balance with an absolute value less than ₹0.01 gets treated as zero and excluded from the creditor/debtor lists. It's a small thing, but it's the kind of thing that would make an evaluator raise an eyebrow during a walkthrough.

## What I Learned From Using AI

The biggest lesson is that AI is great at generating code that looks correct and terrible at understanding edge cases from context. It doesn't know that "Meera left in March" means her `leaveDate` needs to be checked against every expense date. You have to spell that out explicitly.

I also learned that AI-generated code has a specific failure mode: it writes code that handles the common case perfectly and silently does the wrong thing for edge cases. It won't crash — it'll just give you the wrong number. That's actually harder to catch than a crash.

My approach for the critical modules (balance calculator, CSV importer, settlement optimizer) was to trace through them with pen and paper using real numbers before trusting the output. For the UI components, I was less rigorous — if a button looks right and the API call goes through, it's probably fine.

## Key Prompts I Used

I didn't keep an exact log of every prompt, but the important ones were roughly:

- "Write a CSV import service that runs 14 anomaly detectors on each row. Here are the 14 types..." — gave it the full list with examples of what each one means.
- "Write a balance calculator as pure functions. For each non-deleted, non-settlement expense, credit the payer and debit each split member. Handle settlements separately as direct transfers." — the specificity here is what made it work on the first pass (minus the isDeleted bug).
- "Build the anomaly review table with approve/reject toggles per row and a confirm button that's disabled until all anomalies are resolved" — describing the UX constraint directly led to better code than saying "build an import review UI."

The pattern I noticed: the more specific the prompt, the less I had to fix afterward. Vague prompts like "build the frontend" produce generic code. Prompts that describe the exact data flow and edge cases produce code that's 80-90% right.

## Final Note

I reviewed every file in this project. Some of them I rewrote significantly from what was generated; others needed only minor fixes. The architecture, the data flow decisions, and the anomaly detection rules were all designed by me — the AI helped translate those decisions into code faster than I could have typed it all myself.
