# ============================================================
# MyKakeibo NAS デプロイスクリプト (NAS 側ビルド方式)
# ============================================================
# 概要:
#   1. package.json のバージョンを取得
#   2. ソース一式 (node_modules / data / backups 除外) を tar 化
#   3. scp で NAS へ転送
#   4. NAS 側で展開 → docker build (バージョンタグ付き) → compose up -d
#      (データは ./data ボリュームで永続化されているため無影響)
#   5. ヘルスチェックで稼働確認
#
#   ※ ローカルPCに Docker は不要です (NAS 側でビルドします)
#   ※ NAS の SSH が有効であることが前提です
#
# 使い方:
#   .\deploy-nas.ps1 -NasHost 192.168.0.114 -NasUser satoshi -NasDeployDir /volume1/docker/kakeibovs
#
#   ~/.ssh/config にホスト設定がある場合は -UseSshConfig を指定:
#   .\deploy-nas.ps1 -UseSshConfig -SshHostName ugreen-nas
# ============================================================
[CmdletBinding(DefaultParameterSetName = 'Direct')]
param(
    # --- 接続方法 A: 直接指定 ---
    [Parameter(ParameterSetName = 'Direct', Mandatory)]
    [string]$NasHost,

    [Parameter(ParameterSetName = 'Direct')]
    [string]$NasUser = 'admin',

    [Parameter(ParameterSetName = 'Direct')]
    [int]$NasSshPort = 22,

    # --- 接続方法 B: ~/.ssh/config 利用 ---
    [Parameter(ParameterSetName = 'SshConfig', Mandatory)]
    [switch]$UseSshConfig,

    [Parameter(ParameterSetName = 'SshConfig')]
    [string]$SshHostName,

    # --- 共通 ---
    # NAS 上のデプロイディレクトリ (docker-compose.yml が置いてある場所)
    [string]$NasDeployDir = '/volume1/docker/kakeibovs',

    # ホスト側ポート (ヘルスチェック用)
    [int]$AppPort = 9090,

    # ソースの転送・展開のみ行いビルドしない (テスト用)
    [switch]$TransferOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ------------------------------------------------------------
# SSH/SCP 共通引数の組み立て
# ------------------------------------------------------------
$sshTarget = if ($UseSshConfig) { $SshHostName } else { "$NasUser@$NasHost" }
$sshExtra  = @()
if (-not $UseSshConfig -and $NasSshPort -ne 22) { $sshExtra += @('-p', "$NasSshPort") }

function Invoke-Ssh {
    param([string]$Command)
    # PS5.1 は ErrorActionPreference=Stop 下でネイティブコマンドの stderr を
    # 終了エラーに変換するため、実行中のみ一時的に Continue にする
    # -T: PowerShell から実行時の疑似端末割り当て警告を抑制
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = & ssh @sshExtra -T $sshTarget $Command 2>&1
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($LASTEXITCODE -ne 0) { throw "SSH コマンド失敗: $Command`n$($raw -join "`n")" }
    # stderr 由来の ErrorRecord を文字列化して返す (赤字エラー表示を防ぐ)
    return @($raw | ForEach-Object { "$_" })
}

function Invoke-SshStream {
    # 長時間コマンド (docker build 等) 用: 出力をリアルタイム表示
    # docker build の進捗ログは stderr に出るため、2>&1 マージは必須
    param([string]$Command)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & ssh @sshExtra -T $sshTarget $Command 2>&1 | ForEach-Object { Write-Host "  $_" }
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($LASTEXITCODE -ne 0) { throw "SSH コマンド失敗 (exit $LASTEXITCODE): $Command" }
}

# ------------------------------------------------------------
# 0. 事前チェック
# ------------------------------------------------------------
$projectDir = Split-Path -Parent $PSScriptRoot   # deploy/ の親 = Kakeibo.VSLauncher
Set-Location $projectDir

Write-Host '================================================' -ForegroundColor Cyan
Write-Host '  MyKakeibo NAS デプロイ (NAS 側ビルド)'            -ForegroundColor Cyan
Write-Host '================================================' -ForegroundColor Cyan

foreach ($cmd in @('ssh', 'scp', 'tar')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "必要なコマンド '$cmd' が見つかりません。インストールしてください。"
    }
}

# SSH 接続確認
Write-Host ""
Write-Host "[0/5] SSH 接続確認: $sshTarget" -ForegroundColor Yellow

# 初回接続時のホストキー確認を自動承諾 (known_hosts へ自動登録)
$sshBase = @('-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=8')

# まず公開鍵認証で試す (BatchMode=yes = パスワード不可)
# PS5.1 stderr 誤終了対策: 一時的に EAP を Continue に
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & ssh @sshExtra @sshBase -o BatchMode=yes $sshTarget "echo ok" 2>$null
    $authFailed = ($LASTEXITCODE -ne 0)
    $out = $null
    if ($authFailed) {
        # 失敗 = パスワード認証が必要 → ここで対話認証 (初回はホストキー + パスワードを聞かれる)
        $out = & ssh @sshExtra @sshBase $sshTarget "echo ok" 2>&1
        $authFailed = ($LASTEXITCODE -ne 0)
    }
} finally {
    $ErrorActionPreference = $prevEAP
}
if ($authFailed) {
    Write-Host ""
    Write-Host "ヒント: 毎回のパスワード入力を省くには公開鍵認証をセットアップしてください:" -ForegroundColor DarkYellow
    Write-Host "  .\setup-ssh-key.ps1 -NasHost $NasHost -NasUser $NasUser" -ForegroundColor DarkYellow
    Write-Host ""
    throw "SSH 接続に失敗しました。NAS の SSH が有効か、ユーザー名・パスワードを確認してください。`n$out"
}
if ($out) {
    Write-Host "       (パスワード認証で接続。公開鍵設定で省略可能: .\setup-ssh-key.ps1)" -ForegroundColor DarkYellow
} else {
    Write-Host "       (公開鍵認証)" -ForegroundColor DarkGray
}
Write-Host "       接続 OK" -ForegroundColor Green

# NAS 側に docker / docker compose があるか確認
Invoke-Ssh "docker --version && (docker compose version || docker-compose --version)"
Write-Host "       NAS 側 Docker 確認 OK" -ForegroundColor Green

# ------------------------------------------------------------
# 1. バージョン取得
# ------------------------------------------------------------
$pkg = Get-Content (Join-Path $projectDir 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$buildDate = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
Write-Host ""
Write-Host "[1/5] バージョン: $version (ビルド日時: $buildDate)" -ForegroundColor Yellow

# ------------------------------------------------------------
# 2. ソース一式を tar 化
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/5] ソースを tar 化中..." -ForegroundColor Yellow
$tarName = "kakeibovs-src_${version}_${buildDate}.tar.gz"
$tarFile = Join-Path $env:TEMP $tarName

# tar に含めるもの: server.js, package*.json, Dockerfile, docker-compose.yml,
# .dockerignore, app/, scripts/ (report-builder は server.js から参照される)
# deploy は含めない
$tarItems = @('server.js', 'package.json', 'package-lock.json', 'Dockerfile',
              'docker-compose.yml', '.dockerignore', 'app', 'scripts')

$missing = $tarItems | Where-Object { -not (Test-Path (Join-Path $projectDir $_)) }
if ($missing) { throw "必須ファイルが見つかりません: $($missing -join ', ')" }

if (Test-Path $tarFile) { Remove-Item $tarFile -Force }
& tar -czf $tarFile -C $projectDir @tarItems
if ($LASTEXITCODE -ne 0) { throw 'tar 作成に失敗しました。' }
$tarSize = [math]::Round((Get-Item $tarFile).Length / 1MB, 2)
Write-Host "       作成完了: $tarName (${tarSize} MB)" -ForegroundColor Green

try {
    # ------------------------------------------------------------
    # 3. NAS へ転送
    # ------------------------------------------------------------
    Write-Host ""
    Write-Host "[3/5] NAS へ転送中... (${tarSize} MB)" -ForegroundColor Yellow

    # デプロイ先ディレクトリを先に作成し、そこへ直接転送する
    # (UGREEN NAS では /tmp やホーム直下が書き込み不可の場合があるため)
    Invoke-Ssh "mkdir -p $NasDeployDir"
    $remoteTar = "$NasDeployDir/$tarName"
    # -O : レガシー SCP プロトコル強制 (NAS 側で SFTP サブシステムが無効なため)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $scpOut = & scp -O @sshExtra -o StrictHostKeyChecking=accept-new $tarFile "${sshTarget}:$remoteTar" 2>&1
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($LASTEXITCODE -ne 0) { throw "scp による転送に失敗しました。`n$scpOut" }
    Write-Host "       転送完了: $remoteTar" -ForegroundColor Green

    # ------------------------------------------------------------
    # 4. NAS 側: 展開 → docker build → compose up
    # ------------------------------------------------------------
    Write-Host ""
    Write-Host "[4/5] NAS 側でビルド & 再起動" -ForegroundColor Yellow

    # ソースを配置 (app/, server.js 等を上書き。data/ は tar に含まれないため影響なし)
    # 旧 docker-compose.yaml が残っていると compose が警告を出すため除去
    Invoke-Ssh "cd $NasDeployDir && rm -rf app scripts server.js package.json package-lock.json Dockerfile docker-compose.yml docker-compose.yaml .dockerignore && tar -xzf $remoteTar -C $NasDeployDir && rm -f $remoteTar"
    Write-Host "       ソース展開完了" -ForegroundColor Green

    if ($TransferOnly) {
        Write-Host "       (-TransferOnly のためビルドをスキップ)" -ForegroundColor DarkYellow
    } else {
        # docker build (バージョンタグ付き + latest) - 出力をリアルタイム表示
        Invoke-SshStream "cd $NasDeployDir && docker build --build-arg BUILD_DATE=$buildDate --build-arg APP_VERSION=$version -t kakeibo-app:$version -t kakeibo-app:latest ."
        Write-Host "       ビルド完了: kakeibo-app:$version" -ForegroundColor Green

        # コンテナ再作成 (データボリュームは維持) - 進捗をストリーム表示
        Invoke-SshStream "cd $NasDeployDir && docker compose up -d"
        Write-Host "       docker compose up -d 完了 (データは維持されます)" -ForegroundColor Green
    }

    # ------------------------------------------------------------
    # 5. ヘルスチェック
    # ------------------------------------------------------------
    if (-not $TransferOnly) {
        Write-Host ""
        Write-Host "[5/5] ヘルスチェック" -ForegroundColor Yellow
        $healthOk = $false
        for ($i = 1; $i -le 10; $i++) {
            Start-Sleep -Seconds 3
            $verJson = Invoke-Ssh "curl -s http://localhost:$AppPort/api/version" 2>$null
            if ($LASTEXITCODE -eq 0 -and $verJson -match '"version"') {
                Write-Host "       稼働確認 OK: $verJson" -ForegroundColor Green
                $healthOk = $true
                break
            }
            Write-Host "       待機中... ($i/10)"
        }
        if (-not $healthOk) {
            Write-Host "       起動確認がタイムアウトしました。ログを確認してください:" -ForegroundColor Red
            Invoke-Ssh "cd $NasDeployDir && docker compose logs --tail=30"
            throw 'ヘルスチェック失敗'
        }
    }

    # ------------------------------------------------------------
    # 完了
    # ------------------------------------------------------------
    Write-Host ""
    Write-Host '================================================' -ForegroundColor Cyan
    Write-Host "  デプロイ完了!  v$version"                             -ForegroundColor Green
    $healthTarget = if ($UseSshConfig) { $SshHostName } else { $NasHost }
    Write-Host "  http://${healthTarget}:${AppPort}"                    -ForegroundColor Cyan
    Write-Host '================================================' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "ロールハック方法:" -ForegroundColor Yellow
    Write-Host "  NAS 側で旧バーション確認:  docker images | grep kakeibo-app" -ForegroundColor Gray
    Write-Host "  .\rollback-nas.ps1 -NasHost <NAS IP> -NasUser <user> -PreviousVersion <旧バーション>" -ForegroundColor Gray
}
finally {
    if (Test-Path $tarFile) { Remove-Item $tarFile -Force }
    # NAS 側に転送済みの tar が残っていれば削除 (エラー時のクリーンアップ)
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & ssh @sshExtra -o BatchMode=yes -o ConnectTimeout=5 $sshTarget "rm -f $NasDeployDir/$tarName" 2>$null
    } finally {
        $ErrorActionPreference = $prevEAP
    }
}