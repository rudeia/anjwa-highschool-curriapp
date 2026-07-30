const RESULTS_PER_PAGE = 40;
const state = {
  manifest: null,
  trends: new Map(),
  trendRowIds: new Set(),
  historyRowsById: new Map(),
  lineageOptionsByHistoryId: new Map(),
  lineageLoadedCodes: new Set(),
  searchAliases: new Map(),
  departmentSearchGroups: [],
  historyLoadedCodes: new Set(),
  rows: [],
  filtered: [],
  universitiesByRegion: new Map(),
  referenceGrade: null,
  selectedYear: "",
  visibleCount: RESULTS_PER_PAGE,
  targetSlot: 0,
  targetBucket: ""
};
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);
const SEARCH_MODE_STORAGE_KEY = "anjwa.admissionSearch.mode";
const REFERENCE_GRADE_STORAGE_KEY = "anjwa.admissionSearch.referenceGrade";

function readSearchModePreference() {
  try {
    const value = localStorage.getItem(SEARCH_MODE_STORAGE_KEY);
    return value === "filter" ? "filter" : "region";
  } catch {
    return "region";
  }
}

function setSearchMode(mode, remember = true) {
  const selectedMode = mode === "filter" ? "filter" : "region";
  const regionSelected = selectedMode === "region";
  byId("regionModePanel").hidden = !regionSelected;
  byId("filterModePanel").hidden = regionSelected;
  byId("regionModeTab").setAttribute("aria-selected", String(regionSelected));
  byId("filterModeTab").setAttribute("aria-selected", String(!regionSelected));
  byId("regionModeTab").tabIndex = regionSelected ? 0 : -1;
  byId("filterModeTab").tabIndex = regionSelected ? -1 : 0;
  if (remember) {
    try {
      localStorage.setItem(SEARCH_MODE_STORAGE_KEY, selectedMode);
    } catch {
      // 브라우저 저장소를 사용할 수 없어도 모드 전환 자체는 유지한다.
    }
  }
}

function cleanAdmissionName(value) {
  const text = String(value ?? "").trim();
  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  return opens > closes ? `${text}${")".repeat(opens - closes)}` : text;
}

function uniqueValues(field) {
  return [...new Set(state.rows.map((row) => row[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
}

function fillSelect(element, values, defaultLabel) {
  const current = element.value;
  element.innerHTML = `<option value="">${defaultLabel}</option>` + values.map((value) =>
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ).join("");
  if (values.includes(current)) element.value = current;
}

const SPECIAL_UNIVERSITY_ALIASES = {
  "한국과학기술원": "KAIST·카이스트",
  "광주과학기술원": "GIST·지스트",
  "대구경북과학기술원": "DGIST·디지스트",
  "울산과학기술원": "UNIST·유니스트",
  "한국에너지공과대학교": "KENTECH·켄텍",
  "한국전통문화대학교": "한국전통문화대"
};

const REGION_MAP_LAYOUT = [
  { name: "인천", column: 1, row: 2 },
  { name: "서울", column: 2, row: 2 },
  { name: "경기", column: 2, row: 3 },
  { name: "강원", column: 4, row: 2 },
  { name: "충남", column: 2, row: 4 },
  { name: "충북", column: 3, row: 4 },
  { name: "세종", column: 2, row: 5 },
  { name: "대전", column: 3, row: 5 },
  { name: "경북", column: 4, row: 4 },
  { name: "대구", column: 4, row: 5 },
  { name: "전북", column: 2, row: 6 },
  { name: "경남", column: 4, row: 6 },
  { name: "울산", column: 5, row: 5 },
  { name: "부산", column: 5, row: 6 },
  { name: "광주", column: 2, row: 7 },
  { name: "전남", column: 3, row: 7 },
  { name: "제주", column: 1, row: 8 }
];

function specialUniversities() {
  return state.manifest?.specialUniversities || [];
}

function selectedSpecialUniversity() {
  const selected = byId("universityFilter").value;
  return specialUniversities().find((item) => item.name === selected);
}

function fillUniversitySelect() {
  const element = byId("universityFilter");
  const current = element.value;
  const regular = uniqueValues("university");
  const specials = specialUniversities();
  element.innerHTML = [
    '<option value="">전체 대학</option>',
    `<optgroup label="입결 조회 대학">${regular.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</optgroup>`,
    specials.length
      ? `<optgroup label="별도 지원 대학 · 입결 미수록">${specials.map((item) => {
        const alias = SPECIAL_UNIVERSITY_ALIASES[item.name];
        const label = alias ? `${item.name} (${alias})` : item.name;
        return `<option value="${escapeHtml(item.name)}">${escapeHtml(label)}</option>`;
      }).join("")}</optgroup>`
      : ""
  ].join("");
  if (regular.includes(current) || specials.some((item) => item.name === current)) element.value = current;
}

function numericValue(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  if (!normalized || normalized === "-") return null;
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function validReferenceGrade(value) {
  return value !== null && value >= 1 && value <= 9;
}

function persistReferenceGrade(value) {
  try {
    if (validReferenceGrade(value)) {
      localStorage.setItem(REFERENCE_GRADE_STORAGE_KEY, value.toFixed(2));
    } else {
      localStorage.removeItem(REFERENCE_GRADE_STORAGE_KEY);
    }
  } catch {
    // 로컬 저장이 막혀 있어도 현재 화면의 비교 기능은 유지한다.
  }
}

function syncReferenceGradeControl(error = false) {
  const input = byId("referenceGradeInput");
  const status = byId("referenceGradeStatus");
  const hasInput = input.value.trim() !== "";
  input.setAttribute("aria-invalid", String(error));
  byId("clearReferenceGrade").hidden = !hasInput;
  status.classList.toggle("is-error", error);
  if (error) {
    status.textContent = "1.00부터 9.00 사이의 등급을 입력해주세요.";
  } else if (validReferenceGrade(state.referenceGrade)) {
    status.textContent = `${state.referenceGrade.toFixed(2)}등급을 50%·70% CUT과 단순 비교합니다. 입력값은 이 기기에만 저장됩니다.`;
  } else {
    status.textContent = "선택 입력 · 기기에만 저장되며 합격 가능성을 판정하지 않습니다.";
  }
}

function restoreReferenceGrade() {
  let stored = "";
  try {
    stored = localStorage.getItem(REFERENCE_GRADE_STORAGE_KEY) || "";
  } catch {
    stored = "";
  }
  const value = numericValue(stored);
  state.referenceGrade = validReferenceGrade(value) ? value : null;
  byId("referenceGradeInput").value = state.referenceGrade === null ? "" : state.referenceGrade.toFixed(2);
  syncReferenceGradeControl();
}

function updateReferenceGradeFromInput() {
  const input = byId("referenceGradeInput");
  const raw = input.value.trim();
  const value = numericValue(raw);
  const error = raw !== "" && !validReferenceGrade(value);
  state.referenceGrade = error || raw === "" ? null : value;
  persistReferenceGrade(state.referenceGrade);
  syncReferenceGradeControl(error);
}

const AUTO_GRADE_FIELDS = ["result_70", "result_50", "result_90", "result_85", "result_80", "result_75", "result_mean"];

function gradeMetricValue(row) {
  const selected = byId("gradeMetricFilter").value;
  const fields = selected === "auto" ? AUTO_GRADE_FIELDS : [selected];
  for (const field of fields) {
    const value = numericValue(row[field]);
    if (value !== null && value > 0) return value;
  }
  return null;
}

function hasPublishedGrade(row) {
  return ALL_GRADE_FIELDS.some((field) => numericValue(row[field]) !== null);
}

function normalizeDepartmentSearch(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function matchingDepartmentGroups(query) {
  const normalizedQuery = normalizeDepartmentSearch(query);
  if (normalizedQuery.length < 2) return [];
  return state.departmentSearchGroups.filter((group) => (group.keywords || []).some((keyword) => {
    const normalizedKeyword = normalizeDepartmentSearch(keyword);
    return normalizedKeyword === normalizedQuery
      || normalizedKeyword.startsWith(normalizedQuery)
      || normalizedQuery.includes(normalizedKeyword);
  }));
}

function departmentMatchesGroups(row, groups) {
  if (!groups.length) return false;
  const department = normalizeDepartmentSearch(row.department);
  return groups.some((group) => (group.keywords || []).some((keyword) => {
    const normalizedKeyword = normalizeDepartmentSearch(keyword);
    return normalizedKeyword && department.includes(normalizedKeyword);
  }));
}

function syncRelatedSearchNotice(groups) {
  const notice = byId("relatedSearchNotice");
  if (!groups.length) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }
  notice.hidden = false;
  notice.textContent = `관련 학과 범위: ${groups.map((group) => group.label).join(", ")}`;
}

function selectedRegions() {
  return new Set([...document.querySelectorAll('input[name="regionFilter"]:checked')].map((input) => input.value));
}

function indexRegionUniversities() {
  const index = new Map((state.manifest?.regions || []).map((region) => [region, new Set()]));
  state.rows.forEach((row) => {
    if (!row.region || !row.university) return;
    if (!index.has(row.region)) index.set(row.region, new Set());
    index.get(row.region).add(row.university);
  });
  specialUniversities().forEach((item) => {
    if (!item.region || !item.name) return;
    if (!index.has(item.region)) index.set(item.region, new Set());
    index.get(item.region).add(item.name);
  });
  state.universitiesByRegion = new Map([...index].map(([region, universities]) => [
    region,
    [...universities].sort((a, b) => a.localeCompare(b, "ko"))
  ]));
}

function renderRegionMap() {
  const availableRegions = new Set(state.manifest?.regions || []);
  const layout = REGION_MAP_LAYOUT.filter((item) => availableRegions.has(item.name));
  byId("regionMap").innerHTML = layout.map((item) => `
    <button
      class="region-map-button"
      type="button"
      data-map-region="${escapeHtml(item.name)}"
      style="--map-column:${item.column};--map-row:${item.row}"
      aria-pressed="false"
      aria-label="${escapeHtml(item.name)} 지역 대학 보기"
    >
      <strong>${escapeHtml(item.name)}</strong>
      <span data-region-count>0개교</span>
    </button>
  `).join("");
}

function selectedRegionUniversities(regions) {
  return [...new Set([...regions].flatMap((region) => state.universitiesByRegion.get(region) || []))]
    .sort((a, b) => a.localeCompare(b, "ko"));
}

function syncRegionExplorer() {
  const regions = selectedRegions();
  const orderedRegions = (state.manifest?.regions || []).filter((region) => regions.has(region));
  const universities = selectedRegionUniversities(regions);
  const allUniversities = [...new Set(state.rows.map((row) => row.university).filter(Boolean))];
  const selectedUniversity = byId("universityFilter").value;

  document.querySelectorAll("[data-map-region]").forEach((button) => {
    const region = button.dataset.mapRegion;
    const selected = regions.has(region);
    const count = state.universitiesByRegion.get(region)?.length || 0;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.setAttribute("aria-label", `${region} 지역 대학 ${count}개교 보기`);
    button.querySelector("[data-region-count]").textContent = `${count}개교`;
  });

  byId("clearMapRegion").disabled = regions.size === 0;
  byId("regionSelectionLabel").textContent = orderedRegions.length
    ? orderedRegions.length <= 3 ? orderedRegions.join(" · ") : `${orderedRegions.length}개 지역`
    : "전국";
  byId("regionUniversityCount").textContent = regions.size
    ? `${universities.length.toLocaleString("ko-KR")}개 대학`
    : `${allUniversities.length.toLocaleString("ko-KR")}개 대학`;
  byId("regionSelectionHelp").textContent = regions.size
    ? "대학을 선택하면 아래 입시결과가 해당 대학으로 좁혀집니다."
    : "지도에서 지역을 선택하면 해당 지역의 대학 목록이 나타납니다.";
  byId("regionUniversityList").innerHTML = regions.size
    ? universities.map((university) => `
      <button type="button" data-map-university="${escapeHtml(university)}" class="${university === selectedUniversity ? "is-selected" : ""}">
        ${escapeHtml(university)}
      </button>
    `).join("") || '<p class="region-university-empty">선택한 지역에서 조회할 수 있는 대학이 없습니다.</p>'
    : '<p class="region-university-empty">지도에서 지역을 먼저 선택해주세요.</p>';
}

function setMapRegion(region) {
  const current = selectedRegions();
  const clearSelection = current.size === 1 && current.has(region);
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => {
    input.checked = !clearSelection && input.value === region;
  });
  if (!clearSelection) {
    const universities = new Set(state.universitiesByRegion.get(region) || []);
    if (byId("universityFilter").value && !universities.has(byId("universityFilter").value)) {
      byId("universityFilter").value = "";
    }
  }
  syncRegionExplorer();
  render(true);
}

function reconcileUniversityWithRegions() {
  const regions = selectedRegions();
  const selectedUniversity = byId("universityFilter").value;
  if (!regions.size || !selectedUniversity) return;
  const universities = new Set(selectedRegionUniversities(regions));
  if (!universities.has(selectedUniversity)) byId("universityFilter").value = "";
}

function coverageScore(row) {
  const fields = [
    "quota", "competition_rate", "additional_admits", "waitlist_last_rank",
    ...ALL_GRADE_FIELDS, "conversion_score_50", "conversion_score_70"
  ];
  return fields.reduce((score, field) => score + (String(row[field] || "").trim() ? 1 : 0), 0);
}

function compareText(a, b) {
  return [a.university, a.department, a.admission].join("|").localeCompare(
    [b.university, b.department, b.admission].join("|"),
    "ko"
  );
}

function sortRows(rows) {
  const selected = byId("sortFilter").value;
  if (selected === "default") return [...rows].sort(compareText);
  const [metricName, direction] = selected.split("-");
  const metric = (row) => {
    if (metricName === "grade") return gradeMetricValue(row);
    if (metricName === "competition") return numericValue(row.competition_rate);
    if (metricName === "additional") {
      const additional = additionalMetricInfo(row);
      return additional.comparable ? numericValue(additional.rawValue) : null;
    }
    if (metricName === "quota") return numericValue(row.quota);
    if (metricName === "coverage") return coverageScore(row);
    return null;
  };
  return [...rows].sort((a, b) => {
    const valueA = metric(a);
    const valueB = metric(b);
    if (valueA === null && valueB === null) return compareText(a, b);
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    const difference = direction === "asc" ? valueA - valueB : valueB - valueA;
    return difference || compareText(a, b);
  });
}

function metric(label, value, suppressed = false, className = "") {
  const rendered = value
    ? escapeHtml(value)
    : suppressed
      ? '<span class="metric-undisclosed">미공개</span>'
      : "-";
  return `<dl class="metric${className ? ` ${className}` : ""}"><dt>${label}</dt><dd>${rendered}</dd></dl>`;
}

function verificationLabel(value) {
  if (value === "official_office_exact") return "입학처 대조";
  if (value === "official_primary_traced") return "대학어디가 원문";
  if (value === "adiga_reference_snapshot") return "과거 공개자료";
  if (value === "reference_snapshot_supplemented") return "원문+과거자료";
  if (value === "official_primary_partial") return "원문 일부 확인";
  return "두 자료 일치";
}

function verificationClass(value) {
  if (value === "official_office_exact") return "is-office";
  if (value === "official_primary_traced") return "is-primary";
  if (value === "adiga_reference_snapshot") return "is-snapshot";
  if (value === "reference_snapshot_supplemented") return "is-supplemented";
  if (value === "official_primary_partial") return "is-partial";
  return "is-consensus";
}

function aliasText(row) {
  const alias = row.searchAlias || {};
  return [
    ...(alias.currentDepartments || []),
    ...(alias.currentAdmissions || [])
  ].join(" ");
}

function aliasMatch(row, query) {
  if (!query || !row.searchAlias) return false;
  const current = aliasText(row).toLocaleLowerCase("ko");
  const historical = `${row.department} ${row.admission}`.toLocaleLowerCase("ko");
  return current.includes(query) && !historical.includes(query);
}

function aliasNotice(row) {
  const alias = row.searchAlias || {};
  const departments = [...new Set(alias.currentDepartments || [])];
  const admissions = [...new Set(alias.currentAdmissions || [])];
  const labels = [
    departments.length ? `학과 ${departments.join("·")}` : "",
    admissions.length ? `전형 ${admissions.join("·")}` : ""
  ].filter(Boolean);
  return labels.length
    ? `<p class="official-alias-notice"><strong>2027 공식 명칭으로 연결</strong><span>${escapeHtml(labels.join(" / "))}</span></p>`
    : "";
}

const FIELD_LABELS = {
  quota: "모집인원",
  competition_rate: "경쟁률",
  additional_admits: "추합·충원 관련값",
  waitlist_last_rank: "최종 충원순위",
  result_mean: "평균등급",
  result_50: "50%컷",
  result_70: "70%컷",
  result_75: "75%컷",
  result_80: "80%컷",
  result_85: "85%컷",
  result_90: "90%컷",
  conversion_score_50: "환산점수 50%",
  conversion_score_70: "환산점수 70%"
};

const FIXED_CUTS = [
  { field: "result_50", label: "50%" },
  { field: "result_70", label: "70%" }
];
const ADDITIONAL_CUTS = [
  { field: "result_90", label: "90%" },
  { field: "result_85", label: "85%" },
  { field: "result_80", label: "80%" },
  { field: "result_75", label: "75%" }
];
const ALL_GRADE_FIELDS = [
  "result_mean", ...FIXED_CUTS.map(({ field }) => field), ...ADDITIONAL_CUTS.map(({ field }) => field)
];

function fieldList(values) {
  return (values || []).map((field) => FIELD_LABELS[field] || field).join("·");
}

function verificationNote(row) {
  const derivedCompetition = (row.derivedFields || []).includes("competition_rate")
    ? " 경쟁률은 대학이 공개한 모집인원과 지원자 수로 계산했습니다."
    : "";
  const metricDefinition = row.metric_definition_status === "needs_review"
    ? " 추합·충원 공개값은 인원과 최종 순위 중 의미가 확인되지 않아 비율 계산과 충원인원 정렬에서 제외했습니다."
    : "";
  if (row.verification === "adiga_reference_snapshot") {
    return `현재 화면에서 다시 확인하기 어려운 과거 대학어디가 공개값을 확인해 보완한 자료입니다.${derivedCompetition}${metricDefinition}`;
  }
  if (row.verification === "reference_snapshot_supplemented") {
    const fields = fieldList(row.supplementedFields);
    return `대학어디가 원문을 기준으로${fields ? `, 비어 있던 ${fields}은` : " 일부 빈 값은"} 과거 공개자료로 보완했습니다.${derivedCompetition}${metricDefinition}`;
  }
  if (row.verification === "official_primary_partial") {
    const fields = fieldList(row.suppressedFields);
    return `대학어디가 원문에서 확인된 값만 표시합니다.${fields ? ` 자료의 의미가 달랐던 ${fields}은 표시하지 않았습니다.` : " 서로 다르게 확인된 값은 표시하지 않았습니다."}${derivedCompetition}${metricDefinition}`;
  }
  return `${derivedCompetition}${metricDefinition}`.trim();
}

function savedIds() {
  return new Set(ConsultationCardStore.read().items.map((item) => item.id));
}

function updateCardCount() {
  const card = ConsultationCardStore.read();
  byId("cardCount").textContent = card.exemptItems.length ? `${card.standardItems.length}/9+${card.exemptItems.length}` : `${card.standardItems.length}/9`;
}

function slotLabel(slotNumber) {
  return slotNumber <= 6 ? `${slotNumber}번 칸` : `예비 ${slotNumber - 6}순위`;
}

function showToast(message) {
  const toast = byId("saveToast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 1800);
}

function cardActionLabel() {
  return state.targetBucket === "exempt"
    ? "별도 지원에 담기"
    : state.targetSlot
      ? `${slotLabel(state.targetSlot)}에 담기`
      : "상담카드에 추가";
}

function comparisonGradeText(item) {
  const cuts = FIXED_CUTS.map(({ field, label }) => {
    const value = numericValue(item[field]);
    return validReferenceGrade(value) ? `${label} ${value.toFixed(2)}` : `${label} -`;
  });
  return cuts.join(" · ");
}

function comparisonReferenceText(item) {
  if (!validReferenceGrade(state.referenceGrade)) return "-";
  const cuts = FIXED_CUTS.map(({ field, label }) => ({
    label,
    value: numericValue(item[field])
  })).filter((entry) => validReferenceGrade(entry.value));
  if (!cuts.length) return "비교 가능한 CUT 없음";
  return cuts.map((entry) => `${entry.label} ${gradeDifference(entry.value).text.replace("숫자상 ", "")}`).join(" · ");
}

function comparisonAdditionalText(item) {
  const info = additionalMetricInfo(item);
  return `${info.label} ${info.value}`;
}

function comparisonTableRow(label, items, renderCell) {
  return `<tr><th scope="row">${escapeHtml(label)}</th>${items.map((item) => `<td>${renderCell(item)}</td>`).join("")}</tr>`;
}

function renderComparisonUI() {
  const items = AdmissionComparisonStore.read();
  const cardIds = savedIds();
  const dock = byId("compareDock");
  dock.hidden = items.length === 0;
  document.body.classList.toggle("has-compare-dock", items.length > 0);
  byId("compareDockCount").textContent = `${items.length}/${AdmissionComparisonStore.MAX_ITEMS}`;
  byId("clearCompareItems").disabled = items.length === 0;

  if (!items.length) {
    byId("compareTable").innerHTML = '<p class="compare-dialog-empty">입결 검색 결과에서 비교할 후보를 담아주세요.</p>';
    return;
  }

  const rows = [
    comparisonTableRow("학년도·지역", items, (item) => `${escapeHtml(item.year)}학년도<br>${escapeHtml(item.region || "지역 미확인")}`),
    comparisonTableRow("전형", items, (item) => escapeHtml(cleanAdmissionName(item.admission) || "-")),
    comparisonTableRow("분류", items, (item) => `${escapeHtml(item.category || "-")}<br>${escapeHtml(item.admissionType || "세부 유형 미분류")}`),
    comparisonTableRow("모집인원", items, (item) => escapeHtml(countWithUnit(item.quota, "명"))),
    comparisonTableRow("경쟁률", items, (item) => escapeHtml(competitionSummary(item))),
    comparisonTableRow("학생부 CUT", items, (item) => escapeHtml(comparisonGradeText(item))),
    comparisonTableRow("추합·충원", items, (item) => escapeHtml(comparisonAdditionalText(item))),
    comparisonTableRow("원문", items, (item) => {
      const sourceUrl = item.officeSourceUrl || item.sourceUrl;
      return sourceUrl
        ? `<a class="compare-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">원문 확인</a>`
        : "연결 없음";
    }),
    ...(validReferenceGrade(state.referenceGrade)
      ? [comparisonTableRow(`내 ${state.referenceGrade.toFixed(2)}`, items, (item) => `<span class="compare-reference-cell">${escapeHtml(comparisonReferenceText(item))}</span>`)]
      : []),
    comparisonTableRow("후보 관리", items, (item) => `<div class="compare-table-actions">
      <button type="button" data-compare-card-id="${escapeHtml(item.id)}" ${cardIds.has(item.id) ? "disabled" : ""}>${cardIds.has(item.id) ? "상담카드에 추가됨" : escapeHtml(cardActionLabel())}</button>
      <button type="button" data-remove-comparison="${escapeHtml(item.id)}">비교함에서 삭제</button>
    </div>`)
  ].join("");

  byId("compareTable").innerHTML = `<table class="compare-table" style="min-width:${106 + items.length * 170}px">
    <thead><tr><th scope="col">비교 항목</th>${items.map((item) => `<th scope="col"><div class="compare-table-candidate"><strong>${escapeHtml(item.university)}</strong><span>${escapeHtml(item.department)}</span></div></th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function addRowToConsultationCard(row, button) {
  if (state.targetBucket === "exempt" && !ConsultationCardStore.isExemptUniversity(row.university)) {
    showToast("현재 이 대학은 지원 횟수 제한 제외 목록으로 분류되지 않았습니다.");
    return;
  }
  button.disabled = true;
  button.textContent = "3개년 자료 확인 중";
  try {
    await ensureUniversityHistory(row);
  } catch {
    button.disabled = false;
    button.textContent = cardActionLabel();
    showToast("3개년 자료를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  const history = trendRows(row).filter((entry) => entry.id);
  const result = ConsultationCardStore.place({ ...row, history }, state.targetSlot || undefined);
  if (!result.added) {
    button.disabled = false;
    button.textContent = cardActionLabel();
  }
  if (result.added) {
    updateCardCount();
    render();
    const destination = result.bucket === "exempt" ? "별도 지원" : slotLabel(result.slot);
    showToast(`${destination}에 ${row.university} ${row.department}을 담았습니다.`);
    if (state.targetSlot || state.targetBucket) setTimeout(() => { window.location.href = "./grade3-consultation-card.html"; }, 550);
  } else if (result.reason === "duplicate") {
    showToast("이미 상담카드에 추가한 전형입니다.");
  } else if (result.reason === "occupied") {
    showToast("해당 칸에 이미 지원안이 있습니다. 먼저 삭제해주세요.");
  } else if (result.reason === "full") {
    showToast("일반 지원 9개가 모두 찼습니다. 기존 지원안을 삭제한 뒤 추가하세요.");
  } else if (result.reason === "locked") {
    showToast("앞 순위 지원안을 먼저 채우면 이 예비 칸이 열립니다.");
  }
}

function detailMetric(label, value, suppressed = false) {
  const text = value || (suppressed ? "미공개" : "-");
  return `<div><dt>${label}</dt><dd>${escapeHtml(text)}</dd></div>`;
}

function optionalDetailMetric(label, value, suppressed = false) {
  if (!value && !suppressed) return "";
  return detailMetric(label, value, suppressed);
}

function trendKey(row) {
  return [row.university, row.category, admissionKeyForTrend(row.admission), row.department].map((value) => String(value || "").replace(/\s/g, "")).join("|");
}

function indexTrendRows(rows) {
  rows.forEach((row) => {
    const identity = row.id || [row.year, row.universityCode, row.admission, row.department].join("|");
    if (row.id) state.historyRowsById.set(row.id, row);
    if (state.trendRowIds.has(identity)) return;
    state.trendRowIds.add(identity);
    const key = trendKey(row);
    if (!state.trends.has(key)) state.trends.set(key, []);
    state.trends.get(key).push(row);
  });
}

function registerLineagePayload(payload) {
  (payload?.options || []).forEach((option) => {
    const registered = { ...option, lineageUniversityCode: payload.universityCode || "" };
    (option.approvedHistoryIds || []).forEach((historyId) => {
      const current = state.lineageOptionsByHistoryId.get(historyId) || [];
      if (!current.some((entry) => entry.optionId === registered.optionId)) current.push(registered);
      state.lineageOptionsByHistoryId.set(historyId, current);
    });
  });
}

async function ensureHistoryCode(code) {
  const normalized = String(code || "").trim();
  if (!normalized || state.historyLoadedCodes.has(normalized)) return;
  state.historyLoadedCodes.add(normalized);
  try {
    const historyRows = await AdmissionDataLoader.loadUniversityHistory(state.manifest, normalized);
    indexTrendRows(historyRows);
  } catch (error) {
    state.historyLoadedCodes.delete(normalized);
    throw error;
  }
}

async function ensureUniversityHistory(row) {
  const historyCode = String(row.universityCode || "").trim();
  const currentCode = String(row.searchAlias?.universityCode || historyCode).trim();
  if (!historyCode && !currentCode) return;
  let lineagePayload = null;
  if (currentCode && !state.lineageLoadedCodes.has(currentCode)) {
    lineagePayload = await AdmissionDataLoader.loadUniversityLineage(state.manifest, currentCode);
    if (lineagePayload) registerLineagePayload(lineagePayload);
    state.lineageLoadedCodes.add(currentCode);
  } else if (currentCode) {
    lineagePayload = await AdmissionDataLoader.loadUniversityLineage(state.manifest, currentCode);
  }
  const historyCodes = [
    historyCode,
    currentCode,
    ...(lineagePayload?.historyUniversityCodes || [])
  ];
  await Promise.all([...new Set(historyCodes.filter(Boolean))].map(ensureHistoryCode));
}

function admissionKeyForTrend(value) {
  let text = String(value || "").replace(/\s|[()[\]{}.,·・\-_]/g, "");
  ["학생부위주교과", "학생부위주종합", "학생부교과", "학생부종합", "논술위주", "실기위주", "전형"].forEach((token) => {
    text = text.replaceAll(token, "");
  });
  return text;
}

function gradeSummary(row) {
  const additional = ADDITIONAL_CUTS.find(({ field }) => row[field]);
  const values = [
    ...FIXED_CUTS.map(({ field, label }) => [label, row[field]]),
    ...(additional ? [[additional.label, row[additional.field]]] : [])
  ].filter(([, value]) => value);
  if (!values.length && row.result_mean) values.push(["평균", row.result_mean]);
  if (values.length) return values.map(([label, value]) => `${label} ${value}`).join(" · ");
  const suppressed = new Set(row.suppressedFields || []);
  return ALL_GRADE_FIELDS.some((field) => suppressed.has(field)) ? "미공개" : "-";
}

function gradeCutMetric(row) {
  const suppressed = new Set(row.suppressedFields || []);
  const additional = ADDITIONAL_CUTS.find(({ field }) => row[field])
    || ADDITIONAL_CUTS.find(({ field }) => suppressed.has(field))
    || { field: "result_90", label: "90%" };
  const slots = [...FIXED_CUTS, additional];
  const content = `<span class="grade-cut-list">${slots.map(({ field, label }) => {
    const value = field ? row[field] : "";
    const undisclosed = field ? suppressed.has(field) : false;
    const rendered = value || (undisclosed ? "미공개" : "자료 없음");
    return `<span class="grade-cut${value ? "" : " is-empty"}"><b>${escapeHtml(label)}</b><strong>${escapeHtml(rendered)}</strong></span>`;
  }).join("")}</span>`;

  return `<dl class="metric metric-primary grade-cut-metric"><dt>학생부 성적 CUT</dt><dd>${content}</dd></dl>`;
}

function gradeScalePosition(value) {
  return Math.max(0, Math.min(100, ((value - 1) / 8) * 100));
}

function gradeDifference(cut) {
  const difference = state.referenceGrade - cut;
  const absolute = Math.abs(difference);
  if (absolute < 0.05) return { text: "숫자상 거의 같음", className: "is-near" };
  if (difference < 0) return { text: `숫자상 ${absolute.toFixed(2)}등급 앞`, className: "is-ahead" };
  return { text: `숫자상 ${absolute.toFixed(2)}등급 뒤`, className: "is-behind" };
}

function referenceGradeComparison(row) {
  if (!validReferenceGrade(state.referenceGrade)) return "";
  const cuts = FIXED_CUTS.map(({ field, label }) => ({
    label,
    value: numericValue(row[field])
  })).filter((item) => validReferenceGrade(item.value));
  const myPosition = gradeScalePosition(state.referenceGrade);
  const ariaSummary = cuts.length
    ? cuts.map((item) => `${item.label} 컷 ${item.value.toFixed(2)}`).join(", ")
    : "50%와 70% 컷 미공개";

  return `<section class="reference-grade-comparison" aria-label="내 참고등급 ${state.referenceGrade.toFixed(2)}, ${escapeHtml(ariaSummary)}">
    <header><strong>내 참고등급 ${state.referenceGrade.toFixed(2)}</strong><span>단순 등급 위치</span></header>
    ${cuts.length ? `
      <div class="reference-position-track" aria-hidden="true">
        <div class="reference-position-axis"><span>1등급</span><span>5등급</span><span>9등급</span></div>
        <div class="reference-position-line">
          <i class="reference-position-marker is-mine" style="left:${myPosition}%"><b>나</b></i>
          ${cuts.map((item) => `<i class="reference-position-marker" style="left:${gradeScalePosition(item.value)}%"><b>${escapeHtml(item.label)}</b></i>`).join("")}
        </div>
      </div>
      <div class="reference-comparison-list">
        ${cuts.map((item) => {
          const difference = gradeDifference(item.value);
          return `<span class="${difference.className}"><b>${escapeHtml(item.label)} ${item.value.toFixed(2)}</b> · ${escapeHtml(difference.text)}</span>`;
        }).join("")}
      </div>
    ` : '<p class="reference-grade-empty">비교할 50%·70% CUT이 공개되지 않았습니다.</p>'}
    <p>대학별 반영교과와 산출방법이 달라 같은 등급도 결과가 달라질 수 있습니다. 지원 판단이 아닌 원문 확인용 참고값입니다.</p>
  </section>`;
}

function countWithUnit(value, unit) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return /[가-힣]/.test(text) ? text : `${text}${unit}`;
}

function additionalMetricInfo(row) {
  const type = String(row.additional_metric_type || "").trim()
    || (row.waitlist_last_rank ? "waitlist_last_rank" : row.additional_admits ? "unknown" : "none");
  if (type === "additional_count" && row.additional_admits) {
    return {
      type,
      label: row.additional_metric_label || "충원인원",
      value: countWithUnit(row.additional_admits, "명"),
      rawValue: row.additional_admits,
      comparable: true
    };
  }
  if (type === "waitlist_last_rank" && row.waitlist_last_rank) {
    return {
      type,
      label: row.additional_metric_label || "최종 충원순위",
      value: countWithUnit(row.waitlist_last_rank, "번"),
      rawValue: row.waitlist_last_rank,
      comparable: false
    };
  }
  if ((row.additional_admits || row.waitlist_last_rank) && type === "unknown") {
    return {
      type,
      label: row.additional_metric_label || "추합·충원 공개값",
      value: String(row.additional_admits || row.waitlist_last_rank),
      rawValue: row.additional_admits || row.waitlist_last_rank,
      comparable: false
    };
  }
  const suppressed = new Set(row.suppressedFields || []);
  return {
    type: "none",
    label: "추합·충원 관련값",
    value: suppressed.has("additional_admits") || suppressed.has("waitlist_last_rank") ? "미공개" : "-",
    rawValue: "",
    comparable: false
  };
}

function admissionVolume(row) {
  const quota = countWithUnit(row.quota, "명");
  const additional = additionalMetricInfo(row);
  return { label: `모집 / ${additional.label}`, value: `${quota} / ${additional.value}` };
}

function competitionSummary(row) {
  const value = String(row.competition_rate || "").trim();
  if (value) {
    const displayed = value.includes(":") ? value : `${value}:1`;
    return (row.derivedFields || []).includes("competition_rate") ? `${displayed} · 계산` : displayed;
  }
  return (row.suppressedFields || []).includes("competition_rate") ? "미공개" : "-";
}

function trendGradeCuts(row) {
  const suppressed = new Set(row.suppressedFields || []);
  const values = [...FIXED_CUTS, ...ADDITIONAL_CUTS].filter(({ field }) => row[field]);
  if (!values.length && row.result_mean) values.push({ field: "result_mean", label: "평균" });
  if (!values.length) {
    const undisclosed = ALL_GRADE_FIELDS.some((field) => suppressed.has(field));
    return `<span class="trend-grade-empty">${undisclosed ? "미공개" : "공개값 없음"}</span>`;
  }
  return `<span class="trend-grade-list">${values.map(({ field, label }) => `
    <span class="trend-grade-cut"><b>${escapeHtml(label)}</b><strong>${escapeHtml(row[field])}</strong></span>
  `).join("")}</span>`;
}

function trendBasisLabel(row) {
  const text = String(row.result_metric_type || "").trim();
  if (text.includes("최종등록자")) return "최종등록자 기준";
  if (text.includes("입학자")) return "입학자 기준";
  if (text.includes("합격자")) return "합격자 기준";
  if (text.includes("학생부")) return "학생부 등급 기준";
  return text ? "성적 공개 기준 확인" : "성적 기준 미표기";
}

function compactTrendText(value) {
  return String(value || "").replace(/\s|[()[\]{}.,·・\-_]/g, "");
}

function lineageOptionForRow(row) {
  const options = state.lineageOptionsByHistoryId.get(row.id) || [];
  if (options.length <= 1) return options[0] || null;
  const aliasDepartments = new Set((row.searchAlias?.currentDepartments || []).map(compactTrendText));
  const aliasAdmissions = new Set((row.searchAlias?.currentAdmissions || []).map(admissionKeyForTrend));
  const aliasMatch = options.filter((option) => (
    (!aliasDepartments.size || aliasDepartments.has(compactTrendText(option.department)))
    && (!aliasAdmissions.size || aliasAdmissions.has(admissionKeyForTrend(option.admissionName)))
  ));
  if (aliasMatch.length === 1) return aliasMatch[0];
  const exact = options.filter((option) => compactTrendText(option.department) === compactTrendText(row.department)
    && admissionKeyForTrend(option.admissionName) === admissionKeyForTrend(row.admission));
  return exact.length === 1 ? exact[0] : null;
}

function lineageRelationDisplay(relation) {
  return {
    admission_changed_candidate: "공식 전형명 변경 확인",
    renamed_candidate: "공식 학과명 변경 확인",
    university_predecessor_candidate: "통합 전 대학 계보 확인",
    merged_candidate: "공식 학과 통합 확인",
    split_candidate: "공식 학과 분리 확인",
    similar_reference: "공식 계보 확인"
  }[relation] || "공식 계보 확인";
}

function trendConnectionLabel(item, selected) {
  if (item._lineageConnectionStatus === "approved_official_evidence") {
    return lineageRelationDisplay(item._lineageRelation);
  }
  if (item.department !== selected.department) return "유사 모집단위 참고";
  if (cleanAdmissionName(item.admission) !== cleanAdmissionName(selected.admission)) return "전형명 변경 연결";
  return "동일 모집단위·전형";
}

function trendAdditionalSummary(row) {
  const info = additionalMetricInfo(row);
  if (info.type === "additional_count") {
    const quota = numericValue(row.quota);
    const additional = numericValue(row.additional_admits);
    const rate = quota && additional !== null ? ` · ${Math.round((additional / quota) * 100)}%` : "";
    return { label: info.label, value: `${info.value}${rate}` };
  }
  return { label: info.label, value: info.value };
}

function trendRows(row) {
  const key = trendKey(row);
  const lineageOption = lineageOptionForRow(row);
  const lineageRows = (lineageOption?.approvedHistoryIds || [])
    .map((historyId) => state.historyRowsById.get(historyId))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      _lineageConnectionStatus: lineageOption.connectionStatus || "approved_exact",
      _lineageRelation: lineageOption.approvedRelation || "same"
    }));
  const same = lineageRows.length ? lineageRows : [...(state.trends.get(key) || [])];
  const byYear = new Map();
  same.sort((a, b) => {
    const exactA = a.admission === row.admission ? 0 : 1;
    const exactB = b.admission === row.admission ? 0 : 1;
    return exactA - exactB;
  }).forEach((candidate) => {
    const linked = byYear.get(candidate.year) || {};
    if (!linked.verifiedRow || candidate.admission === row.admission) {
      byYear.set(candidate.year, {
        ...linked,
        ...candidate,
        competition_rate: candidate.competition_rate || linked.competition_rate || "",
        result_50: candidate.result_50 || linked.result_50 || "",
        result_70: candidate.result_70 || linked.result_70 || "",
        result_75: candidate.result_75 || linked.result_75 || "",
        result_80: candidate.result_80 || linked.result_80 || "",
        result_85: candidate.result_85 || linked.result_85 || "",
        result_90: candidate.result_90 || linked.result_90 || "",
        additional_admits: candidate.additional_admits || linked.additional_admits || "",
        waitlist_last_rank: candidate.waitlist_last_rank || linked.waitlist_last_rank || "",
        additional_metric_type: candidate.additional_metric_type || linked.additional_metric_type || "",
        additional_metric_label: candidate.additional_metric_label || linked.additional_metric_label || "",
        metric_definition_status: candidate.metric_definition_status || linked.metric_definition_status || "",
        verifiedRow: true
      });
    }
  });
  return ["2024", "2025", "2026"].map((year) => byYear.get(year) || { year });
}

function trendReferenceGroups(row) {
  const option = lineageOptionForRow(row);
  const groups = { similarDepartments: [], otherAdmissions: [] };
  if (!option) return groups;
  const seen = new Set();
  (option.candidates || [])
    .filter((candidate) => !["approved_trend", "rejected"].includes(candidate.reviewStatus))
    .forEach((candidate) => {
      const entries = (candidate.historicalRecordIds || [])
        .map((historyId) => state.historyRowsById.get(historyId))
        .filter(Boolean)
        .sort((left, right) => Number(right.year) - Number(left.year));
      const entry = entries[0];
      if (!entry) return;
      const key = `${entry.year}|${entry.department}|${entry.admission}`;
      if (seen.has(key)) return;
      seen.add(key);
      const reference = {
        ...entry,
        _lineageRelation: candidate.relation || "similar_reference",
        _lineageReviewStatus: candidate.reviewStatus || "manual_review",
        _lineageEvidence: candidate.reviewEvidence || {}
      };
      const sameDepartment = compactTrendText(candidate.department) === compactTrendText(option.department);
      const differentAdmission = admissionKeyForTrend(candidate.admission) !== admissionKeyForTrend(option.admissionName);
      if (sameDepartment && differentAdmission) groups.otherAdmissions.push(reference);
      else groups.similarDepartments.push(reference);
    });
  return groups;
}

function trendReferenceLabel(entry) {
  if (entry._lineageReviewStatus === "approved_reference") return "공식 참고 관계";
  return {
    admission_changed_candidate: "다른 전형",
    renamed_candidate: "학과명 변경 후보",
    university_predecessor_candidate: "통합 전 대학 후보",
    merged_candidate: "학과 통합 후보",
    split_candidate: "학과 분리 후보",
    duplicate_current_identity_candidate: "동일 명칭 구분 필요",
    similar_reference: "유사 모집단위"
  }[entry._lineageRelation] || "참고 후보";
}

function renderTrendReferenceGroup(entries, type) {
  if (!entries.length) return "";
  const otherAdmission = type === "other-admission";
  return `<details class="trend-reference-group${otherAdmission ? " is-other-admission" : ""}">
    <summary>${otherAdmission ? "같은 모집단위의 다른 전형 참고" : "유사 모집단위 참고"} ${entries.length}건</summary>
    <p>${otherAdmission ? "같은 학과라도 전형별 평가방법과 지원자 집단이 달라 확정 추이에 합치지 않습니다." : "명칭 변경·통합·분리 가능성 또는 학문 분야가 비슷한 자료이며, 공식 계보가 확인되기 전에는 확정 추이에 합치지 않습니다."}</p>
    <div>${entries.map((entry) => {
      const evidenceUrl = entry._lineageEvidence?.sourceUrl || entry.officeSourceUrl || entry.sourceUrl;
      return `<span><b>${escapeHtml(trendReferenceLabel(entry))}</b><strong>${escapeHtml(entry.year)}학년도 ${escapeHtml(entry.department)}</strong><em>${escapeHtml(entry.admission || "전형명 확인 필요")}</em><i>경쟁률 ${escapeHtml(competitionSummary(entry))} · ${escapeHtml(gradeSummary(entry))}</i>${evidenceUrl ? `<a href="${escapeHtml(evidenceUrl)}" target="_blank" rel="noopener noreferrer">근거 보기</a>` : ""}</span>`;
    }).join("")}</div>
  </details>`;
}

function gradeValue(row) {
  return row.result_70 || row.result_50 || row.result_90 || row.result_85
    || row.result_80 || row.result_75 || row.result_mean || "";
}

function trendChart(row) {
  const rows = trendRows(row);
  const references = trendReferenceGroups(row);
  const visibleCount = rows.filter((item) => item.id).length;
  return `
    <section class="trend-section" aria-label="3개년 입결 추이">
      <div class="trend-head">
        <div><strong>확정 3개년 입결 추이</strong><span>동일 명칭 또는 대학 공식 근거로 계보가 확인된 자료만 연결합니다.</span></div>
        <em>${visibleCount}/3개년 확인</em>
      </div>
      <p class="trend-identity-note">수능최저·모집인원·전형방법·반영비율이 달라졌다는 이유만으로 다른 모집단위로 분리하지 않습니다. 다만 전형명이 달라진 경우에는 대학 공식 근거를 확인한 뒤 연결하며, 바뀐 조건은 학년도별로 따로 보여줍니다.</p>
      <div class="trend-grid">
        ${rows.map((item) => {
          if (!item.id) return `<article class="trend-year is-empty">
            <header class="trend-year-head"><strong>${item.year}학년도</strong><span>모집 -</span></header>
            <p>확정 연결 자료 없음</p>
          </article>`;
          const additional = trendAdditionalSummary(item);
          const sourceUrl = item.officeSourceUrl || item.sourceUrl;
          const metricType = String(item.result_metric_type || "").trim();
          return `<article class="trend-year${item.year === row.year ? " is-current" : ""}">
            <header class="trend-year-head"><strong>${item.year}학년도</strong><span>모집 ${escapeHtml(countWithUnit(item.quota, "명"))}</span></header>
            <div class="trend-year-meta">
              <span>${escapeHtml(trendConnectionLabel(item, row))}</span>
              <span${metricType ? ` title="${escapeHtml(metricType)}"` : ""}>${escapeHtml(trendBasisLabel(item))}</span>
            </div>
            <dl class="trend-stat-grid">
              <div><dt>경쟁률</dt><dd>${escapeHtml(competitionSummary(item))}</dd></div>
              <div><dt>${escapeHtml(additional.label)}</dt><dd>${escapeHtml(additional.value)}</dd></div>
            </dl>
            <div class="trend-grade-block"><span>학생부 성적 CUT</span>${trendGradeCuts(item)}</div>
            ${sourceUrl ? `<a class="trend-year-source" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">원문 확인 <span aria-hidden="true">↗</span></a>` : ""}
          </article>`;
        }).join("")}
      </div>
      ${renderGradeTrack(rows)}
      ${renderTrendReferenceGroup(references.similarDepartments, "similar-department")}
      ${renderTrendReferenceGroup(references.otherAdmissions, "other-admission")}
    </section>`;
}

function displayPair(first, second, suppressed) {
  if (first || second) return `${escapeHtml(first || "-")} / ${escapeHtml(second || "-")}`;
  return suppressed.has("result_50") || suppressed.has("result_70") ? "미공개" : "-";
}

function renderGradeTrack(rows) {
  const points = rows.map((row) => ({ year: row.year, value: numericValue(gradeValue(row)) }))
    .filter((point) => validReferenceGrade(point.value));
  if (points.length < 2) return '<p class="trend-help">등급 수치가 2개년 이상 확인되면 추이 그래프가 나타납니다.</p>';
  const referenceRow = validReferenceGrade(state.referenceGrade)
    ? `<div class="grade-row is-reference"><strong>나</strong><div><i style="left:${gradeScalePosition(state.referenceGrade)}%"></i></div><span>${state.referenceGrade.toFixed(2)}</span></div>`
    : "";
  return `<div class="grade-track" aria-label="등급 추이 그래프${referenceRow ? `와 내 참고등급 ${state.referenceGrade.toFixed(2)}` : ""}">
    <div class="grade-axis"><span>1등급</span><span>5등급</span><span>9등급</span></div>
    ${referenceRow}
    ${points.map((point) => {
      const position = gradeScalePosition(point.value);
      return `<div class="grade-row"><strong>${point.year}</strong><div><i style="left:${position}%"></i></div><span>${point.value.toFixed(2)}</span></div>`;
    }).join("")}
  </div>`;
}

function render(resetLimit = false) {
  if (resetLimit) state.visibleCount = RESULTS_PER_PAGE;
  const university = byId("universityFilter").value;
  const category = byId("categoryFilter").value;
  const admissionType = byId("admissionTypeFilter").value;
  const group = byId("groupFilter").value;
  const rawQuery = byId("textFilter").value.trim();
  const query = rawQuery.toLocaleLowerCase("ko");
  const relatedGroups = byId("relatedDepartmentFilter").checked
    ? matchingDepartmentGroups(rawQuery)
    : [];
  syncRelatedSearchNotice(relatedGroups);
  const ownership = byId("ownershipFilter").value;
  const regions = selectedRegions();
  const gradeMin = numericValue(byId("gradeMinFilter").value);
  const gradeMax = numericValue(byId("gradeMaxFilter").value);
  const publishedOnly = byId("publishedGradeFilter").checked;
  const special = selectedSpecialUniversity();
  const filtered = state.rows.filter((row) => {
    if (university && row.university !== university) return false;
    if (category && row.category !== category) return false;
    if (admissionType && row.admissionType !== admissionType) return false;
    if (group && row.departmentGroup !== group) return false;
    if (ownership && row.ownershipGroup !== ownership) return false;
    if (regions.size && !regions.has(row.region)) return false;
    if (publishedOnly && !hasPublishedGrade(row)) return false;
    if (gradeMin !== null || gradeMax !== null) {
      const grade = gradeMetricValue(row);
      if (grade === null) return false;
      if (gradeMin !== null && grade < gradeMin) return false;
      if (gradeMax !== null && grade > gradeMax) return false;
    }
    if (query) {
      const haystack = `${row.university} ${row.admission} ${row.admissionType} ${row.department} ${row.departmentGroup} ${row.region} ${row.ownershipGroup} ${aliasText(row)}`.toLocaleLowerCase("ko");
      if (!haystack.includes(query) && !departmentMatchesGroups(row, relatedGroups)) return false;
    }
    return true;
  });
  state.filtered = sortRows(filtered);
  byId("resultCount").textContent = `${state.filtered.length.toLocaleString("ko-KR")}개 결과`;
  byId("emptyState").hidden = state.filtered.length !== 0;
  byId("emptyState").innerHTML = special
    ? `<strong>${escapeHtml(special.name)}</strong><span>표준화된 3개년 입결 자료가 없어 임의의 등급 행을 만들지 않았습니다. 2027학년도 공식 모집요강을 확인해 상담카드에 직접 작성하세요.</span><a href="./grade3-consultation-card.html?bucket=exempt">상담카드 별도 지원란에서 작성</a>`
    : "조건에 맞는 결과가 없습니다.";
  const cardIds = savedIds();
  const comparisonIds = new Set(AdmissionComparisonStore.read().map((item) => item.id));
  const visibleRows = state.filtered.slice(0, state.visibleCount);
  byId("resultList").innerHTML = visibleRows.map((row) => {
    const isSaved = cardIds.has(row.id);
    const isCompared = comparisonIds.has(row.id);
    const admissionName = cleanAdmissionName(row.admission);
    const buttonText = cardActionLabel();
    const sourceNote = verificationNote(row);
    const sourceLinkLabel = row.verification === "adiga_reference_snapshot" ? "대학어디가 대학 정보" : "대학어디가 원문";
    const volume = admissionVolume(row);
    const showAlias = aliasMatch(row, query);
    return `
    <article class="result-item">
      <div class="result-identity">
        <div><span>대학·캠퍼스</span><strong>${escapeHtml(row.university)}${row.campus ? ` · ${escapeHtml(row.campus)}` : ""}</strong></div>
        <div><span>학과·모집단위</span><strong>${escapeHtml(row.department)}</strong></div>
      </div>
      <div class="admission-line">
        <span class="admission-year">${escapeHtml(row.year)} 입결</span>
        <span>${escapeHtml(row.category)}</span>
        <span>${escapeHtml(row.admissionType || "세부 유형 미분류")}</span>
        <span>${escapeHtml(row.region || "지역 미확인")}</span>
        <span>${escapeHtml(row.ownershipGroup || "설립 미확인")}</span>
        <strong>${escapeHtml(admissionName)}</strong>
        <span class="verification-chip ${verificationClass(row.verification)}">${escapeHtml(verificationLabel(row.verification))}</span>
      </div>
      ${showAlias ? aliasNotice(row) : ""}
      <div class="result-metrics">
        ${gradeCutMetric(row)}
        ${metric("경쟁률", competitionSummary(row))}
        ${metric(volume.label, volume.value)}
      </div>
      ${referenceGradeComparison(row)}
      <div class="result-controls">
        <details class="result-detail" data-history-id="${escapeHtml(row.id)}">
          <summary>3개년·상세 보기</summary>
          <div class="trend-content" data-trend-id="${escapeHtml(row.id)}">
            <p class="trend-loading">상세보기를 열면 이 대학의 3개년 자료를 불러옵니다.</p>
          </div>
          <section class="target-2027">
            <strong>2027학년도 지원 전형</strong>
            <p>상담카드에서 2027 공식 모집요강의 학과·전형명을 확인해 입력합니다. 현재 표시된 전형명은 ${escapeHtml(row.year)}학년도 입결 기준이며 2027 전형명으로 간주하지 않습니다.</p>
          </section>
          <dl class="detail-grid">
            ${detailMetric("전형 큰 분류", row.category)}
            ${detailMetric("세부 유형", row.admissionType)}
            ${detailMetric("공식 전형명", admissionName)}
            ${detailMetric("모집단위 계열", row.departmentGroup)}
            ${optionalDetailMetric("성적 공개 기준", row.result_metric_type)}
            ${detailMetric("평균등급", row.result_mean, row.suppressedFields?.includes("result_mean"))}
            ${detailMetric("50% CUT", row.result_50, row.suppressedFields?.includes("result_50"))}
            ${detailMetric("70% CUT", row.result_70, row.suppressedFields?.includes("result_70"))}
            ${optionalDetailMetric("75% CUT", row.result_75, row.suppressedFields?.includes("result_75"))}
            ${optionalDetailMetric("80% CUT", row.result_80, row.suppressedFields?.includes("result_80"))}
            ${optionalDetailMetric("85% CUT", row.result_85, row.suppressedFields?.includes("result_85"))}
            ${optionalDetailMetric("90% CUT", row.result_90, row.suppressedFields?.includes("result_90"))}
            ${optionalDetailMetric("최종등록자", row.registered_count ? `${row.registered_count}명` : "")}
            ${optionalDetailMetric("환산점수 50%", row.conversion_score_50, row.suppressedFields?.includes("conversion_score_50"))}
            ${optionalDetailMetric("환산점수 70%", row.conversion_score_70, row.suppressedFields?.includes("conversion_score_70"))}
          </dl>
          ${sourceNote ? `<p class="verification-note"><strong>${escapeHtml(verificationLabel(row.verification))}</strong><span>${escapeHtml(sourceNote)}</span></p>` : ""}
          <div class="source-links">
            ${row.sourceUrl ? `<a href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLinkLabel}</a>` : ""}
            ${row.officeSourceUrl ? `<a href="${escapeHtml(row.officeSourceUrl)}" target="_blank" rel="noopener noreferrer">대학 입학처 원문</a>` : ""}
          </div>
        </details>
        <div class="result-action-buttons">
          <button class="compare-toggle-button${isCompared ? " is-selected" : ""}" type="button" data-compare-id="${escapeHtml(row.id)}">
            ${isCompared ? "비교함에서 빼기" : "비교함에 담기"}
          </button>
          <button class="add-card-button${isSaved ? " is-saved" : ""}" type="button" data-card-id="${escapeHtml(row.id)}" ${isSaved ? "disabled" : ""}>
            ${isSaved ? "상담카드에 추가됨" : buttonText}
          </button>
        </div>
      </div>
    </article>`;
  }).join("");
  const remaining = Math.max(0, state.filtered.length - visibleRows.length);
  const loadMore = byId("loadMoreResults");
  loadMore.hidden = remaining === 0;
  loadMore.textContent = remaining
    ? `다음 ${Math.min(RESULTS_PER_PAGE, remaining)}개 보기 · ${visibleRows.length.toLocaleString("ko-KR")}/${state.filtered.length.toLocaleString("ko-KR")}`
    : "";
  renderComparisonUI();
}

byId("resultList").addEventListener("toggle", async (event) => {
  const detail = event.target.closest("details[data-history-id]");
  if (!detail?.open || detail.dataset.loaded === "true") return;
  const row = state.rows.find((item) => item.id === detail.dataset.historyId);
  const content = detail.querySelector("[data-trend-id]");
  if (!row || !content) return;
  detail.dataset.loaded = "loading";
  content.innerHTML = '<p class="trend-loading">3개년 자료를 불러오는 중입니다.</p>';
  try {
    await ensureUniversityHistory(row);
    content.innerHTML = trendChart(row);
    detail.dataset.loaded = "true";
  } catch (error) {
    content.innerHTML = `<p class="trend-loading is-error">${escapeHtml(error.message)} 원문 링크에서 직접 확인해주세요.</p>`;
    detail.dataset.loaded = "error";
  }
}, true);

byId("resultList").addEventListener("click", async (event) => {
  const compareButton = event.target.closest("[data-compare-id]");
  if (compareButton) {
    const row = state.rows.find((item) => item.id === compareButton.dataset.compareId);
    if (!row) return;
    const compared = AdmissionComparisonStore.read().some((item) => item.id === row.id);
    const result = compared
      ? AdmissionComparisonStore.remove(row.id)
      : AdmissionComparisonStore.add(row);
    if (result.reason === "full") {
      showToast(`비교함에는 최대 ${AdmissionComparisonStore.MAX_ITEMS}개까지 담을 수 있습니다.`);
    } else if (result.reason === "storage") {
      showToast("비교함을 현재 기기에 저장하지 못했습니다.");
    } else {
      showToast(compared ? `${row.university} 후보를 비교함에서 뺐습니다.` : `${row.university} 후보를 비교함에 담았습니다.`);
    }
    return;
  }
  const button = event.target.closest("[data-card-id]");
  if (!button) return;
  const row = state.rows.find((item) => item.id === button.dataset.cardId);
  if (!row) return;
  await addRowToConsultationCard(row, button);
});

function coverageRow(year, coverage) {
  if (!coverage) return "";
  return `<div class="coverage-year">
    <strong>${escapeHtml(year)}학년도</strong>
    <span>학생부 성적 <b>${coverage.gradePercent}%</b></span>
    <span>경쟁률 <b>${coverage.competitionPercent}%</b></span>
    <span>모집인원 <b>${coverage.quotaPercent}%</b></span>
    <span>추합·충원 관련값 <b>${coverage.additionalPercent}%</b></span>
  </div>`;
}

function renderCoverageSummary() {
  const rows = (state.manifest.years || []).map((entry) => {
    const coverage = entry.coverage || state.manifest.yearCoverage?.[entry.year];
    return coverageRow(entry.year, coverage);
  }).join("");
  const totalRows = (state.manifest.years || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
  const totalUniversities = Number(state.manifest.universityCount || 0);
  byId("metadataStatus").innerHTML = `
    <p>${totalRows.toLocaleString("ko-KR")}건의 2024~2026학년도 입시결과와 ${totalUniversities}개 대학 정보를 조회할 수 있습니다.</p>
    ${rows ? `<details class="coverage-summary"><summary>연도별 공개 범위 확인</summary><div>${rows}</div><p>‘자료 없음’은 0점이나 불합격을 뜻하지 않습니다. 대학이 공개하지 않았거나 현재 원문에서 확인되지 않은 값입니다.</p></details>` : ""}`;
}

function renderAdvancedMetadata() {
  const regions = state.manifest.regions || [];
  byId("regionOptions").innerHTML = regions.map((region) => `
    <label><input type="checkbox" name="regionFilter" value="${escapeHtml(region)}"><span>${escapeHtml(region)}</span></label>
  `).join("");
  byId("specialUniversityList").innerHTML = specialUniversities().map((item) => {
    const alias = SPECIAL_UNIVERSITY_ALIASES[item.name];
    return `<button type="button" data-special-university="${escapeHtml(item.name)}">${escapeHtml(alias || item.name)} · ${escapeHtml(item.region)}</button>`;
  }).join("");
  renderRegionMap();
  syncRegionExplorer();
  renderCoverageSummary();
}

async function selectYear(year) {
  state.selectedYear = year;
  state.visibleCount = RESULTS_PER_PAGE;
  byId("resultCount").textContent = `${year}학년도 자료를 불러오는 중`;
  byId("resultList").innerHTML = '<div class="empty-state">선택한 학년도의 입시결과를 불러오고 있습니다.</div>';
  byId("loadMoreResults").hidden = true;
  const rows = await AdmissionDataLoader.loadYear(state.manifest, year);
  state.rows = rows.map((row) => {
    const searchAlias = state.searchAliases.get(row.id);
    return searchAlias ? { ...row, searchAlias } : row;
  });
  indexRegionUniversities();
  indexTrendRows(state.rows);
  fillUniversitySelect();
  fillSelect(byId("admissionTypeFilter"), uniqueValues("admissionType"), "전체 세부 유형");
  fillSelect(byId("groupFilter"), uniqueValues("departmentGroup"), "전체 계열");
  const entry = state.manifest.years.find((item) => item.year === year);
  const coverage = entry.coverage || state.manifest.yearCoverage?.[year] || AdmissionDataLoader.coverage(state.rows);
  byId("dataScope").textContent = `${entry.universities.length}개 대학 · 성적 공개 ${coverage.gradePercent}% · 경쟁률 공개 ${coverage.competitionPercent}% · 상세에서 대학별 3개년 확인`;
  byId("disclosureLegend").hidden = !state.rows.some((row) => row.suppressedFields?.length);
  syncRegionExplorer();
  render(true);
}

async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    state.targetSlot = Number(params.get("slot")) || 0;
    state.targetBucket = params.get("bucket") === "exempt" ? "exempt" : "";
    if (state.targetBucket) {
      state.targetSlot = 0;
      byId("slotNotice").hidden = false;
      byId("slotNoticeTitle").textContent = "지원 횟수 제한 제외 대학에 담기";
    } else if (state.targetSlot >= 1 && state.targetSlot <= 9) {
      byId("slotNotice").hidden = false;
      byId("slotNoticeTitle").textContent = `${slotLabel(state.targetSlot)}에 담기`;
    } else {
      state.targetSlot = 0;
    }
    setSearchMode(state.targetBucket || state.targetSlot ? "filter" : readSearchModePreference(), false);
    restoreReferenceGrade();
    state.manifest = await AdmissionDataLoader.loadManifest();
    const [aliasPayload, departmentPayload] = await Promise.all([
      AdmissionDataLoader.loadSearchAliases(state.manifest.generatedAt || "current"),
      AdmissionDataLoader.loadDepartmentSearchGroups(state.manifest.generatedAt || "current")
    ]);
    state.searchAliases = new Map(Object.entries(aliasPayload.historyAliases || {}));
    state.departmentSearchGroups = Array.isArray(departmentPayload.groups) ? departmentPayload.groups : [];
    const years = [...state.manifest.years].sort((a, b) => b.year.localeCompare(a.year));
    byId("yearFilter").innerHTML = years.map((item) => `<option value="${item.year}">${item.year}학년도 입결</option>`).join("");
    renderAdvancedMetadata();
    await selectYear(years[0].year);
  } catch (error) {
    byId("resultList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)} 로컬 서버에서 다시 확인해주세요.</div>`;
  }
}

byId("yearFilter").addEventListener("change", async (event) => {
  try {
    await selectYear(event.target.value);
  } catch (error) {
    byId("resultList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)} 잠시 후 다시 시도해주세요.</div>`;
  }
});
["categoryFilter", "admissionTypeFilter", "groupFilter", "sortFilter", "gradeMetricFilter", "ownershipFilter", "publishedGradeFilter"].forEach((id) => byId(id).addEventListener("change", () => render(true)));
byId("universityFilter").addEventListener("change", () => {
  syncRegionExplorer();
  render(true);
});
["gradeMinFilter", "gradeMaxFilter"].forEach((id) => byId(id).addEventListener("input", () => render(true)));
byId("textFilter").addEventListener("input", () => render(true));
byId("relatedDepartmentFilter").addEventListener("change", () => render(true));
byId("referenceGradeInput").addEventListener("input", () => {
  updateReferenceGradeFromInput();
  render();
});
byId("clearReferenceGrade").addEventListener("click", () => {
  byId("referenceGradeInput").value = "";
  updateReferenceGradeFromInput();
  render();
  byId("referenceGradeInput").focus();
});
byId("openCompareDialog").addEventListener("click", () => {
  renderComparisonUI();
  const dialog = byId("compareDialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
});
byId("closeCompareDialog").addEventListener("click", () => {
  const dialog = byId("compareDialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
});
byId("compareDialog").addEventListener("click", (event) => {
  if (event.target !== byId("compareDialog")) return;
  byId("closeCompareDialog").click();
});
byId("compareTable").addEventListener("click", async (event) => {
  const removeButton = event.target.closest("[data-remove-comparison]");
  if (removeButton) {
    const item = AdmissionComparisonStore.read().find((candidate) => candidate.id === removeButton.dataset.removeComparison);
    const result = AdmissionComparisonStore.remove(removeButton.dataset.removeComparison);
    if (result.removed) showToast(`${item?.university || "선택한"} 후보를 비교함에서 삭제했습니다.`);
    else if (result.reason === "storage") showToast("비교함을 현재 기기에 저장하지 못했습니다.");
    return;
  }
  const cardButton = event.target.closest("[data-compare-card-id]");
  if (!cardButton) return;
  const item = AdmissionComparisonStore.read().find((candidate) => candidate.id === cardButton.dataset.compareCardId);
  if (!item) return;
  await addRowToConsultationCard(item, cardButton);
});
byId("clearCompareItems").addEventListener("click", () => {
  const items = AdmissionComparisonStore.read();
  if (!items.length) return;
  if (!window.confirm(`임시 비교 후보 ${items.length}개를 모두 삭제할까요?`)) return;
  const result = AdmissionComparisonStore.clear();
  showToast(result.cleared ? "임시 비교함을 비웠습니다." : "비교함을 현재 기기에서 지우지 못했습니다.");
});
["regionModeTab", "filterModeTab"].forEach((id) => {
  byId(id).addEventListener("click", () => setSearchMode(id === "filterModeTab" ? "filter" : "region"));
  byId(id).addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = id === "filterModeTab" ? "region" : "filter";
    setSearchMode(nextMode);
    byId(nextMode === "filter" ? "filterModeTab" : "regionModeTab").focus();
  });
});
byId("regionOptions").addEventListener("change", () => {
  reconcileUniversityWithRegions();
  syncRegionExplorer();
  render(true);
});
byId("regionMap").addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-region]");
  if (!button) return;
  setMapRegion(button.dataset.mapRegion);
});
byId("regionUniversityList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-university]");
  if (!button) return;
  byId("universityFilter").value = button.dataset.mapUniversity;
  syncRegionExplorer();
  render(true);
  byId("resultCount").scrollIntoView({ behavior: "smooth", block: "center" });
});
byId("clearMapRegion").addEventListener("click", () => {
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => { input.checked = false; });
  syncRegionExplorer();
  render(true);
});
byId("loadMoreResults").addEventListener("click", () => {
  state.visibleCount += RESULTS_PER_PAGE;
  render();
});
byId("clearRegions").addEventListener("click", () => {
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => { input.checked = false; });
  syncRegionExplorer();
  render(true);
});
byId("toggleAdvancedFilters").addEventListener("click", () => {
  const panel = byId("advancedFilters");
  const expanded = byId("toggleAdvancedFilters").getAttribute("aria-expanded") === "true";
  panel.hidden = expanded;
  byId("toggleAdvancedFilters").setAttribute("aria-expanded", String(!expanded));
  byId("toggleAdvancedFilters").querySelector("span").textContent = expanded ? "상세 조건 열기" : "상세 조건 닫기";
});
byId("specialUniversityList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-special-university]");
  if (!button) return;
  byId("universityFilter").value = button.dataset.specialUniversity;
  syncRegionExplorer();
  render(true);
  byId("resultCount").scrollIntoView({ behavior: "smooth", block: "center" });
});
byId("resetFilters").addEventListener("click", () => {
  ["universityFilter", "categoryFilter", "admissionTypeFilter", "groupFilter", "textFilter", "ownershipFilter", "gradeMinFilter", "gradeMaxFilter"].forEach((id) => { byId(id).value = ""; });
  byId("sortFilter").value = "default";
  byId("gradeMetricFilter").value = "auto";
  byId("publishedGradeFilter").checked = false;
  byId("relatedDepartmentFilter").checked = false;
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => { input.checked = false; });
  syncRegionExplorer();
  render(true);
});
window.addEventListener("consultation-card-change", () => {
  updateCardCount();
  render();
});
window.addEventListener("admission-comparison-change", () => render());
window.addEventListener("storage", (event) => {
  updateCardCount();
  if (event.key === REFERENCE_GRADE_STORAGE_KEY) {
    restoreReferenceGrade();
    render();
  }
  if (event.key === AdmissionComparisonStore.STORAGE_KEY) render();
});
updateCardCount();
renderComparisonUI();
init();
