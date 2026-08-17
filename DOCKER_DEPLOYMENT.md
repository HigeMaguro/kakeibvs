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
9. [トラブルシューティング](#トラブルシューティング)

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
| `/api/export` | GET | データエクスポート |

### テーブル一覧

- `transactions` - 収支データ
- `budgets` - 予算データ
- `bank_accounts` - 銀行口座
- `account_transactions` - 口座取引明細

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
