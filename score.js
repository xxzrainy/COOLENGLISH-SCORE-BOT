// ---- Score Module ----
(function () {
  const IGNORED_KEYWORDS = ['time'];

  // State
  let csvHeaders = [];
  let csvRows = [];
  let questionColumns = [];
  let results = [];
  let currentFilter = 'all';
  let currentMinScore = 0;

  // DOM
  const uploadArea = document.getElementById('scoreUploadArea');
  const csvInput = document.getElementById('scoreCsvInput');
  const settingsCard = document.getElementById('scoreSettingsCard');
  const resultsCard = document.getElementById('scoreResultsCard');
  const csvPreview = document.getElementById('scoreCsvPreview');
  const calcBtn = document.getElementById('scoreCalcBtn');
  const resetBtn = document.getElementById('scoreResetBtn');
  const defaultMinScoreInput = document.getElementById('defaultMinScore');
  const passScoreInput = document.getElementById('passScore');
  const resultHead = document.getElementById('scoreResultHead');
  const resultBody = document.getElementById('scoreResultBody');
  const statsGrid = document.getElementById('scoreStatsGrid');
  const filterTabs = document.getElementById('scoreFilterTabs');
  const exportBtn = document.getElementById('scoreExportBtn');
  const exportPassBtn = document.getElementById('scoreExportPassBtn');
  const pagination = document.getElementById('scorePagination');
  const pageInfo = document.getElementById('scorePageInfo');
  const prevPageBtn = document.getElementById('scorePrevPage');
  const nextPageBtn = document.getElementById('scoreNextPage');
  const pageSizeSelect = document.getElementById('scorePageSize');

  // Upload
  setupUpload(uploadArea, csvInput, (parsed, fileCount) => {
    csvHeaders = parsed.headers;
    csvRows = parsed.rows;
    detectColumnsAndPreview(fileCount);
  });

  function detectColumnsAndPreview(fileCount) {
    questionColumns = csvHeaders
      .map((h, i) => ({ name: h, index: i }))
      .filter(c => c.index >= FIXED_COUNT)
      .filter(c => !IGNORED_KEYWORDS.some(kw => c.name.toLowerCase().includes(kw)));

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
        偵測到 <strong>${questionColumns.length}</strong> 個題目欄位：
      </div>
      <div class="preview-chips-wrapper">
        ${questionColumns.map(c => `<span class="preview-chip">${c.name}</span>`).join('')}
      </div>
    `;

    settingsCard.classList.remove('hidden');
    resultsCard.classList.add('hidden');
  }

  // Calculate
  calcBtn.addEventListener('click', calculate);

  function calculate() {
    const passAvg = parseFloat(passScoreInput.value) || 60;
    const minScore = parseFloat(defaultMinScoreInput.value) || 0;

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
        if (score < minScore) allAboveMin = false;
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

  // Render
  function getFilteredResults() {
    return currentFilter === 'all' ? results
      : currentFilter === 'pass' ? results.filter(r => r.passed)
      : results.filter(r => !r.passed);
  }

  const pager = setupPagination({
    prevBtn: prevPageBtn,
    nextBtn: nextPageBtn,
    pageSizeSelect,
    getFilteredResults,
    renderRows
  });

  function renderResults(minScore) {
    const totalStudents = results.length;
    const passCount = results.filter(r => r.passed).length;
    const failCount = totalStudents - passCount;
    const passRate = totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(1) : 0;

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
    pager.reset();

    filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => {
        filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        pager.page = 1;
        pager.reset();
      };
    });
  }

  function renderRows(page, pageSize) {
    const filtered = getFilteredResults();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (page > totalPages) { pager.page = totalPages; page = totalPages; }

    const start = (page - 1) * pageSize;
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

    if (filtered.length > pageSize) {
      pagination.classList.remove('hidden');
    } else {
      pagination.classList.add('hidden');
    }
    pageInfo.textContent = `第 ${page} / ${totalPages} 頁（共 ${filtered.length} 筆）`;
    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= totalPages;
  }

  // Export
  exportBtn.addEventListener('click', () => {
    if (!results.length) return;
    const qNames = questionColumns.map(q => q.name);
    const header = ['姓名', 'Email', ...qNames, '平均', '結果'];
    const rows = results.map(r => [
      r.name, r.email, ...qNames.map(q => r.scores[q]), r.avg.toFixed(1), r.passed ? '通過' : '未通過'
    ]);
    downloadCSV([header, ...rows], '成績結果.csv');
  });

  exportPassBtn.addEventListener('click', () => {
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

  // Reset
  resetBtn.addEventListener('click', () => {
    csvHeaders = [];
    csvRows = [];
    questionColumns = [];
    results = [];
    uploadArea.querySelector('.file-list').classList.add('hidden');
    uploadArea.querySelector('.file-list').innerHTML = '';
    csvPreview.classList.add('hidden');
    settingsCard.classList.add('hidden');
    resultsCard.classList.add('hidden');
    csvInput.value = '';
  });
})();
