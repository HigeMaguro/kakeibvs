# 🏠 MyKakeibo（マイ家計簿）

自宅サーバー / **UGREEN NAS（緑聯 NAS）** などの Docker 環境で稼働する、シンプルでモダンな家計簿 Web アプリケーションです。
収支管理、カテゴリ別予算管理、銀行口座・資産管理、グラフ分析、スマホ専用伝票入力画面（テンキー式）を搭載しています。

---

## 🌟 主な機能

- **📊 ダッシュボード**: 月別の収入・支出・収支バランス、カテゴリ別支出円グラフ、推移グラフ
- **📝 収支一覧 & 入力**: 取引一覧のフィルタリング、収入/支出のワンクリック登録・編集
- **📱 スマホ専用伝票入力画面**: スマホから片手でサクサク入力できるテンキー式UI（PWAホーム画面追加対応）
- **🎯 予算管理**: カテゴリごとの月次予算設定と消化率プログレスバー
- **🏦 預金口座管理**: 複数口座の残高管理、口座間振込、取引明細記録
- **📈 分析レポート**: 年間収支推移、カテゴリ別割合、日別支出グラフ
- **💾 データ永続化 & バックアップ**: SQLite によるローカル完結保存、ワンクリック JSON バックアップ

---

## 🚀 クイックスタート（Docker Compose）

### 1. リポジトリをクローン
```bash
git clone https://github.com/<your-username>/kakeibo01.git
cd kakeibo01
```

### 2. コンテナのビルド & 起動
```bash
docker compose up -d --build
```

### 3. ブラウザでアクセス
- **メイン画面**: `http://localhost:9090`（または `http://<NASのIP>:9090`）
- **スマホ専用伝票入力画面**: `http://localhost:9090/mobile-input.html`

> [!NOTE]
> UGREEN NAS（UGOS / UGOS Pro）への詳しいデプロイ手順は [DEPLOY_UGREEN_NAS.md](DEPLOY_UGREEN_NAS.md) をご覧ください。

---

## 📁 ディレクトリ構成

```text
kakeibvs/
├── kakeibvs.sln                # Visual Studio ソリューション
└── src/
    └── Kakeibo.VSLauncher/     # VS プロジェクト (Node.js ランチャー)
        ├── Program.cs          # .NET ランチャー (node --watch server.js を起動)
        ├── Kakeibo.VSLauncher.csproj
        ├── Properties/         # launchSettings.json
        ├── app/                # フロントエンド（HTML/CSS/JS/マニュアル）
        │   ├── css/            # スタイルシート（style.css, mobile-input.css）
        │   ├── js/             # アプリロジック（app.js, accounts.js, mobile-input.js）
        │   ├── index.html      # メインSPA
        │   ├── mobile-input.html # スマホ専用伝票入力画面
        │   └── kakeibo_manual.htm  # 取扱説明書
        ├── data/               # SQLiteデータベース保存先（永続化マウント）
        ├── Dockerfile          # Dockerコンテナ定義 (Node.js 22 Alpine)
        ├── docker-compose.yml  # Docker Compose設定
        ├── server.js           # Express + node:sqlite REST APIサーバー
        ├── package.json        # Node.js 依存関係定義
        └── DEPLOY_UGREEN_NAS.md  # UGREEN NAS 向けデプロイ手順書
```

---

## 🛠️ 技術スタック

- **フロントエンド**: HTML5, Vanilla JavaScript, CSS3, Chart.js, Font Awesome
- **バックエンド**: Node.js (v22+), Express
- **データベース**: SQLite (`node:sqlite` 組み込みモジュール)
- **コンテナ環境**: Docker, Docker Compose (Alpine Linux)

---

## 📄 ライセンス

MIT License
