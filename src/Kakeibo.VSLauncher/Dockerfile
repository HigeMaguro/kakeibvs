FROM node:22-alpine

# ビルド日時を ARG で受け取る。
# docker-compose.yml 側で毎ビルド異なる値を渡すことで、
# このレイヤー以降のビルドキャッシュを必ず無効化する。
# 値は実行時に参照されないが、ENV にエクスポートして
# レイヤーハッシュに反映させることで確実なキャッシュ崩しとする。
ARG BUILD_DATE=unknown
ENV BUILD_DATE=${BUILD_DATE}

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

# ソース一式の「内容ベース ハッシュ」をマーカーファイルに書き出す。
# 【目的】
#  1. GUI 運用(環境変数を渡せない)でも、ソース内容が変われば
#     このレイヤーのハッシュが変わり、以降のビルドキャッシュを確実に無効化。
#     NAS のファイルタイムスタンプ依存のキャッシュ誤判定も回避できる。
#  2. 実行時に `docker exec kakeibo cat /app/.sourcehash` で、
#     稼働中のコンテナがどのソース版でビルドされたか確認できる。
#     (GUI で「本当に再ビルドされたか？」の判別に有用)
# node_modules / data / backups は計算対象から除外する。
RUN cd /app \
    && find . -type f \
       \! -path './node_modules/*' \
       \! -path './data/*' \
       \! -path './backups/*' \
       -print0 | xargs -0 -r md5sum \
    | sort | md5sum > /app/.sourcehash \
    && cat /app/.sourcehash

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