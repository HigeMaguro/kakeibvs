# ============================================================
# MyKakeibo NAS ロールバックスクリプト (PowerShell)
# ============================================================
# 概要:
#   指定した旧バージョンのイメージに latest タグを付け替えて
#   コンテナを再作成します。データ (./data ボリューム) は
#   影響を受けません。
#
# 使い方:
#   # 旧バージョンを確認 (NAS 側で実行)
#   ssh user@nas "docker images | grep kakeibo-app"
#
#   # ロールバック実行
#   .\rollback-nas.ps1 -NasHost 192.168.1.100 -NasUser admin `
#       -PreviousVersion 1.0.0 -NasDeployDir /volume1/docker/kakeibo
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
    # ロールバック先のバージョン (kakeibo-app:<version> タグ)
    [Parameter(Mandatory)]
    [string]$PreviousVersion,

    # NAS 上のデプロイディレクトリ
    [string]$NasDeployDir = '/volume1/docker/kakeibovs',

    # ホスト側ポート (稼働確認用)
    [int]$AppPort = 9090
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

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
        $raw = & ssh @sshExtra -T -o StrictHostKeyChecking=accept-new $sshTarget $Command 2>&1
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if ($LASTEXITCODE -ne 0) { throw "SSH コマンド失敗: $Command`n$($raw -join "`n")" }
    # stderr 由来の ErrorRecord を文字列化して返す (赤字エラー表示を防ぐ)
    return @($raw | ForEach-Object { "$_" })
}

Write-Host '================================================' -ForegroundColor Cyan
Write-Host "  MyKakeibo ロールバック → v$PreviousVersion"     -ForegroundColor Cyan
Write-Host '================================================' -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. 旧バージョンイメージの存在確認
# ------------------------------------------------------------
Write-Host ""
Write-Host "[1/3] イメージ存在確認: kakeibo-app:$PreviousVersion" -ForegroundColor Yellow
$images = Invoke-Ssh "docker images --format '{{.Repository}}:{{.Tag}}'"
$found = ($images -split "`n" | ForEach-Object { $_.Trim() }) -contains "kakeibo-app:$PreviousVersion"
if (-not $found) {
    Write-Host "利用可能な kakeibo-app イメージ:" -ForegroundColor Red
    Invoke-Ssh "docker images | grep kakeibo-app"
    throw "イメージ kakeibo-app:$PreviousVersion が NAS 上に見つかりません。"
}
Write-Host "       見つかりました" -ForegroundColor Green

# ------------------------------------------------------------
# 2. latest タグ付け替え & コンテナ再作成
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] タグ付け替え & 再起動" -ForegroundColor Yellow
Invoke-Ssh "docker tag kakeibo-app:$PreviousVersion kakeibo-app:latest"
Invoke-Ssh "cd $NasDeployDir && docker compose up -d"
Write-Host "       再起動完了" -ForegroundColor Green

# ------------------------------------------------------------
# 3. 稼働確認
# ------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] ヘルスチェック" -ForegroundColor Yellow
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
    Write-Host "⚠ 起動確認がタイムアウトしました。ログを確認してください:" -ForegroundColor Red
    Invoke-Ssh "cd $NasDeployDir && docker compose logs --tail=30"
    throw 'ヘルスチェック失敗'
}

Write-Host ""
Write-Host '================================================' -ForegroundColor Cyan
Write-Host "  ロールバック完了 → v$PreviousVersion"                -ForegroundColor Green
Write-Host '================================================' -ForegroundColor Cyan