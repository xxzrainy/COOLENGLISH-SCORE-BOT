// ---- Constants ----
const FIXED_COLUMNS = ['id', 'firstname', 'lastname', 'email'];
const FIXED_COUNT = FIXED_COLUMNS.length;

// ---- Shared Utilities ----

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

function parseCSVFiles(texts) {
  const firstLines = texts[0].split(/\r?\n/).filter(l => l.trim());
  if (firstLines.length < 2) { alert('CSV 至少需要標題列和一筆資料'); return null; }

  const headers = parseCSVLine(firstLines[0]);
  const rows = firstLines.slice(1).map(l => parseCSVLine(l));

  for (let i = 1; i < texts.length; i++) {
    const lines = texts[i].split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) continue;
    rows.push(...lines.slice(1).map(l => parseCSVLine(l)));
  }

  return { headers, rows };
}

function getStudentName(row) {
  const first = (row[1] || '').trim();
  const last = (row[2] || '').trim();
  return `${last}${first}` || row[0] || '(未命名)';
}

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

function setupUpload(uploadArea, fileInput, onFilesReady) {
  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files, uploadArea, onFilesReady);
  });
  fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleUpload(e.target.files, uploadArea, onFilesReady);
  });
}

function handleUpload(files, uploadArea, onFilesReady) {
  const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
  if (csvFiles.length === 0) return alert('請上傳 CSV 檔案');

  const fileListEl = uploadArea.querySelector('.file-list');
  fileListEl.innerHTML = csvFiles.map(f =>
    `<span class="file-chip"><span class="material-symbols-outlined" style="font-size:14px;">description</span>${f.name}</span>`
  ).join('');
  fileListEl.classList.remove('hidden');

  const readPromises = csvFiles.map(f => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsText(f, 'UTF-8');
  }));

  Promise.all(readPromises).then(texts => {
    const parsed = parseCSVFiles(texts);
    if (parsed) onFilesReady(parsed, csvFiles.length);
  });
}

function setupPagination({ prevBtn, nextBtn, pageSizeSelect, getFilteredResults, renderRows }) {
  let currentPage = 1;

  function render() {
    renderRows(currentPage, parseInt(pageSizeSelect.value));
  }

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; render(); }
  });
  nextBtn.addEventListener('click', () => {
    const filtered = getFilteredResults();
    const totalPages = Math.ceil(filtered.length / parseInt(pageSizeSelect.value));
    if (currentPage < totalPages) { currentPage++; render(); }
  });
  pageSizeSelect.addEventListener('change', () => {
    currentPage = 1;
    render();
  });

  return {
    reset() { currentPage = 1; render(); },
    get page() { return currentPage; },
    set page(v) { currentPage = v; }
  };
}

// ---- Mode Tab Switching ----
const modeTabs = document.querySelectorAll('.mode-tab');
const scoreMode = document.getElementById('scoreMode');
const selfStudyMode = document.getElementById('selfStudyMode');

modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const mode = tab.dataset.mode;
    scoreMode.classList.toggle('hidden', mode !== 'score');
    selfStudyMode.classList.toggle('hidden', mode !== 'self-study');
  });
});
