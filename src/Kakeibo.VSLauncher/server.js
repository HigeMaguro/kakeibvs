/**
 * MyKakeibo - 自宅サーバー / NAS 向けバックエンドサーバー
 * Node.js + Express + 標準組み込み SQLite (node:sqlite)
 */

'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const ExcelJS = require('exceljs');
const { addReportToWorkbook } = require('./scripts/lib/report-builder');

// ─────────────────────────────────────────
// 設定
// ─────────────────────────────────────────
const PORT = process.env.APP_PORT || process.env.PORT || 80;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'kakeibo.db');

// データディレクトリの自動生成
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ─────────────────────────────────────────
// SQLite データベース初期化
// ─────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// テーブル初期化
db.exec(`
  -- 収支テーブル
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    memo TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

  -- 予算テーブル
  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    budget REAL NOT NULL,
    label TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);

  -- 銀行口座テーブル
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bank_name TEXT DEFAULT '',
    account_type TEXT DEFAULT '普通',
    balance REAL DEFAULT 0,
    initial_balance REAL DEFAULT 0,
    color TEXT DEFAULT 'acct-color-1',
    note TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bank_accounts_created ON bank_accounts(created_at);

  -- 口座取引明細テーブル
  CREATE TABLE IF NOT EXISTS account_transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT DEFAULT '',
    description TEXT DEFAULT '',
    related_account_id TEXT DEFAULT '',
    link_mode INTEGER DEFAULT 0,
    linked_income_tx_id TEXT DEFAULT '',
    linked_expense_tx_id TEXT DEFAULT '',
    balance_after REAL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_acct_tx_account ON account_transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_acct_tx_date ON account_transactions(date);
  CREATE INDEX IF NOT EXISTS idx_acct_tx_created ON account_transactions(created_at DESC);

  -- 汎用キーバリューストア（設定・カテゴリ保存用）
  CREATE TABLE IF NOT EXISTS app_settings_new (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings_new(key);
`);
// 旧 app_settings テーブルが id カラムなしで存在する場合は新テーブルへ移行
try {
  const hasIdCol = db.prepare("PRAGMA table_info(app_settings)").all().some(c => c.name === 'id');
  if (hasIdCol) {
    // 既に id カラム持ちならそのまま
    db.exec('ALTER TABLE app_settings RENAME TO app_settings_tmp');
    db.exec('ALTER TABLE app_settings_tmp RENAME TO app_settings');
  } else if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'").get()) {
    // 旧テーブルから新テーブルへ移行
    db.exec('INSERT OR IGNORE INTO app_settings_new(id, key, value, updated_at) SELECT key, key, value, updated_at FROM app_settings');
    db.exec('DROP TABLE app_settings');
    db.exec('ALTER TABLE app_settings_new RENAME TO app_settings');
  } else {
    db.exec('ALTER TABLE app_settings_new RENAME TO app_settings');
  }
} catch (e) {
  // 移行エラーは無視（初回起動時など）
  try { db.exec('ALTER TABLE app_settings_new RENAME TO app_settings'); } catch (_) {}
}

// マイグレーション: 旧DBカラムを追加
const migrations = [
  'ALTER TABLE account_transactions ADD COLUMN linked_tx_id TEXT DEFAULT ""',
  'ALTER TABLE account_transactions ADD COLUMN link_mode INTEGER DEFAULT 0',
  'ALTER TABLE account_transactions ADD COLUMN linked_income_tx_id TEXT DEFAULT ""',
  'ALTER TABLE account_transactions ADD COLUMN linked_expense_tx_id TEXT DEFAULT ""',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (e) { /* 既存カラムは無視 */ }
}

console.log(`[DB] SQLite initialized at: ${DB_PATH}`);

// ─────────────────────────────────────────
// Express アプリケーション設定
// ─────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─────────────────────────────────────────
// ヘルスチェック
// ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ─────────────────────────────────────────
// テーブル定義メタデータ
// ─────────────────────────────────────────
const KNOWN_TABLES = {
  transactions: {
    columns: ['id', 'date', 'type', 'category', 'amount', 'memo', 'created_at', 'updated_at'],
    numeric: ['amount', 'created_at', 'updated_at'],
    defaultSort: 'created_at DESC',
  },
  budgets: {
    columns: ['id', 'month', 'category', 'budget', 'label', 'created_at', 'updated_at'],
    numeric: ['budget', 'created_at', 'updated_at'],
    defaultSort: 'created_at ASC',
  },
  bank_accounts: {
    columns: ['id', 'name', 'bank_name', 'account_type', 'balance', 'initial_balance', 'color', 'note', 'icon', 'created_at', 'updated_at'],
    numeric: ['balance', 'initial_balance', 'created_at', 'updated_at'],
    defaultSort: 'created_at ASC',
  },
  account_transactions: {
    columns: ['id', 'account_id', 'date', 'type', 'amount', 'category', 'description', 'related_account_id', 'link_mode', 'linked_income_tx_id', 'linked_expense_tx_id', 'linked_tx_id', 'balance_after', 'created_at', 'updated_at'],
    numeric: ['amount', 'balance_after', 'link_mode', 'created_at', 'updated_at'],
    defaultSort: 'created_at DESC',
  },
  app_settings: {
    columns: ['id', 'key', 'value', 'updated_at'],
    numeric: ['updated_at'],
    defaultSort: 'updated_at DESC',
  }
};

function getTableMeta(tableName) {
  if (KNOWN_TABLES[tableName]) {
    return KNOWN_TABLES[tableName];
  }
  // 未定義テーブルは動的カラム検出
  try {
    const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (info && info.length > 0) {
      return {
        columns: info.map(col => col.name),
        numeric: info.filter(col => col.type.includes('INT') || col.type.includes('REAL') || col.type.includes('NUM')).map(col => col.name),
        defaultSort: 'rowid DESC'
      };
    }
  } catch (e) {
    // テーブルが存在しない場合
  }
  return null;
}

// ─────────────────────────────────────────
// RESTful Table API
// ─────────────────────────────────────────

// GET /tables/:table - 一覧取得
app.get('/tables/:table', (req, res) => {
  const { table } = req.params;
  const meta = getTableMeta(table);
  if (!meta) {
    return res.status(404).json({ error: `テーブル '${table}' が見つかりません` });
  }

  try {
    const { limit, offset, sort, ...filters } = req.query;
    const conditions = [];
    const paramValues = [];

    // フィルタ条件構築
    for (const [k, v] of Object.entries(filters)) {
      if (meta.columns.includes(k) && v !== undefined && v !== '') {
        conditions.push(`${k} = ?`);
        paramValues.push(meta.numeric.includes(k) ? Number(v) : v);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = sort || meta.defaultSort;
    const limitNum = Math.min(Number(limit) || 500, 5000);
    const offsetNum = Number(offset) || 0;

    const countSql = `SELECT COUNT(*) AS total FROM ${table} ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...paramValues);
    const total = totalRow ? totalRow.total : 0;

    const selectSql = `SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const rows = db.prepare(selectSql).all(...paramValues, limitNum, offsetNum);

    res.json({
      data: rows,
      total,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (err) {
    console.error(`[GET /tables/${table}] Error:`, err);
    res.status(500).json({ error: 'データ取得に失敗しました', details: err.message });
  }
});

// POST /tables/:table - 新規登録
app.post('/tables/:table', (req, res) => {
  const { table } = req.params;
  const meta = getTableMeta(table);
  if (!meta) {
    return res.status(404).json({ error: `テーブル '${table}' が見つかりません` });
  }

  try {
    const record = { ...req.body };
    const now = Date.now();

    if (!record.id) {
      record.id = crypto.randomUUID();
    }
    if (!record.created_at) {
      record.created_at = now;
    }
    record.updated_at = now;

    // テーブル定義に合致するカラムのみ抽出
    const validKeys = Object.keys(record).filter(k => meta.columns.includes(k));
    if (validKeys.length === 0) {
      return res.status(400).json({ error: '有効なデータフィールドがありません' });
    }

    const colNames = validKeys.join(', ');
    const placeholders = validKeys.map(() => '?').join(', ');
    const values = validKeys.map(k => {
      const val = record[k];
      if (meta.numeric.includes(k) && val !== null && val !== undefined) {
        return Number(val);
      }
      return val;
    });

    const sql = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`;
    db.prepare(sql).run(...values);

    const created = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(record.id);
    res.status(201).json(created);
  } catch (err) {
    console.error(`[POST /tables/${table}] Error:`, err);
    res.status(500).json({ error: 'データ登録に失敗しました', details: err.message });
  }
});

// GET /tables/:table/:id - 単一取得
app.get('/tables/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const meta = getTableMeta(table);
  if (!meta) {
    return res.status(404).json({ error: `テーブル '${table}' が見つかりません` });
  }

  try {
    const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!item) {
      return res.status(404).json({ error: '指定されたレコードが見つかりません' });
    }
    res.json(item);
  } catch (err) {
    console.error(`[GET /tables/${table}/${id}] Error:`, err);
    res.status(500).json({ error: 'データ取得に失敗しました', details: err.message });
  }
});

// PUT / PATCH /tables/:table/:id - 更新
const updateHandler = (req, res) => {
  const { table, id } = req.params;
  const meta = getTableMeta(table);
  if (!meta) {
    return res.status(404).json({ error: `テーブル '${table}' が見つかりません` });
  }

  try {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!existing) {
      return res.status(404).json({ error: '更新対象のレコードが見つかりません' });
    }

    const updates = { ...req.body };
    delete updates.id; // IDは不変
    updates.updated_at = Date.now();

    const validKeys = Object.keys(updates).filter(k => meta.columns.includes(k));
    if (validKeys.length === 0) {
      return res.json(existing);
    }

    const setClauses = validKeys.map(k => `${k} = ?`).join(', ');
    const values = validKeys.map(k => {
      const val = updates[k];
      if (meta.numeric.includes(k) && val !== null && val !== undefined) {
        return Number(val);
      }
      return val;
    });

    const sql = `UPDATE ${table} SET ${setClauses} WHERE id = ?`;
    db.prepare(sql).run(...values, id);

    const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    res.json(updated);
  } catch (err) {
    console.error(`[PUT /tables/${table}/${id}] Error:`, err);
    res.status(500).json({ error: 'データ更新に失敗しました', details: err.message });
  }
};

app.put('/tables/:table/:id', updateHandler);
app.patch('/tables/:table/:id', updateHandler);

// DELETE /tables/:table/:id - 削除
app.delete('/tables/:table/:id', (req, res) => {
  const { table, id } = req.params;
  const meta = getTableMeta(table);
  if (!meta) {
    return res.status(404).json({ error: `テーブル '${table}' が見つかりません` });
  }

  try {
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '削除対象のレコードが見つかりません' });
    }
    res.status(200).json({ success: true, deletedId: id });
  } catch (err) {
    console.error(`[DELETE /tables/${table}/${id}] Error:`, err);
    res.status(500).json({ error: 'データ削除に失敗しました', details: err.message });
  }
});

// ─────────────────────────────────────────
// バックアップ・エクスポート API
// ─────────────────────────────────────────
app.get('/api/export', (req, res) => {
  try {
    const data = {
      exported_at: new Date().toISOString(),
      transactions: db.prepare('SELECT * FROM transactions ORDER BY date DESC').all(),
      budgets: db.prepare('SELECT * FROM budgets').all(),
      bank_accounts: db.prepare('SELECT * FROM bank_accounts').all(),
      account_transactions: db.prepare('SELECT * FROM account_transactions ORDER BY date DESC').all(),
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="mykakeibo_backup_${Date.now()}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'エクスポートに失敗しました', details: err.message });
  }
});

// ─────────────────────────────────────────
// バージョン情報 API
// ─────────────────────────────────────────
let APP_VERSION = process.env.APP_VERSION || '';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  if (!APP_VERSION) APP_VERSION = pkg.version || 'unknown';
} catch (e) {
  if (!APP_VERSION) APP_VERSION = 'unknown';
}

app.get('/api/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    build_date: process.env.BUILD_DATE || '',
    node: process.version,
    uptime: process.uptime(),
  });
});

// ─────────────────────────────────────────
// Excel (.xlsx) エクスポート API
// ─────────────────────────────────────────
const HEADER_FILL = 'FFE8F0FE';   // ヘッダー行の背景色 (薄い青)
const HEADER_FONT_COLOR = 'FF1F3864';
const YEN_FORMAT = '"¥"#,##0';
const DATE_FORMAT = 'yyyy/mm/dd';

function styleHeaderRow(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: HEADER_FONT_COLOR } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 22;
}

function autoWidth(sheet, minWidth = 8) {
  sheet.columns.forEach(col => {
    let max = minWidth;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = String(cell.value != null ? cell.value : '').length;
      if (len > max) max = len;
    });
    // 日本語は全角を考慮して幅を少し広げる
    col.width = Math.min(max * 1.6 + 4, 60);
  });
}

app.get('/api/export/excel', async (req, res) => {
  try {
    // ── 月フィルタ (?month=YYYY-MM) ──
    // 指定時はその月のデータのみ出力 (未指定時は全期間 = 従来動作)
    const monthParam = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month)
      ? req.query.month : null;

    // ── データ取得 ──
    const transactions = monthParam
      ? db.prepare("SELECT * FROM transactions WHERE date LIKE ? || '%' ORDER BY date DESC").all(monthParam)
      : db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    const budgets = monthParam
      ? db.prepare('SELECT * FROM budgets WHERE month = ? ORDER BY month ASC').all(monthParam)
      : db.prepare('SELECT * FROM budgets ORDER BY month ASC').all();
    const accounts     = db.prepare('SELECT * FROM bank_accounts ORDER BY created_at ASC').all();
    const acctTx = monthParam
      ? db.prepare("SELECT * FROM account_transactions WHERE date LIKE ? || '%' ORDER BY date DESC").all(monthParam)
      : db.prepare('SELECT * FROM account_transactions ORDER BY date DESC').all();
    const accountNames = Object.fromEntries(accounts.map(a => [a.id, a.name]));
    const acctTypeLabels = { deposit: '入金', withdrawal: '出金', transfer_in: '振込入金', transfer_out: '振込出金' };
    const txTypeLabels   = { income: '収入', expense: '支出' };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MyKakeibo';
    wb.created = new Date();

    // ── シート1: 月別サマリー ──
    const ws1 = wb.addWorksheet('月別サマリー');
    ws1.columns = [
      { header: '年月', key: 'month', width: 12 },
      { header: '収入合計', key: 'income', width: 16 },
      { header: '支出合計', key: 'expense', width: 16 },
      { header: '収支', key: 'balance', width: 16 },
    ];
    const monthly = {};
    for (const t of transactions) {
      const month = String(t.date || '').slice(0, 7);
      if (!month) continue;
      if (!monthly[month]) monthly[month] = { income: 0, expense: 0 };
      if (t.type === 'income')  monthly[month].income  += Number(t.amount) || 0;
      if (t.type === 'expense') monthly[month].expense += Number(t.amount) || 0;
    }
    for (const month of Object.keys(monthly).sort()) {
      const m = monthly[month];
      const row = ws1.addRow({ month, income: m.income, expense: m.expense, balance: m.income - m.expense });
      row.getCell('income').numFmt = YEN_FORMAT;
      row.getCell('expense').numFmt = YEN_FORMAT;
      row.getCell('balance').numFmt = YEN_FORMAT;
      row.getCell('balance').font = { color: { argb: m.income - m.expense >= 0 ? 'FF2E7D32' : 'FFC0392B' } };
    }
    styleHeaderRow(ws1);
    autoWidth(ws1);
    ws1.views = [{ state: 'frozen', ySplit: 1 }];

    // ── シート2: 収支データ ──
    const ws2 = wb.addWorksheet('収支データ');
    ws2.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '種別', key: 'type', width: 8 },
      { header: 'カテゴリ', key: 'category', width: 14 },
      { header: '金額', key: 'amount', width: 14 },
      { header: 'メモ', key: 'memo', width: 30 },
    ];
    for (const t of transactions) {
      const row = ws2.addRow({
        date: t.date ? new Date(t.date + 'T00:00:00') : '',
        type: txTypeLabels[t.type] || t.type,
        category: t.category,
        amount: Number(t.amount) || 0,
        memo: t.memo || '',
      });
      row.getCell('date').numFmt = DATE_FORMAT;
      row.getCell('amount').numFmt = YEN_FORMAT;
    }
    styleHeaderRow(ws2);
    autoWidth(ws2);
    ws2.autoFilter = { from: 'A1', to: { row: 1, column: 5 } };
    ws2.views = [{ state: 'frozen', ySplit: 1 }];

    // ── シート3: 予算 ──
    const ws3 = wb.addWorksheet('予算');
    ws3.columns = [
      { header: '年月', key: 'month', width: 12 },
      { header: 'カテゴリ', key: 'category', width: 14 },
      { header: '予算額', key: 'budget', width: 14 },
      { header: 'ラベル', key: 'label', width: 20 },
    ];
    for (const b of budgets) {
      const row = ws3.addRow({
        month: b.month,
        category: b.category,
        budget: Number(b.budget) || 0,
        label: b.label || '',
      });
      row.getCell('budget').numFmt = YEN_FORMAT;
    }
    styleHeaderRow(ws3);
    autoWidth(ws3);
    ws3.autoFilter = { from: 'A1', to: { row: 1, column: 4 } };
    ws3.views = [{ state: 'frozen', ySplit: 1 }];

    // ── シート4: 預金口座 ──
    const ws4 = wb.addWorksheet('預金口座');
    ws4.columns = [
      { header: '口座名', key: 'name', width: 18 },
      { header: '銀行名', key: 'bank_name', width: 18 },
      { header: '口座種別', key: 'account_type', width: 10 },
      { header: '現在残高', key: 'balance', width: 14 },
      { header: '初期残高', key: 'initial_balance', width: 14 },
      { header: 'メモ', key: 'note', width: 24 },
    ];
    for (const a of accounts) {
      const row = ws4.addRow({
        name: a.name,
        bank_name: a.bank_name || '',
        account_type: a.account_type || '',
        balance: Number(a.balance) || 0,
        initial_balance: Number(a.initial_balance) || 0,
        note: a.note || '',
      });
      row.getCell('balance').numFmt = YEN_FORMAT;
      row.getCell('initial_balance').numFmt = YEN_FORMAT;
    }
    styleHeaderRow(ws4);
    autoWidth(ws4);
    ws4.views = [{ state: 'frozen', ySplit: 1 }];

    // ── シート5: 口座明細 ──
    const ws5 = wb.addWorksheet('口座明細');
    ws5.columns = [
      { header: '日付', key: 'date', width: 12 },
      { header: '口座名', key: 'account', width: 16 },
      { header: '種別', key: 'type', width: 10 },
      { header: 'カテゴリ', key: 'category', width: 12 },
      { header: '出金', key: 'withdraw', width: 14 },
      { header: '入金', key: 'deposit', width: 14 },
      { header: '残高', key: 'balance_after', width: 14 },
      { header: '摘要', key: 'description', width: 24 },
      { header: '相手口座', key: 'related', width: 16 },
    ];
    for (const t of acctTx) {
      const amt = Number(t.amount) || 0;
      const isWithdraw = t.type === 'withdrawal' || t.type === 'transfer_out';
      const row = ws5.addRow({
        date: t.date ? new Date(t.date + 'T00:00:00') : '',
        account: accountNames[t.account_id] || '',
        type: acctTypeLabels[t.type] || t.type,
        category: t.category || '',
        withdraw: isWithdraw ? amt : null,
        deposit: isWithdraw ? null : amt,
        balance_after: t.balance_after != null && t.balance_after !== '' ? Number(t.balance_after) : null,
        description: t.description || '',
        related: t.related_account_id ? (accountNames[t.related_account_id] || '') : '',
      });
      row.getCell('date').numFmt = DATE_FORMAT;
      row.getCell('withdraw').numFmt = YEN_FORMAT;
      row.getCell('deposit').numFmt = YEN_FORMAT;
      row.getCell('balance_after').numFmt = YEN_FORMAT;
    }
    styleHeaderRow(ws5);
    autoWidth(ws5);
    ws5.autoFilter = { from: 'A1', to: { row: 1, column: 9 } };
    ws5.views = [{ state: 'frozen', ySplit: 1 }];

    // ── 集計・グラフレポート追加 (設定/集計/グラフシート + チャート埋込) ──
    // ── レスポンス送信 ──
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const buf = await addReportToWorkbook(wb);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mykakeibo_${monthParam ? monthParam + '_' : ''}${stamp}.xlsx"`);
    res.setHeader('Content-Length', buf.length);
    res.send(Buffer.from(buf));
  } catch (err) {
    console.error('[GET /api/export/excel] Error:', err);
    res.status(500).json({ error: 'Excel エクスポートに失敗しました', details: err.message });
  }
});

// ─────────────────────────────────────────
// 静的ファイル配信 (app ディレクトリ)
// ─────────────────────────────────────────
const appDir = path.join(__dirname, 'app');
app.use(express.static(appDir));

// SPA / ルートフォールバック
app.get('*', (req, res) => {
  const indexPath = path.join(appDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

// ─────────────────────────────────────────
// サーバー起動
// ─────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🏠 MyKakeibo Server running on port ${PORT}`);
  console.log(`📊 Storage: SQLite (${DB_PATH})`);
  console.log(`🌐 Local Access: http://localhost:${PORT}`);
  console.log(`=========================================`);
});
