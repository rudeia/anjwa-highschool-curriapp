const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);

const YEARS = ["2024", "2025", "2026"];
const STRATEGIES = ["상향", "적정", "안정"];
const MANUAL_EXEMPT_UNIVERSITIES = [
  { code: "EXEMPT-KAIST", name: "한국과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-GIST", name: "광주과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-DGIST", name: "대구경북과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-UNIST", name: "울산과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-KENTECH", name: "한국에너지공과대학교", campus: "본교", manual: true },
  { code: "EXEMPT-NUCH", name: "한국전통문화대학교", campus: "본교", manual: true }
];
const OVERRIDE_CONFIG = {
  quota: { source: "targetQuota", override: "targetQuotaOverride", input: "editorQuotaOverride", fallback: "모집인원 미지정" },
  selectionMethod: { source: "targetSelectionMethod", override: "targetSelectionMethodOverride", input: "editorSelectionMethodOverride", fallback: "원문 확인 피요" },
  minimum: { source: "targetMinimumOfficial", override: "targetMinimumOverride", input: "editorMinimumOverride", fallback: "모집요강 확인 피요" }
};
const dataCache = {
  optionIndexPromise: null,
  historyIndexPromise: null,
  universityLinksPromise: null,
  optionUniversities: new Map(),
  historyUniversities: new Map(),
  universityLinks: new Map()
};

let expandedCardId = "";
let reorderMode = false;
let editorSession = null;
let editorDraft = null;
let editorSequence = 0;
let returnFocusElement = null;

function compact(value) {
  return String(value ?? "").toLocaleUpperCase("ko").replace(/\s|[()[\]{}.,·・\-_:]/g, "");
}

function compactUniversity(value) {
  return compact(value).replace(/대학교$/u, "대");
}

function categoryKey(value) {
  const text = compact(value);
  if (text.includes("교과")) return "교과";
  if (text.includes("종합")) return "종합";
  if (text.includes("논술")) return "논술";
  if (text.includes("실기") || text.includes("특기")) return "실기";
  return text;
}

function admissionKey(value) {
  let text = compact(value);
  ["학생부위주교과", "학생부위주종합", "학생부교과", "학생부종합", "논술위주", "실기위주", "전형"].forEach((token) => {
    text = text.replaceAll(token, "");
  });
  return text;
}

function bigrams(value) {
  const text = compact(value);
  if (text.length < 2) return new Set(text ? [text] : []);
  return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
}

function diceSimilarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => { if (b.has(token)) overlap += 1; });
  return (2 * overlap) / (a.size + b.size);
}

function cleanAdmissionName(value) {
  const text = String(value ?? "").trim();
  const opens = (text.match(/\(/g) || []).length;
  const closes = (text.match(/\)/g) || []).length;
  return opens > closes ? `${text}${")".repeat(opens - closes)}` : text;
}

function historyVerificationBadge(entry) {
  if (entry.verification === "official_office_exact") return '<em>입학처 대조</em>';
  if (entry.verification === "official_primary_traced") return '<em>어디가 원문</em>';
  if (entry.verification === "adiga_reference_snapshot") return '<em class="is-snapshot" title="과거 대학어디가 공개자료에서 확인">과거 공개자료</em>';
  if (entry.verification === "reference_snapshot_supplemented") return '<em class="is-supplemented" title="대학어디가 원문의 빈 값을 과거 공개자료로 보완">원문+과거자료</em>';
  if (entry.verification === "official_primary_partial") return '<em class="is-partial" title="대학어디가 원문에서 확인된 값만 표시">원문 일부</em>';
  if (entry.verification === "cross_reference_consensus") return '<em class="is-consensus">두 자료 일치</em>';
  return "";
}

function historyValue(entry, field, fallback = "-") {
  if (entry[field]) return entry[field];
  const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return (entry.suppressedFields || []).includes(snakeField) ? "미공개" : fallback;
}

function showToast(message) {
  const toast = byId("cardToast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function slotLabel(slotNumber) {
  return slotNumber <= 6 ? `${slotNumber}순위` : `예비 ${slotNumber - 6}순위`;
}

function universityLabel(university) {
  return `${university.name}${university.campus ? ` · ${university.campus}` : ""}`;
}

function isManualUniversity(item) {
  return String(item?.targetUniversityCode || "").startsWith("EXEMPT-");
}

function overrideFields(item) {
  return new Set(Array.isArray(item?.targetOverrideFields) ? item.targetOverrideFields : []);
}

function hasTargetOverride(item, key) {
  return overrideFields(item).has(key);
}

function effectiveTargetValue(item, key) {
  const config = OVERRIDE_CONFIG[key];
  if (!config) return "";
  return hasTargetOverride(item, key) ? String(item?.[config.override] ?? "") : String(item?.[config.source] ?? "");
}

function clearedOverrides() {
  return {
    targetOverrideFields: [],
    targetQuotaOverride: "",
    targetSelectionMethodOverride: "",
    targetMinimumOverride: ""
  };
}

function copiedOverrides(item) {
  return {
    targetOverrideFields: [...overrideFields(item)],
    targetQuotaOverride: String(item?.targetQuotaOverride ?? ""),
    targetSelectionMethodOverride: String(item?.targetSelectionMethodOverride ?? ""),
    targetMinimumOverride: String(item?.targetMinimumOverride ?? "")
  };
}

function withSuffix(value, suffix = "") {
  const text = String(value ?? "").trim();
  if (!text || !suffix || text.endsWith(suffix)) return text;
  return `${text}${suffix}`;
}

function allUniversityEntries(index) {
  const indexed = [...index.universities];
  const codes = new Set(indexed.map((university) => university.code));
  return indexed.concat(MANUAL_EXEMPT_UNIVERSITIES.filter((university) => !codes.has(university.code)));
}

function universityCodeFromUrl(value) {
  const match = String(value || "").match(/[?&]unvCd=([^&#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function universityCodeFromItem(item) {
  if (item?.targetUniversityCode && !isManualUniversity(item)) return item.targetUniversityCode;
  const urls = [
    item?.targetSourceUrl,
    item?.targetMinimumSourceUrl,
    item?.sourceUrl,
    item?.officeSourceUrl,
    ...(item?.history || []).flatMap((entry) => [entry.sourceUrl, entry.officeSourceUrl])
  ];
  return urls.map(universityCodeFromUrl).find(Boolean) || "";
}

function universityLinksForItem(item) {
  const code = universityCodeFromItem(item);
  if (code && dataCache.universityLinks.has(code)) return dataCache.universityLinks.get(code);
  const sameName = [...dataCache.universityLinks.values()].filter(
    (entry) => compactUniversity(entry.name) === compactUniversity(item?.university)
  );
  return sameName.find((entry) => !item?.campus || compact(entry.campus) === compact(item.campus))
    || (sameName.length === 1 ? sameName[0] : null);
}

function adigaRecruitUrl(code) {
  return code
    ? `https://www.adiga.kr/ucp/uvt/uni/univDetailRecruit.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=${encodeURIComponent(code)}`
    : "";
}

function adigaResultUrl(item, code) {
  const history = latestHistory(item);
  return history?.sourceUrl || item?.sourceUrl || (code
    ? `https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=${encodeURIComponent(code)}`
    : "");
}

function renderSourceActions(item) {
  const code = universityCodeFromItem(item);
  const universityLinks = universityLinksForItem(item);
  const candidates = [
    [universityLinks?.admissionUrl, "대학 입학처·모집요강", "is-primary"],
    [item?.targetSourceUrl || adigaRecruitUrl(code), "대학어디가 2027 전형", ""],
    [adigaResultUrl(item, code), "대학어디가 입결", ""],
    [item?.targetMinimumSourceUrl, "수능최저 원문", ""],
    [universityLinks?.homepageUrl, "대학 홈페이지", ""]
  ];
  const seen = new Set();
  const links = candidates.filter(([url]) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  if (!links.length) return "";
  return `<section class="source-actions" aria-label="대학 공식 정보 확인">
    <div class="source-actions-copy"><strong>원문 확인</strong><span>지원 전 모집요강과 입결을 다시 확인하세요.</span></div>
    <nav>${links.map(([url, label, className]) => `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span aria-hidden="true">↗</span></a>`).join("")}</nav>
  </section>`;
}

function latestHistory(item) {
  return [...(item?.history || [])].sort((left, right) => Number(right.year) - Number(left.year))[0] || null;
}

function gradeMetric(entry) {
  if (!entry) return null;
  return [
    ["70%", entry.result70],
    ["50%", entry.result50],
    ["90%", entry.result90],
    ["85%", entry.result85],
    ["80%", entry.result80],
    ["75%", entry.result75],
    ["평균", entry.resultMean]
  ].find(([, value]) => value) || null;
}

function compactGradeMetrics(entry) {
  const additional = [
    ["90%", entry.result90],
    ["85%", entry.result85],
    ["80%", entry.result80],
    ["75%", entry.result75]
  ].find(([, value]) => value);
  const metrics = [
    ["50%", entry.result50],
    ["70%", entry.result70],
    ...(additional ? [additional] : [])
  ].filter(([, value]) => value);
  return metrics.length ? metrics : [["평균", entry.resultMean]].filter(([, value]) => value);
}

function competitionWithRatio(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return text;
  return text.includes(":") ? text : `${text}:1`;
}

function recentResultMarkup(item) {
  const entry = latestHistory(item);
  if (!entry) return '<strong class="summary-result-line"><span>과거 입결 없음</span></strong>';
  const metric = gradeMetric(entry);
  const parts = [`<span>${escapeHtml(entry.year)}학년도</span>`];
  if (entry.competitionRate) parts.push(`<span>경쟁률 ${escapeHtml(competitionWithRatio(entry.competitionRate))}</span>`);
  if (metric) parts.push(`<span>${escapeHtml(metric[0])} ${escapeHtml(metric[1])}</span>`);
  if (parts.length === 1) parts.push("<span>공개값 없음</span>");
  return `<strong class="summary-result-line">${parts.join("")}</strong>`;
}

function renderHistory(item) {
  if (isManualUniversity(item)) {
    return '<div class="history-placeholder">별도 지원 대학의 입결은 해당 대학 입학처 자료를 확인해 상담 메모에 기록합니다.</div>';
  }
  if (!item?.targetOptionId && !(item?.history || []).length) {
    return '<div class="history-placeholder">학과와 전형을 선택하면 2024~2026학년도 입결을 연결합니다.</div>';
  }
  const targetLinked = Boolean(item.targetOptionId);
  const historyByYear = new Map((item.history || []).map((entry) => [entry.year, entry]));
  const rows = YEARS.map((year) => {
    const entry = historyByYear.get(year);
    if (!entry) {
      return `<tr class="is-empty" data-year="${year}">
        <th scope="row"><span class="history-year">${year}</span></th>
        <td colspan="4"><span class="history-empty-copy"><strong>연결 자료 없음</strong><small>동일 모집단위·전형 기준</small></span></td>
      </tr>`;
    }
    const grades = compactGradeMetrics(entry);
    const suppressedGrades = new Set(entry.suppressedFields || []);
    const hasSuppressedGrade = [
      "result_mean", "result_50", "result_70", "result_75", "result_80", "result_85", "result_90"
    ].some((field) => suppressedGrades.has(field));
    const gradeText = grades.length
      ? `<span class="history-grade-list">${grades.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}</span>`
      : `<span class="history-muted">${hasSuppressedGrade ? "미공개" : "공개값 없음"}</span>`;
    const sourceUrl = entry.officeSourceUrl || entry.sourceUrl;
    const quota = entry.quota ? `${escapeHtml(entry.quota)}명` : "-";
    const additional = escapeHtml(entry.additionalAdmits || entry.waitlistLastRank || historyValue(entry, "additionalAdmits"));
    const competition = competitionWithRatio(historyValue(entry, "competitionRate"));
    const sourceLabel = entry.officeSourceUrl ? "입학처" : "대학어디가";
    return `<tr class="has-data" data-year="${year}">
      <th scope="row"><span class="history-year">${year}<small>학년도</small></span>${historyVerificationBadge(entry)}</th>
      <td><strong class="history-single-value">${escapeHtml(competition)}</strong></td>
      <td>${gradeText}</td>
      <td><span class="history-admit-values"><strong>${quota}</strong><i>/</i><span>${additional}</span></span></td>
      <td>${sourceUrl ? `<a class="history-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}<span aria-hidden="true">↗</span></a>` : '<span class="history-muted">-</span>'}</td>
    </tr>`;
  }).join("");
  const suggestions = (item.historySuggestions || []).slice(0, 3);
  const connectedYears = YEARS.filter((year) => historyByYear.has(year));
  return `<section class="saved-history" aria-label="3개년 입결">
    <div class="history-head">
      <div class="history-heading-copy"><strong>3개년 입결</strong><span>${targetLinked ? "동일 대학·모집단위·전형 기준" : "현재 저장된 과거 입결 · 2027 전형 연결 필요"}</span></div>
      <div class="history-coverage" aria-label="3개년 중 ${connectedYears.length}개년 연결">
        <span class="history-coverage-dots" aria-hidden="true">${YEARS.map((year) => `<i class="${historyByYear.has(year) ? "is-connected" : ""}"></i>`).join("")}</span>
        <strong>${connectedYears.length}<small>/3개년</small></strong>
      </div>
    </div>
    <div class="history-table-wrap"><table class="history-table"><thead><tr><th>학년도</th><th>경쟁률</th><th>학생부 성적</th><th>모집/충원</th><th>출처</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${suggestions.length ? `<details class="similar-history"><summary>유사 모집단위 참고 ${suggestions.length}건</summary><p>학과 개편 여부를 살피기 위한 참고값이며, 선택한 모집단위의 입결은 아닙니다.</p><div>${suggestions.map((entry) => { const metric = gradeMetric(entry); return `<span><strong>${escapeHtml(entry.year)} ${escapeHtml(entry.department)}</strong> · 경쟁률 ${escapeHtml(entry.competitionRate || "-")} · ${escapeHtml(metric ? `${metric[0]} ${metric[1]}` : "성적 공개값 없음")}</span>`; }).join("")}</div></details>` : ""}
  </section>`;
}

function renderOptionSummary(item) {
  if (isManualUniversity(item)) {
    return '<div class="option-placeholder">모집인원·전형방법·수능최저는 해당 대학의 2027 모집요강을 확인해 상담 메모에 기록합니다.</div>';
  }
  if (!item?.targetOptionId) {
    return '<div class="option-placeholder">정보·순위 수정을 눌러 학과와 전형을 선택하세요.</div>';
  }
  const quota = item.targetQuota ? `${item.targetQuota}명` : "모집인원 미지정";
  const minimum = item.targetMinimumOfficial || (
    item.targetMinimumStatus === "official_not_entered" ? "대학어디가 입력 없음 · 모집요강 확인" : "모집요강 확인 필요"
  );
  return `<section class="option-summary" aria-label="2027 전형 정보">
    <div><span>2027 모집인원</span><strong>${escapeHtml(quota)}</strong></div>
    <div><span>전형방법·반영비율</span><strong>${escapeHtml(item.targetSelectionMethod || "원문 확인 필요")}</strong></div>
    <div><span>수능최저</span><strong>${escapeHtml(minimum)}</strong></div>
    ${item.targetMinimumSubjects ? `<details><summary>수능최저 반영 영역 보기</summary><p>${escapeHtml(item.targetMinimumSubjects)}</p></details>` : ""}
    <nav>${item.targetSourceUrl ? `<a href="${escapeHtml(item.targetSourceUrl)}" target="_blank" rel="noopener noreferrer">2027 모집정보 원문</a>` : ""}${item.targetMinimumSourceUrl ? `<a href="${escapeHtml(item.targetMinimumSourceUrl)}" target="_blank" rel="noopener noreferrer">수능최저 상세</a>` : ""}</nav>
  </section>`;
}

function optionValueBlock(item, key, label, value, fallback, suffix = "") {
  const config = OVERRIDE_CONFIG[key];
  const overridden = hasTargetOverride(item, key);
  const manual = isManualUniversity(item) && overridden;
  const source = String(item?.[config.source] ?? "");
  const shown = value ? withSuffix(value, suffix) : fallback;
  const status = overridden ? `<span class="option-value-status">${manual ? "직접 입력" : "직접 수정"}</span>` : "";
  const original = overridden ? `<small class="option-original">자동값: ${escapeHtml(source ? withSuffix(source, suffix) : "입력 없음")}</small>` : "";
  return `<div><span>${escapeHtml(label)}${status}</span><strong>${escapeHtml(shown)}</strong>${original}</div>`;
}

function renderOptionSummaryV2(item, bucket = "standard") {
  if (!item?.targetOptionId && !isManualUniversity(item)) {
    return `<section class="option-summary is-unlinked" aria-label="2027 전형 정보 연결 필요">
      <div><span>2027 모집인원</span><strong>전형 연결 후 표시</strong></div>
      <div><span>반영 요소·비율</span><strong>전형 연결 후 표시</strong></div>
      <div><span>수능최저학력기준</span><strong>전형 연결 후 표시</strong></div>
      <div class="option-connect-notice"><span><strong>2027 학과·전형을 연결하세요.</strong> 모집인원, 반영비율, 수능최저가 자동으로 채워집니다.</span><button type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${escapeHtml(bucket)}">2027 전형 연결</button></div>
    </section>`;
  }
  const quota = effectiveTargetValue(item, "quota");
  const selectionMethod = effectiveTargetValue(item, "selectionMethod");
  const minimum = effectiveTargetValue(item, "minimum");
  const hasManualData = [quota, selectionMethod, minimum].some(Boolean);
  if (isManualUniversity(item) && !hasManualData) {
    return `<section class="option-summary is-unlinked" aria-label="2027 전형 정보 직접 입력">
      <div><span>2027 모집인원</span><strong>직접 입력 필요</strong></div>
      <div><span>반영 요소·비율</span><strong>직접 입력 필요</strong></div>
      <div><span>수능최저학력기준</span><strong>직접 입력 필요</strong></div>
      <div class="option-connect-notice"><span><strong>모집요강을 확인해 정보를 보완하세요.</strong> 수정값은 이 상담카드에만 저장됩니다.</span><button type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${escapeHtml(bucket)}">정보 입력</button></div>
    </section>`;
  }
  const minimumFallback = item.targetMinimumStatus === "official_not_entered"
    ? "대학어디가 입력 없음 · 모집요강 확인"
    : "모집요강 확인 필요";
  return `<section class="option-summary" aria-label="2027 전형 정보">
    ${optionValueBlock(item, "quota", "2027 모집인원", quota, "모집인원 미지정", "명")}
    ${optionValueBlock(item, "selectionMethod", "반영 요소·비율", selectionMethod, "원문 확인 필요")}
    ${optionValueBlock(item, "minimum", "수능최저학력기준", minimum, minimumFallback)}
    ${item.targetMinimumSubjects ? `<details><summary>수능최저 반영 영역 보기</summary><p>${escapeHtml(item.targetMinimumSubjects)}</p></details>` : ""}
  </section>`;
}

function renderEmptySlot(slot) {
  const reserveClass = slot.slot > 6 ? " is-reserve" : "";
  return `<article class="empty-slot-row" data-slot="${slot.slot}">
    <button type="button" data-open-slot="${slot.slot}">
      <span class="slot-number${reserveClass}">${slotLabel(slot.slot)}</span>
      <span><strong>지원 대학 추가</strong><small>대학·학과·전형을 선택합니다.</small></span>
      <span class="add-mark" aria-hidden="true">+</span>
    </button>
  </article>`;
}

function renderCard(slot, options = {}) {
  const item = slot.item;
  const isExempt = options.bucket === "exempt";
  if (!item) return renderEmptySlot(slot);
  const expanded = expandedCardId === item.id;
  const rank = isExempt ? "별도 지원" : slotLabel(slot.slot);
  const reserveClass = slot.slot > 6 && !isExempt ? " is-reserve" : "";
  const strategy = item.strategy || "미판단";
  const admission = cleanAdmissionName(item.targetAdmission || item.admission) || "전형 선택 필요";
  const effectiveQuota = effectiveTargetValue(item, "quota");
  const quota = effectiveQuota ? withSuffix(effectiveQuota, "명") : "인원 확인";
  const canMoveUp = !isExempt && slot.slot > 1;
  const state = ConsultationCardStore.read();
  const canMoveDown = !isExempt && slot.slot < state.visibleSlotCount;
  return `<article class="saved-card${expanded ? " is-expanded" : ""}${isExempt ? " exempt-card" : ""}" data-card-id="${escapeHtml(item.id)}">
    <div class="saved-card-summary-row">
      <button class="saved-card-summary" type="button" data-toggle-id="${escapeHtml(item.id)}" aria-expanded="${expanded}">
        <span class="slot-number${reserveClass}">${rank}</span>
        <span class="summary-identity"><strong>${escapeHtml(item.university)}${item.campus ? ` · ${escapeHtml(item.campus)}` : ""}</strong><small>${escapeHtml(item.targetDepartment || item.department || "학과·모집단위 선택 필요")}</small></span>
        <span class="summary-admission"><strong>${escapeHtml(admission)}</strong><small>2027 모집 ${escapeHtml(quota)}</small></span>
        <span class="summary-result">${recentResultMarkup(item)}<small>${item.history?.length || 0}/3개년 연결</small></span>
        <span class="strategy-badge strategy-${escapeHtml(strategy)}">${escapeHtml(strategy)}</span>
        <span class="summary-chevron" aria-hidden="true">⌄</span>
      </button>
      ${!isExempt ? `<div class="reorder-controls" aria-label="${rank} 이동">
        <button type="button" data-move-id="${escapeHtml(item.id)}" data-move-target="${slot.slot - 1}"${canMoveUp ? "" : " disabled"} aria-label="위 순위로 이동" title="위 순위로 이동">↑</button>
        <button type="button" data-move-id="${escapeHtml(item.id)}" data-move-target="${slot.slot + 1}"${canMoveDown ? "" : " disabled"} aria-label="아래 순위로 이동" title="아래 순위로 이동">↓</button>
      </div>` : ""}
    </div>
    <div class="saved-card-detail"${expanded ? "" : " hidden"}>
      ${renderOptionSummaryV2(item, isExempt ? "exempt" : "standard")}
      ${renderSourceActions(item)}
      ${renderHistory(item)}
      <div class="card-inputs">
        <div><span class="field-label">지원 판단</span><div class="strategy-control" aria-label="지원 판단">${STRATEGIES.map((value) => `<button type="button" data-strategy-id="${escapeHtml(item.id)}" data-strategy="${value}" class="${item.strategy === value ? "is-active" : ""}" aria-pressed="${item.strategy === value}">${value}</button>`).join("")}</div></div>
        <label class="memo-field"><span class="field-label">상담 메모</span><textarea data-memo-id="${escapeHtml(item.id)}" placeholder="지원 이유, 수능최저 준비, 확인할 내용을 적어보세요.">${escapeHtml(item.memo)}</textarea></label>
      </div>
      <div class="card-detail-actions">
        <button class="secondary-button" type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${isExempt ? "exempt" : "standard"}">2027 전형·순위 수정</button>
        <button class="delete-button" type="button" data-delete-id="${escapeHtml(item.id)}">지원안 삭제</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const state = ConsultationCardStore.read();
  if (expandedCardId && !state.items.some((item) => item.id === expandedCardId)) expandedCardId = "";
  const regularCount = state.slots.slice(0, 6).filter((slot) => slot.item).length;
  const reserveCount = state.slots.slice(6, 9).filter((slot) => slot.item).length;
  byId("savedCount").textContent = `${state.items.length}개 지원안`;
  byId("slotStatus").textContent = `일반지원 ${regularCount}/6 · 예비후보 ${reserveCount}/3 · 제한 외 ${state.exemptItems.length}`;
  const hasConsultationContent = state.consultations.some(consultationHasContent);
  byId("resetCard").disabled = state.items.length === 0 && !state.studentNumber && !state.overallOpinion && !hasConsultationContent;
  byId("reorderCard").disabled = state.standardItems.length === 0;
  byId("reorderCard").textContent = reorderMode ? "순위 편집 완료" : "순위 편집";
  byId("reorderCard").setAttribute("aria-pressed", String(reorderMode));
  byId("cardList").classList.toggle("is-reordering", reorderMode);
  byId("cardList").innerHTML = state.slots.slice(0, state.visibleSlotCount).map((slot) => renderCard(slot)).join("");

  const notice = byId("standardLimitNotice");
  if (state.standardFull) {
    notice.hidden = false;
    notice.innerHTML = "<strong>일반 지원과 예비 후보 9개가 모두 채워졌습니다.</strong><span>다른 지원안을 넣으려면 기존 카드를 삭제하세요.</span>";
  } else {
    notice.hidden = true;
    notice.innerHTML = "";
  }

  byId("exemptList").innerHTML = state.exemptItems.length
    ? state.exemptItems.map((item, index) => renderCard({ slot: index + 1, item }, { bucket: "exempt" })).join("")
    : '<p class="empty-exempt">현재 추가한 제한 제외 대학이 없습니다.</p>';
  updateDocumentStatus(state);
}

let documentSaveTimer = 0;

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function localDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${padNumber(date.getMonth() + 1)}.${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function filenameTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}${padNumber(date.getMonth() + 1)}${padNumber(date.getDate())}_${padNumber(date.getHours())}${padNumber(date.getMinutes())}`;
}

function safeFilenamePart(value, fallback) {
  return String(value || fallback).trim().replace(/[\\/:*?"<>|\s]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function consultationHasContent(entry) {
  return Boolean(entry && (
    entry.date || entry.topics || entry.notes || entry.nextAction ||
    entry.studentConfirmed || entry.guardianConfirmed
  ));
}

function documentHasContent(state) {
  return Boolean(state.studentNumber || state.overallOpinion || state.consultations.some(consultationHasContent));
}

function consultationSessionMarkup(entry, index, open = false) {
  const complete = consultationHasContent(entry);
  return `<details class="consultation-session" data-consultation-index="${index}"${open ? " open" : ""}>
    <summary><strong>${index + 1}차 상담</strong><span data-consultation-status class="${complete ? "is-complete" : ""}">${complete ? "작성됨" : "미작성"}</span></summary>
    <div class="consultation-form">
      <label><span>상담일</span><input type="date" data-consultation-field="date" value="${escapeHtml(entry.date)}"></label>
      <label><span>상담 주제</span><input type="text" data-consultation-field="topics" value="${escapeHtml(entry.topics)}" placeholder="예: 지원 조합 및 수능최저 점검"></label>
      <label class="consultation-wide"><span>상담 내용</span><textarea data-consultation-field="notes" placeholder="비교한 지원안, 확인한 입결, 학생의 강점과 주의점을 기록하세요.">${escapeHtml(entry.notes)}</textarea></label>
      <label class="consultation-wide"><span>다음 확인·준비 사항</span><textarea data-consultation-field="nextAction" placeholder="모집요강 재확인, 서류·면접 준비, 다음 상담 전 확인할 내용을 적으세요.">${escapeHtml(entry.nextAction)}</textarea></label>
      <div class="confirmation-row" aria-label="상담 확인">
        <label><input type="checkbox" data-consultation-field="studentConfirmed"${entry.studentConfirmed ? " checked" : ""}> 학생 확인</label>
        <label><input type="checkbox" data-consultation-field="guardianConfirmed"${entry.guardianConfirmed ? " checked" : ""}> 보호자 확인</label>
      </div>
    </div>
  </details>`;
}

function updateDocumentStatus(state = ConsultationCardStore.read()) {
  byId("lastSavedAt").textContent = state.updatedAt ? localDateTime(state.updatedAt) : "아직 저장 전";
  byId("lastExportedAt").textContent = state.lastExportedAt
    ? `상담카드 파일 ${localDateTime(state.lastExportedAt)}`
    : "상담카드 파일 저장 이력 없음";
  byId("lastPrintedAt").textContent = state.lastPrintedAt
    ? `인쇄·PDF ${localDateTime(state.lastPrintedAt)}`
    : "인쇄·PDF 기록 없음";
}

function updateConsultationStatus(details) {
  if (!details) return;
  const entry = consultationFromElement(details);
  const status = details.querySelector("[data-consultation-status]");
  const complete = consultationHasContent(entry);
  status.textContent = complete ? "작성됨" : "미작성";
  status.classList.toggle("is-complete", complete);
}

function loadDocumentForm() {
  const state = ConsultationCardStore.read();
  byId("studentNumber").value = state.studentNumber;
  byId("overallOpinion").value = state.overallOpinion;
  const hasAny = state.consultations.some(consultationHasContent);
  byId("consultationSessions").innerHTML = state.consultations
    .map((entry, index) => consultationSessionMarkup(entry, index, !hasAny && index === 0))
    .join("");
  updateDocumentStatus(state);
}

function consultationFromElement(details) {
  const readField = (name) => details.querySelector(`[data-consultation-field="${name}"]`);
  return {
    date: readField("date")?.value || "",
    topics: readField("topics")?.value || "",
    notes: readField("notes")?.value || "",
    nextAction: readField("nextAction")?.value || "",
    studentConfirmed: Boolean(readField("studentConfirmed")?.checked),
    guardianConfirmed: Boolean(readField("guardianConfirmed")?.checked)
  };
}

function consultationsFromForm() {
  const details = [...byId("consultationSessions").querySelectorAll("[data-consultation-index]")];
  return details.length ? details.map(consultationFromElement) : ConsultationCardStore.read().consultations;
}

function persistDocumentForm() {
  clearTimeout(documentSaveTimer);
  const state = ConsultationCardStore.updateDocument({
    studentNumber: byId("studentNumber").value,
    consultations: consultationsFromForm(),
    overallOpinion: byId("overallOpinion").value
  });
  updateDocumentStatus(state);
  byId("resetCard").disabled = state.items.length === 0 && !documentHasContent(state);
  return state;
}

function scheduleDocumentSave() {
  clearTimeout(documentSaveTimer);
  documentSaveTimer = setTimeout(persistDocumentForm, 280);
}

function downloadCardFile() {
  persistDocumentForm();
  const exportedAt = new Date();
  const payload = ConsultationCardStore.exportData(exportedAt.toISOString());
  const studentNumber = safeFilenamePart(payload.studentNumber, "학번미입력");
  const filename = `수시지원상담카드_${studentNumber}_${filenameTimestamp(exportedAt)}.anjwacard`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateDocumentStatus(ConsultationCardStore.read());
  showToast(`${filename} 파일을 저장했습니다.`);
}

async function importCardFile(file) {
  if (!file) return;
  const current = ConsultationCardStore.read();
  const hasCurrentData = current.items.length || current.studentNumber || current.overallOpinion || current.consultations.some(consultationHasContent);
  if (hasCurrentData && !window.confirm("현재 상담카드를 불러온 파일의 내용으로 바꿀까요?")) return;
  try {
    const payload = JSON.parse(await file.text());
    ConsultationCardStore.importData(payload);
    expandedCardId = "";
    reorderMode = false;
    closeEditor();
    loadDocumentForm();
    render();
    showToast("상담카드 파일을 불러왔습니다.");
  } catch (error) {
    window.alert(`파일을 불러오지 못했습니다.\n${error.message}`);
  } finally {
    byId("importCardFile").value = "";
  }
}

function printConsultationCard() {
  closeEditor();
  persistDocumentForm();
  const printedAt = new Date();
  const state = ConsultationCardStore.markPrinted(printedAt.toISOString());
  updateDocumentStatus(state);
  const originalTitle = document.title;
  const details = [...byId("consultationSessions").querySelectorAll("details")];
  const openStates = details.map((entry) => entry.open);
  details.forEach((entry) => { entry.open = true; });
  document.title = `수시지원상담카드_${safeFilenamePart(state.studentNumber, "학번미입력")}_${filenameTimestamp(printedAt)}`;

  const restore = () => {
    document.title = originalTitle;
    details.forEach((entry, index) => { entry.open = openStates[index]; });
  };
  window.addEventListener("afterprint", restore, { once: true });
  requestAnimationFrame(() => window.print());
}

async function loadOptionIndex() {
  if (!dataCache.optionIndexPromise) {
    dataCache.optionIndexPromise = fetch("./admission-data/options-2027/index.json?v=20260716e").then((response) => {
      if (!response.ok) throw new Error(`2027 대학 목록을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    });
  }
  return dataCache.optionIndexPromise;
}

async function loadUniversityLinks() {
  if (!dataCache.universityLinksPromise) {
    dataCache.universityLinksPromise = fetch("./admission-data/university-links.json?v=20260716u").then((response) => {
      if (!response.ok) throw new Error(`대학 홈페이지 목록을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    }).then((payload) => {
      dataCache.universityLinks = new Map((payload.universities || []).map((entry) => [entry.code, entry]));
      return payload;
    });
  }
  return dataCache.universityLinksPromise;
}

async function loadHistoryIndex() {
  if (!dataCache.historyIndexPromise) {
    dataCache.historyIndexPromise = fetch("./admission-data/history/index.json?v=20260716j").then((response) => {
      if (!response.ok) throw new Error(`입결 목록을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    });
  }
  return dataCache.historyIndexPromise;
}

async function loadOptionUniversity(code) {
  if (!code) return null;
  if (!dataCache.optionUniversities.has(code)) {
    dataCache.optionUniversities.set(code, fetch(`./admission-data/options-2027/${code}.json?v=20260716e`).then((response) => {
      if (!response.ok) throw new Error(`2027 전형정보를 불러오지 못했습니다: ${response.status}`);
      return response.json();
    }));
  }
  return dataCache.optionUniversities.get(code);
}

async function loadHistoryUniversity(code) {
  if (!code) return { rows: [] };
  const index = await loadHistoryIndex();
  const entry = index.universities.find((university) => university.code === code);
  if (!entry) return { rows: [] };
  if (!dataCache.historyUniversities.has(code)) {
    dataCache.historyUniversities.set(code, fetch(`./admission-data/history/${entry.file}?v=${encodeURIComponent(index.generatedAt)}`).then((response) => {
      if (!response.ok) throw new Error(`과거 입결을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    }));
  }
  return dataCache.historyUniversities.get(code);
}

function matchingUniversity(index, item) {
  const manual = MANUAL_EXEMPT_UNIVERSITIES.find((university) => university.code === item.targetUniversityCode);
  if (manual) return manual;
  if (item.targetUniversityCode) {
    const exactCode = index.universities.find((university) => university.code === item.targetUniversityCode);
    if (exactCode) return exactCode;
  }
  const sameName = index.universities.filter((university) => compactUniversity(university.name) === compactUniversity(item.university));
  return sameName.find((university) => !item.campus || compact(university.campus) === compact(item.campus)) || (sameName.length === 1 ? sameName[0] : null);
}

function populateUniversitySelect(select, index, selectedCode, exemptOnly = false) {
  const universities = allUniversityEntries(index)
    .filter((university) => !exemptOnly || ConsultationCardStore.isExemptUniversity(university.name))
    .sort((left, right) => universityLabel(left).localeCompare(universityLabel(right), "ko"));
  select.disabled = false;
  select.innerHTML = '<option value="">대학·캠퍼스 선택</option>' + universities.map((university) => `<option value="${escapeHtml(university.code)}"${university.code === selectedCode ? " selected" : ""}>${escapeHtml(universityLabel(university))}${ConsultationCardStore.isExemptUniversity(university.name) && !exemptOnly ? " · 6회 제한 외" : ""}</option>`).join("");
}

function inferDepartment(data, item) {
  if (item.targetDepartment) {
    const selected = data.departments.find((department) => department.name === item.targetDepartment);
    if (selected) return selected;
  }
  const legacyKey = compact(item.department);
  if (!legacyKey) return null;
  return data.departments.find((department) => compact(department.name) === legacyKey) || null;
}

function inferOption(department, item) {
  if (!department) return null;
  if (item.targetOptionId) {
    const selected = department.options.find((option) => option.optionId === item.targetOptionId);
    if (selected) return selected;
  }
  const legacyKey = admissionKey(item.admission || item.targetAdmission);
  const legacyCategory = categoryKey(item.category || item.targetCategory);
  if (!legacyKey) return null;
  const matches = department.options.filter((option) => admissionKey(option.admissionName) === legacyKey && (!legacyCategory || categoryKey(option.category) === legacyCategory));
  return matches.length === 1 ? matches[0] : null;
}

function rowMetricCount(row) {
  return [
    row.competitionRate, row.resultMean, row.result50, row.result70,
    row.result75, row.result80, row.result85, row.result90, row.additionalAdmits
  ].filter(Boolean).length;
}

function matchHistory(rows, departmentName, option) {
  const departmentKey = compact(departmentName);
  const optionAdmission = admissionKey(option.admissionName);
  const optionCategory = categoryKey(option.category);
  const sameAdmission = rows.filter((row) => admissionKey(row.admission) === optionAdmission && categoryKey(row.category) === optionCategory);
  const exactDepartment = sameAdmission.filter((row) => compact(row.department) === departmentKey);
  const byYear = new Map();
  exactDepartment.forEach((row) => {
    const current = byYear.get(row.year);
    if (!current || rowMetricCount(row) > rowMetricCount(current)) byYear.set(row.year, { ...row, matchType: "exact" });
  });
  const suggestions = sameAdmission
    .filter((row) => compact(row.department) !== departmentKey)
    .map((row) => ({ ...row, similarity: diceSimilarity(row.department, departmentName), matchType: "similar" }))
    .filter((row) => row.similarity >= 0.34)
    .sort((left, right) => right.similarity - left.similarity || Number(right.year) - Number(left.year));
  const uniqueSuggestions = [];
  const seen = new Set();
  suggestions.forEach((row) => {
    const key = `${row.year}|${row.department}`;
    if (!seen.has(key) && uniqueSuggestions.length < 3) {
      seen.add(key);
      uniqueSuggestions.push(row);
    }
  });
  return { history: YEARS.map((year) => byYear.get(year)).filter(Boolean), suggestions: uniqueSuggestions };
}

function targetChanges(data, department, option, matched) {
  return {
    ...clearedOverrides(),
    university: data.name,
    campus: data.campus || "",
    targetUniversityCode: data.code,
    department: department.name,
    targetDepartment: department.name,
    category: option.category,
    admission: option.admissionName,
    targetOptionId: option.optionId,
    targetAdmission: option.admissionName,
    targetCategory: option.category,
    targetField: option.field || "",
    targetQuota: option.quota == null ? "" : String(option.quota),
    targetQuotaStatus: option.quotaStatus || "",
    targetSelectionMethod: option.selectionMethod || "",
    targetSourceUrl: option.sourceUrl || "",
    targetMinimumStatus: option.minimumStatus || "",
    targetMinimumOfficial: option.minimumStandard || "",
    targetMinimumSubjects: option.minimumSubjects || "",
    targetMinimumSourceUrl: option.minimumSourceUrl || "",
    history: matched.history,
    historySuggestions: matched.suggestions
  };
}

function setDepartmentOptions(select, data, selected) {
  select.disabled = false;
  select.innerHTML = '<option value="">학과·모집단위 선택</option>' + data.departments.map((department) => `<option value="${escapeHtml(department.name)}"${department.name === selected ? " selected" : ""}>${escapeHtml(department.name)}</option>`).join("");
}

function setAdmissionOptions(select, department, selectedId) {
  if (!department) {
    select.disabled = true;
    select.innerHTML = '<option value="">학과를 먼저 선택하세요</option>';
    return;
  }
  select.disabled = false;
  select.innerHTML = '<option value="">전형 선택</option>' + department.options.map((option) => {
    const quota = option.quota == null ? "모집인원 미지정" : `${option.quota}명`;
    return `<option value="${escapeHtml(option.optionId)}"${option.optionId === selectedId ? " selected" : ""}>${escapeHtml(cleanAdmissionName(option.admissionName))} · ${escapeHtml(quota)}</option>`;
  }).join("");
}

function resetTarget(entry) {
  return {
    ...clearedOverrides(),
    university: entry?.name || "",
    campus: entry?.campus || "",
    targetUniversityCode: entry?.code || "",
    department: "",
    category: "",
    admission: "",
    targetDepartment: "",
    targetOptionId: "",
    targetAdmission: "",
    targetCategory: "",
    targetField: "",
    targetQuota: "",
    targetQuotaStatus: "",
    targetSelectionMethod: "",
    targetSourceUrl: "",
    targetMinimumStatus: "",
    targetMinimumOfficial: "",
    targetMinimumSubjects: "",
    targetMinimumSourceUrl: "",
    history: [],
    historySuggestions: []
  };
}

function renderEditorPreview(item) {
  if (!item?.university) return "대학·학과·전형을 선택하면 2027 모집정보와 연결된 과거 입결을 확인할 수 있습니다.";
  const manual = isManualUniversity(item);
  if (!item.targetDepartment) return `<strong>${escapeHtml(item.university)}</strong><span>${manual ? "학과·모집단위를 직접 입력하세요." : "학과·모집단위를 선택하세요."}</span>`;
  if (!manual && !item.targetOptionId) return `<strong>${escapeHtml(item.university)} · ${escapeHtml(item.targetDepartment)}</strong><span>지원 전형을 선택하세요.</span>`;
  if (manual && !item.targetAdmission) return `<strong>${escapeHtml(item.university)} · ${escapeHtml(item.targetDepartment)}</strong><span>지원 전형명을 직접 입력하세요.</span>`;

  const quota = effectiveTargetValue(item, "quota");
  const selectionMethod = effectiveTargetValue(item, "selectionMethod");
  const minimum = effectiveTargetValue(item, "minimum");
  return `<div class="editor-preview-grid">
    <div><span>2027 모집</span><strong>${escapeHtml(quota ? withSuffix(quota, "명") : "인원 미지정")}</strong></div>
    <div><span>전형방법</span><strong>${escapeHtml(selectionMethod || "원문 확인 필요")}</strong></div>
    <div><span>수능최저</span><strong>${escapeHtml(minimum || "모집요강 확인 필요")}</strong></div>
    <div><span>과거 입결</span><strong>${escapeHtml(manual ? "입학처 확인" : `${item.history?.length || 0}/3개년 연결`)}</strong></div>
  </div>`;
}

function syncOverrideEditor(item, { writeInputs = true } = {}) {
  const fields = overrideFields(item);
  Object.entries(OVERRIDE_CONFIG).forEach(([key, config]) => {
    const input = byId(config.input);
    const source = String(item?.[config.source] ?? "").trim();
    const overridden = fields.has(key);
    const value = overridden ? String(item?.[config.override] ?? "") : source;
    if (writeInputs) input.value = value;
    input.disabled = !item?.university;

    const status = document.querySelector(`[data-override-status="${key}"]`);
    const sourceNote = document.querySelector(`[data-override-source="${key}"]`);
    const reset = document.querySelector(`[data-reset-override="${key}"]`);
    const manual = overridden && !source;
    status.textContent = overridden ? (manual ? "직접 입력" : "직접 수정") : (source ? "자동값" : "입력 전");
    status.classList.toggle("is-edited", overridden && !manual);
    status.classList.toggle("is-manual", manual);
    sourceNote.textContent = source ? `공식 원본: ${key === "quota" ? withSuffix(source, "명") : source}` : "공식 원본 입력 없음";
    reset.disabled = !overridden;
  });

  const count = fields.size;
  const countBadge = byId("editorOverrideCount");
  countBadge.textContent = count ? `직접 수정 ${count}개` : "자동값";
  countBadge.classList.toggle("is-edited", count > 0);
  if (count) byId("editorOverrides").open = true;
}

function refreshEditorPreview({ syncOverrides = true } = {}) {
  byId("editorPreview").innerHTML = renderEditorPreview(editorDraft);
  syncOverrideEditor(editorDraft, { writeInputs: syncOverrides });
}

function handleOverrideInput(event) {
  const field = event.target.closest("[data-override-field]");
  if (!field || !editorDraft) return;
  const key = field.dataset.overrideField;
  const config = OVERRIDE_CONFIG[key];
  if (!config || event.target.id !== config.input) return;
  const source = String(editorDraft?.[config.source] ?? "").trim();
  const entered = event.target.value.trim();
  const fields = overrideFields(editorDraft);
  if (entered === source) fields.delete(key);
  else fields.add(key);
  editorDraft = {
    ...editorDraft,
    targetOverrideFields: [...fields],
    [config.override]: fields.has(key) ? entered : ""
  };
  refreshEditorPreview({ syncOverrides: false });
}

function handleOverrideReset(event) {
  const button = event.target.closest("[data-reset-override]");
  if (!button || !editorDraft) return;
  const key = button.dataset.resetOverride;
  const config = OVERRIDE_CONFIG[key];
  if (!config) return;
  const fields = overrideFields(editorDraft);
  fields.delete(key);
  editorDraft = {
    ...editorDraft,
    targetOverrideFields: [...fields],
    [config.override]: ""
  };
  refreshEditorPreview();
}

function setEditorError(message = "") {
  const error = byId("editorError");
  error.textContent = message;
  error.hidden = !message;
}

function setEditorStrategy(value) {
  editorDraft = { ...(editorDraft || {}), strategy: value };
  byId("editorStrategy").querySelectorAll("[data-editor-strategy]").forEach((button) => {
    const active = button.dataset.editorStrategy === value;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function populateRankOptions(state, selectedSlot, editing) {
  const select = byId("editorRank");
  select.innerHTML = state.slots.slice(0, state.visibleSlotCount).map((slot) => {
    const occupied = Boolean(slot.item) && slot.slot !== selectedSlot;
    const suffix = occupied ? ` · ${slot.item.university}와 순위 교환` : "";
    return `<option value="${slot.slot}"${slot.slot === selectedSlot ? " selected" : ""}${occupied && !editing ? " disabled" : ""}>${slotLabel(slot.slot)}${escapeHtml(suffix)}</option>`;
  }).join("");
}

function setEditorFieldMode(entry) {
  const exempt = Boolean(entry && ConsultationCardStore.isExemptUniversity(entry.name));
  const manual = Boolean(entry?.manual);
  editorSession.isExempt = exempt;
  editorSession.isManual = manual;
  byId("editorRankField").hidden = exempt || editorSession.requestedBucket === "exempt";
  byId("editorDepartmentField").hidden = manual;
  byId("editorAdmissionField").hidden = manual;
  byId("editorManualDepartmentField").hidden = !manual;
  byId("editorManualAdmissionField").hidden = !manual;
}

async function configureEditorUniversity(entry, existing = null) {
  const sequence = ++editorSequence;
  editorSession.entry = entry;
  editorSession.data = null;
  editorSession.department = null;
  editorSession.option = null;
  setEditorFieldMode(entry);
  const preserved = {
    strategy: editorDraft?.strategy || "",
    memo: byId("editorMemo").value,
    ...(existing ? copiedOverrides(existing) : clearedOverrides())
  };
  editorDraft = { ...resetTarget(entry), ...preserved };

  if (!entry) {
    byId("editorDepartment").disabled = true;
    byId("editorDepartment").innerHTML = '<option value="">대학을 먼저 선택하세요</option>';
    byId("editorAdmission").disabled = true;
    byId("editorAdmission").innerHTML = '<option value="">학과를 먼저 선택하세요</option>';
    refreshEditorPreview();
    return;
  }

  if (entry.manual) {
    const department = existing?.targetDepartment || existing?.department || "";
    const admission = existing?.targetAdmission || existing?.admission || "";
    byId("editorManualDepartment").value = department;
    byId("editorManualAdmission").value = admission;
    editorDraft = {
      ...editorDraft,
      department,
      targetDepartment: department,
      admission,
      targetAdmission: admission
    };
    refreshEditorPreview();
    return;
  }

  byId("editorDepartment").disabled = true;
  byId("editorDepartment").innerHTML = '<option value="">학과 목록 불러오는 중</option>';
  byId("editorAdmission").disabled = true;
  byId("editorAdmission").innerHTML = '<option value="">학과를 먼저 선택하세요</option>';
  try {
    const data = await loadOptionUniversity(entry.code);
    if (!editorSession || sequence !== editorSequence) return;
    editorSession.data = data;
    const department = existing ? inferDepartment(data, existing) : null;
    setDepartmentOptions(byId("editorDepartment"), data, department?.name || "");
    const option = existing ? inferOption(department, existing) : null;
    setAdmissionOptions(byId("editorAdmission"), department, option?.optionId || "");
    editorSession.department = department;
    editorSession.option = option;
    if (department && option) {
      const historyData = await loadHistoryUniversity(data.code);
      if (!editorSession || sequence !== editorSequence) return;
      const matched = matchHistory(historyData.rows || [], department.name, option);
      editorDraft = { ...editorDraft, ...targetChanges(data, department, option, matched), ...preserved };
    } else if (department) {
      editorDraft = { ...editorDraft, department: department.name, targetDepartment: department.name };
    }
    refreshEditorPreview();
  } catch (error) {
    if (sequence !== editorSequence) return;
    setEditorError(error.message);
  }
}

async function openEditor({ slot = 0, itemId = "", bucket = "standard" } = {}) {
  const state = ConsultationCardStore.read();
  const item = itemId ? state.items.find((candidate) => candidate.id === itemId) : null;
  const sourceSlot = item && bucket === "standard"
    ? state.slots.find((candidate) => candidate.item?.id === item.id)?.slot || 0
    : 0;
  let selectedSlot = sourceSlot || Number(slot);
  if (bucket === "standard" && !selectedSlot) {
    selectedSlot = state.slots.slice(0, state.visibleSlotCount).find((candidate) => !candidate.item)?.slot || 0;
  }
  if (bucket === "standard" && !selectedSlot) {
    showToast("일반 지원과 예비 후보 9개가 모두 채워졌습니다.");
    return;
  }

  returnFocusElement = document.activeElement;
  editorSession = {
    requestedBucket: bucket,
    sourceBucket: item ? bucket : "",
    itemId: item?.id || "",
    sourceSlot,
    selectedSlot,
    entry: null,
    data: null,
    department: null,
    option: null,
    isExempt: bucket === "exempt",
    isManual: false
  };
  editorDraft = item ? { ...item } : { strategy: "", memo: "" };
  populateRankOptions(state, selectedSlot, Boolean(item));
  byId("editorRankField").hidden = bucket === "exempt";
  byId("editorTitle").textContent = item ? "지원안 수정" : bucket === "exempt" ? "별도 지원 대학 추가" : "지원 대학 추가";
  byId("editorEyebrow").textContent = item ? (bucket === "exempt" ? "별도 지원 수정" : slotLabel(sourceSlot)) : "지원안 입력";
  byId("saveEditor").textContent = item ? "수정 내용 저장" : "상담카드에 추가";
  byId("editorMemo").value = item?.memo || "";
  setEditorStrategy(item?.strategy || "");
  setEditorError();
  byId("editorOverrides").open = overrideFields(editorDraft).size > 0;
  refreshEditorPreview();
  byId("cardEditor").hidden = false;
  document.body.classList.add("editor-open");

  try {
    const index = await loadOptionIndex();
    if (!editorSession) return;
    const entry = item ? matchingUniversity(index, item) : null;
    populateUniversitySelect(byId("editorUniversity"), index, entry?.code || "", bucket === "exempt");
    await configureEditorUniversity(entry, item);
    byId("editorUniversity").focus();
  } catch (error) {
    setEditorError(error.message);
  }
}

function closeEditor() {
  if (byId("cardEditor").hidden) return;
  editorSequence += 1;
  byId("cardEditor").hidden = true;
  document.body.classList.remove("editor-open");
  editorSession = null;
  editorDraft = null;
  if (returnFocusElement?.focus) returnFocusElement.focus();
  returnFocusElement = null;
}

async function handleEditorUniversityChange() {
  if (!editorSession) return;
  setEditorError();
  const index = await loadOptionIndex();
  const entry = allUniversityEntries(index).find((university) => university.code === byId("editorUniversity").value) || null;
  byId("editorManualDepartment").value = "";
  byId("editorManualAdmission").value = "";
  await configureEditorUniversity(entry);
}

function handleEditorDepartmentChange() {
  if (!editorSession?.data) return;
  const department = editorSession.data.departments.find((candidate) => candidate.name === byId("editorDepartment").value) || null;
  editorSession.department = department;
  editorSession.option = null;
  setAdmissionOptions(byId("editorAdmission"), department, "");
  editorDraft = {
    ...editorDraft,
    ...clearedOverrides(),
    department: department?.name || "",
    targetDepartment: department?.name || "",
    admission: "",
    category: "",
    targetOptionId: "",
    targetAdmission: "",
    targetCategory: "",
    targetQuota: "",
    targetSelectionMethod: "",
    targetMinimumOfficial: "",
    history: [],
    historySuggestions: []
  };
  refreshEditorPreview();
}

async function handleEditorAdmissionChange() {
  if (!editorSession?.data || !editorSession.department) return;
  const option = editorSession.department.options.find((candidate) => candidate.optionId === byId("editorAdmission").value) || null;
  editorSession.option = option;
  if (!option) {
    editorDraft = {
      ...editorDraft,
      ...clearedOverrides(),
      targetOptionId: "",
      targetAdmission: "",
      history: [],
      historySuggestions: []
    };
    refreshEditorPreview();
    return;
  }
  const sequence = ++editorSequence;
  byId("editorPreview").textContent = "2027 모집정보와 과거 입결을 연결하는 중입니다.";
  try {
    const historyData = await loadHistoryUniversity(editorSession.data.code);
    if (!editorSession || sequence !== editorSequence) return;
    const matched = matchHistory(historyData.rows || [], editorSession.department.name, option);
    editorDraft = {
      ...editorDraft,
      ...targetChanges(editorSession.data, editorSession.department, option, matched)
    };
    refreshEditorPreview();
  } catch (error) {
    setEditorError(error.message);
  }
}

function handleEditorManualInput() {
  if (!editorSession?.isManual) return;
  const department = byId("editorManualDepartment").value.trim();
  const admission = byId("editorManualAdmission").value.trim();
  editorDraft = {
    ...editorDraft,
    department,
    targetDepartment: department,
    admission,
    targetAdmission: admission
  };
  refreshEditorPreview();
}

async function saveEditor(event) {
  event.preventDefault();
  if (!editorSession?.entry || !editorDraft?.university) {
    setEditorError("대학·캠퍼스를 선택하세요.");
    return;
  }
  const memo = byId("editorMemo").value.trim();
  const changes = { ...editorDraft, memo, strategy: editorDraft.strategy || "" };
  if (editorSession.isManual) {
    handleEditorManualInput();
    changes.department = editorDraft.department;
    changes.targetDepartment = editorDraft.targetDepartment;
    changes.admission = editorDraft.admission;
    changes.targetAdmission = editorDraft.targetAdmission;
    if (!changes.targetDepartment || !changes.targetAdmission) {
      setEditorError("학과·모집단위와 전형명을 모두 입력하세요.");
      return;
    }
  } else if (!changes.targetOptionId) {
    setEditorError("학과·모집단위와 지원 전형을 모두 선택하세요.");
    return;
  }

  const isExempt = ConsultationCardStore.isExemptUniversity(changes.university);
  let savedId = editorSession.itemId;
  if (editorSession.itemId) {
    if (editorSession.sourceBucket === "exempt") {
      ConsultationCardStore.update(editorSession.itemId, changes);
    } else if (isExempt) {
      const result = ConsultationCardStore.upsertSlot(editorSession.sourceSlot, { ...changes, id: editorSession.itemId });
      savedId = result.item?.id || savedId;
    } else {
      ConsultationCardStore.update(editorSession.itemId, changes);
      const targetSlot = Number(byId("editorRank").value);
      if (targetSlot && targetSlot !== editorSession.sourceSlot) ConsultationCardStore.move(editorSession.itemId, targetSlot);
    }
  } else if (isExempt) {
    const result = ConsultationCardStore.addExempt(changes);
    if (!result.added) {
      setEditorError("별도 지원 대학을 추가하지 못했습니다.");
      return;
    }
    savedId = result.item.id;
  } else {
    const targetSlot = Number(byId("editorRank").value);
    const result = ConsultationCardStore.upsertSlot(targetSlot, changes);
    if (!result.updated) {
      setEditorError("선택한 순위에 지원안을 추가하지 못했습니다.");
      return;
    }
    savedId = result.item?.id || "";
  }

  expandedCardId = savedId;
  const edited = Boolean(editorSession.itemId);
  closeEditor();
  render();
  showToast(edited ? "지원안을 수정했습니다." : "상담카드에 지원안을 추가했습니다.");
}

async function handleCardClick(event) {
  const openButton = event.target.closest("[data-open-slot]");
  if (openButton) {
    await openEditor({ slot: Number(openButton.dataset.openSlot) });
    return;
  }
  const toggleButton = event.target.closest("[data-toggle-id]");
  if (toggleButton) {
    expandedCardId = expandedCardId === toggleButton.dataset.toggleId ? "" : toggleButton.dataset.toggleId;
    render();
    return;
  }
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    await openEditor({ itemId: editButton.dataset.editId, bucket: editButton.dataset.editBucket || "standard" });
    return;
  }
  const moveButton = event.target.closest("[data-move-id]");
  if (moveButton) {
    const result = ConsultationCardStore.move(moveButton.dataset.moveId, Number(moveButton.dataset.moveTarget));
    if (result.moved) {
      render();
      showToast(result.reason === "swapped" ? "두 지원안의 순위를 교환했습니다." : "지원 순위를 변경했습니다.");
    }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    if (window.confirm("이 지원안을 상담카드에서 삭제할까요?")) {
      ConsultationCardStore.remove(deleteButton.dataset.deleteId);
      render();
      showToast("지원안을 삭제했습니다.");
    }
    return;
  }
  const strategyButton = event.target.closest("[data-strategy-id]");
  if (strategyButton) {
    const state = ConsultationCardStore.read();
    const item = state.items.find((saved) => saved.id === strategyButton.dataset.strategyId);
    const next = item?.strategy === strategyButton.dataset.strategy ? "" : strategyButton.dataset.strategy;
    ConsultationCardStore.update(strategyButton.dataset.strategyId, { strategy: next });
    render();
  }
}

function handleCardInput(event) {
  const textarea = event.target.closest("[data-memo-id]");
  if (!textarea) return;
  clearTimeout(textarea.saveTimer);
  textarea.saveTimer = setTimeout(() => ConsultationCardStore.update(textarea.dataset.memoId, { memo: textarea.value }), 250);
}

byId("cardList").addEventListener("click", handleCardClick);
byId("exemptList").addEventListener("click", handleCardClick);
byId("cardList").addEventListener("input", handleCardInput);
byId("exemptList").addEventListener("input", handleCardInput);
byId("openCardEditor").addEventListener("click", () => openEditor());
byId("openExemptEditor").addEventListener("click", () => openEditor({ bucket: "exempt" }));
byId("reorderCard").addEventListener("click", () => {
  reorderMode = !reorderMode;
  render();
  showToast(reorderMode ? "화살표로 지원 순위를 바꿀 수 있습니다." : "순위 편집을 마쳤습니다.");
});
byId("resetCard").addEventListener("click", () => {
  if (!window.confirm("학번, 지원안, 상담 메모와 상담 기록을 모두 초기화할까요?")) return;
  ConsultationCardStore.clear();
  expandedCardId = "";
  reorderMode = false;
  closeEditor();
  loadDocumentForm();
  render();
  showToast("상담카드를 초기화했습니다.");
});

byId("cardEditor").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-editor]")) closeEditor();
});
byId("editorUniversity").addEventListener("change", handleEditorUniversityChange);
byId("editorDepartment").addEventListener("change", handleEditorDepartmentChange);
byId("editorAdmission").addEventListener("change", handleEditorAdmissionChange);
byId("editorManualDepartment").addEventListener("input", handleEditorManualInput);
byId("editorManualAdmission").addEventListener("input", handleEditorManualInput);
byId("editorOverrides").addEventListener("input", handleOverrideInput);
byId("editorOverrides").addEventListener("click", handleOverrideReset);
byId("editorStrategy").addEventListener("click", (event) => {
  const button = event.target.closest("[data-editor-strategy]");
  if (!button) return;
  const next = editorDraft?.strategy === button.dataset.editorStrategy ? "" : button.dataset.editorStrategy;
  setEditorStrategy(next);
});
byId("cardEditorForm").addEventListener("submit", saveEditor);
byId("studentNumber").addEventListener("input", scheduleDocumentSave);
byId("overallOpinion").addEventListener("input", scheduleDocumentSave);
byId("consultationSessions").addEventListener("input", (event) => {
  updateConsultationStatus(event.target.closest("[data-consultation-index]"));
  scheduleDocumentSave();
});
byId("consultationSessions").addEventListener("change", (event) => {
  updateConsultationStatus(event.target.closest("[data-consultation-index]"));
  persistDocumentForm();
});
byId("exportCard").addEventListener("click", downloadCardFile);
byId("importCard").addEventListener("click", () => byId("importCardFile").click());
byId("importCardFile").addEventListener("change", (event) => importCardFile(event.target.files?.[0]));
byId("printCard")?.addEventListener("click", printConsultationCard);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !byId("cardEditor").hidden) closeEditor();
});
window.addEventListener("storage", () => {
  loadDocumentForm();
  render();
});

loadDocumentForm();
render();
loadUniversityLinks().then(render).catch((error) => console.warn(error));
