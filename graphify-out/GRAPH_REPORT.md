# Graph Report - kakeibovs  (2026-09-04)

## Corpus Check
- Corpus is ~20,095 words - fits in a single context window. You may not need a graph.

## Summary
- 348 nodes · 618 edges · 35 communities (18 shown, 17 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.86)
- Token cost: 16,000 input · 4,500 output

## Community Hubs (Navigation)
- Desktop App Core
- Bank Account Management
- Mobile Input UI
- Dependencies & References
- Docker Deployment Docs
- Project Docs Overview
- SPA Pages & Data Model
- Express Server Backend
- Mobile Input Actions
- Mobile Input Rendering
- Mobile API & Formatting
- Mobile Input Components
- .NET Launcher
- Date Utilities
- .NET Project Config
- Azure Copilot Rules
- PWA Features
- Graphify Agent Rules
- Mobile Type Switcher
- Docs Gaps & Features
- NAS Build Metadata
- Docker Config Doc
- Root README
- History Drawer
- NAS Backup
- NAS SSH Deploy
- Accounts Page Doc
- Analysis Page Doc
- Budget Page Doc
- Dashboard Doc
- Input Page Doc
- Transactions Page Doc

## God Nodes (most connected - your core abstractions)
1. `bindEvents()` - 19 edges
2. `handleTxFormSubmit()` - 17 edges
3. `init()` - 17 edges
4. `renderAccountTxArea()` - 15 edges
5. `getMonthTransactions()` - 12 edges
6. `handleAccountSubmit()` - 12 edges
7. `refreshCurrentPage()` - 11 edges
8. `renderTransactions()` - 11 edges
9. `handleAccountFormSubmit()` - 10 edges
10. `acctDeleteTx()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Doc: Web System Feature Overview (duplicate)` --semantically_similar_to--> `Architecture (Frontend + Backend)`  [INFERRED] [semantically similar]
  src/Kakeibo.VSLauncher/doc/Webシステム機能概要.md → Webシステム機能概要.md
- `Tech Stack (HTML5, Node.js, Express, SQLite, Docker)` --semantically_similar_to--> `Architecture (Frontend + Backend)`  [INFERRED] [semantically similar]
  src/Kakeibo.VSLauncher/README.md → Webシステム機能概要.md
- `Data Persistence (Volume Mounts)` --semantically_similar_to--> `Compose Volume Mounts (data + backups)`  [INFERRED] [semantically similar]
  DOCKER_DEPLOYMENT.md → src/Kakeibo.VSLauncher/docker-compose.yml
- `Transactions Page` --semantically_similar_to--> `Generic CRUD API (/tables/:table endpoints)`  [INFERRED] [semantically similar]
  src/Kakeibo.VSLauncher/app/index.html → DOCKER_DEPLOYMENT.md
- `transactions data model` --semantically_similar_to--> `transactions table schema`  [INFERRED] [semantically similar]
  src/Kakeibo.VSLauncher/app/README.md → Webシステム機能概要.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **SQLite Database Schema** — web_system_overview_sqlite, web_system_overview_transactions_table, web_system_overview_budgets_table, web_system_overview_bank_accounts_table, web_system_overview_account_transactions_table, web_system_overview_app_settings_table [EXTRACTED 1.00]
- **NAS Deploy Lifecycle** — docker_deployment_nasdeploy, docker_deployment_deploydifferential, docker_deployment_sshkeyauth, docker_deployment_versioning, docker_deployment_rollback [EXTRACTED 1.00]
- **SPA Page Family** — src_kakeibo_vslauncher_app_index_html_spa, src_kakeibo_vslauncher_app_index_html_dashboardpage, src_kakeibo_vslauncher_app_index_html_transactionspage, src_kakeibo_vslauncher_app_index_html_inputpage, src_kakeibo_vslauncher_app_index_html_budgetpage, src_kakeibo_vslauncher_app_index_html_analysispage, src_kakeibo_vslauncher_app_index_html_accountspage, src_kakeibo_vslauncher_app_index_html_datamanagepage [EXTRACTED 1.00]
- **SQLite Data Model** — docker_deployment_transactions, docker_deployment_budgets, docker_deployment_bank_accounts, docker_deployment_account_transactions [EXTRACTED 1.00]

## Communities (35 total, 17 thin omitted)

### Community 0 - "Desktop App Core"
Cohesion: 0.09
Nodes (63): addNewCategory(), apiDelete(), apiGet(), apiPost(), apiPut(), bindEvents(), CATEGORY_ICONS, changeMonth() (+55 more)

### Community 1 - "Bank Account Management"
Cohesion: 0.11
Nodes (48): ACCT_COLORS, acctApi(), acctConfirmDeleteAccount(), acctConfirmDeleteTx(), acctDelete(), acctDeleteAccount(), acctDeleteTx(), acctFormatDate() (+40 more)

### Community 2 - "Mobile Input UI"
Cohesion: 0.05
Nodes (35): accountChips, accountFields, ACCT_TX_CATS, acctCatChips, acctLinkGroup, acctLinkSelect, amountDisplay, amountErrorEl (+27 more)

### Community 3 - "Dependencies & References"
Cohesion: 0.07
Nodes (28): cors, eslint, exceljs, express, budget, docker, finance, kakeibo (+20 more)

### Community 4 - "Docker Deployment Docs"
Cohesion: 0.15
Nodes (20): Container Architecture (Express + SQLite + Static App), Data Persistence (Volume Mounts), Differential NAS Version-Up Deploy (deploy-nas.ps1 flow), Environment Variable Configuration (APP_PORT, DB_PATH, NODE_ENV, TZ), Excel Export Feature (GET /api/export/excel), Export API JSON Backup (/api/export), Container Health Check (/health wget spider), UGREEN NAS Deployment Flow (+12 more)

### Community 5 - "Project Docs Overview"
Cohesion: 0.11
Nodes (19): Doc: Web System Feature Overview (duplicate), MIT License, budgets data model, App README Features, transactions data model, UGREEN NAS GUI Deployment, Directory Layout, Main Features List (+11 more)

### Community 6 - "SPA Pages & Data Model"
Cohesion: 0.14
Nodes (18): account_transactions table, bank_accounts table, budgets table, Generic CRUD API (/tables/:table endpoints), transactions table, accounts.js, Bank Accounts Page, Analysis Page (+10 more)

### Community 7 - "Express Server Backend"
Cohesion: 0.12
Nodes (15): app, appDir, cors, crypto, { DatabaseSync }, db, dbDir, ExcelJS (+7 more)

### Community 8 - "Mobile Input Actions"
Cohesion: 0.24
Nodes (15): addCategory(), apiGetAccounts(), apiPost(), closeCatModal(), closeDetailPanel(), closeHistoryPanel(), handleKakeiboSubmit(), handleKeyboard() (+7 more)

### Community 9 - "Mobile Input Rendering"
Cohesion: 0.22
Nodes (15): loadRecentMemos(), openDetailPanel(), renderAccountChips(), renderAcctCatChips(), renderCategoryChips(), renderMemoSuggestions(), resetAmountOnly(), resetForm() (+7 more)

### Community 10 - "Mobile API & Formatting"
Cohesion: 0.22
Nodes (9): apiPostAcctTx(), apiPostKakeibo(), apiPutAcct(), formatDateJP(), formatYen(), handleAccountSubmit(), openHistoryPanel(), renderHistoryList() (+1 more)

### Community 11 - "Mobile Input Components"
Cohesion: 0.33
Nodes (6): Category Chips UI, Continuous Input Mode Toggle, Date Quick Buttons (yesterday/today/tomorrow), Slide-up Detail Panel, Tenkey Numpad UI, Mobile Input Page (mobile-input.html)

### Community 13 - "Date Utilities"
Cohesion: 0.40
Nodes (5): apiGetToday(), offsetDateStr(), pad(), setDateOffset(), todayStr()

### Community 15 - "Azure Copilot Rules"
Cohesion: 1.00
Nodes (3): azmcp_bestpractices_get tool, Azure Best Practices Rule, Azure Tools Rule

### Community 16 - "PWA Features"
Cohesion: 0.67
Nodes (3): PWA Meta Tags (apple-mobile-web-app-capable, theme-color), Success Overlay Animation, PWA Home Screen Add

## Knowledge Gaps
- **123 isolated node(s):** `net8.0`, `Microsoft.NET.Sdk`, `ACCT_COLORS`, `TX_TYPE_LABELS`, `acctState` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Single Page Application Navigation` connect `SPA Pages & Data Model` to `Docker Deployment Docs`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `Data Management Page` connect `Docker Deployment Docs` to `SPA Pages & Data Model`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `bindEvents()` (e.g. with `addNewCategory()` and `closeCategoryModal()`) actually correct?**
  _`bindEvents()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `init()` (e.g. with `mobile-input.js` and `addCategory()`) actually correct?**
  _`init()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `net8.0`, `Microsoft.NET.Sdk`, `ACCT_COLORS` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Desktop App Core` be split into smaller, more focused modules?**
  _Cohesion score 0.08531468531468532 - nodes in this community are weakly interconnected._
- **Should `Bank Account Management` be split into smaller, more focused modules?**
  _Cohesion score 0.10775510204081633 - nodes in this community are weakly interconnected._