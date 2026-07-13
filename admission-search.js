(() => {
  'use strict';

  const source = window.ADMISSION_SEARCH_DATA;
  if (!source || !Array.isArray(source.rows)) {
    document.body.innerHTML = '<main style="padding:40px">수시 전형 데이터를 불러오지 못했습니다.</main>';
    return;
  }

  const columnIndex = Object.fromEntries(source.columns.map((column, index) => [column, index]));
  const value = (row, column) => row[columnIndex[column]];
  const text = input => input === null || input === undefined ? '' : String(input).trim();
  const escapeHtml = input => text(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const normalized = input => text(input).toLowerCase().replace(/[\s\-_/()[\].,·・]/g, '');
  const hasNumber = input => input !== '' && input !== null && Number.isFinite(Number(input));
  const displayNumber = input => hasNumber(input) ? Number(input).toLocaleString('ko-KR') : '-';
  const pageSize = 30;

  const elements = Object.fromEntries([
    'searchQuery', 'universityQuery', 'departmentQuery', 'regionFilter', 'categoryFilter',
    'minimumFilter', 'resultFilter', 'sortOrder', 'filterReset', 'resultCount',
    'resultList', 'resultEmpty', 'activeFilters', 'prevPage', 'nextPage', 'pageStatus',
    'universityList', 'departmentList', 'dataUpdatedAt', 'admissionToast'
  ].map(id => [id, document.getElementById(id)]));

  const state = {
    page: 1,
    filtered: [],
    openId: '',
    loadedRegions: new Set(),
    detailMaps: new Map(),
    toastTimer: null
  };

  const universities = [...new Set(source.rows.map(row => text(value(row, '대학명'))))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const departments = [...new Set(source.rows.map(row => text(value(row, '학과명'))))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'));
  const regions = [...new Set(source.rows.map(row => text(value(row, '지역'))))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'ko'));

  elements.universityList.innerHTML = universities.map(item => `<option value="${escapeHtml(item)}"></option>`).join('');
  elements.departmentList.innerHTML = departments.map(item => `<option value="${escapeHtml(item)}"></option>`).join('');
  elements.regionFilter.insertAdjacentHTML('beforeend', regions.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join(''));
  elements.dataUpdatedAt.textContent = `자료 기준 ${source.generatedAt || '-'}`;

  function filterState() {
    return {
      search: normalized(elements.searchQuery.value),
      university: normalized(elements.universityQuery.value),
      department: normalized(elements.departmentQuery.value),
      region: elements.regionFilter.value,
      category: elements.categoryFilter.value,
      minimum: elements.minimumFilter.value,
      result: elements.resultFilter.value
    };
  }

  function matches(row, filters) {
    const university = normalized(value(row, '대학명'));
    const department = normalized(value(row, '학과명'));
    const admission = normalized(value(row, '전형명'));
    const rawType = normalized(value(row, '전형유형'));
    if (filters.search && !`${university}${department}${admission}${rawType}`.includes(filters.search)) return false;
    if (filters.university && !university.includes(filters.university)) return false;
    if (filters.department && !department.includes(filters.department)) return false;
    if (filters.region && value(row, '지역') !== filters.region) return false;
    if (filters.category && value(row, '전형분류') !== filters.category) return false;
    if (filters.minimum && value(row, '수능최저유무') !== filters.minimum) return false;
    const hasResult = hasNumber(value(row, '50%컷')) || hasNumber(value(row, '70%컷'));
    if (filters.result === 'available' && !hasResult) return false;
    if (filters.result === 'missing' && hasResult) return false;
    return true;
  }

  function sortRows(rows) {
    const order = elements.sortOrder.value;
    const copy = rows.slice();
    const byName = (a, b) => {
      return text(value(a, '대학명')).localeCompare(text(value(b, '대학명')), 'ko')
        || text(value(a, '학과명')).localeCompare(text(value(b, '학과명')), 'ko')
        || text(value(a, '전형명')).localeCompare(text(value(b, '전형명')), 'ko');
    };
    if (order === 'competitionAsc') return copy.sort((a, b) => numericSort(a, b, '2026경쟁률', 1) || byName(a, b));
    if (order === 'competitionDesc') return copy.sort((a, b) => numericSort(a, b, '2026경쟁률', -1) || byName(a, b));
    if (order === 'cutAsc') return copy.sort((a, b) => numericSort(a, b, '70%컷', 1) || byName(a, b));
    return copy.sort(byName);
  }

  function numericSort(a, b, column, direction) {
    const av = hasNumber(value(a, column)) ? Number(value(a, column)) : null;
    const bv = hasNumber(value(b, column)) ? Number(value(b, column)) : null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * direction;
  }

  function renderActiveFilters(filters) {
    const labels = [
      ['검색', elements.searchQuery.value],
      ['대학', elements.universityQuery.value],
      ['학과', elements.departmentQuery.value],
      ['지역', filters.region],
      ['전형', filters.category],
      ['수능최저', filters.minimum],
      ['입결', filters.result === 'available' ? '자료 있음' : filters.result === 'missing' ? '자료 없음' : '']
    ].filter(([, item]) => text(item));
    elements.activeFilters.innerHTML = labels.map(([label, item]) => `<span class="active-filter-chip">${escapeHtml(label)}: ${escapeHtml(item)}</span>`).join('');
  }

  function render() {
    const filters = filterState();
    state.filtered = sortRows(source.rows.filter(row => matches(row, filters)));
    const pages = Math.max(1, Math.ceil(state.filtered.length / pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * pageSize;
    const rows = state.filtered.slice(start, start + pageSize);

    elements.resultCount.textContent = state.filtered.length.toLocaleString('ko-KR');
    elements.resultList.innerHTML = rows.map(resultHtml).join('');
    elements.resultEmpty.hidden = state.filtered.length !== 0;
    elements.pageStatus.textContent = `${state.page.toLocaleString('ko-KR')} / ${pages.toLocaleString('ko-KR')}`;
    elements.prevPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= pages;
    renderActiveFilters(filters);
    bindResultActions();
    if (state.openId) restoreOpenDetail();
  }

  function resultHtml(row) {
    const id = text(value(row, 'id'));
    const category = text(value(row, '전형분류'));
    const rawType = text(value(row, '전형유형'));
    const minimum = text(value(row, '수능최저유무')) || '확인 필요';
    return `
      <article class="admission-result-item" data-id="${escapeHtml(id)}">
        <div class="admission-result-summary">
          <div class="admission-result-title">
            <span class="admission-result-badge">${escapeHtml(category)}</span>
            ${rawType !== category ? `<span class="admission-result-badge">${escapeHtml(rawType)}</span>` : ''}
            <h3>${escapeHtml(value(row, '대학명'))} · ${escapeHtml(value(row, '학과명'))}</h3>
            <p>${escapeHtml(value(row, '전형명'))} · ${escapeHtml(value(row, '지역'))} · 모집 ${escapeHtml(displayNumber(value(row, '2027 모집인원')))}명</p>
          </div>
          <div class="admission-result-metrics">
            <div><span>2026 경쟁률</span><strong>${escapeHtml(displayNumber(value(row, '2026경쟁률')))}</strong></div>
            <div><span>50% / 70%컷</span><strong>${escapeHtml(displayNumber(value(row, '50%컷')))} / ${escapeHtml(displayNumber(value(row, '70%컷')))}</strong></div>
            <div><span>수능최저</span><strong>${escapeHtml(minimum)}</strong></div>
          </div>
          <div class="admission-result-actions">
            <button type="button" class="admission-result-action detail-button" data-id="${escapeHtml(id)}">상세보기</button>
            <button type="button" class="admission-result-action primary import-button" data-id="${escapeHtml(id)}">상담카드에 담기</button>
          </div>
        </div>
        <div class="admission-result-details" id="detail-${escapeHtml(id)}" hidden></div>
      </article>`;
  }

  function bindResultActions() {
    elements.resultList.querySelectorAll('.detail-button').forEach(button => {
      button.addEventListener('click', () => toggleDetail(button.dataset.id));
    });
    elements.resultList.querySelectorAll('.import-button').forEach(button => {
      button.addEventListener('click', () => sendToCard(button.dataset.id));
    });
  }

  function rowById(id) {
    return source.rows.find(row => value(row, 'id') === id);
  }

  function loadRegion(region) {
    if (state.loadedRegions.has(region) || window.ADMISSION_DETAIL_CHUNKS && window.ADMISSION_DETAIL_CHUNKS[region]) {
      state.loadedRegions.add(region);
      return Promise.resolve();
    }
    const src = source.regionFiles[region];
    if (!src) return Promise.reject(new Error('상세 데이터 파일 없음'));
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${src}?v=20260713`;
      script.onload = () => { state.loadedRegions.add(region); resolve(); };
      script.onerror = () => reject(new Error('상세 데이터 로드 실패'));
      document.head.appendChild(script);
    });
  }

  function detailById(region, id) {
    if (!state.detailMaps.has(region)) {
      const chunk = window.ADMISSION_DETAIL_CHUNKS && window.ADMISSION_DETAIL_CHUNKS[region];
      if (!chunk) return null;
      const indexes = Object.fromEntries(chunk.columns.map((column, index) => [column, index]));
      const map = new Map(chunk.rows.map(row => [row[indexes.id], { row, indexes }]));
      state.detailMaps.set(region, map);
    }
    return state.detailMaps.get(region).get(id) || null;
  }

  async function toggleDetail(id) {
    const container = document.getElementById(`detail-${id}`);
    if (!container) return;
    if (state.openId === id && !container.hidden) {
      container.hidden = true;
      state.openId = '';
      return;
    }
    const row = rowById(id);
    if (!row) return;
    const region = value(row, '지역');
    container.hidden = false;
    container.innerHTML = '<p>상세 정보를 불러오는 중입니다.</p>';
    state.openId = id;
    try {
      await loadRegion(region);
      const detail = detailById(region, id);
      container.innerHTML = detailHtml(row, detail);
    } catch (error) {
      container.innerHTML = '<p>상세 정보를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.</p>';
    }
  }

  function detailHtml(row, detail) {
    const detailValue = column => detail ? detail.row[detail.indexes[column]] : '';
    const fields = [
      ['수능최저학력기준', value(row, '2027수능최저학력기준'), true],
      ['전형 방법', detailValue('2027 전형방법'), true],
      ['교과 반영', detailValue('교과반영방법'), false],
      ['서류 평가', detailValue('서류평가방법'), false],
      ['면접 평가', detailValue('면접평가방법'), false],
      ['면접·논술·실기 일정', [detailValue('면접고사일'), detailValue('논술고사일'), detailValue('실기고사일')].filter(Boolean).join(' / '), true],
      ['합격자 발표', [detailValue('1단계 합격자발표'), detailValue('최초합격자발표')].filter(Boolean).join(' / '), false],
      ['비고', detailValue('비고'), true]
    ].filter(([, item]) => text(item));
    const links = source.links[value(row, '대학명')] || {};
    return `
      <div class="admission-detail-grid">
        ${fields.map(([label, item, wide]) => `<div class="admission-detail-field${wide ? ' wide' : ''}"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(item)}</p></div>`).join('')}
      </div>
      <div class="admission-detail-links">
        ${links.home ? `<a href="${escapeHtml(links.home)}" target="_blank" rel="noopener noreferrer">대학 입학처</a>` : ''}
        ${links.recruit ? `<a href="${escapeHtml(links.recruit)}" target="_blank" rel="noopener noreferrer">모집요강 확인</a>` : ''}
        <span>자료 신뢰도: ${escapeHtml(detailValue('추출신뢰도') || '확인 필요')}</span>
      </div>`;
  }

  function restoreOpenDetail() {
    const container = document.getElementById(`detail-${state.openId}`);
    if (!container) state.openId = '';
  }

  function sendToCard(id) {
    const row = rowById(id);
    if (!row) return;
    const payload = {
      id,
      university: text(value(row, '대학명')),
      category: text(value(row, '전형분류')),
      admissionType: text(value(row, '전형유형')),
      admissionName: text(value(row, '전형명')),
      department: text(value(row, '학과명')),
      timestamp: Date.now()
    };
    try {
      localStorage.setItem('admission_card_import_v1', JSON.stringify(payload));
      window.location.href = './grade3-consultation-card.html?import=search';
    } catch (error) {
      showToast('브라우저 저장을 사용할 수 없어 상담카드로 전달하지 못했습니다.');
    }
  }

  function showToast(message) {
    clearTimeout(state.toastTimer);
    elements.admissionToast.textContent = message;
    elements.admissionToast.classList.add('show');
    state.toastTimer = setTimeout(() => elements.admissionToast.classList.remove('show'), 2600);
  }

  let inputTimer = null;
  const scheduleRender = () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => { state.page = 1; state.openId = ''; render(); }, 120);
  };

  [elements.searchQuery, elements.universityQuery, elements.departmentQuery].forEach(input => input.addEventListener('input', scheduleRender));
  [elements.regionFilter, elements.categoryFilter, elements.minimumFilter, elements.resultFilter].forEach(select => select.addEventListener('change', scheduleRender));
  elements.sortOrder.addEventListener('change', () => { state.page = 1; render(); });
  elements.filterReset.addEventListener('click', () => {
    [elements.searchQuery, elements.universityQuery, elements.departmentQuery].forEach(input => { input.value = ''; });
    [elements.regionFilter, elements.categoryFilter, elements.minimumFilter, elements.resultFilter].forEach(select => { select.value = ''; });
    elements.sortOrder.value = 'university';
    state.page = 1;
    state.openId = '';
    render();
  });
  elements.prevPage.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; render(); scrollToResults(); } });
  elements.nextPage.addEventListener('click', () => {
    if (state.page < Math.ceil(state.filtered.length / pageSize)) { state.page += 1; render(); scrollToResults(); }
  });

  function scrollToResults() {
    document.querySelector('.admission-results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
})();
