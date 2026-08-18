# MyKakeibo - 家計簿 Web アプリケーション 機能概要

## 概要
**MyKakeibo** は、自宅サーバー/NAS (Docker・Ugreen 等) 上で動作する、静的 Web フロントエンド + Node.js/Express バックエンドによる家計簿アプリケーションです。SQLite をデータストアとし、ローカルネットワーク内のブラウザからアクセス可能です。

---

## アーキテクチャ

- **フロントエンド**: HTML5 + JavaScript (VanillaJS) + Chart.js (グラフ描画)
- **スタイル**: CSS カスタムプロパティ、Font Awesome アイコン、Google Fonts (Noto Sans JP)
- **バックエンド**: Node.js + Express + SQLite (node:sqlite)
- **API**: RESTful テーブル API (`/tables/:table`) - GET/POST/PUT/DELETE
- **データ**: トランザクション、予算、銀行口座、口座取引明細

---

## メイン画面 (ダッシュボード)

### 1. サマリーカード
- **今月の収入**: その月の収入総額
- **今月の支出**: その月の支出総額
- **今月の収支**: 収入 - 支出 (正の時は収支プラス、負の時は赤字表示)

### 2. グラフ
- **カテゴリ別支出 (ドーナツチャート)**: その月の支出をカテゴリ別に可視化
- **月別推移 (ラインチャート)**: 直近 6 か月間の収入・支出の推移

### 3. 最近の取引
- 直近 7 件の取引を表示 (種別アイコン、カテゴリ、日付、メモ、金額)

### 4. ナビゲーション
- サイドバーでのページ切替 (ダッシュボード、収支一覧、入力、予算管理、分析、預金口座管理)
- モバイル対応のハンバーガーメニュー

---

## ページ別機能

### 1. 収支一覧
- テーブル形式の取引一覧
- **検索**: キーワードでカテゴリ・メモ検索
- **フィルタ**: 種類 (収入/支出)、カテゴリ別フィルタリング
- **ページネーション**: 1 ページ 15 件
- **操作**: 編集・削除ボタン (モーダル確認)

### 2. 収支入力
- **収入/支出 切替**: タブで種類を選択
- **フォーム項目**: 日付 (date 型)、金額 (数値入力)、カテゴリ (セレクト)、メモ (最大 100 文字)
- **カテゴリ追加**: モーダルから新しいカテゴリを追加可能
- **編集**: 既存取引のペンアイコンから編集モードに移行

### 3. 予算管理
- **予算設定**: カテゴリごとの月次予算登録
- **予算進捗**: 
  - 使用金額 / 予算額 の表示
  - 進捗バー (Green: 正常, Warning: 80% 以上, Over: 予算オーバー)
  - 残り金額の表示
- **予算編集・削除**: 既存予算の上書きまたは削除

### 4. 分析
- **月別収支比較 (棒グラフ)**: 1 年分の月次収支を比較表示
- **収入カテゴリ内訳 (円グラフ)**: 収入をカテゴリ別に可視化
- **日別支出推移 (累計ラインチャート)**: その月の日ごとの累計支出を折れ線グラフで表示

### 5. 預金口座管理
- **口座サマリーカード**: 全口座合計残高 + 個別口座の残高表示
- **口座カードリスト**: カラー付き口座カード (クリックでアクティブ化)
- **口座追加/編集**: 銀行名、口座名、種別 (普通/当座/定期/証券/その他)、色、メモ、初期残高
- **取引明細**: 選択中口座の入金・出金・振込明細をページング表示
- **振込処理**: 相手口座を持つ振出・振込対応

### 6. スマホ入力 (mobile-input.html)
- **テンキー入力**: 0-9、C (クリア)、DEL (削除)、NEXT (確認) キー
- **種別切替**: 収入/支出 タブ切替
- **カテゴリチップ**: 選択可能なカテゴリ一覧 (アイコン付き)
- **メモ候補**: 最近使用したメモとデフォルト候補を表示
- **日付クイック選択**: 今日・昨日・明日のクイック選択ボタン
- **成功オーバーレイ**: 登録完了時のアニメーション表示
- **履歴パネル**: 当日の取引履歴の表示・非表示
- **連打防止**: 連続入力モード対応

---

## バックエンド API (Express)

| エンドポイント | 説明 |
|---|---|
| `GET /health` | ヘルスチェック (ステータス、タイムスタンプ、アップタイム) |
| `GET /tables/:table` | テーブル一覧取得 (limit, offset, sort, フィルタ対応) |
| `POST /tables/:table` | 新規レコード登録 (UUID 自動採番、created_at/updated_at 自動付与) |
| `GET /tables/:table/:id` | 単一レコード取得 |
| `PUT/PATCH /tables/:table/:id` | レコード更新 (updated_at 自動更新) |
| `DELETE /tables/:table/:id` | レコード削除 |
| `GET /api/export` | データエクスポート (JSON、ファイルダウンロード) |

### 取り扱いテーブル
- `transactions`: 収支履歴 (id, date, type, category, amount, memo, created_at, updated_at)
- `budgets`: 予算設定 (id, month, category, budget, label, created_at, updated_at)
- `bank_accounts`: 銀行口座 (id, name, bank_name, account_type, balance, initial_balance, color, note, icon, created_at, updated_at)
- `account_transactions`: 口座取引明細 (id, account_id, date, type, amount, category, description, related_account_id, balance_after, created_at, updated_at)
- `app_settings`: キーバリューストア (key, value, updated_at)

### フィルタ・ソート対応
- クエリパラメータでのフィルタリング (`?type=income&category=食費`)
- ソート (`?sort=date DESC`)
- ページネーション (`?limit=50&offset=100`)

---

## データベース (SQLite)

- **パス**: `data/kakeibo.db` (Docker/NAS 環境では環境変数 `DB_PATH` で変更可能)
- **モード**: WAL (Write-Ahead Logging) 有効
- **外部キー**: 有効化 (`PRAGMA foreign_keys = ON`)
- **インデックス**: 検索性能向上のための複数インデックス設定

### テーブル定義の詳細は server.js 参照

---

## 技術的特徴

- **オフライン対応**: フロントエンドは静的ファイルのみ (CDN 使用)
- **ローカルファースト**: データはすべてローカル SQLite に保存、クラウド連携なし
- **Docker 対応**: `docker-compose.yml` および Dockerfile 完備、Ugreen NAS 等での動作確認あり
- **レスポンシブデザイン**: デスクトップ・タブレット・スマホ対応
- **日本語対応**: すべてのラベル・メッセージが日本語、フォントに Noto Sans JP を使用
- **ダークモード対応**: CSS カスタムプロパティによるライト/ダークテーマ切替対応
- **Accessibility**: aria-label、適切な見出し構造、フォーカス管理

---

## インストール・起動

```bash
# リポジトリ clone 後
docker compose up -d      # または node server.js

# アクセス
http://localhost:80 (または環境変数 APP_PORT)
```

詳細は `DEPLOY_UGREEN_NAS.md` および `Dockerfile` 参照。