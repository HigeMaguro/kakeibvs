# ============================================================
# MyKakeibo SSH 公開鍵認証セットアップ (ssh-copy-id 相当)
# ============================================================
# 概要:
#   Windows には ssh-copy-id がないため、同等の処理を行うスクリプト。
#   1. SSH 鍵ペア (ed25519) がなければ生成
#   2. 公開鍵を NAS の ~/.ssh/authorized_keys に登録
#      (ここだけ 1 回パスワード入力が必要)
#   3. パスワードなしログインを検証
#
#   完了後は deploy-nas.ps1 / rollback-nas.ps1 が
#   パスワード入力なしで実行できます。
#
# 使い方:
#   .\setup-ssh-key.ps1 -NasHost 192.168.0.114 -NasUser satoshi
#   .\setup-ssh-key.ps1 -UseSshConfig -SshHostName ugreen-nas
#
# ※ 鍵はパスフレーズなしで生成します (自動デプロイ用)。
#   PC のファイルアクセス制御で保護してください。
#   パスフレーズを付けたい場合は手動で ssh-keygen した後、
#   このスクリプトを再実行してください (登録のみ行われます)。
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
    [string]$SshHostName
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sshTarget = if ($UseSshConfig) { $SshHostName } else { "$NasUser@$NasHost" }
$sshExtra  = @()
if (-not $UseSshConfig -and $NasSshPort -ne 22) { $sshExtra += @('-p', "$NasSshPort") }

# ------------------------------------------------------------
# 1. 鍵ペアの確認 / 生成
# ------------------------------------------------------------
$sshDir = Join-Path $env:USERPROFILE '.ssh'
$keyFile = Join-Path $sshDir 'id_ed25519'
$pubFile = "$keyFile.pub"

if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir | Out-Null
}

if (-not (Test-Path $keyFile)) {
    Write-Host "[1/3] SSH 鍵を生成中: $keyFile" -ForegroundColor Yellow
    # パスフレーズなし (-N '') で生成。自動デプロイ用。
    & ssh-keygen -t ed25519 -C "kakeibo-deploy@$env:COMPUTERNAME" -f $keyFile -N '""'
    if ($LASTEXITCODE -ne 0) { throw 'ssh-keygen に失敗しました。' }
    Write-Host "       生成完了 (ed25519 / パスフレーズなし)" -ForegroundColor Green
} else {
    Write-Host "[1/3] 既存の SSH 鍵を使用: $keyFile" -ForegroundColor Yellow
}

if (-not (Test-Path $pubFile)) { throw "公開鍵が見つかりません: $pubFile" }

# ------------------------------------------------------------
# 2. 公開鍵を NAS へ登録 (ここだけ 1 回パスワード入力)
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] 公開鍵を $sshTarget へ登録中..." -ForegroundColor Yellow
Write-Host "      ※ NAS のパスワードを 1 回入力してください" -ForegroundColor DarkYellow

# ssh-copy-id 相当: 公開鍵を stdin から ssh へ送って authorized_keys に冪等追記
#   - 単一行の ed25519 公開鍵のためクォート問題は発生しない
#   - grep -qxF で二重登録を防止 (冪等)
#   - umask 077 で .ssh / authorized_keys のパーミッションを担保
$pubContent = (Get-Content $pubFile -Raw).Trim()
$remoteScript = 'umask 077 && mkdir -p ~/.ssh && touch ~/.ssh/authorized_keys && KEY="$(cat)" && grep -qxF "$KEY" ~/.ssh/authorized_keys || echo "$KEY" >> ~/.ssh/authorized_keys'

$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $pubContent | & ssh @sshExtra -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 $sshTarget $remoteScript 2>&1
    $regFailed = ($LASTEXITCODE -ne 0)
} finally {
    $ErrorActionPreference = $prevEAP
}
if ($regFailed) {
    throw '公開鍵の登録に失敗しました。パスワード・SSH 設定を確認してください。'
}
Write-Host "       登録完了" -ForegroundColor Green

# ------------------------------------------------------------
# 3. パスワードなしログインの検証
# ------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] パスワードなしログインを検証中..." -ForegroundColor Yellow
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & ssh @sshExtra -o BatchMode=yes -o ConnectTimeout=8 $sshTarget "echo ok" 2>$null
    $verifyFailed = ($LASTEXITCODE -ne 0)
} finally {
    $ErrorActionPreference = $prevEAP
}
if ($verifyFailed) {
    Write-Host "       失敗しました。NAS 側の sshd_config で PubkeyAuthentication が" -ForegroundColor Red
    Write-Host "       無効 (no) になっていないか確認してください。" -ForegroundColor Red
    throw 'パスワードなし認証の検証に失敗しました。'
}
Write-Host "       検証 OK - パスワードなしでログインできます" -ForegroundColor Green

Write-Host ""
Write-Host '================================================' -ForegroundColor Cyan
Write-Host "  セットアップ完了!"                                  -ForegroundColor Green
Write-Host '================================================' -ForegroundColor Cyan
Write-Host ""
Write-Host "以降のデプロイはパスワード入力不要です:" -ForegroundColor Yellow
Write-Host "  .\deploy-nas.ps1 -NasHost $NasHost -NasUser $NasUser -NasDeployDir /volume1/docker/kakeibovs" -ForegroundColor Gray
if ($UseSshConfig) {
    Write-Host "  .\deploy-nas.ps1 -UseSshConfig -SshHostName $SshHostName" -ForegroundColor Gray
}