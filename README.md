# 🌌 ContriMatch — Omnichannel Personal OSS Career Agent

> **ContriMatch v11.1.0** is an omnichannel open-source career agent that automatically bridges the gap between active open-source repositories and global hiring markets. By utilizing **Coral** (the declarative multi-source SQL engine) and **Gemini 2.5 Flash**, it helps you locate unassigned open-source issues, verify them against active pull request collisions, match them to live job opportunities, and deliver dynamic alerts directly to your phone.

---

## 🏆 The 12/10 Moat: Core Coral Contributions

Unlike conventional wrappers that simply query existing database endpoints, **ContriMatch is built on core engine extensions contributed directly to the Coral project**. I actively contributed and expanded the core Coral ecosystem by authoring 22 native community and core source integrations:

| Source / Spec | Pull Request / Branch | Purpose | Status |
|:---|:---|:---|:---|
| **Telegram** | [PR #863](https://github.com/withcoral/coral/pull/863) | Enabled real-time bidirectional updates, message polling, and chat synchronization. | **Merged / Released** |
| **Google Contacts** | [PR #846](https://github.com/withcoral/coral/pull/846) | Added unified Google Contacts source, address list mapping, and search query rules. | **Merged / Released** |
| **Adzuna** | [PR #815](https://github.com/withcoral/coral/pull/815) | Created the `adzuna.search_jobs` table function for worldwide job aggregation. | **Merged / Released** |
| **DEV.to** | [PR #811](https://github.com/withcoral/coral/pull/811) | Added dev article querying, reaction sorting, and author username indices. | **Merged / Released** |
| **HackerNews** | [PR #803](https://github.com/withcoral/coral/pull/803) | Integrated Algolia search indexes, story scoring, comments count, and search query filters. | **Merged / Released** |
| **Open-Meteo** | [PR #786](https://github.com/withcoral/coral/pull/786) | Live weather parameters, daily projections, and coordinate search. | **Merged / Released** |
| **CoinGecko** | [PR #781](https://github.com/withcoral/coral/pull/781) | Live cryptocurrency market pricing, coin lists, and volume tracking. | **Merged / Released** |
| **OpenLibrary** | [PR #780](https://github.com/withcoral/coral/pull/780) | Book search, author registry details, and subject search parameters integration. | **Merged / Released** |
| **Free Dictionary** | [PR #779](https://github.com/withcoral/coral/pull/779) | Term definition resolver, synonyms, audio phonetics, and grammar tags. | **Merged / Released** |
| **Public Holidays** | [PR #775](https://github.com/withcoral/coral/pull/775) | Country-wide holiday schedules, localized names, and global date alignments. | **Merged / Released** |
| **Frankfurter** | [PR #772](https://github.com/withcoral/coral/pull/772) | Real-time currency exchange rates and historical price transformations. | **Merged / Released** |
| **Chuck Norris Jokes** | [PR #770](https://github.com/withcoral/coral/pull/770) | Dynamic category joke resolver and random text matching. | **Merged / Released** |
| **PokeAPI** | [PR #767](https://github.com/withcoral/coral/pull/767) | Pokémon metadata search, characteristics extraction, and stats mapping. | **Merged / Released** |
| **REST Countries** | [PR #765](https://github.com/withcoral/coral/pull/765) | Unified worldwide country registry (borders, regions, codes, and population metadata). | **Merged / Released** |
| **Ghost CMS** | [PR #713](https://github.com/withcoral/coral/pull/713) | Administrative blog metrics, posts list, and page layouts extraction. | **Merged / Released** |
| **HackerNews Docs** | [PR #712](https://github.com/withcoral/coral/pull/712) | Added comprehensive HN integration manuals and source specification READMEs. | **Merged / Released** |
| **Remotive** | [PR #685](https://github.com/withcoral/coral/pull/685) | Enabled structured remote job metadata queries and tags extraction. | **Merged / Released** |
| **Google Ads** | [PR #854](https://github.com/withcoral/coral/pull/854) | Campaign metrics, budgets, and ad group performance reporting. | **Active / Open** |
| **Google Classroom** | [PR #852](https://github.com/withcoral/coral/pull/852) | Student courses, lists, assignments, and curriculum status. | **Active / Open** |
| **Google Chat** | [PR #850](https://github.com/withcoral/coral/pull/850) | Chat space directories, message history, and incoming webhook triggers. | **Active / Open** |
| **Google Keep** | [PR #848](https://github.com/withcoral/coral/pull/848) | Google Keep API notes listing, sync, and keyword search. | **Active / Open** |
| **CoinCap** | `feat/source-coincap` | Token rate translations, exchange listings, and history graphs. | **Local Branch** |
| **HackerNews Tables** | `feat/source-hn-tables` | Custom table mappings and schema specifications for HN articles. | **Local Branch** |


---

## 🧱 Architectural Breakdown

ContriMatch operates as a reactive hub coordinating multi-source data extraction, autonomous language generation, and instant mobile dispatch.

```
                      ┌──────────────────────────────────────────────┐
                      │                 ContriMatch                  │
                      │         "Omnichannel OSS Career Agent"       │
                      ├──────────┬──────────────┬────────────────────┤
                      │  🌐 UI   │  🤖 NL→SQL   │  ✈️ Telegram Bot    │
                      │  Web App │  (Self-Heal) │  (Polling Thread)  │
                      ├──────────┴──────────────┴────────────────────┤
                      │           Python FastAPI (port 8000)         │
                      ├──────────────────────────────────────────────┤
                      │               Coral SQL Engine               │
                      ├──────────┬──────────┬────────┬────────┬──────┤
                      │ GitHub   │ Remotive │   HN   │ DEV.to │Adzuna│
                      │ (core)   │ (PR #685)│(PR#803)│(PR#811)│(PR#815)
                      └──────────┴──────────┴────────┴────────┴──────┘
```

### 1. 📡 6 Live Data Sources
ContriMatch normalizes and joins 6 distinct data feeds across core and community boundaries using Coral:

*   **GitHub (Core)**: Exposes unassigned bugs, labels, comments, and open Pull Requests.
*   **Adzuna (PR #815)**: Powers keyword-based global career matches via `adzuna.search_jobs(what => '...')`.
*   **Remotive (PR #685)**: Aggregates remote positions categorized by technology tags and locations.
*   **HackerNews (PR #803)**: Tracks active software development conversations and trending topics.
*   **DEV.to (PR #811)**: Integrates technical articles, guides, and learning resources.
*   **Telegram (PR #863)**: Enables real-time updates and direct user notification streams.

### 2. 🧠 Autonomous Self-Healing Agent Core
The `/api/ask` route executes a resilient natural language interface.
1.  **Intent Translation**: Generates raw Coral SQL from plain English using `gemini-2.5-flash`.
2.  **Compilation Interception**: If the generated SQL fails due to structural or validation errors in the Coral CLI, the exception is caught.
3.  **Self-Correction Loop**: The raw error log is fed back into Gemini with the original question. The agent autonomously heals the SQL syntax and executes the corrected query, delivering zero-crash reliability during live demos.

### 3. ✈️ Bidirectional Async Telegram Daemon
A background daemon thread runs continuously inside FastAPI, checking the custom-built `telegram.updates` table via Coral SQL.
*   **Zero-State Polling**: The daemon queries updates using an offset logic (`last_update_id + 1`) to ignore old history and only ingest active chats.
*   **Bidirectional Execution**: Texting prompts to your Telegram bot (e.g. *"Find Python developer jobs on Adzuna"*) triggers the NL→SQL engine, queries Coral, formats matching records, and texts clickable HTML anchors back to your phone.

### 4. 📉 Smart Deflationary Filters
To ensure contributors only spend time on high-value, claimable issues, the engine implements strict filters to weed out "issue collision":
*   **No Claimed Assignments**: Hides issues already assigned (`assignee__login IS NULL`).
*   **No Clutter/Debate**: Filters out topics with high noise (`comments < 5`) to target easy-to-claim tickets.
*   **No Active PR Collisions**: Employs a nested subquery filter (`i.title NOT IN (SELECT p.title FROM github.pulls p WHERE state = 'open')`) to skip issues where someone has already submitted an open pull request.

---

## ⚙️ Prerequisites & Secure Deployment Guide

### 1. Register Coral Sources
Ensure you have the Coral CLI installed and the community specifications registered:
```bash
coral source add github
coral source add withcoral/coral/sources/community/remotive
coral source add withcoral/coral/sources/community/hn
coral source add withcoral/coral/sources/community/devto
coral source add withcoral/coral/sources/community/telegram
coral source add withcoral/coral/sources/community/adzuna
```

### 2. Configure Environment Variables
ContriMatch requires API keys to be exported in your environment context. Never hardcode them inside files to avoid security alarms.

```bash
# Export variables in your terminal before running
export GITHUB_TOKEN="ghp_yourGitHubPersonalAccessToken"
export GEMINI_API_KEY="AIzaSyYourGoogleAIStudioKey"
export TELEGRAM_BOT_TOKEN="123456789:ABCdefYourTelegramBotKey"

# Optional: Higher-quota production model
export GEMINI_MODEL="gemini-2.5-flash" 
```

> [!WARNING]
> Do not write or commit authorization tokens directly into backend code. The server dynamically fetches these credentials from the operating environment at runtime using `os.environ.get`.

### 3. Start backend server
Start the local FastAPI server from the backend directory:
```bash
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

> [!IMPORTANT]
> Always access the application dashboard through **`http://localhost:8000`** in your browser. Accessing the frontend via `file:///` URLs will trigger CORS (Cross-Origin Resource Sharing) blocks, preventing the frontend from communicating with the API.

---

## 🎨 Rich UI Features
*   **Glassmorphic Dark/Light Mode**: Ambient glassmorphism with high-contrast neon accents, persistent across browser sessions using `localStorage` memory.
*   **Subprocess Loading Timelines**: A micro-animated loading indicator displaying rotating text loops to indicate execution steps while the Coral CLI fetches data.
*   **Reflective Visual Grid**: Symmetrical 3-column layout matching and formatting datasets from HackerNews, DEV.to, and Adzuna card clusters.

---

## 🗺️ Roadmap v2 (Future Vision)
To expand ContriMatch into an enterprise-grade workspace for professional open-source engineers, the next release cycle will introduce:
*   **Multi-Repository Tracking Grid**: Add an interactive interface (with a `+` input button) allowing contributors to monitor unassigned issues and PR collisions across multiple repositories and organizations simultaneously.
*   **Collapsible Org Sorting & Search**: Integrate live filter search bars inside the contributions accordion section to easily filter merge states across dozens of different upstream repositories.
*   **Full Resume Compiler & Enhancer**: Upgrade the plain-text Resume Advisor into a comprehensive builder. Support PDF/DOCX file uploads, parse existing resumes, and use Gemini to dynamically append and enhance bullet points as new open-source code is merged.

