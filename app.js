// ---- Constants ----
const FIXED_COLUMNS = ['id', 'firstname', 'lastname', 'email'];
const FIXED_COUNT = FIXED_COLUMNS.length;
const IGNORED_KEYWORDS = ['time'];

// ---- State ----
let csvHeaders = [];
let csvRows = [];
let questionColumns = [];
let results = [];
let currentPage = 1;
let currentFilter = 'all';
let currentMinScore = 0;

// ---- DOM ----
const uploadArea = document.getElementById('uploadArea');
const csvInput = document.getElementById('csvInput');
const fileList = document.getElementById('fileList');
const settingsCard = document.getElementById('settingsCard');
const resultsCard = document.getElementById('resultsCard');
const csvPreview = document.getElementById('csvPreview');
const calcBtn = document.getElementById('calcBtn');
const resetBtn = document.getElementById('resetBtn');
const defaultMinScore = document.getElementById('defaultMinScore');
const passScore = document.getElementById('passScore');
const resultHead = document.getElementById('resultHead');
const resultBody = document.getElementById('resultBody');
const statsGrid = document.getElementById('statsGrid');
const filterTabs = document.getElementById('filterTabs');
const exportBtn = document.getElementById('exportBtn');
const pagination = document.getElementById('pagination');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageSizeSelect = document.getElementById('pageSize');

// ---- CSV Upload ----
uploadArea.addEventListener('click', () => csvInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});
csvInput.addEventListener('change', e => { if (e.target.files.length) handleFiles(e.target.files); });

function handleFiles(files) {
  const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
  if (csvFiles.length === 0) return alert('請上傳 CSV 檔案');

  fileList.innerHTML = csvFiles.map(f =>
    `<span class="file-chip"><span class="material-symbols-outlined" style="font-size:14px;">description</span>${f.name}</span>`
  ).join('');
  fileList.classList.remove('hidden');

  const readPromises = csvFiles.map(f => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsText(f, 'UTF-8');
  }));

  Promise.all(readPromises).then(texts => {
    // Parse first file to get headers
    const firstLines = texts[0].split(/\r?\n/).filter(l => l.trim());
    if (firstLines.length < 2) return alert('CSV 至少需要標題列和一筆資料');

    csvHeaders = parseCSVLine(firstLines[0]);
    csvRows = firstLines.slice(1).map(l => parseCSVLine(l));

    // Merge additional files (skip their header rows)
    for (let i = 1; i < texts.length; i++) {
      const lines = texts[i].split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) continue;
      csvRows.push(...lines.slice(1).map(l => parseCSVLine(l)));
    }

    detectColumnsAndPreview(csvFiles.length);
  });
}

function detectColumnsAndPreview(fileCount) {
  // Auto-detect: first 4 columns are fixed, rest are questions (skip ignored keywords)
  questionColumns = csvHeaders
    .map((h, i) => ({ name: h, index: i }))
    .filter(c => c.index >= FIXED_COUNT)
    .filter(c => !IGNORED_KEYWORDS.some(kw => c.name.toLowerCase().includes(kw)));

  // Show preview info
  csvPreview.classList.remove('hidden');
  csvPreview.innerHTML = `
    <div class="preview-row">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-sys-color-primary);">folder</span>
      已載入 <strong>${fileCount}</strong> 個檔案
    </div>
    <div class="preview-row">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-sys-color-primary);">people</span>
      共 <strong>${csvRows.length}</strong> 筆學生資料
    </div>
    <div class="preview-row">
      <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-sys-color-primary);">quiz</span>
      偵測到 <strong>${questionColumns.length}</strong> 個題目欄位：${questionColumns.map(c => `<span class="preview-chip">${c.name}</span>`).join(' ')}
    </div>
  `;

  settingsCard.classList.remove('hidden');
  resultsCard.classList.add('hidden');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(current.trim()); current = ''; }
      else current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ---- Calculate ----
calcBtn.addEventListener('click', calculate);

function getStudentName(row) {
  const first = (row[1] || '').trim();
  const last = (row[2] || '').trim();
  return `${last}${first}` || row[0] || '(未命名)';
}

function calculate() {
  const passAvg = parseFloat(passScore.value) || 60;
  const minScore = parseFloat(defaultMinScore.value) || 0;

  results = csvRows.map(row => {
    const name = getStudentName(row);
    const email = (row[3] || '').trim();
    let sum = 0;
    let allAboveMin = true;
    const scores = {};

    questionColumns.forEach(q => {
      const raw = parseFloat(row[q.index]);
      const score = isNaN(raw) ? 0 : raw;
      scores[q.name] = score;

      if (score < minScore) {
        allAboveMin = false;
      }
      sum += score;
    });

    const avg = questionColumns.length > 0 ? sum / questionColumns.length : 0;
    const passed = allAboveMin && avg >= passAvg;

    return { name, email, scores, avg, allAboveMin, passed };
  });

  renderResults(minScore);
  resultsCard.classList.remove('hidden');
  resultsCard.scrollIntoView({ behavior: 'smooth' });
}

function renderResults(minScore) {
  const totalStudents = results.length;
  const passCount = results.filter(r => r.passed).length;
  const failCount = totalStudents - passCount;
  const passRate = totalStudents > 0
    ? ((passCount / totalStudents) * 100).toFixed(1) : 0;

  statsGrid.innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalStudents}</div><div class="stat-label">總人數</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--md-sys-color-success)">${passCount}</div><div class="stat-label">通過</div></div>
    <div class="stat-card"><div class="stat-value" style="color:var(--md-sys-color-error)">${failCount}</div><div class="stat-label">未通過</div></div>
    <div class="stat-card"><div class="stat-value">${passRate}%</div><div class="stat-label">通過率</div></div>
  `;

  resultHead.innerHTML = `<tr>
    <th>姓名</th>
    <th>Email</th>
    ${questionColumns.map(q => `<th>${q.name}</th>`).join('')}
    <th>平均</th>
    <th>結果</th>
  </tr>`;

  currentMinScore = minScore;
  currentFilter = 'all';
  currentPage = 1;
  renderFilteredRows();

  filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
    tab.onclick = () => {
      filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      renderFilteredRows();
    };
  });
}

function getFilteredResults() {
  return currentFilter === 'all' ? results
    : currentFilter === 'pass' ? results.filter(r => r.passed)
    : results.filter(r => !r.passed);
}

function renderFilteredRows() {
  const filtered = getFilteredResults();
  const pageSize = parseInt(pageSizeSelect.value);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  resultBody.innerHTML = pageData.map(r => `<tr>
    <td style="font-weight:500;">${r.name}</td>
    <td style="font-size:13px;color:var(--md-sys-color-on-surface-variant);">${r.email}</td>
    ${questionColumns.map(q => {
      const score = r.scores[q.name];
      const isLow = score < currentMinScore;
      return `<td class="${isLow ? 'score-low' : 'score-ok'}">${score}${isLow ? ' ✗' : ''}</td>`;
    }).join('')}
    <td style="font-weight:500;">${r.avg.toFixed(1)}</td>
    <td>${r.passed
      ? '<span class="chip-pass"><span class="material-symbols-outlined" style="font-size:14px;">check_circle</span>通過</span>'
      : '<span class="chip-fail"><span class="material-symbols-outlined" style="font-size:14px;">cancel</span>未通過</span>'
    }</td>
  </tr>`).join('');

  // Update pagination controls
  if (filtered.length > parseInt(pageSizeSelect.value)) {
    pagination.classList.remove('hidden');
  } else {
    pagination.classList.add('hidden');
  }
  pageInfo.textContent = `第 ${currentPage} / ${totalPages} 頁（共 ${filtered.length} 筆）`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// ---- Pagination Events ----
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) { currentPage--; renderFilteredRows(); }
});
nextPageBtn.addEventListener('click', () => {
  const filtered = getFilteredResults();
  const totalPages = Math.ceil(filtered.length / parseInt(pageSizeSelect.value));
  if (currentPage < totalPages) { currentPage++; renderFilteredRows(); }
});
pageSizeSelect.addEventListener('change', () => {
  currentPage = 1;
  renderFilteredRows();
});

// ---- Export ----
function downloadCSV(data, filename) {
  const csv = data.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener('click', () => {
  if (!results.length) return;
  const qNames = questionColumns.map(q => q.name);
  const header = ['姓名', 'Email', ...qNames, '平均', '結果'];
  const rows = results.map(r => [
    r.name, r.email, ...qNames.map(q => r.scores[q]), r.avg.toFixed(1), r.passed ? '通過' : '未通過'
  ]);
  downloadCSV([header, ...rows], '成績結果.csv');
});

document.getElementById('exportPassBtn').addEventListener('click', () => {
  if (!results.length) return;
  const passed = results.filter(r => r.passed);
  if (!passed.length) return alert('沒有通過的學生');
  const qNames = questionColumns.map(q => q.name);
  const header = ['姓名', 'Email', ...qNames, '平均'];
  const rows = passed.map(r => [
    r.name, r.email, ...qNames.map(q => r.scores[q]), r.avg.toFixed(1)
  ]);
  downloadCSV([header, ...rows], '通過名單.csv');
});

// ---- Reset ----
resetBtn.addEventListener('click', () => {
  csvHeaders = [];
  csvRows = [];
  questionColumns = [];
  results = [];
  fileList.classList.add('hidden');
  fileList.innerHTML = '';
  csvPreview.classList.add('hidden');
  settingsCard.classList.add('hidden');
  resultsCard.classList.add('hidden');
  csvInput.value = '';
});
