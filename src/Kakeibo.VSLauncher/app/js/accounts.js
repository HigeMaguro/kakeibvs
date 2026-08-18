/**
 * MyKakeibo – 預金口座管理モジュール
 * js/accounts.js  (app.js より先に読み込まれる)
 */

'use strict';

/* ─────────────────────────────────────────
   定数・設定
───────────────────────────────────────── */
const ACCT_TABLE = 'bank_accounts';
const ACCT_TX_TABLE = 'account_transactions';
const ACCT_TX_PER_PAGE = 20;

const ACCT_COLORS = [
  { cls: 'acct-color-1', hex: '#4f7df3' },
  { cls: 'acct-color-2', hex: '#22c55e' },
  { cls: 'acct-color-3', hex: '#f59e0b' },
  { cls: 'acct-color-4', hex: '#ef4444' },
  { cls: 'acct-color-5', hex: '#8b5cf6' },
  { cls: 'acct-color-6', hex: '#06b6d4' },
  { cls: 'acct-color-7', hex: '#ec4899' },
  { cls: 'acct-color-8', hex: '#10b981' },
];

const TX_TYPE_LABELS = {
  deposit:      { label: '入金',      icon: 'fa-arrow-down',         cls: 'deposit' },
  withdrawal:   { label: '出金',      icon: 'fa-arrow-up',           cls: 'withdrawal' },
  transfer_in:  { label: '振込（入）', icon: 'fa-right-to-bracket',  cls: 'transfer_in' },
  transfer_out: { label: '振込（出）', icon: 'fa-right-from-bracket', cls: 'transfer_out' },
};

/* 家計簿連携モード: 0=連携なし, 1=収入へ連携, 2=収入と支出へ連携 */
const LINK_MODE_NONE = 0;
const LINK_MODE_INCOME = 1;
const LINK_MODE_INCOME_EXPENSE = 2;
const KAKEIBO_INCOME_CATEGORY_FALLBACK = 'その他収入';
const KAKEIBO_EXPENSE_CATEGORY_FALLBACK = 'その他';

function getLinkMode(type) {
  if (type !== 'withdrawal') return LINK_MODE_NONE;
  const sel = document.getElementById('acct-tx-link-mode');
  if (!sel) return LINK_MODE_NONE;
  return parseInt(sel.value, 10) || LINK_MODE_NONE;
}

/* ─────────────────────────────────────────
   状態
───────────────────────────────────────── */
const acctState = {
  accounts:         [],
  transactions:     [],
  activeAccountId:  null,
  selectedColor:    ACCT_COLORS[0].cls,
  txPage:           1,
  txTypeFilter:     '',
  editingAcctId:    null,
  editingTxId:      null,
};

/* ─────────────────────────────────────────
   ユーティリティ
───────────────────────────────────────── */
function acctFormatYen(n) {
  return '¥' + Number(n || 0).toLocaleString('ja-JP');
}
function acctFormatDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${+m}/${+d}`;
}
function acctToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** 口座に色クラス→hex 逆引き */
function colorHexFromCls(cls) {
  return (ACCT_COLORS.find(c => c.cls === cls) || ACCT_COLORS[0]).hex;
}
function colorClsFromHex(hex) {
  return (ACCT_COLORS.find(c => c.hex === hex) || ACCT_COLORS[0]).cls;
}

/* ─────────────────────────────────────────
   API ラッパー
───────────────────────────────────────── */
async function acctApi(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`tables/${path}`, opts);
  if (!res.ok) throw new Error(`API error: ${method} ${path}`);
  if (res.status === 204) return null;
  return res.json();
}
const acctGet    = (path, qs='') => acctApi('GET', `${path}${qs ? '?'+qs : ''}`, null);
const acctPost   = (path, body)  => acctApi('POST',   path, body);
const acctPut    = (path, body)  => acctApi('PUT',    path, body);
const acctDelete = (path)        => acctApi('DELETE', path, null);

/* ─── 家計簿(transactions)連携用 API ─── */
async function kakeiboApi(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`tables/${path}`, opts);
  if (!res.ok) throw new Error(`API error: ${method} ${path}`);
  if (res.status === 204) return null;
  return res.json();
}
const kakeiboPost   = (body)      => kakeiboApi('POST',   'transactions', body);
const kakeiboPut    = (id, body)  => kakeiboApi('PUT',    `transactions/${id}`, body);
const kakeiboDelete = (id)        => kakeiboApi('DELETE', `transactions/${id}`, null);

/* ─── app.js state.allTransactions への即時反映ヘルパー ─── */
function pushKakeiboState(created) {
  if (typeof state !== 'undefined' && state.allTransactions) {
    state.allTransactions.push(created);
  }
}
function syncKakeiboState(id, updated) {
  if (typeof state !== 'undefined' && state.allTransactions) {
    const kIdx = state.allTransactions.findIndex(t => t.id === id);
    if (kIdx >= 0) state.allTransactions[kIdx] = { ...state.allTransactions[kIdx], ...updated };
  }
}
function removeKakeiboState(id) {
  if (typeof state !== 'undefined' && state.allTransactions) {
    state.allTransactions = state.allTransactions.filter(t => t.id !== id);
  }
}

/* ─────────────────────────────────────────
   データ読み込み
───────────────────────────────────────── */
async function loadAccountsData() {
  const [aRes, tRes] = await Promise.all([
    acctGet(ACCT_TABLE,    'limit=200'),
    acctGet(ACCT_TX_TABLE, 'limit=2000'),
  ]);
  acctState.accounts     = (aRes.data  || []).sort((a,b) => a.created_at - b.created_at);
  acctState.transactions = (tRes.data  || []).sort((a,b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return b.created_at - a.created_at;
  });
}

/* ─────────────────────────────────────────
   ページ全体描画
───────────────────────────────────────── */
async function renderAccountsPage() {
  await loadAccountsData();
  renderSummaryCards();
  renderAccountCardsList();
  // デフォルト選択
  if (!acctState.activeAccountId && acctState.accounts.length > 0) {
    acctState.activeAccountId = acctState.accounts[0].id;
  }
  renderAccountTxArea();
}

/* ─────────────────────────────────────────
   合計残高サマリーカード
───────────────────────────────────────── */
function renderSummaryCards() {
  const container = document.getElementById('accounts-summary-cards');
  const accounts  = acctState.accounts;

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance || 0), 0);

  let html = `
    <div class="acct-summary-card total-card">
      <div class="acct-summary-label">💰 全口座合計残高</div>
      <div class="acct-summary-value">${acctFormatYen(totalBalance)}</div>
    </div>
  `;

  accounts.forEach(a => {
    const colorHex = colorHexFromCls(a.color || ACCT_COLORS[0].cls);
    html += `
      <div class="acct-summary-card" style="--acct-color:${colorHex}">
        <div class="acct-summary-label">${a.bank_name || ''}</div>
        <div class="acct-summary-value">${acctFormatYen(a.balance)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ─────────────────────────────────────────
   口座カードリスト
───────────────────────────────────────── */
function renderAccountCardsList() {
  const list    = document.getElementById('account-cards-list');
  const noMsg   = document.getElementById('no-accounts-msg');
  const accounts = acctState.accounts;
  const addBtn  = document.getElementById('add-acct-tx-btn');

  if (accounts.length === 0) {
    list.innerHTML = '';
    noMsg.style.display = 'block';
    if (addBtn) addBtn.disabled = true;
    return;
  }
  noMsg.style.display = 'none';
  if (addBtn) addBtn.disabled = false;

  list.innerHTML = accounts.map(a => {
    const colorHex = colorHexFromCls(a.color || ACCT_COLORS[0].cls);
    const isActive = a.id === acctState.activeAccountId;
    const bal      = Number(a.balance || 0);
    return `
      <div class="account-card${isActive ? ' active-acct' : ''}"
           style="--acct-color:${colorHex}"
           onclick="acctSelectAccount('${a.id}')">
        <div class="account-card-bar"></div>
        <div class="account-card-info">
          <div class="account-card-bank">
            <i class="fas fa-building-columns"></i>${a.bank_name || ''}
          </div>
          <div class="account-card-name">${a.name}</div>
          <span class="account-card-type">${a.account_type || '普通'}</span>
        </div>
        <div class="account-card-balance-col">
          <div class="account-card-balance-label">残高</div>
          <div class="account-card-balance${bal < 0 ? ' negative' : ''}">${acctFormatYen(bal)}</div>
        </div>
        <div class="account-card-actions">
          <button class="btn-icon edit" onclick="event.stopPropagation(); acctStartEditAccount('${a.id}')" title="編集">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn-icon delete" onclick="event.stopPropagation(); acctConfirmDeleteAccount('${a.id}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/* ─────────────────────────────────────────
   口座選択
───────────────────────────────────────── */
function acctSelectAccount(id) {
  acctState.activeAccountId = id;
  acctState.txPage          = 1;
  acctState.txTypeFilter    = '';
  document.getElementById('acct-tx-filter-type').value = '';
  renderAccountCardsList();
  renderAccountTxArea();
}

/* ─────────────────────────────────────────
   取引エリア（テーブル＋サマリー）
───────────────────────────────────────── */
function renderAccountTxArea() {
  const account = acctState.accounts.find(a => a.id === acctState.activeAccountId);

  const titleEl = document.getElementById('acct-tx-title');
  if (account) {
    const colorHex = colorHexFromCls(account.color || ACCT_COLORS[0].cls);
    titleEl.innerHTML = `<i class="fas fa-list-ul" style="color:${colorHex}"></i> ${account.name}　の取引明細`;
  } else {
    titleEl.innerHTML = '<i class="fas fa-list-ul"></i> 取引明細';
  }

  // 取引追加ボタンの有効化
  const addBtn = document.getElementById('add-acct-tx-btn');
  if (addBtn) addBtn.disabled = !account;

  // 相手口座セレクト更新
  updateRelatedAccountSelect();

  if (!account) {
    document.getElementById('acct-tx-tbody').innerHTML = '';
    document.getElementById('no-acct-tx-msg').style.display = 'block';
    document.getElementById('acct-tx-pagination').innerHTML = '';
    return;
  }

  // 対象口座の取引を絞り込み
  let txs = acctState.transactions.filter(t => t.account_id === acctState.activeAccountId);
  if (acctState.txTypeFilter) {
    txs = txs.filter(t => t.type === acctState.txTypeFilter);
  }

  // サマリーバー
  renderTxSummaryBar(txs);

  // ページング
  const total      = txs.length;
  const totalPages = Math.max(1, Math.ceil(total / ACCT_TX_PER_PAGE));
  if (acctState.txPage > totalPages) acctState.txPage = totalPages;
  const start  = (acctState.txPage - 1) * ACCT_TX_PER_PAGE;
  const paged  = txs.slice(start, start + ACCT_TX_PER_PAGE);

  const tbody = document.getElementById('acct-tx-tbody');
  const noMsg = document.getElementById('no-acct-tx-msg');

  if (paged.length === 0) {
    tbody.innerHTML = '';
    noMsg.style.display = 'block';
  } else {
    noMsg.style.display = 'none';
    tbody.innerHTML = paged.map(tx => {
      const info      = TX_TYPE_LABELS[tx.type] || TX_TYPE_LABELS.deposit;
      const isDebit   = tx.type === 'withdrawal' || tx.type === 'transfer_out';
      const debitCell = isDebit
        ? `<td class="text-right acct-tx-debit" data-label="出金">−${acctFormatYen(tx.amount)}</td><td class="text-right" data-label="入金">—</td>`
        : `<td class="text-right" data-label="出金">—</td><td class="text-right acct-tx-credit" data-label="入金">+${acctFormatYen(tx.amount)}</td>`;
      const relatedAcct = tx.related_account_id
        ? (acctState.accounts.find(a => a.id === tx.related_account_id) || {}).name || ''
        : '';
      const hasIncomeLink  = !!tx.linked_income_tx_id || !!tx.linked_tx_id;
      const hasExpenseLink  = !!tx.linked_expense_tx_id;
      const linkedBadge = (hasIncomeLink || hasExpenseLink)
        ? `<span class="acct-tx-linked-badge" title="家計簿へ自動連携済み"><i class="fas fa-link"></i>家計簿${(hasIncomeLink && hasExpenseLink) ? '入出金' : (hasIncomeLink ? '収入' : '支出')}</span>`
        : '';
      const descText = [tx.description, relatedAcct ? `(${relatedAcct})` : ''].filter(Boolean).join(' ');

      return `
        <tr>
          <td data-label="日付">${acctFormatDate(tx.date)}</td>
          <td data-label="種別">
            <span class="tx-type-badge ${info.cls}">
              <i class="fas ${info.icon}"></i> ${info.label}
            </span>
          </td>
          <td data-label="種類" style="color:var(--text-muted);font-size:13px;">${tx.category || '—'}</td>
          <td data-label="摘要" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">${descText || '—'} ${linkedBadge}</td>
          ${debitCell}
          <td class="text-right acct-tx-balance" data-label="残高">${tx.balance_after != null ? acctFormatYen(tx.balance_after) : '—'}</td>
          <td class="text-center action-cell" data-label="操作">
            <div class="action-buttons">
              <button class="btn-icon edit" onclick="acctStartEditTx('${tx.id}')" title="編集"><i class="fas fa-pen"></i></button>
              <button class="btn-icon delete" onclick="acctConfirmDeleteTx('${tx.id}')" title="削除"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderAcTxPagination(totalPages);
}

/* ─── 取引合計サマリーバー ─── */
function renderTxSummaryBar(txs) {
  const totalIn  = txs.filter(t => t.type === 'deposit'    || t.type === 'transfer_in' ).reduce((s,t) => s + Number(t.amount), 0);
  const totalOut = txs.filter(t => t.type === 'withdrawal' || t.type === 'transfer_out').reduce((s,t) => s + Number(t.amount), 0);
  const txArea = document.getElementById('acct-tx-area');

  let bar = document.getElementById('acct-tx-summary-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'acct-tx-summary-bar';
    bar.className = 'acct-tx-summary-bar';
    const tableWrap = txArea.querySelector('.acct-tx-table-wrap');
    txArea.insertBefore(bar, tableWrap);
  }
  bar.innerHTML = `
    <span>取引件数：<strong>${txs.length}件</strong></span>
    <span style="color:var(--income)">入金合計：<strong>${acctFormatYen(totalIn)}</strong></span>
    <span style="color:var(--expense)">出金合計：<strong>${acctFormatYen(totalOut)}</strong></span>
    <span>差引：<strong style="color:${(totalIn-totalOut)>=0?'var(--income)':'var(--expense)'}">${acctFormatYen(totalIn-totalOut)}</strong></span>
  `;
}

/* ─── 取引ページネーション ─── */
function renderAcTxPagination(totalPages) {
  const pg = document.getElementById('acct-tx-pagination');
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="acctGoToTxPage(${acctState.txPage-1})" ${acctState.txPage===1?'disabled':''}><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - acctState.txPage) <= 2) {
      html += `<button class="page-btn${i===acctState.txPage?' active':''}" onclick="acctGoToTxPage(${i})">${i}</button>`;
    } else if (Math.abs(i - acctState.txPage) === 3) {
      html += `<span class="page-btn" style="pointer-events:none">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="acctGoToTxPage(${acctState.txPage+1})" ${acctState.txPage===totalPages?'disabled':''}><i class="fas fa-chevron-right"></i></button>`;
  pg.innerHTML = html;
}

function acctGoToTxPage(p) {
  acctState.txPage = p;
  renderAccountTxArea();
}

/* ─────────────────────────────────────────
   口座追加フォーム
───────────────────────────────────────── */
function renderColorPicker() {
  const row = document.getElementById('color-picker-row');
  row.innerHTML = ACCT_COLORS.map(c => `
    <div class="color-dot${c.cls === acctState.selectedColor ? ' selected' : ''}"
         style="background:${c.hex}"
         data-cls="${c.cls}"
         onclick="acctSelectColor('${c.cls}')">
    </div>
  `).join('');
}

function acctSelectColor(cls) {
  acctState.selectedColor = cls;
  renderColorPicker();
}

function showAccountForm(show = true) {
  const card = document.getElementById('acct-form-card');
  card.style.display = show ? 'block' : 'none';
  if (show) {
    renderColorPicker();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function resetAccountForm() {
  acctState.editingAcctId = null;
  acctState.selectedColor = ACCT_COLORS[0].cls;
  document.getElementById('account-form').reset();
  document.getElementById('acct-edit-id').value = '';
  document.getElementById('acct-form-title').innerHTML = '<i class="fas fa-plus-circle"></i> 口座を追加';
  document.getElementById('acct-submit-btn').innerHTML = '<i class="fas fa-check"></i> 登録する';
  renderColorPicker();
}

function acctStartEditAccount(id) {
  const a = acctState.accounts.find(a => a.id === id);
  if (!a) return;

  acctState.editingAcctId = id;
  acctState.selectedColor = a.color || ACCT_COLORS[0].cls;

  document.getElementById('acct-edit-id').value    = id;
  document.getElementById('acct-bank').value       = a.bank_name || '';
  document.getElementById('acct-name').value       = a.name || '';
  document.getElementById('acct-type').value       = a.account_type || '普通';
  document.getElementById('acct-initial').value    = a.initial_balance || 0;
  document.getElementById('acct-note').value       = a.note || '';
  document.getElementById('acct-form-title').innerHTML = '<i class="fas fa-pen"></i> 口座を編集';
  document.getElementById('acct-submit-btn').innerHTML = '<i class="fas fa-pen"></i> 更新する';

  showAccountForm(true);
}

async function handleAccountFormSubmit(e) {
  e.preventDefault();
  const bankName      = document.getElementById('acct-bank').value.trim();
  const name          = document.getElementById('acct-name').value.trim();
  const accountType   = document.getElementById('acct-type').value;
  const initialBalance = parseFloat(document.getElementById('acct-initial').value || '0');
  const note          = document.getElementById('acct-note').value.trim();
  const color         = acctState.selectedColor;

  if (!bankName || !name) {
    acctShowToast('銀行名と口座名称を入力してください', 'error'); return;
  }

  const btn = document.getElementById('acct-submit-btn');
  btn.disabled = true;

  try {
    if (acctState.editingAcctId) {
      const existing = acctState.accounts.find(a => a.id === acctState.editingAcctId);
      const data = { name, bank_name: bankName, account_type: accountType,
                     balance: existing?.balance ?? initialBalance,
                     initial_balance: initialBalance, color, note };
      const updated = await acctPut(`${ACCT_TABLE}/${acctState.editingAcctId}`, data);
      const idx = acctState.accounts.findIndex(a => a.id === acctState.editingAcctId);
      if (idx >= 0) acctState.accounts[idx] = { ...acctState.accounts[idx], ...updated };
      acctShowToast('口座情報を更新しました ✏️');
    } else {
      const data = { name, bank_name: bankName, account_type: accountType,
                     balance: initialBalance, initial_balance: initialBalance, color, note };
      const created = await acctPost(ACCT_TABLE, data);
      acctState.accounts.push(created);
      acctState.activeAccountId = created.id;
      acctShowToast('口座を登録しました 🏦');
    }

    resetAccountForm();
    showAccountForm(false);
    renderSummaryCards();
    renderAccountCardsList();
    renderAccountTxArea();

  } catch (err) {
    acctShowToast('保存に失敗しました', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ─── 口座削除 ─── */
function acctConfirmDeleteAccount(id) {
  const a = acctState.accounts.find(a => a.id === id);
  if (!a) return;
  if (!confirm(`「${a.name}」を削除しますか？\n関連する取引明細も削除されます。`)) return;
  acctDeleteAccount(id);
}

async function acctDeleteAccount(id) {
  try {
    // 関連取引を一括削除
    const related = acctState.transactions.filter(t => t.account_id === id);
    await Promise.all(related.map(t => acctDelete(`${ACCT_TX_TABLE}/${t.id}`)));
    await acctDelete(`${ACCT_TABLE}/${id}`);

    acctState.accounts     = acctState.accounts.filter(a => a.id !== id);
    acctState.transactions = acctState.transactions.filter(t => t.account_id !== id);

    if (acctState.activeAccountId === id) {
      acctState.activeAccountId = acctState.accounts[0]?.id || null;
    }
    acctShowToast('口座を削除しました 🗑️');
    renderSummaryCards();
    renderAccountCardsList();
    renderAccountTxArea();
  } catch {
    acctShowToast('削除に失敗しました', 'error');
  }
}

/* ─────────────────────────────────────────
   取引追加フォーム
───────────────────────────────────────── */
function showTxForm(show = true) {
  document.getElementById('acct-tx-form-wrap').style.display = show ? 'block' : 'none';
  if (show) {
    document.getElementById('acct-tx-form-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function resetTxForm() {
  acctState.editingTxId = null;
  document.getElementById('acct-tx-form').reset();
  document.getElementById('acct-tx-edit-id').value = '';
  document.getElementById('acct-tx-date').value = acctToday();
  document.getElementById('acct-tx-link-mode').value = String(LINK_MODE_NONE);
  document.getElementById('acct-tx-submit-btn').innerHTML = '<i class="fas fa-check"></i> 登録する';
  toggleRelatedAccountField('withdrawal');
  toggleLinkSelectField('withdrawal');
}

function updateRelatedAccountSelect() {
  const sel     = document.getElementById('acct-tx-related');
  const others  = acctState.accounts.filter(a => a.id !== acctState.activeAccountId);
  sel.innerHTML = '<option value="">選択...</option>' +
    others.map(a => `<option value="${a.id}">${a.bank_name} ${a.name}</option>`).join('');
}

function toggleRelatedAccountField(type) {
  const grp = document.getElementById('acct-tx-related-group');
  const show = type === 'transfer_in' || type === 'transfer_out';
  grp.style.display = show ? 'block' : 'none';
}

function toggleLinkSelectField(type) {
  const grp = document.getElementById('acct-tx-link-kakeibo-wrap');
  if (grp) grp.style.display = type === 'withdrawal' ? 'block' : 'none';
}

function acctStartEditTx(id) {
  const tx = acctState.transactions.find(t => t.id === id);
  if (!tx) return;

  acctState.editingTxId = id;
  document.getElementById('acct-tx-edit-id').value   = id;
  document.getElementById('acct-tx-date').value      = tx.date;
  document.getElementById('acct-tx-type').value      = tx.type;
  document.getElementById('acct-tx-amount').value    = tx.amount;
  document.getElementById('acct-tx-category').value  = tx.category || '';
  document.getElementById('acct-tx-desc').value      = tx.description || '';
  document.getElementById('acct-tx-related').value   = tx.related_account_id || '';
  document.getElementById('acct-tx-link-mode').value   = String(tx.link_mode || LINK_MODE_NONE);
  document.getElementById('acct-tx-submit-btn').innerHTML = '<i class="fas fa-pen"></i> 更新する';
  toggleRelatedAccountField(tx.type);
  toggleLinkSelectField(tx.type);
  showTxForm(true);
}

async function handleTxFormSubmit(e) {
  e.preventDefault();
  const account = acctState.accounts.find(a => a.id === acctState.activeAccountId);
  if (!account) { acctShowToast('口座が選択されていません', 'error'); return; }

  const date             = document.getElementById('acct-tx-date').value;
  const type             = document.getElementById('acct-tx-type').value;
  const amount           = parseFloat(document.getElementById('acct-tx-amount').value || '0');
  const category         = document.getElementById('acct-tx-category').value.trim();
  const description      = document.getElementById('acct-tx-desc').value.trim();
  const relatedAccountId = document.getElementById('acct-tx-related').value || '';
  const linkMode         = getLinkMode(type);

  if (!date)   { acctShowToast('日付を入力してください', 'error'); return; }
  if (!amount || amount <= 0) { acctShowToast('金額を入力してください', 'error'); return; }

  // 残高計算
  const isDebit    = type === 'withdrawal' || type === 'transfer_out';
  const oldTx      = acctState.editingTxId ? acctState.transactions.find(t => t.id === acctState.editingTxId) : null;
  let newBalance   = Number(account.balance || 0);

  if (oldTx) {
    // 編集：旧取引の影響を戻す
    const oldIsDebit = oldTx.type === 'withdrawal' || oldTx.type === 'transfer_out';
    newBalance += oldIsDebit ? Number(oldTx.amount) : -Number(oldTx.amount);
  }
  newBalance += isDebit ? -amount : amount;

  const txData = {
    account_id: acctState.activeAccountId,
    date, type, amount, category, description,
    related_account_id: relatedAccountId || '',
    link_mode: linkMode,
    linked_income_tx_id: '',
    linked_expense_tx_id: '',
    balance_after: newBalance,
  };

  // 家計簿連携: 種類名を収入カテゴリ(および支出カテゴリ)として使用
  const kakeiboIncomeCategory  = category || KAKEIBO_INCOME_CATEGORY_FALLBACK;
  const kakeiboExpenseCategory = category || KAKEIBO_EXPENSE_CATEGORY_FALLBACK;
  const kakeiboMemo = `${account.name}より${description ? ' / ' + description : ''}`;

  // 収入/支出カテゴリに未登録なら即時追加
  if (typeof state !== 'undefined') {
    if (linkMode >= LINK_MODE_INCOME && state.incomeCategories && !state.incomeCategories.includes(kakeiboIncomeCategory)) {
      state.incomeCategories.push(kakeiboIncomeCategory);
    }
    if (linkMode === LINK_MODE_INCOME_EXPENSE && state.expenseCategories && !state.expenseCategories.includes(kakeiboExpenseCategory)) {
      state.expenseCategories.push(kakeiboExpenseCategory);
    }
  }

  let linkedIncomeTxId = '';
  let linkedExpenseTxId = '';

  const btn = document.getElementById('acct-tx-submit-btn');
  btn.disabled = true;

  try {
    if (acctState.editingTxId) {
      // 編集: 旧連携取引を調整
      const oldIncomeId  = oldTx?.linked_income_tx_id || oldTx?.linked_tx_id || '';
      const oldExpenseId = oldTx?.linked_expense_tx_id || '';

      // 収入連携
      if (linkMode >= LINK_MODE_INCOME) {
        const kakeiboIncomeData = {
          date, amount, type: 'income',
          category: kakeiboIncomeCategory,
          memo: kakeiboMemo,
        };
        if (oldIncomeId) {
          const updated = await kakeiboPut(oldIncomeId, kakeiboIncomeData);
          linkedIncomeTxId = oldIncomeId;
          syncKakeiboState(oldIncomeId, updated);
        } else {
          const created = await kakeiboPost(kakeiboIncomeData);
          linkedIncomeTxId = created.id;
          pushKakeiboState(created);
        }
      } else if (oldIncomeId) {
        await kakeiboDelete(oldIncomeId);
        removeKakeiboState(oldIncomeId);
      }

      // 支出連携
      if (linkMode === LINK_MODE_INCOME_EXPENSE) {
        const kakeiboExpenseData = {
          date, amount, type: 'expense',
          category: kakeiboExpenseCategory,
          memo: kakeiboMemo,
        };
        if (oldExpenseId) {
          const updated = await kakeiboPut(oldExpenseId, kakeiboExpenseData);
          linkedExpenseTxId = oldExpenseId;
          syncKakeiboState(oldExpenseId, updated);
        } else {
          const created = await kakeiboPost(kakeiboExpenseData);
          linkedExpenseTxId = created.id;
          pushKakeiboState(created);
        }
      } else if (oldExpenseId) {
        await kakeiboDelete(oldExpenseId);
        removeKakeiboState(oldExpenseId);
      }

      txData.linked_income_tx_id  = linkedIncomeTxId;
      txData.linked_expense_tx_id = linkedExpenseTxId;

      const updated = await acctPut(`${ACCT_TX_TABLE}/${acctState.editingTxId}`, txData);
      const idx = acctState.transactions.findIndex(t => t.id === acctState.editingTxId);
      if (idx >= 0) acctState.transactions[idx] = { ...acctState.transactions[idx], ...updated };
      acctShowToast('取引を更新しました ✏️');
    } else {
      // 新規作成
      if (linkMode >= LINK_MODE_INCOME) {
        const kakeiboIncomeData = {
          date, amount, type: 'income',
          category: kakeiboIncomeCategory,
          memo: kakeiboMemo,
        };
        const created = await kakeiboPost(kakeiboIncomeData);
        linkedIncomeTxId = created.id;
        pushKakeiboState(created);
      }
      if (linkMode === LINK_MODE_INCOME_EXPENSE) {
        const kakeiboExpenseData = {
          date, amount, type: 'expense',
          category: kakeiboExpenseCategory,
          memo: kakeiboMemo,
        };
        const created = await kakeiboPost(kakeiboExpenseData);
        linkedExpenseTxId = created.id;
        pushKakeiboState(created);
      }

      txData.linked_income_tx_id  = linkedIncomeTxId;
      txData.linked_expense_tx_id = linkedExpenseTxId;

      const created = await acctPost(ACCT_TX_TABLE, txData);
      acctState.transactions.unshift(created);
      const linkLabel = linkMode === LINK_MODE_NONE ? '' : (linkMode === LINK_MODE_INCOME ? '（家計簿収入へ連携）' : '（家計簿入出金へ連携）');
      acctShowToast(`${isDebit ? '出金' : '入金'}を登録しました${linkLabel}`);
    }

    // 口座残高を更新
    const acctUpdated = await acctPut(`${ACCT_TABLE}/${acctState.activeAccountId}`, {
      ...account, balance: newBalance,
    });
    const acctIdx = acctState.accounts.findIndex(a => a.id === acctState.activeAccountId);
    if (acctIdx >= 0) acctState.accounts[acctIdx] = { ...acctState.accounts[acctIdx], ...acctUpdated };

    // 振込の場合、相手口座も更新
    if (relatedAccountId && (type === 'transfer_in' || type === 'transfer_out')) {
      const relAcct = acctState.accounts.find(a => a.id === relatedAccountId);
      if (relAcct) {
        const relIsCredit = type === 'transfer_out'; // 出金した側から見ると相手は入金
        const relNewBal   = Number(relAcct.balance || 0) + (relIsCredit ? amount : -amount);
        const relTxType   = type === 'transfer_out' ? 'transfer_in' : 'transfer_out';
        const relTxData   = {
          account_id: relatedAccountId, date, type: relTxType, amount, category, description,
          related_account_id: acctState.activeAccountId, balance_after: relNewBal,
        };
        // 編集時は既存の対応取引を削除して再作成（簡略実装）
        const relCreated = await acctPost(ACCT_TX_TABLE, relTxData);
        acctState.transactions.unshift(relCreated);
        await acctPut(`${ACCT_TABLE}/${relatedAccountId}`, { ...relAcct, balance: relNewBal });
        const rIdx = acctState.accounts.findIndex(a => a.id === relatedAccountId);
        if (rIdx >= 0) acctState.accounts[rIdx] = { ...acctState.accounts[rIdx], balance: relNewBal };
      }
    }

    resetTxForm();
    showTxForm(false);
    renderSummaryCards();
    renderAccountCardsList();
    renderAccountTxArea();
    if (typeof renderMonthlySummaryBar === 'function') renderMonthlySummaryBar();

  } catch (err) {
    acctShowToast('保存に失敗しました', 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

/* ─── 取引削除 ─── */
function acctConfirmDeleteTx(id) {
  const tx = acctState.transactions.find(t => t.id === id);
  if (!tx) return;
  // 削除確認モーダルを共用
  if (!confirm('この取引を削除しますか？\n口座残高も変更前に戻ります。')) return;
  acctDeleteTx(id);
}

async function acctDeleteTx(id) {
  const tx = acctState.transactions.find(t => t.id === id);
  if (!tx) return;

  try {
    // 家計簿連携取引があれば削除(収入・支出の2件)
    const linkedIds = [tx.linked_income_tx_id, tx.linked_expense_tx_id, tx.linked_tx_id].filter(Boolean);
    for (const lid of linkedIds) {
      try { await kakeiboDelete(lid); } catch (e) { /* 無視 */ }
      removeKakeiboState(lid);
    }

    await acctDelete(`${ACCT_TX_TABLE}/${id}`);
    acctState.transactions = acctState.transactions.filter(t => t.id !== id);

    // 残高を戻す
    const account = acctState.accounts.find(a => a.id === tx.account_id);
    if (account) {
      const isDebit  = tx.type === 'withdrawal' || tx.type === 'transfer_out';
      const restored = Number(account.balance || 0) + (isDebit ? Number(tx.amount) : -Number(tx.amount));
      const updated  = await acctPut(`${ACCT_TABLE}/${account.id}`, { ...account, balance: restored });
      const idx = acctState.accounts.findIndex(a => a.id === account.id);
      if (idx >= 0) acctState.accounts[idx] = { ...acctState.accounts[idx], ...updated };
    }

    acctShowToast('取引を削除しました 🗑️');
    renderSummaryCards();
    renderAccountCardsList();
    renderAccountTxArea();
    if (typeof renderMonthlySummaryBar === 'function') renderMonthlySummaryBar();
  } catch {
    acctShowToast('削除に失敗しました', 'error');
  }
}

/* ─────────────────────────────────────────
   トースト（app.js の showToast と共存）
───────────────────────────────────────── */
function acctShowToast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
  const container = document.getElementById('toast-container');
  if (container) container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

/* ─────────────────────────────────────────
   イベントバインド（DOMContentLoaded後）
───────────────────────────────────────── */
function bindAccountEvents() {
  // 口座追加ボタン
  document.getElementById('show-add-acct-btn').addEventListener('click', () => {
    resetAccountForm();
    showAccountForm(true);
  });

  // フォームを閉じるボタン
  document.getElementById('acct-form-close-btn').addEventListener('click', () => {
    resetAccountForm();
    showAccountForm(false);
  });
  document.getElementById('acct-cancel-btn').addEventListener('click', () => {
    resetAccountForm();
    showAccountForm(false);
  });

  // 口座フォーム送信
  document.getElementById('account-form').addEventListener('submit', handleAccountFormSubmit);

  // 取引追加ボタン
  document.getElementById('add-acct-tx-btn').addEventListener('click', () => {
    if (!acctState.activeAccountId) return;
    resetTxForm();
    showTxForm(true);
  });

  // 取引フォームキャンセル
  document.getElementById('acct-tx-cancel-btn').addEventListener('click', () => {
    resetTxForm();
    showTxForm(false);
  });

  // 取引フォーム送信
  document.getElementById('acct-tx-form').addEventListener('submit', handleTxFormSubmit);

  // 取引種別変更 → 相手口座フィールド切替 + 連携セレクト切替
  document.getElementById('acct-tx-type').addEventListener('change', e => {
    toggleRelatedAccountField(e.target.value);
    toggleLinkSelectField(e.target.value);
  });

  // 取引フィルター
  document.getElementById('acct-tx-filter-type').addEventListener('change', e => {
    acctState.txTypeFilter = e.target.value;
    acctState.txPage = 1;
    renderAccountTxArea();
  });
}

/* ─────────────────────────────────────────
   初期化 (DOMContentLoaded)
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  bindAccountEvents();
});
