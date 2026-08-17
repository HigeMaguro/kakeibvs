/**
 * MyKakeibo – スマホ専用伝票入力画面
 * js/mobile-input.js
 */

'use strict';

// ─────────────────────────────────────────
// 定数・設定
// ─────────────────────────────────────────
const API_BASE  = 'tables';
const TABLE_TX  = 'transactions';
const MAX_DIGITS = 10;

const EXPENSE_CATS_DEFAULT = ['食費','交通費','光熱費','通信費','日用品','医療費','娯楽','衣服','外食','教育','保険','住居','その他'];
const INCOME_CATS_DEFAULT  = ['給与','副業','ボーナス','投資','その他収入'];

const CAT_ICONS = {
  '食費':'🍚','交通費':'🚃','光熱費':'💡','通信費':'📱','日用品':'🧹',
  '医療費':'💊','娯楽':'🎮','衣服':'👕','外食':'🍜','教育':'📚',
  '保険':'🛡️','住居':'🏠','その他':'📦','給与':'💼','副業':'💻',
  'ボーナス':'🎁','投資':'📈','その他収入':'💰',
};

const MEMO_SUGGESTIONS_EXPENSE = ['コンビニ','スーパー','ランチ','カフェ','薬局','電車代','ガソリン','外食','病院','書籍'];
const MEMO_SUGGESTIONS_INCOME  = ['給与','賞与','フリーランス','売上','配当'];

const STORAGE_KEY_EX_CATS = 'mkb_expense_cats';
const STORAGE_KEY_IN_CATS = 'mkb_income_cats';
const STORAGE_KEY_MEMOS   = 'mkb_recent_memos';

// ─────────────────────────────────────────
// アプリ状態
// ─────────────────────────────────────────
const s = {
  type:             'expense',        // 'expense' | 'income'
  rawAmount:        '',               // テンキー入力文字列
  selectedCategory: '',
  selectedDate:     todayStr(),
  dateOffset:       0,                // -1=昨日, 0=今日, 1=明日
  expenseCats:      loadCats('expense'),
  incomeCats:       loadCats('income'),
  todayTxs:         [],               // 今日登録した取引（履歴パネル用）
  detailOpen:       false,
  historyOpen:      false,
};

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

function offsetDateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatYen(n) { return '¥' + Number(n).toLocaleString('ja-JP'); }

function formatDateJP(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const days = ['日','月','火','水','木','金','土'];
  const dt = new Date(+y, +m - 1, +d);
  return `${+m}/${+d}(${days[dt.getDay()]})`;
}

// ─────────────────────────────────────────
// localStorage カテゴリ保存・読み込み
// ─────────────────────────────────────────
function loadCats(type) {
  try {
    const key  = type === 'expense' ? STORAGE_KEY_EX_CATS : STORAGE_KEY_IN_CATS;
    const defs = type === 'expense' ? EXPENSE_CATS_DEFAULT : INCOME_CATS_DEFAULT;
    const raw  = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // デフォルトカテゴリが消えていたら先頭に補完
      const merged = [...new Set([...defs.filter(d => parsed.includes(d)), ...parsed])];
      return merged;
    }
  } catch {}
  return type === 'expense' ? [...EXPENSE_CATS_DEFAULT] : [...INCOME_CATS_DEFAULT];
}

function saveCats(type) {
  const key = type === 'expense' ? STORAGE_KEY_EX_CATS : STORAGE_KEY_IN_CATS;
  const arr = type === 'expense' ? s.expenseCats : s.incomeCats;
  localStorage.setItem(key, JSON.stringify(arr));
}

// ─────────────────────────────────────────
// localStorage メモ履歴
// ─────────────────────────────────────────
function loadRecentMemos() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MEMOS) || '[]'); }
  catch { return []; }
}

function saveRecentMemo(memo) {
  if (!memo) return;
  let memos = loadRecentMemos().filter(m => m !== memo);
  memos.unshift(memo);
  memos = memos.slice(0, 10);
  localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(memos));
}

// ─────────────────────────────────────────
// API
// ─────────────────────────────────────────
async function apiPost(data) {
  const res = await fetch(`${API_BASE}/${TABLE_TX}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('登録失敗');
  return await res.json();
}

async function apiGetToday() {
  const today = todayStr();
  const res = await fetch(`${API_BASE}/${TABLE_TX}?limit=200`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data || []).filter(t => t.date === today)
                          .sort((a,b) => b.created_at - a.created_at);
}

// ─────────────────────────────────────────
// DOM 参照
// ─────────────────────────────────────────
const $ = id => document.getElementById(id);
const amountDisplay  = $('amount-display');
const amountValueEl  = $('amount-value');
const amountLabelEl  = $('amount-type-label');
const amountErrorEl  = $('amount-error');
const detailPanel    = $('detail-panel');
const detailBackdrop = $('detail-backdrop');
const historyPanel   = $('history-panel');
const histBackdrop   = $('history-backdrop');
const panelDate      = $('panel-date');
const categoryChips  = $('category-chips');
const panelMemo      = $('panel-memo');
const memoSugg       = $('memo-suggestions');
const submitBtn      = $('submit-btn');
const historyList    = $('history-list');
const historyEmpty   = $('history-empty');
const historyTotal   = $('history-total');
const successOverlay = $('success-overlay');
const successMsg     = $('success-msg');
const successSub     = $('success-sub');
const continuousMode = $('continuous-mode');

// ─────────────────────────────────────────
// 金額入力（テンキー）
// ─────────────────────────────────────────
function updateAmountDisplay() {
  const num = parseInt(s.rawAmount || '0', 10);
  amountValueEl.textContent = num.toLocaleString('ja-JP');
  amountDisplay.className = 'amount-display' +
    (s.rawAmount ? ' has-value' : '') +
    ` ${s.type}`;
}

function handleNumpad(val) {
  amountErrorEl.style.display = 'none';

  if (val === 'C') {
    s.rawAmount = '';
    updateAmountDisplay();
    return;
  }
  if (val === 'DEL') {
    s.rawAmount = s.rawAmount.slice(0, -1);
    updateAmountDisplay();
    return;
  }
  if (val === 'NEXT') {
    if (!s.rawAmount || parseInt(s.rawAmount, 10) === 0) {
      amountErrorEl.style.display = 'block';
      // 振動フィードバック
      if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
      return;
    }
    openDetailPanel();
    return;
  }
  // 数字入力
  if (s.rawAmount.length >= MAX_DIGITS) return;
  if (s.rawAmount === '' && val === '0') return;    // 先頭ゼロ防止
  if (s.rawAmount === '' && val === '000') return;
  if (val === '000') {
    if (s.rawAmount.length + 3 > MAX_DIGITS) return;
    s.rawAmount += '000';
  } else if (val === '00') {
    if (s.rawAmount.length + 2 > MAX_DIGITS) return;
    s.rawAmount += '00';
  } else {
    s.rawAmount += val;
  }
  updateAmountDisplay();
}

// ─────────────────────────────────────────
// 収入／支出 切替
// ─────────────────────────────────────────
function setType(type) {
  s.type = type;
  s.selectedCategory = '';

  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  amountLabelEl.textContent = type === 'expense' ? '支出金額' : '収入金額';
  updateAmountDisplay();
  renderCategoryChips();
  renderMemoSuggestions();
  updateSubmitBtnStyle();
}

// ─────────────────────────────────────────
// 詳細パネル
// ─────────────────────────────────────────
function openDetailPanel() {
  s.detailOpen = true;
  panelDate.value = s.selectedDate;
  renderCategoryChips();
  renderMemoSuggestions();
  updateSubmitBtnStyle();

  detailBackdrop.style.display = 'block';
  detailPanel.style.display    = 'flex';
  detailPanel.classList.remove('closing');
}

function closeDetailPanel() {
  if (!s.detailOpen) return;
  detailPanel.classList.add('closing');
  setTimeout(() => {
    detailPanel.style.display    = 'none';
    detailBackdrop.style.display = 'none';
    detailPanel.classList.remove('closing');
    s.detailOpen = false;
  }, 240);
}

function updateSubmitBtnStyle() {
  submitBtn.className = 'submit-btn ' + (s.type === 'expense' ? 'expense-mode' : 'income-mode');
}

// ─────────────────────────────────────────
// 日付クイック選択
// ─────────────────────────────────────────
function setDateOffset(offset) {
  s.dateOffset = offset;
  s.selectedDate = offsetDateStr(offset);
  panelDate.value = s.selectedDate;

  document.querySelectorAll('.date-quick-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.offset) === offset);
  });
}

// ─────────────────────────────────────────
// カテゴリチップ描画
// ─────────────────────────────────────────
function renderCategoryChips() {
  const cats = s.type === 'expense' ? s.expenseCats : s.incomeCats;
  categoryChips.innerHTML = cats.map(cat => {
    const icon = CAT_ICONS[cat] || '🏷️';
    const isSel = cat === s.selectedCategory;
    const typeClass = s.type === 'income' ? 'income-chip' : '';
    return `<button class="cat-chip${isSel ? ' selected ' + typeClass : ''}" data-cat="${cat}">
      ${icon} ${cat}
    </button>`;
  }).join('');

  categoryChips.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => selectCategory(btn.dataset.cat));
  });
}

function selectCategory(cat) {
  s.selectedCategory = cat;
  renderCategoryChips();
  if (navigator.vibrate) navigator.vibrate(20);
}

// ─────────────────────────────────────────
// メモ候補描画
// ─────────────────────────────────────────
function renderMemoSuggestions() {
  const recentMemos   = loadRecentMemos();
  const defaultSuggs  = s.type === 'expense' ? MEMO_SUGGESTIONS_EXPENSE : MEMO_SUGGESTIONS_INCOME;
  // 直近メモを先頭に、デフォルト候補を続ける（重複除去）
  const merged = [...new Set([...recentMemos.slice(0, 4), ...defaultSuggs])].slice(0, 8);

  memoSugg.innerHTML = merged.map(m =>
    `<button class="memo-sug-btn" data-memo="${m}">${m}</button>`
  ).join('');

  memoSugg.querySelectorAll('.memo-sug-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      panelMemo.value = btn.dataset.memo;
      panelMemo.focus();
    });
  });
}

// ─────────────────────────────────────────
// 登録処理
// ─────────────────────────────────────────
async function handleSubmit() {
  const amount   = parseInt(s.rawAmount || '0', 10);
  const category = s.selectedCategory;
  const date     = panelDate.value || s.selectedDate;
  const memo     = panelMemo.value.trim();

  // バリデーション
  if (!amount || amount <= 0) {
    showToast('金額を入力してください', 'error'); return;
  }
  if (!category) {
    showToast('カテゴリを選択してください', 'error');
    // チップエリアを軽くスクロール表示
    categoryChips.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (!date) {
    showToast('日付を選択してください', 'error'); return;
  }

  submitBtn.disabled = true;

  try {
    const created = await apiPost({ date, type: s.type, category, amount, memo });
    s.todayTxs.unshift(created);
    if (memo) saveRecentMemo(memo);

    // 完了フィードバック
    showSuccessOverlay(s.type, category, amount);

    const continuous = continuousMode.checked;
    if (continuous) {
      // 連続入力モード: フォームをリセット
      setTimeout(() => {
        hideSuccessOverlay();
        resetForm();
      }, 900);
    } else {
      // 通常モード: 詳細パネルを閉じる
      closeDetailPanel();
      setTimeout(hideSuccessOverlay, 1100);
      resetAmountOnly();
    }

    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

  } catch (err) {
    showToast('登録に失敗しました。通信状況をご確認ください。', 'error');
    submitBtn.disabled = false;
  }
}

function resetAmountOnly() {
  s.rawAmount = '';
  updateAmountDisplay();
  submitBtn.disabled = false;
}

function resetForm() {
  s.rawAmount = '';
  s.selectedCategory = '';
  s.selectedDate = todayStr();
  s.dateOffset = 0;
  panelMemo.value = '';
  panelDate.value = s.selectedDate;
  updateAmountDisplay();
  renderCategoryChips();
  renderMemoSuggestions();
  // 日付クイックボタンリセット
  document.querySelectorAll('.date-quick-btn').forEach(b => {
    b.classList.toggle('active', Number(b.dataset.offset) === 0);
  });
  submitBtn.disabled = false;
}

// ─────────────────────────────────────────
// 完了オーバーレイ
// ─────────────────────────────────────────
function showSuccessOverlay(type, category, amount) {
  const icon = successOverlay.querySelector('.success-icon');
  icon.className = `success-icon${type === 'expense' ? ' expense' : ''}`;

  successMsg.textContent = type === 'expense' ? '支出を登録しました！' : '収入を登録しました！';
  successSub.textContent = `${CAT_ICONS[category] || '💴'} ${category}  ${formatYen(amount)}`;
  successOverlay.style.display = 'flex';
}

function hideSuccessOverlay() {
  successOverlay.style.display = 'none';
}

// ─────────────────────────────────────────
// 履歴パネル
// ─────────────────────────────────────────
function openHistoryPanel() {
  s.historyOpen = true;
  histBackdrop.style.display  = 'block';
  historyPanel.style.display  = 'flex';
  historyPanel.classList.remove('closing');
  renderHistoryList();
}

function closeHistoryPanel() {
  if (!s.historyOpen) return;
  historyPanel.classList.add('closing');
  setTimeout(() => {
    historyPanel.style.display  = 'none';
    histBackdrop.style.display  = 'none';
    historyPanel.classList.remove('closing');
    s.historyOpen = false;
  }, 240);
}

function renderHistoryList() {
  if (s.todayTxs.length === 0) {
    historyList.innerHTML = '';
    historyEmpty.style.display = 'block';
    historyTotal.textContent   = '';
    return;
  }
  historyEmpty.style.display = 'none';

  const totalExpense = s.todayTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const totalIncome  = s.todayTxs.filter(t=>t.type==='income' ).reduce((s,t)=>s+Number(t.amount),0);
  historyTotal.textContent = `支出 ${formatYen(totalExpense)} / 収入 ${formatYen(totalIncome)}`;

  historyList.innerHTML = s.todayTxs.map(tx => `
    <div class="history-item">
      <div class="hist-icon ${tx.type}">${CAT_ICONS[tx.category] || '💴'}</div>
      <div class="hist-details">
        <div class="hist-cat">${tx.category}</div>
        <div class="hist-meta">${formatDateJP(tx.date)}${tx.memo ? ' · ' + tx.memo : ''}</div>
      </div>
      <div class="hist-amount ${tx.type}">
        ${tx.type === 'income' ? '+' : '−'}${formatYen(tx.amount)}
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
// カテゴリ追加モーダル
// ─────────────────────────────────────────
const catModalOverlay = $('cat-modal-overlay');
const newCatInput     = $('new-cat-input');

function openCatModal() {
  catModalOverlay.style.display = 'flex';
  newCatInput.value = '';
  setTimeout(() => newCatInput.focus(), 80);
}
function closeCatModal() { catModalOverlay.style.display = 'none'; }

function addCategory() {
  const name = newCatInput.value.trim();
  if (!name) { showToast('カテゴリ名を入力してください', 'error'); return; }

  const arr = s.type === 'expense' ? s.expenseCats : s.incomeCats;
  if (arr.includes(name)) { showToast('同じカテゴリが既に存在します', 'info'); return; }

  arr.push(name);
  CAT_ICONS[name] = '🏷️';
  saveCats(s.type);

  closeCatModal();
  s.selectedCategory = name;
  renderCategoryChips();
  showToast(`「${name}」を追加しました`);
}

// ─────────────────────────────────────────
// トースト
// ─────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = $('mob-toast-container');
  const toast = document.createElement('div');
  toast.className = `mob-toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastFade 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─────────────────────────────────────────
// キーボードショートカット（デスクトップ）
// ─────────────────────────────────────────
function handleKeyboard(e) {
  if (catModalOverlay.style.display === 'flex') {
    if (e.key === 'Enter')  { e.preventDefault(); addCategory(); }
    if (e.key === 'Escape') closeCatModal();
    return;
  }
  if (s.detailOpen) {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') closeDetailPanel();
    return;
  }
  if (s.historyOpen) {
    if (e.key === 'Escape') closeHistoryPanel();
    return;
  }
  // テンキー操作
  if (/^[0-9]$/.test(e.key)) handleNumpad(e.key);
  if (e.key === 'Backspace') handleNumpad('DEL');
  if (e.key === 'Delete')    handleNumpad('C');
  if (e.key === 'Enter')     handleNumpad('NEXT');
}

// ─────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────
async function init() {
  // 今日の既存取引を取得（履歴表示用）
  try {
    s.todayTxs = await apiGetToday();
  } catch {}

  // テンキーイベント
  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.addEventListener('click', () => handleNumpad(btn.dataset.val));
  });

  // 収支タブ
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => setType(btn.dataset.type));
  });

  // 詳細パネル：バックドロップ
  detailBackdrop.addEventListener('click', closeDetailPanel);

  // 詳細パネル：日付
  document.querySelectorAll('.date-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => setDateOffset(Number(btn.dataset.offset)));
  });
  panelDate.addEventListener('change', e => {
    s.selectedDate = e.target.value;
    s.dateOffset   = null;
    document.querySelectorAll('.date-quick-btn').forEach(b => b.classList.remove('active'));
  });

  // 詳細パネル：カテゴリ追加
  $('add-cat-btn').addEventListener('click', openCatModal);
  $('cat-modal-cancel').addEventListener('click', closeCatModal);
  $('cat-modal-add').addEventListener('click', addCategory);
  newCatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); addCategory(); }
    if (e.key === 'Escape') closeCatModal();
  });

  // 詳細パネル：登録ボタン
  submitBtn.addEventListener('click', handleSubmit);

  // 履歴パネル
  $('history-toggle-btn').addEventListener('click', openHistoryPanel);
  histBackdrop.addEventListener('click', closeHistoryPanel);

  // キーボード
  document.addEventListener('keydown', handleKeyboard);

  // 完了オーバーレイタップ
  successOverlay.addEventListener('click', hideSuccessOverlay);

  // 初期表示
  updateAmountDisplay();
  panelDate.value = s.selectedDate;
  setDateOffset(0);
}

document.addEventListener('DOMContentLoaded', init);
