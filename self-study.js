// ---- Self-Study Module ----
(function () {
  const TIME_KEYWORD = '停留平台時間';

  // State
  let csvHeaders = [];
  let csvRows = [];
  let timeColumns = []; // [{ name, index, month }]
  let results = [];
  let currentFilter = 'all';

  // DOM
  const uploadArea = document.getElementById('selfStudyUploadArea');
  const csvInput = document.getElementById('selfStudyCsvInput');
  const settingsCard = document.getElementById('selfStudySettingsCard');
  const resultsCard = document.getElementById('selfStudyResultsCard');
  const csvPreview = document.getElementById('selfStudyCsvPreview');
  const calcBtn = document.getElementById('selfStudyCalcBtn');
  const resetBtn = document.getElementById('selfStudyResetBtn');
  const targetMonthInput = document.getElementById('targetMonth');
  const minStudyHoursInput = document.getElementById('minStudyHours');
  const resultHead = document.getElementById('selfStudyResultHead');
  const resultBody = document.getElementById('selfStudyResultBody');
  const statsGrid = document.getElementById('selfStudyStatsGrid');
  const filterTabs = document.getElementById('selfStudyFilterTabs');
  const exportBtn = document.getElementById('selfStudyExportBtn');
  const exportPassBtn = document.getElementById('selfStudyExportPassBtn');
  const pagination = document.getElementById('selfStudyPagination');
  const pageInfo = document.getElementById('selfStudyPageInfo');
  const prevPageBtn = document.getElementById('selfStudyPrevPage');
  const nextPageBtn = document.getElementById('selfStudyNextPage');
  const pageSizeSelect = document.getElementById('selfStudyPageSize');

  // Upload
  setupUpload(uploadArea, csvInput, (parsed, fileCount) => {
    csvHeaders = parsed.headers;
    csvRows = parsed.rows;
    detectColumnsAndPreview(fileCount);
  });

  function extractMonth(colName) {
    // Extract YYYYMM from column name like "202603停留平台時間"
    const match = colName.match(/^(\d{6})/);
    if (!match) return null;
    const ym = match[1];
    const y = ym.slice(0, 4);
    const m = ym.slice(4, 6);
    return `${y}/${m}`;
  }

  function detectColumnsAndPreview(fileCount) {
    timeColumns = csvHeaders
      .map((h, i) => ({ name: h, index: i }))
      .filter(c => c.index >= FIXED_COUNT)
      .filter(c => c.name.includes(TIME_KEYWORD))
      .map(c => ({ ...c, month: extractMonth(c.name) || c.name }));

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
        <span class="material-symbols-outlined" style="font-size:18px;color:var(--md-sys-color-primary);">timer</span>
        偵測到 <strong>${timeColumns.length}</strong> 個月份時數欄位：
      </div>
      <div class="preview-chips-wrapper">
        ${timeColumns.map(c => `<span class="preview-chip">${c.month}</span>`).join('')}
      </div>
    `;

    settingsCard.classList.remove('hidden');
    resultsCard.classList.add('hidden');
  }

  // Calculate
  calcBtn.addEventListener('click', calculate);

  function parseTimeToHours(value) {
    if (value == null || value === '') return 0;
    const str = String(value).trim();

    // "00小時 07分 16秒" or "12小時 32分 34秒"
    const cnMatch = str.match(/(\d+)\s*小時\s*(\d+)\s*分\s*(\d+)\s*秒/);
    if (cnMatch) {
      return parseInt(cnMatch[1]) + parseInt(cnMatch[2]) / 60 + parseInt(cnMatch[3]) / 3600;
    }

    // "HH:MM:SS" or "MM:SS"
    if (str.includes(':')) {
      const parts = str.split(':').map(Number);
      if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600;
      if (parts.length === 2) return parts[0] / 60 + parts[1] / 3600;
      return 0;
    }

    // Plain number treated as minutes
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num / 60;
  }

  function formatHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return '0m';
  }

  let activeColumns = [];

  function calculate() {
    const minHours = parseFloat(minStudyHoursInput.value) || 0;
    const targetMonth = targetMonthInput.value.trim();

    // Filter to target month if specified
    if (targetMonth) {
      activeColumns = timeColumns.filter(c => c.name.startsWith(targetMonth));
      if (activeColumns.length === 0) {
        return alert(`找不到月份 ${targetMonth} 的欄位`);
      }
    } else {
      activeColumns = timeColumns;
    }

    results = csvRows.map(row => {
      const name = getStudentName(row);
      const email = (row[3] || '').trim();
      const monthlyHours = {};

      activeColumns.forEach(col => {
        monthlyHours[col.month] = parseTimeToHours(row[col.index]);
      });

      const monthResults = {};
      let allPassed = true;
      activeColumns.forEach(col => {
        const passed = monthlyHours[col.month] >= minHours;
        monthResults[col.month] = passed;
        if (!passed) allPassed = false;
      });

      return { name, email, monthlyHours, monthResults, passed: allPassed };
    });

    renderResults();
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

  function renderResults() {
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
      ${activeColumns.map(c => `<th>${c.month}</th>`).join('')}
      <th>結果</th>
    </tr>`;

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
      ${activeColumns.map(c => {
        const hours = r.monthlyHours[c.month];
        const ok = r.monthResults[c.month];
        return `<td class="${ok ? 'score-ok' : 'score-low'}">${formatHours(hours)}${ok ? '' : ' ✗'}</td>`;
      }).join('')}
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
    const months = activeColumns.map(c => c.month);
    const header = ['姓名', 'Email', ...months.map(m => `${m}（小時）`), '結果'];
    const rows = results.map(r => [
      r.name, r.email,
      ...months.map(m => r.monthlyHours[m].toFixed(1)),
      r.passed ? '通過' : '未通過'
    ]);
    downloadCSV([header, ...rows], '自學活動結果.csv');
  });

  exportPassBtn.addEventListener('click', () => {
    if (!results.length) return;
    const passed = results.filter(r => r.passed);
    if (!passed.length) return alert('沒有通過的學生');
    const months = activeColumns.map(c => c.month);
    const header = ['姓名', 'Email', ...months.map(m => `${m}（小時）`)];
    const rows = passed.map(r => [
      r.name, r.email,
      ...months.map(m => r.monthlyHours[m].toFixed(1))
    ]);
    downloadCSV([header, ...rows], '自學活動通過名單.csv');
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    csvHeaders = [];
    csvRows = [];
    timeColumns = [];
    results = [];
    uploadArea.querySelector('.file-list').classList.add('hidden');
    uploadArea.querySelector('.file-list').innerHTML = '';
    csvPreview.classList.add('hidden');
    settingsCard.classList.add('hidden');
    resultsCard.classList.add('hidden');
    csvInput.value = '';
  });
})();
