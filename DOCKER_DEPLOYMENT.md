# MyKakeibo Docker 配置ドキュメント

## プロジェクト概要

**MyKakeibo** は、自宅サーバー/NAS 向けに設計された家計簿 Web アプリケーションです。

- **バックエンド**: Node.js + Express + SQLite (node:sqlite)
- **フロントエンド**: HTML/CSS/JavaScript (SPA)
- **Docker**: Alpine Linux ベースの軽量コンテナ

---

## 目次

1. [アーキテクチャ](#アーキテクチャ)
2. [ディレクトリ構成](#ディレクトリ構成)
3. [Docker ビルド方法](#docker-ビルド方法)
4. [Docker Compose での運用](#docker-compose-での運用)
5. [環境変数設定](#環境変数設定)
6. [データ永続化](#データ永続化)
7. [ヘルスチェック](#ヘルスチェック)
8. [本番環境へのデプロイ](#本番環境へのデプロイ)
9. [Excel エクスポート機能](#excel-エクスポート機能)
10. [バージョン管理](#バージョン管理)
11. [NAS へのバージョンアップデプロイ (差分更新)](#nas-へのバージョンアップデプロイ-差分更新)
12. [ロールバック](#ロールバック)
13. [トラブルシューティング](#トラブルシューティング)

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Container                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Node.js Application                 │   │
│  │  ┌─────────────┐  ┌─────────────────────────┐   │   │
│  │  │   Express   │  │  SQLite (node:sqlite)   │   │   │
│  │  │   (Port 80) │  │  /app/data/kakeibo.db   │   │   │
│  │  └─────────────┘  └─────────────────────────┘   │   │
│  │              │                                   │   │
│  │              ▼                                   │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │         Static Files (app/)             │    │   │
│  │  │  index.html, css/, js/                  │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                │
│  ┌─────────────────────┴─────────────────────────┐     │
│  │            Volume Mounts                      │     │
│  │  /app/data     → ./data (DB 永続化)           │     │
│  │  /app/backups  → ./backups (バックアップ)     │     │
│  └───────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Host Machine       │
              │  Port 9090          │
              └─────────────────────┘
```

---

## ディレクトリ構成

```
kakeibovs/
├── kakeibvs.sln                      # Visual Studio ソリューションファイル
├── .gitignore                        # Git 除外設定
└── src/
    └── Kakeibo.VSLauncher/           # メインプロジェクト
        ├── Program.cs                # .NET 8 ランチャー (開発用)
        ├── Kakeibo.VSLauncher.csproj # .NET プロジェクトファイル
        ├── server.js                 # Express サーバー
        ├── package.json              # Node.js 依存関係
        ├── package-lock.json         # 依存関係ロック
        ├── Dockerfile                # Docker イメージ定義
        ├── docker-compose.yml        # Docker Compose 設定
        ├── .dockerignore             # Docker ビルド除外ファイル
        ├── app/                      # フロントエンド静的ファイル
        │   ├── index.html
        │   ├── css/
        │   ├── js/
        │   └── mobile-input.html
        ├── data/                     # SQLite データベース (開発用)
        │   └── kakeibo.db
        └── backups/                  # バックアップディレクトリ
```

---

## Docker ビルド方法

### 事前要件

- Docker Desktop (Windows/Mac) または Docker Engine (Linux)
- Docker Compose v2 以上

### 手順

#### 方法 1: Docker Compose を使用 (推奨)

```bash
cd src/Kakeibo.VSLauncher

# ビルドと起動
docker compose up --build -d

# ログ確認
docker compose logs -f kakeibo-app

# 停止
docker compose down
```

#### 方法 2: Docker ビルドコマンド直接使用

```bash
cd src/Kakeibo.VSLauncher

# イメージビルド
docker build -t kakeibo-app:latest .

# コンテナ実行
docker run -d \
  --name kakeibo \
  -p 9090:80 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/backups:/app/backups \
  -e TZ=Asia/Tokyo \
  -e NODE_ENV=production \
  kakeibo-app:latest
```

---

## Docker Compose での運用

### docker-compose.yml 設定解説

```yaml
version: "3.8"

services:
  kakeibo-app:
    build:
      context: .
      dockerfile: Dockerfile
    image: kakeibo-app:latest
    container_name: kakeibo
    restart: unless-stopped          # コンテナ停止時自動再起動
    ports:
      - "9090:80"                    # ホスト:コンテナ
    volumes:
      - ./data:/app/data             # DB 永続化
      - ./backups:/app/backups       # バックアップ保存
    environment:
      - TZ=Asia/Tokyo                # タイムゾーン
      - NODE_ENV=production          # 本番モード
      - APP_PORT=80                  # コンテナ内ポート
      - DB_PATH=/app/data/kakeibo.db # DB パス
    networks:
      - kakeibo-net
    healthcheck:                     # ヘルスチェック設定
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  kakeibo-net:
    driver: bridge
```

### 主要コマンド

| コマンド | 説明 |
|----------|------|
| `docker compose up -d` | バックグラウンドで起動 |
| `docker compose up --build -d` | ビルドし直して起動 |
| `docker compose down` | コンテナ停止・削除 |
| `docker compose down -v` | ボリュームも含めて削除 |
| `docker compose logs -f` | ログをリアルタイム表示 |
| `docker compose ps` | コンテナ状態確認 |
| `docker compose restart` | 再起動 |

---

## 環境変数設定

### 利用可能な環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|--------------|------|
| `APP_PORT` | `80` | アプリケーションがリスニングするポート |
| `DB_PATH` | `/app/data/kakeibo.db` | SQLite データベースファイルのパス |
| `NODE_ENV` | `production` | 実行モード (`development` / `production`) |
| `TZ` | `Asia/Tokyo` | タイムゾーン設定 |

### 環境変数の設定方法

#### docker-compose.yml で設定

```yaml
environment:
  - APP_PORT=8080
  - DB_PATH=/app/data/mykakeibo.db
  - NODE_ENV=development
```

#### .env ファイルを作成 (推奨)

```bash
# src/Kakeibo.VSLauncher/.env
APP_PORT=9090
DB_PATH=/app/data/kakeibo.db
NODE_ENV=production
TZ=Asia/Tokyo
```

```yaml
# docker-compose.yml
services:
  kakeibo-app:
    env_file:
      - .env
```

---

## データ永続化

### ボリュームマウント構成

```
ホストマシン                    Docker コンテナ
┌─────────────────┐           ┌─────────────────┐
│  ./data/        │ ────────▶ │  /app/data/     │
│    kakeibo.db   │           │    kakeibo.db   │
│    kakeibo.db-  │           │    kakeibo.db-  │
│    kakeibo.db-s │           │    kakeibo.db-s │
└─────────────────┘           └─────────────────┘

┌─────────────────┐           ┌─────────────────┐
│  ./backups/     │ ────────▶ │  /app/backups/  │
│    *.json       │           │    *.json       │
└─────────────────┘           └─────────────────┘
```

### バックアップ方法

#### 1. エクスポート API を使用

```bash
# ブラウザまたは curl でアクセス
curl -o backup_$(date +%Y%m%d).json \
  http://localhost:9090/api/export
```

#### 2. データベースファイルを直接コピー

```bash
# コンテナ稼働中にスナップショット取得
docker cp kakeibo:/app/data/kakeibo.db ./backups/kakeibo_backup_$(date +%Y%m%d).db
```

#### 3. 定期バックアップ (cron)

```bash
# 毎日午前 2 時にバックアップ
0 2 * * * curl -o /backups/kakeibo_$(date +\%Y\%m\%d).json http://localhost:9090/api/export
```

---

## ヘルスチェック

### エンドポイント

```
GET /health
```

### レスポンス例

```json
{
  "status": "ok",
  "timestamp": "2026-08-17T14:00:00.000Z",
  "uptime": 3600.5
}
```

### ヘルスチェック状態確認

```bash
# コンテナのヘルスステータス確認
docker inspect --format='{{.State.Health.Status}}' kakeibo

# 詳細なヘルスチェックログ
docker inspect --format='{{json .State.Health}}' kakeibo | jq
```

---

## 本番環境へのデプロイ

### UGREEN NAS へのデプロイ手順

1. **Docker イメージの転送**

```bash
# ローカルでビルド
docker build -t kakeibo-app:latest .

# イメージをエクスポート
docker save -o kakeibo-app.tar kakeibo-app:latest

# NAS へ転送
scp kakeibo-app.tar user@ugreen-nas:/tmp/

# NAS でインポート
docker load -i /tmp/kakeibo-app.tar
```

2. **docker-compose.yml を配置**

```bash
# NAS 上にデプロイディレクトリ作成
ssh user@ugreen-nas "mkdir -p /docker/kakeibo"

# docker-compose.yml を配置
scp docker-compose.yml user@ugreen-nas:/docker/kakeibo/
```

3. **NAS 上で起動**

```bash
ssh user@ugreen-nas
cd /docker/kakeibo
docker compose up -d
```

### 公開設定 (オプション)

#### Nginx リバースプロキシ

```nginx
server {
    listen 80;
    server_name kakeibo.your-domain.com;

    location / {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 証明書 (Let's Encrypt)

```bash
certbot certonly --webroot -w /var/www/html -d kakeibo.your-domain.com
```

---

## トラブルシューティング

### コンテナが起動しない

```bash
# ログ確認
docker compose logs kakeibo-app

# コンテナ状態確認
docker compose ps

# 削除して再作成
docker compose down
docker compose up --build -d
```

### データベースエラー

```bash
# データディレクトリの権限確認
ls -la ./data/

# 必要に応じて権限修正
chmod 755 ./data
```

### ポートが競合している

```bash
# 使用中のポート確認
netstat -tlnp | grep 9090

# docker-compose.yml でポート変更
ports:
  - "8080:80"  # ホスト側ポートを変更
```

### コンテナ内シェルに入る

```bash
# コンテナ内にアクセス
docker compose exec kakeibo-app sh

# または
docker exec -it kakeibo sh
```

### ログレベルの確認

```bash
# 詳細ログ表示
docker compose logs -f --tail=100

# 過去 1000 行表示
docker compose logs --tail=1000
```

---

## API エンドポイント一覧

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `/health` | GET | ヘルスチェック |
| `/tables/:table` | GET | テーブル一覧取得 |
| `/tables/:table` | POST | 新規レコード登録 |
| `/tables/:table/:id` | GET | 単一レコード取得 |
| `/tables/:table/:id` | PUT/PATCH | レコード更新 |
| `/tables/:table/:id` | DELETE | レコード削除 |
| `/api/export` | GET | データエクスポート (JSON) |
| `/api/export/excel` | GET | データエクスポート (Excel .xlsx) ※ `?month=YYYY-MM` で選択月のみ出力 |
| `/api/version` | GET | バージョン情報 (バージョン・ビルド日時・Node.js バージョン) |

### テーブル一覧

- `transactions` - 収支データ
- `budgets` - 予算データ
- `bank_accounts` - 銀行口座
- `account_transactions` - 口座取引明細

---

## Excel エクスポート機能

アプリのサイドバー「**データ管理**」ページから、家計簿データを Excel (.xlsx) ファイルとしてダウンロードできます。

### エンドポイント

```
GET /api/export/excel            … 全期間
GET /api/export/excel?month=2026-08  … 選択月のみ
```

アプリの「データ管理」ページからは、ヘッダーの月セレクターで選択中の月の
データのみが出力されます (「全期間を含める」チェックボックスで全期間も選択可)。

### 出力シート構成

| シート | 内容 |
|--------|------|
| 月別サマリー | 月ごとの収入合計・支出合計・収支 (収支は緑/赤で色分け) |
| 収支データ | 全取引 (日付・種別・カテゴリ・金額・メモ) オートフィルタ付き + 作業列 (年月・大区分・集計フラグ) |
| 予算 | 月別カテゴリ予算 |
| 預金口座 | 口座名・銀行名・残高・初期残高 |
| 口座明細 | 口座別入出金明細 (口座名・出金/入金列分離・相手口座) |
| 設定 | 科目 → 大区分マッピング + 集計対象フラグ (TRUE/FALSE) |
| 集計 | SUMIFS 数式による月別×大区分・月別×科目の動的集計 |
| グラフ | チャート4種 (積み上げ棒/比較棒/横棒/円) — チェック連動 |

金額は `¥#,##0` 書式、日付は `yyyy/mm/dd` 書式、ヘッダー行は固定・色付きです。

### グラフのチェックボックス連動

1. **「設定」シート** の「集計対象」列 (C列 TRUE/FALSE) が全グラフの表示対象を制御
2. FALSE にすると該当科目が集計・グラフから除外される
3. **Excel 365 の場合**: 集計対象列 (C2:C末尾) を選択 → 挿入 → **チェックボックス** で
   TRUE/FALSE セルが本物のチェックボックスに変換され、クリックでグラフが即座に更新
4. 大区分は「設定」シート B 列を編集すれば自由に変更可能 (自動反映)

### スタンドアロンスクリプト (既存 xlsx に後から追加)

```powershell
cd src/Kakeibo.VSLauncher
# exceldata/ 内の最新 xlsx を処理
npm run report
# またはファイル指定
node scripts/make-report.js path\to\mykakeibo.xlsx
```

出力: `<入力名>_report.xlsx`

### コマンドラインからの取得

```bash
curl -o kakeibo.xlsx http://localhost:9090/api/export/excel
```

---

## バージョン管理

イメージは `kakeibo-app:<package.json のバージョン>` タグでビルドされます。
`/api/version` またはアプリの「データ管理」ページで、稼働中のコンテナのバージョンを確認できます。

```bash
# 稼働中バージョンの確認
curl http://localhost:9090/api/version
```

バージョンを上げるときは `package.json` の `version` を更新してからデプロイしてください。

---

## NAS へのバージョンアップデプロイ (差分更新)

`deploy/deploy-nas.ps1` を使うと、ソース一式を NAS へ転送して
**NAS 側で docker build** する差分バージョンアップができます。
ローカルPCに Docker は不要です。
**データ (`./data` ボリューム) は保持されたままコンテナだけが置き換わります。**

### 事前要件

- 開発PC: OpenSSH (Windows 10 以降は標準搭載) / tar (Windows 10 以降は標準搭載)
- NAS 側: SSH が有効、docker / docker compose がインストール済み
- NAS 側のデプロイディレクトリ例: `/volume1/docker/kakeibovs`

### SSH の有効化 (UGREEN NAS の場合)

1. NAS の管理画面 (UGOS) にログイン
2. 「設定」→「リモートアクセス」→「SSH」を有効化
3. ポート 22 (または任意のポート) を開放
4. デプロイユーザーで SSH ログインできることを確認

### 公開鍵認証のセットアップ (パスワード入力を省略)

`deploy/setup-ssh-key.ps1` が `ssh-copy-id` 相当の処理を行います。
SSH 鍵ペア (`~/.ssh/id_ed25519`) がなければ自動生成し、
公開鍵を NAS の `~/.ssh/authorized_keys` に登録します。
**ここだけ 1 回パスワード入力が必要**で、以降は不要になります。

```powershell
cd src/Kakeibo.VSLauncher/deploy
.\setup-ssh-key.ps1 -NasHost 192.168.0.114 -NasUser satoshi

# 完了後はデプロイもパスワード不要
.\deploy-nas.ps1 -NasHost 192.168.0.114 -NasUser satoshi -NasDeployDir /volume1/docker/kakeibovs
```

※ 鍵はパスフレーズなし (ed25519) で生成します (自動デプロイ用)。
  すでに鍵がある場合は生成をスキップして登録のみ行います。

### 使い方 (直接指定)

```powershell
cd src/Kakeibo.VSLauncher/deploy

# バージョンアップ (ソース転送 → NAS側ビルド → 再起動 → 稼働確認)
.\deploy-nas.ps1 -NasHost 192.168.0.114 -NasUser satoshi -NasDeployDir /volume1/docker/kakeibovs

# SSH ポートが 22 以外の場合
.\deploy-nas.ps1 -NasHost 192.168.0.114 -NasUser satoshi -NasSshPort 2222 -NasDeployDir /volume1/docker/kakeibovs
```

### 使い方 (~/.ssh/config 利用)

```powershell
# ~/.ssh/config に ugreen-nas ホスト設定がある場合
.\deploy-nas.ps1 -UseSshConfig -SshHostName ugreen-nas -NasDeployDir /volume1/docker/kakeibovs
```

### スクリプトの処理内容

1. `package.json` のバージョンを取得 (`kakeibo-app:<version>` タグ用)
2. ソース一式 (server.js / app/ / Dockerfile 等。node_modules・data は除外) を tar.gz 化
3. `scp` で NAS へ転送し、デプロイディレクトリに展開
4. NAS 側で `docker build` (`APP_VERSION` / `BUILD_DATE` 付き) → `docker compose up -d`
5. `/api/version` をポーリングして稼働確認
6. 旧バージョンタグは NAS に残るためロールバック可能

### オプション

| オプション | 説明 |
|-----------|------|
| `-TransferOnly` | ソース転送・展開のみ (ビルドしない。接続テスト用) |
| `-AppPort` | NAS 側のアプリポート (既定 9090) |

### 初回デプロイ (手動)

スクリプトは NAS 側のディレクトリを自動作成しますが、初回のみ
`docker-compose.yml` が配置されていない状態からでも動作します
(tar に compose ファイルが含まれるため)。

初回のみポートやボリュームの環境を確認してください:

```bash
# NAS 側
cd /volume1/docker/kakeibovs
docker compose up -d --build
docker compose logs -f   # 起動ログ確認
```

### 手動でバージョンアップする場合

```bash
# 1. ソース転送 (開発PC側)
tar -czf kakeibovs-src.tar.gz server.js package.json package-lock.json Dockerfile docker-compose.yml .dockerignore app
scp kakeibovs-src.tar.gz satoshi@nas-ip:/volume1/docker/kakeibovs/

# 2. NAS 側で展開 & ビルド & 再起動
ssh satoshi@nas-ip
cd /volume1/docker/kakeibovs
tar -xzf kakeibovs-src.tar.gz && rm kakeibovs-src.tar.gz
docker build --build-arg APP_VERSION=1.1.0 --build-arg BUILD_DATE=$(date -u +%Y%m%d%H%M%S) \
  -t kakeibo-app:1.1.0 -t kakeibo-app:latest .
docker compose up -d
```

---

## ロールバック

問題が発生した場合は、NAS に残っている旧バージョンタグに戻せます。

```powershell
# 旧バージョンの確認 (NAS 側)
ssh satoshi@nas-ip "docker images | grep kakeibo-app"

# ロールバック実行
.\rollback-nas.ps1 -NasHost 192.168.0.114 -NasUser satoshi -PreviousVersion 1.0.0 -NasDeployDir /volume1/docker/kakeibovs
```

手動でロールバックする場合:

```bash
ssh satoshi@nas-ip
docker tag kakeibo-app:1.0.0 kakeibo-app:latest
cd /volume1/docker/kakeibovs && docker compose up -d
```

---

## セキュリティ考慮事項

### 推奨設定

1. **ファイアウォール設定**
   - 必要最小限のポートのみ公開
   - 内部ネットワークからのみアクセス許可

2. **HTTPS 化**
   - リバースプロキシで SSL/TLS 終端
   - Let's Encrypt 等で証明書取得

3. **認証・認可**
   - アプリケーションレベルで認証実装
   - 基本認証や JWT 等の導入を検討

4. **定期的なバックアップ**
   - `/app/data` ディレクトリの定期バックアップ
   - 外部ストレージへの複製

---

## ライセンス

MIT
