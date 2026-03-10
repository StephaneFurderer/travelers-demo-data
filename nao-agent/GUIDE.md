# How This Works: A Plain-English Guide to the Nao Analytics Agent

**Audience:** Business leaders, insurance executives, and anyone curious about what it takes to go from "I have a database" to "I can ask it questions in English."

**Time to read:** 8 minutes

---

## What You're Looking At

This is a travel insurance portfolio — 50,000 bookings, 73,000 policies, 5,300 claims — stored in a standard Postgres database. The kind of data that normally lives behind a dashboard.

On top of it sits **Nao**, an open-source analytics agent. You type a question in plain English. Nao writes the SQL, runs it against your database, and gives you the answer. No tickets. No waiting. No translating what you need into someone else's language.

The whole setup took an afternoon.

---

## The Mental Model: Three Layers

Think of it like hiring a new analyst. They need three things before they can answer your questions:

```
┌─────────────────────────────────────┐
│  1. ACCESS    → Database connection │  "Here's the database login"
│  2. CONTEXT   → Semantic model      │  "Here's what the tables mean"
│  3. JUDGMENT  → LLM (Claude)        │  "Now figure out the answer"
└─────────────────────────────────────┘
```

**Layer 1 — Access** is just a database connection. Host, port, credentials. Same as any BI tool.

**Layer 2 — Context** is where the real work happens. This is a file called `RULES.md` that tells the agent everything a senior analyst would know: what the tables represent, how they join together, what the metrics mean, and what mistakes to avoid. More on this below.

**Layer 3 — Judgment** is the large language model (Claude, in our case). It reads your question, reads the context, writes SQL, and explains the result. You don't configure this part — it just works.

---

## The Four Files That Make It Work

If you open the [GitHub repo](https://github.com/StephaneFurderer/travelers-demo-data), here's what matters inside the `nao-agent/` folder:

### 1. `nao_config.yaml` — The Connection

*Not in the repo (contains credentials), but here's what it looks like:*

This file tells Nao two things: where's the database, and which AI model to use. It's 15 lines. You set it once and forget it.

```yaml
databases:
  - name: supabase-travelers
    type: postgres
    host: your-database-host.com
    port: 5432
    database: postgres
    schema_name: public

llm:
  provider: anthropic
```

**In plain terms:** "Connect to this database, use Claude to answer questions."

### 2. `RULES.md` — The Semantic Model (This Is the Important One)

This is the file that separates a useful agent from a hallucinating one. It's roughly 100 lines of plain English that describes:

- **What each table represents.** "Bookings is the central table — one row per customer trip. Policies is one row per insured product. A single booking can have two policies."

- **How tables connect.** "Bookings link to destinations by destination_id. Policies link to bookings by booking_id. Claims link to policies by policy_id."

- **What the metrics actually mean.** "Reported frequency = count of claims / count of policies. Loss ratio = sum of claim amounts / sum of trip costs. These are not the same thing."

- **What mistakes to avoid.** "When computing loss ratio, join policies to claims — not bookings to claims. Round money to 2 decimals. Use explicit JOINs."

Think of RULES.md as the onboarding document you'd write for a new analyst on their first day. The better this file is, the better the answers are.

### 3. `databases/` — The Schema Documentation

When you run `nao sync`, Nao connects to your database and auto-generates documentation for every table: column names, data types, and a preview of the data. These files live in the `databases/` folder.

The auto-generated descriptions say "No description available" — so we enriched each one with 2-3 sentences of business context. For example, the claims table description now reads:

> *"Insurance claim events linked to policies. ~7% of policies generate a claim. Claims are either pre_departure (cancellation) or post_departure (trip_delay or trip_interruption)."*

This is the kind of institutional knowledge that usually lives in someone's head. Now it lives in a file the agent can read.

### 4. `tests/` — Verification

Three YAML files, each with a question and the correct SQL answer. You run `nao test` and the agent's answers are compared against ground truth. This is how you know the agent is accurate before you put it in front of anyone.

Our three test cases:
- Average claim amount by segment (tests a 3-table join)
- Loss ratio by destination type (tests a derived metric)
- Hurricane exposure on the Gulf Coast in September (tests date logic + geographic filtering)

All three pass.

---

## The Demo: 9 Questions in 3 Acts

### Act 1 — "Things the dashboard already answers" (warm-up)
1. How many bookings by segment?
2. Average claim amount by segment?
3. Which states have the highest loss ratio?

**Point:** The agent matches the dashboard. Trust established.

### Act 2 — "Things the dashboard can't answer" (the gap)
4. Average trip duration for customers who filed a claim vs. those who didn't?
5. Reported frequency by age bracket?
6. Which origin-to-destination routes have the highest claim frequency?

**Point:** These are reasonable business questions. None of them are on any dashboard. Each one would be a ticket to the BI team.

### Act 3 — "The hurricane scenario" (the closer)
7. If a hurricane hits the Gulf Coast Sept 10-16, how many travelers are on the ground?
8. What's the total dollar exposure? Break it down by city.
9. How does September Gulf Coast reported frequency compare to other regions?

**Point:** In a real catastrophe, these answers need to come in minutes, not days. The agent delivers them in seconds.

### Bonus - "Things that require more data"
10. Forecast the portfolio using the historical trend.
11. I want to see the development of each cohort per purchase month
12. Add an ultimate loss estimate per cohort using a chain-ladder development factor

---

## What This Doesn't Replace

Let's be clear about what Nao is and isn't:

| Nao is good at | Nao is not for |
|----------------|----------------|
| Ad-hoc questions from business users | Production reporting pipelines |
| Quick exploration of data | Real-time operational dashboards |
| Scenario analysis ("what if...") | Data entry or writes to the database |
| Validating intuition with numbers | Replacing your data engineering team |

Your Power BI dashboard isn't the problem. The problem is that the dashboard only answers the questions it was built to answer. Nao answers the next question — the one nobody anticipated.

---

## How to Set It Up (High-Level Steps)

1. **Install Nao** — `pip install nao-core` in a Python virtual environment
2. **Write the config** — Database connection + LLM provider (15 lines of YAML)
3. **Sync the schema** — `nao sync` reads your database and generates docs
4. **Enrich the docs** — Add business context to each table's description
5. **Write the semantic model** — `RULES.md` with table descriptions, joins, metrics, guardrails
6. **Test** — Write 2-3 test cases, run `nao test`, verify accuracy
7. **Launch** — `nao chat` opens the UI at localhost:5005

Steps 4 and 5 are where you spend 80% of your time. Everything else is configuration.

---

## Resources

- **This repo:** [github.com/StephaneFurderer/travelers-demo-data](https://github.com/StephaneFurderer/travelers-demo-data) — full source code, semantic model, test cases
- **Nao documentation:** [github.com/naohq/nao](https://github.com/naohq/nao) — the open-source project
- **RULES.md in this repo:** The complete semantic model — read this to see exactly what the agent knows about our data

---

## The Prompts I Used to Build This

For transparency, here are the key prompts I gave Claude Code (the AI coding assistant) to build this entire setup:

**Prompt 1 — Initial setup:**
> "Implement the following plan: Install Nao CLI, write nao_config.yaml pointing to our Supabase Postgres database, write RULES.md as a semantic model covering all 5 tables, their joins, metric definitions, and hurricane exposure methodology. Sync the schema, enrich descriptions, write 3 test cases, and verify everything works."

**Prompt 2 — Verification:**
> Ran `nao test` — all 3 test cases passed on the first run after tuning the prompts.

The total build time from "empty folder" to "all tests passing" was under 2 hours, including debugging dependency issues.

---

## Three Questions to Ask Yourself

Before evaluating any tool, ask these about your current setup:

1. **What question did you last ask your BI team that took more than a day to answer?** If the answer was a simple filter, group-by, or join — that's a process bottleneck, not a complexity problem.

2. **Can your dashboard answer a question it wasn't built to answer?** This is the core test. If someone in leadership asks something that's not on a pre-built tab, what happens next?

3. **Who in your org has a question right now that they stopped asking because the turnaround wasn't worth it?** This is the real cost — not slow answers, but questions that never get asked.

---

*Built with Nao (open source) + Claude (Anthropic) + Supabase (Postgres) + one afternoon of setup.*
