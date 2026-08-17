FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV APP_PORT=80
ENV DB_PATH=/app/data/kakeibo.db
ENV TZ=Asia/Tokyo

# タイムゾーン設定 & ヘルスチェック用の wget/tzdata
RUN apk add --no-cache tzdata wget \
    && cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
    && echo "Asia/Tokyo" > /etc/timezone

# 依存関係定義のコピーとインストール (C++コンパイル不要・ピュアJS & node:sqlite)
COPY package*.json ./
RUN npm install --omit=dev

# ソースコード・静的アセットをコピー
COPY server.js ./
COPY app ./app

# データ永続化ディレクトリを作成
RUN mkdir -p /app/data /app/backups

# ボリューム定義
VOLUME ["/app/data", "/app/backups"]

# ポート公開
EXPOSE 80

# コンテナヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# 起動コマンド
CMD ["node", "server.js"]