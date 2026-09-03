# Graph Report - kakeibovs  (2026-08-27)

## Corpus Check
- 19 files · ~16,233 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 389 nodes · 657 edges · 20 communities (15 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b20386f3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- accounts.js
- MyKakeibo Docker 配置ドキュメント
- mobile-input.js
- 🏠 MyKakeibo - UGREEN NAS Docker デプロイガイド
- package.json
- MyKakeibo - 家計簿 Web アプリケーション 機能概要
- MyKakeibo - 家計簿 Web アプリケーション 機能概要
- setType
- server.js
- 🏠 MyKakeibo - 家計簿ウェブアプリ
- init
- handleAccountSubmit
- Program
- todayStr
- Kakeibo.VSLauncher.csproj
- renderHistoryList
- rules/graphify.md
- workflows/graphify.md
- README.md

## God Nodes (most connected - your core abstractions)
1. `bindEvents()` - 18 edges
2. `handleTxFormSubmit()` - 17 edges
3. `init()` - 17 edges
4. `renderAccountTxArea()` - 15 edges
5. `MyKakeibo Docker 配置ドキュメント` - 15 edges
6. `getMonthTransactions()` - 12 edges
7. `handleAccountSubmit()` - 12 edges
8. `renderTransactions()` - 11 edges
9. `handleAccountFormSubmit()` - 10 edges
10. `acctDeleteTx()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `init()` --indirect_call--> `hideSuccessOverlay()`  [INFERRED]
  src/Kakeibo.VSLauncher/app/js/mobile-input.js → src/Kakeibo.VSLauncher/app/js/mobile-input.js  _Bridges community 12 → community 11_
- `init()` --indirect_call--> `openHistoryPanel()`  [INFERRED]
  src/Kakeibo.VSLauncher/app/js/mobile-input.js → src/Kakeibo.VSLauncher/app/js/mobile-input.js  _Bridges community 16 → community 11_
- `resetForm()` --calls--> `todayStr()`  [EXTRACTED]
  src/Kakeibo.VSLauncher/app/js/mobile-input.js → src/Kakeibo.VSLauncher/app/js/mobile-input.js  _Bridges community 14 → community 8_
- `renderHistoryList()` --calls--> `formatYen()`  [EXTRACTED]
  src/Kakeibo.VSLauncher/app/js/mobile-input.js → src/Kakeibo.VSLauncher/app/js/mobile-input.js  _Bridges community 12 → community 16_
- `handleAccountSubmit()` --calls--> `saveRecentMemo()`  [EXTRACTED]
  src/Kakeibo.VSLauncher/app/js/mobile-input.js → src/Kakeibo.VSLauncher/app/js/mobile-input.js  _Bridges community 8 → community 12_

## Import Cycles
- None detected.

## Communities (20 total, 5 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.09
Nodes (61): addNewCategory(), apiDelete(), apiGet(), apiPost(), apiPut(), bindEvents(), CATEGORY_ICONS, changeMonth() (+53 more)

### Community 1 - "accounts.js"
Cohesion: 0.11
Nodes (48): ACCT_COLORS, acctApi(), acctConfirmDeleteAccount(), acctConfirmDeleteTx(), acctDelete(), acctDeleteAccount(), acctDeleteTx(), acctFormatDate() (+40 more)

### Community 2 - "MyKakeibo Docker 配置ドキュメント"
Cohesion: 0.04
Nodes (44): 1. エクスポート API を使用, 2. データベースファイルを直接コピー, 3. 定期バックアップ (cron), API エンドポイント一覧, docker-compose.yml で設定, docker-compose.yml 設定解説, Docker Compose での運用, Docker ビルド方法 (+36 more)

### Community 3 - "mobile-input.js"
Cohesion: 0.05
Nodes (35): accountChips, accountFields, ACCT_TX_CATS, acctCatChips, acctLinkGroup, acctLinkSelect, amountDisplay, amountErrorEl (+27 more)

### Community 4 - "🏠 MyKakeibo - UGREEN NAS Docker デプロイガイド"
Cohesion: 0.06
Nodes (30): 1. SQLite データベースの自動永続化, 2. ワンクリック JSON バックアップ, 3. NAS 全体バックアップ, 🏠 MyKakeibo - UGREEN NAS Docker デプロイガイド, アプリを停止する, アプリを更新・再起動する, 🔄 アプリケーションの更新・停止・再起動, 🌐 アプリケーションへのアクセス (+22 more)

### Community 5 - "package.json"
Cohesion: 0.07
Nodes (26): cors, eslint, express, budget, docker, finance, kakeibo, nas (+18 more)

### Community 6 - "MyKakeibo - 家計簿 Web アプリケーション 機能概要"
Cohesion: 0.09
Nodes (22): 1. サマリーカード, 1. 収支一覧, 2. グラフ, 2. 収支入力, 3. 予算管理, 3. 最近の取引, 4. ナビゲーション, 4. 分析 (+14 more)

### Community 7 - "MyKakeibo - 家計簿 Web アプリケーション 機能概要"
Cohesion: 0.09
Nodes (22): 1. サマリーカード, 1. 収支一覧, 2. グラフ, 2. 収支入力, 3. 予算管理, 3. 最近の取引, 4. ナビゲーション, 4. 分析 (+14 more)

### Community 8 - "setType"
Cohesion: 0.22
Nodes (15): loadRecentMemos(), openDetailPanel(), renderAccountChips(), renderAcctCatChips(), renderCategoryChips(), renderMemoSuggestions(), resetAmountOnly(), resetForm() (+7 more)

### Community 9 - "server.js"
Cohesion: 0.14
Nodes (14): app, appDir, cors, crypto, { DatabaseSync }, db, dbDir, express (+6 more)

### Community 10 - "🏠 MyKakeibo - 家計簿ウェブアプリ"
Cohesion: 0.15
Nodes (12): 🔗 API エンドポイント, `budgets` テーブル（予算データ）, 🏠 MyKakeibo - 家計簿ウェブアプリ, `transactions` テーブル（収支データ）, 📅 デフォルトカテゴリ, 📊 データモデル, 📁 ファイル構成, 🔧 ローカル開発 (+4 more)

### Community 11 - "init"
Cohesion: 0.29
Nodes (12): addCategory(), apiGetAccounts(), closeCatModal(), closeDetailPanel(), closeHistoryPanel(), handleKeyboard(), handleNumpad(), handleSubmit() (+4 more)

### Community 12 - "handleAccountSubmit"
Cohesion: 0.25
Nodes (9): apiPost(), apiPostAcctTx(), apiPostKakeibo(), apiPutAcct(), formatYen(), handleAccountSubmit(), handleKakeiboSubmit(), hideSuccessOverlay() (+1 more)

### Community 14 - "todayStr"
Cohesion: 0.40
Nodes (5): apiGetToday(), offsetDateStr(), pad(), setDateOffset(), todayStr()

### Community 16 - "renderHistoryList"
Cohesion: 0.67
Nodes (3): formatDateJP(), openHistoryPanel(), renderHistoryList()

## Knowledge Gaps
- **172 isolated node(s):** `net8.0`, `Microsoft.NET.Sdk`, `ACCT_COLORS`, `TX_TYPE_LABELS`, `acctState` (+167 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 8 inferred relationships involving `bindEvents()` (e.g. with `addNewCategory()` and `closeCategoryModal()`) actually correct?**
  _`bindEvents()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `init()` (e.g. with `mobile-input.js` and `addCategory()`) actually correct?**
  _`init()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `net8.0`, `Microsoft.NET.Sdk`, `ACCT_COLORS` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08878968253968254 - nodes in this community are weakly interconnected._
- **Should `accounts.js` be split into smaller, more focused modules?**
  _Cohesion score 0.10775510204081633 - nodes in this community are weakly interconnected._
- **Should `MyKakeibo Docker 配置ドキュメント` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `mobile-input.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._