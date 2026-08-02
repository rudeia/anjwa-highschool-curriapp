const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);

const YEARS = ["2024", "2025", "2026"];
const STRATEGIES = ["상향", "적정", "안정"];
const REFERENCE_GRADE_STORAGE_KEY = "anjwa.admissionSearch.referenceGrade";
const MANUAL_EXEMPT_UNIVERSITIES = [
  { code: "EXEMPT-KAIST", name: "한국과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-GIST", name: "광주과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-DGIST", name: "대구경북과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-UNIST", name: "울산과학기술원", campus: "본교", manual: true },
  { code: "EXEMPT-KENTECH", name: "한국에너지공과대학교", campus: "본교", manual: true },
  { code: "EXEMPT-NUCH", name: "한국전통문화대학교", campus: "본교", manual: true }
];
const SUCCESSOR_UNIVERSITY_CODES = new Map([
  ["0000001", "0003363"],
  ["0000002", "0003364"]
]);
const OVERRIDE_CONFIG = {
  quota: { source: "targetQuota", override: "targetQuotaOverride", input: "editorQuotaOverride", fallback: "모집인원 미지정" },
  selectionMethod: { source: "targetSelectionMethod", override: "targetSelectionMethodOverride", input: "editorSelectionMethodOverride", fallback: "원문 확인 필요" },
  minimum: { source: "targetMinimumOfficial", override: "targetMinimumOverride", input: "editorMinimumOverride", fallback: "모집요강 확인 필요" },
  announcementDate: { source: "targetAnnouncementDate", override: "targetAnnouncementDateOverride", input: "editorAnnouncementDateOverride", fallback: "직접 입력 필요" }
};
Object.assign(OVERRIDE_CONFIG.quota, {
  reference: "targetReferenceQuota",
  status: "targetQuotaDataStatus"
});
Object.assign(OVERRIDE_CONFIG.selectionMethod, {
  reference: "targetReferenceSelectionMethod",
  status: "targetSelectionMethodDataStatus"
});
Object.assign(OVERRIDE_CONFIG.minimum, {
  reference: "targetReferenceMinimum",
  status: "targetMinimumDataStatus"
});
const DATA_STATUS_LABELS = {
  official_confirmed: "대학어디가 확인",
  official_confirmed_reference_conflict: "공식값 우선",
  counseling_reference_exact: "상담자료 보완",
  official_not_entered: "원문 미입력",
  official_non_csat_detail: "별도 기준 확인"
};
const DATA_STATUS_DESCRIPTIONS = {
  official_confirmed: "대학어디가 2027학년도 모집정보에서 확인한 값입니다.",
  official_confirmed_reference_conflict: "대학어디가 값을 표시합니다. 상담자료와 차이가 있어 모집요강을 다시 확인하세요.",
  counseling_reference_exact: "대학·학과·전형이 정확히 일치한 상담자료로 빈 값을 보완했습니다. 지원 전 모집요강을 확인하세요.",
  official_not_entered: "대학어디가에 값이 입력되지 않았습니다. 대학 모집요강을 확인하세요.",
  official_non_csat_detail: "수능최저가 아닌 별도 지원 기준일 수 있습니다. 대학 모집요강을 확인하세요."
};
const dataCache = {
  optionIndexPromise: null,
  recommendationIndexPromise: null,
  historyIndexPromise: null,
  lineageIndexPromise: null,
  universityLinksPromise: null,
  optionUniversities: new Map(),
  historyUniversities: new Map(),
  lineageUniversities: new Map(),
  universityLinks: new Map()
};

let expandedCardId = "";
let reorderMode = false;
let historyReferencePicker = null;
let editorSession = null;
let editorDraft = null;
let editorSequence = 0;
let returnFocusElement = null;
let gradeEditorRecordId = "";
let gradeReturnFocusElement = null;
let similarDepartmentSession = null;
let similarDepartmentReturnFocusElement = null;
let feedbackSession = null;
let feedbackReturnFocusElement = null;

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

function historyCountWithUnit(value, unit) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return /[가-힣]/.test(text) ? text : `${text}${unit}`;
}

function historyAdditionalInfo(entry) {
  const type = String(entry.additionalMetricType || "").trim()
    || (entry.waitlistLastRank ? "waitlist_last_rank" : entry.additionalAdmits ? "unknown" : "none");
  if (type === "additional_count" && entry.additionalAdmits) {
    return { label: entry.additionalMetricLabel || "충원인원", value: historyCountWithUnit(entry.additionalAdmits, "명") };
  }
  if (type === "waitlist_last_rank" && entry.waitlistLastRank) {
    return { label: entry.additionalMetricLabel || "최종 충원순위", value: historyCountWithUnit(entry.waitlistLastRank, "번") };
  }
  if (type === "unknown" && (entry.additionalAdmits || entry.waitlistLastRank)) {
    return { label: entry.additionalMetricLabel || "추합·충원 공개값", value: `공개값 ${entry.additionalAdmits || entry.waitlistLastRank}` };
  }
  const suppressed = new Set(entry.suppressedFields || []);
  return {
    label: "추합·충원 관련값",
    value: suppressed.has("additional_admits") || suppressed.has("waitlist_last_rank") ? "미공개" : "-"
  };
}

function showToast(message) {
  const toast = byId("cardToast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function gradeCourseTypeLabel(value) {
  return value === "career" ? "진로선택" : "공통·일반선택";
}

function gradeCurriculumCategoryLabel(value) {
  return value === "specialized" ? "전문교과" : "보통교과";
}

function gradeRecordComplete(record) {
  if (!record.subjectName || !Number(record.credits)) return false;
  if (record.passFail) return true;
  if (record.courseType === "career") return Boolean(record.achievement);
  return Number(record.rankGrade) >= 1 && Number(record.rankGrade) <= 9;
}

function gradeRecordValue(record) {
  if (record.passFail) return "P/F";
  if (record.courseType === "career") {
    return [
      record.achievement ? `성취도 ${record.achievement}` : "성취도 미입력",
      record.rankGrade ? `${record.rankGrade}등급` : ""
    ].filter(Boolean).join(" · ");
  }
  return record.rankGrade ? `${Number(record.rankGrade).toFixed(Number(record.rankGrade) % 1 ? 2 : 0)}등급` : "석차등급 미입력";
}

function gradeRecordMarkup(record) {
  const complete = gradeRecordComplete(record);
  return `<article class="grade-record${complete ? "" : " is-incomplete"}" data-grade-record-id="${escapeHtml(record.id)}">
    <div class="grade-record-period"><strong>${escapeHtml(record.schoolYear)}-${escapeHtml(record.semester)}</strong><span>학년-학기</span></div>
    <div class="grade-record-identity">
      <span>${escapeHtml(record.subjectGroup)} · ${escapeHtml(gradeCourseTypeLabel(record.courseType))} · ${escapeHtml(gradeCurriculumCategoryLabel(record.curriculumCategory))}</span>
      <strong>${escapeHtml(record.subjectName)}</strong>
      ${record.note ? `<small>${escapeHtml(record.note)}</small>` : ""}
    </div>
    <div class="grade-record-values">
      <span><b>${escapeHtml(record.credits ?? "-")}</b>이수단위</span>
      <span class="${complete ? "" : "is-warning"}"><b>${escapeHtml(gradeRecordValue(record))}</b>${complete ? "성적" : "확인 필요"}</span>
    </div>
    <div class="grade-record-buttons">
      <button type="button" data-edit-grade="${escapeHtml(record.id)}">수정</button>
      <button type="button" class="is-delete" data-delete-grade="${escapeHtml(record.id)}">삭제</button>
    </div>
  </article>`;
}

function renderGradeRecords(state = ConsultationCardStore.read()) {
  const records = [...(state.gradeRecords || [])].sort((left, right) => (
    Number(left.schoolYear) - Number(right.schoolYear)
    || Number(left.semester) - Number(right.semester)
    || String(left.subjectGroup).localeCompare(String(right.subjectGroup), "ko")
    || String(left.subjectName).localeCompare(String(right.subjectName), "ko")
  ));
  const general = records.filter((record) => record.courseType === "common-general").length;
  const career = records.filter((record) => record.courseType === "career").length;
  const creditSum = records.reduce((sum, record) => sum + (Number(record.credits) || 0), 0);
  const incomplete = records.filter((record) => !gradeRecordComplete(record)).length;
  byId("gradeRecordCount").textContent = records.length;
  byId("generalRecordCount").textContent = general;
  byId("careerRecordCount").textContent = career;
  byId("gradeCreditSum").textContent = Number.isInteger(creditSum) ? creditSum : creditSum.toFixed(1);
  byId("gradeRecordStatus").textContent = records.length
    ? incomplete
      ? `${records.length}과목 중 ${incomplete}과목의 등급·성취도를 확인해야 합니다.`
      : `${records.length}과목의 필수값이 입력되었습니다. 대학별 반영 교과와 예외 규칙은 계산 단계에서 다시 확인합니다.`
    : "입력한 과목이 없습니다. 대학 환산점수는 과목별 자료가 있어야 계산할 수 있습니다.";
  byId("gradeRecordStatus").classList.toggle("is-warning", incomplete > 0);
  byId("gradeRecordList").innerHTML = records.length
    ? records.map(gradeRecordMarkup).join("")
    : '<div class="grade-record-empty"><strong>학생부 과목을 추가하세요.</strong><span>한 과목씩 입력하거나 스프레드시트에서 여러 과목을 붙여넣을 수 있습니다.</span></div>';
  renderUniversityCalculator(state);
}

function calculatorRecordMarkup(record, excluded = false) {
  const careerValue = [
    record.achievement ? `성취도 ${record.achievement}` : "",
    record.rankGrade ? `${record.rankGrade}등급` : ""
  ].filter(Boolean).join(" · ") || "등급·성취도 없음";
  const value = excluded
    ? record.reason
    : `${record.credits}단위 · ${record.courseType === "career" ? careerValue : `${record.rankGrade}등급`} → ${record.score}점`;
  return `<span class="${excluded ? "is-excluded" : ""}"><b>${escapeHtml(record.schoolYear)}-${escapeHtml(record.semester)}</b><strong>${escapeHtml(record.subjectName || "과목명 없음")}</strong><small>${escapeHtml(record.subjectGroup || "기타")} · ${escapeHtml(value)}</small></span>`;
}

function calculatorNoticeList(items, className) {
  if (!items.length) return "";
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

const UNIVERSITY_CALCULATOR_CONFIG = Object.freeze({
  sejong: Object.freeze({
    ruleKey: "sejong2027",
    selectionKey: "sejong2027",
    title: "세종대학교 2027 학생부 환산",
    description: "입력한 과목 중 선택 계열의 반영 교과를 3학년 1학기까지 계산합니다.",
    sourceUrl: "https://ipsi.sejong.ac.kr/board/upload_file/pdf/20266159234314522.pdf",
    sourceLabel: "2027 수시모집요강 22쪽 확인"
  }),
  kookmin: Object.freeze({
    ruleKey: "kookmin2027",
    selectionKey: "kookmin2027",
    title: "국민대학교 2027 학생부 환산",
    description: "보통교과 중 계열별 반영 교과와 진로선택 성취도 상위 3과목을 계산합니다.",
    sourceUrl: "https://admission.kookmin.ac.kr/helper/notice.php?ctype=view&no=1066&s_key=subject&s_word=%EA%B0%80%EC%9D%B4%EB%93%9C",
    sourceLabel: "2027 학생부위주전형 가이드북 확인"
  }),
  dongguk: Object.freeze({
    ruleKey: "dongguk2027",
    selectionKey: "dongguk2027",
    title: "동국대학교(서울) 2027 학생부 환산",
    description: "계열별 반영 교과의 석차등급 상위 10과목을 이수단위 없이 계산합니다.",
    sourceUrl: "https://ipsi.dongguk.edu/upload/file/202605291309499DW33F.PDF",
    sourceLabel: "2027 수시모집요강 44·85~86쪽 확인"
  })
});

function calculatorUniversityIdFromName(university) {
  const raw = String(university || "").replace(/\s+/g, "");
  if (/WISE/i.test(raw)) return "";
  if (["동국대학교", "동국대", "동국대학교(서울)", "동국대(서울)"].includes(raw)) return "dongguk";
  const compact = raw
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/대학교$/u, "대");
  if (compact === "세종대") return "sejong";
  if (compact === "국민대") return "kookmin";
  return "";
}

function calculatorUniversityLabel(universityId) {
  if (universityId === "kookmin") return "국민대학교";
  if (universityId === "dongguk") return "동국대학교(서울)";
  return "세종대학교";
}

function selectCalculatorUniversity(universityId, options = {}) {
  if (!UNIVERSITY_CALCULATOR_CONFIG[universityId]) return false;
  const current = ConsultationCardStore.read();
  const state = current.gradeCalculatorSelections.activeUniversity === universityId
    ? current
    : ConsultationCardStore.updateDocument({
      gradeCalculatorSelections: {
        ...current.gradeCalculatorSelections,
        activeUniversity: universityId
      }
    });
  renderUniversityCalculator(state);

  if (options.scroll) {
    const section = byId("universityGradeCalculator");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    requestAnimationFrame(() => {
      section?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      byId("calculatorUniversity")?.focus({ preventScroll: true });
    });
  }
  if (options.notify) {
    showToast(`${calculatorUniversityLabel(universityId)} 환산계산기로 이동했습니다. 지원 계열을 확인하세요.`);
  }
  return true;
}

function renderUniversityCalculator(state = ConsultationCardStore.read()) {
  const calculators = window.AdmissionGradeCalculators;
  const universitySelect = byId("calculatorUniversity");
  const trackSelect = byId("calculatorTrack");
  if (!calculators || !universitySelect || !trackSelect) return;
  const selections = state.gradeCalculatorSelections || {};
  const activeUniversity = UNIVERSITY_CALCULATOR_CONFIG[selections.activeUniversity]
    ? selections.activeUniversity
    : "sejong";
  const config = UNIVERSITY_CALCULATOR_CONFIG[activeUniversity];
  const rule = calculators.rules[config.ruleKey];
  const tracks = Object.entries(rule.tracks);
  const savedTrack = selections[config.selectionKey];
  const trackId = rule.tracks[savedTrack] ? savedTrack : tracks[0][0];

  universitySelect.value = activeUniversity;
  trackSelect.innerHTML = tracks
    .map(([id, track]) => `<option value="${escapeHtml(id)}"${id === trackId ? " selected" : ""}>${escapeHtml(track.label)}</option>`)
    .join("");
  byId("universityCalculatorHeading").textContent = config.title;
  byId("universityCalculatorDescription").textContent = config.description;
  const sourceLink = byId("calculatorSourceLink");
  sourceLink.href = config.sourceUrl;
  sourceLink.innerHTML = `${escapeHtml(config.sourceLabel)} <b aria-hidden="true">↗</b>`;

  if (activeUniversity === "kookmin") renderKookminCalculator(state, trackId);
  else if (activeUniversity === "dongguk") renderDonggukCalculator(state, trackId);
  else renderSejongCalculator(state, trackId);
}

function renderSejongCalculator(state = ConsultationCardStore.read(), trackId = state.gradeCalculatorSelections?.sejong2027 || "humanities") {
  const container = byId("universityCalculatorResult");
  if (!container || !window.AdmissionGradeCalculators) return;
  const result = window.AdmissionGradeCalculators.calculateSejong2027(state.gradeRecords, trackId);
  const track = result.track || result.rule.tracks[trackId];
  if (!state.gradeRecords.length) {
    container.innerHTML = `<div class="calculator-empty">
      <strong>계산할 과목이 없습니다.</strong>
      <span>${escapeHtml(track.label)} 반영 교과 ${escapeHtml(track.subjects.join("·"))} 과목을 먼저 입력하세요.</span>
    </div>`;
    return;
  }

  const summary = result.summary || {
    commonGeneralCount: 0,
    careerCount: 0,
    commonCredits: 0,
    careerCredits: 0,
    reflectedCredits: 0
  };
  const includedMarkup = result.included.length
    ? `<div class="calculator-record-grid">${result.included.map((record) => calculatorRecordMarkup(record)).join("")}</div>`
    : '<p class="calculator-detail-empty">반영된 과목이 없습니다.</p>';
  const excludedMarkup = result.excluded.length
    ? `<div class="calculator-record-grid">${result.excluded.map((record) => calculatorRecordMarkup(record, true)).join("")}</div>`
    : '<p class="calculator-detail-empty">제외된 과목이 없습니다.</p>';

  if (!result.ok) {
    container.innerHTML = `<div class="calculator-error-summary">
      <strong>환산점수를 계산하려면 입력값을 확인하세요.</strong>
      <span>${escapeHtml(track.label)} · 반영 교과 ${escapeHtml(track.subjects.join("·"))}</span>
    </div>
    ${calculatorNoticeList(result.errors, "calculator-errors")}
    ${calculatorNoticeList(result.warnings, "calculator-warnings")}
    <details class="calculator-breakdown">
      <summary>과목 반영 내역 <b>${result.included.length}과목 반영 · ${result.excluded.length}과목 제외</b></summary>
      <h4>반영 과목</h4>${includedMarkup}
      <h4>제외 과목</h4>${excludedMarkup}
    </details>`;
    return;
  }

  const careerDescription = result.careerAverage === null
    ? "진로선택 과목 없음 · 공통·일반 100%"
    : `${result.careerAverageRaw.toFixed(10)} × ${Math.round(result.careerWeight * 100)}%`;
  const formula = result.careerAverage === null
    ? `${result.commonAverageRaw.toFixed(10)} × 100%`
    : `${result.commonAverageRaw.toFixed(10)} × ${Math.round(result.commonWeight * 100)}% + ${careerDescription}`;
  container.innerHTML = `<div class="calculator-score-head">
    <div>
      <span>${escapeHtml(track.label)} · 1,000점 기준</span>
      <strong>${result.score.toFixed(8)}</strong>
      <small>소수점 아홉째 자리에서 절사</small>
    </div>
    <dl>
      <div><dt>공통·일반선택</dt><dd>${result.commonAverage.toFixed(8)} <small>${summary.commonGeneralCount}과목 · ${summary.commonCredits}단위</small></dd></div>
      <div><dt>진로선택</dt><dd>${result.careerAverage === null ? "미반영" : result.careerAverage.toFixed(8)} <small>${summary.careerCount}과목 · ${summary.careerCredits}단위</small></dd></div>
      <div><dt>반영 교과</dt><dd>${escapeHtml(track.subjects.join("·"))}<small>총 ${summary.reflectedCredits}단위</small></dd></div>
    </dl>
  </div>
  <p class="calculator-formula"><b>계산식</b><span>${escapeHtml(formula)} · 중간 평균은 반올림하지 않음</span></p>
  ${calculatorNoticeList(result.warnings, "calculator-warnings")}
  <details class="calculator-breakdown">
    <summary>반영·제외 과목 확인 <b>${result.included.length}과목 반영 · ${result.excluded.length}과목 제외</b></summary>
    <h4>반영 과목</h4>${includedMarkup}
    <h4>제외 과목</h4>${excludedMarkup}
  </details>`;
}

function renderKookminCalculator(state = ConsultationCardStore.read(), trackId = state.gradeCalculatorSelections?.kookmin2027 || "humanities") {
  const container = byId("universityCalculatorResult");
  if (!container || !window.AdmissionGradeCalculators) return;
  const result = window.AdmissionGradeCalculators.calculateKookmin2027(
    state.gradeRecords,
    trackId,
    state.academicProfile
  );
  const track = result.track || result.rule.tracks[trackId];
  if (!state.gradeRecords.length) {
    container.innerHTML = `<div class="calculator-empty">
      <strong>계산할 과목이 없습니다.</strong>
      <span>${escapeHtml(track.label)} 공통·일반 반영 교과 ${escapeHtml(track.commonSubjects.join("·"))} 과목을 먼저 입력하세요.</span>
    </div>`;
    return;
  }

  const summary = result.summary || {
    commonGeneralCount: 0,
    careerCount: 0,
    commonCredits: 0,
    careerCredits: 0,
    reflectedCredits: 0,
    legacyGraduate: false
  };
  const includedMarkup = result.included.length
    ? `<div class="calculator-record-grid">${result.included.map((record) => calculatorRecordMarkup(record)).join("")}</div>`
    : '<p class="calculator-detail-empty">반영된 과목이 없습니다.</p>';
  const excludedMarkup = result.excluded.length
    ? `<div class="calculator-record-grid">${result.excluded.map((record) => calculatorRecordMarkup(record, true)).join("")}</div>`
    : '<p class="calculator-detail-empty">제외된 과목이 없습니다.</p>';

  if (!result.ok) {
    container.innerHTML = `<div class="calculator-error-summary">
      <strong>환산점수를 계산하려면 입력값을 확인하세요.</strong>
      <span>${escapeHtml(track.label)} · 공통·일반 ${escapeHtml(track.commonSubjects.join("·"))}</span>
    </div>
    ${calculatorNoticeList(result.errors, "calculator-errors")}
    ${calculatorNoticeList(result.warnings, "calculator-warnings")}
    <details class="calculator-breakdown">
      <summary>과목 반영 내역 <b>${result.included.length}과목 반영 · ${result.excluded.length}과목 제외</b></summary>
      <h4>반영 과목</h4>${includedMarkup}
      <h4>제외 과목</h4>${excludedMarkup}
    </details>`;
    return;
  }

  const careerDescription = result.careerAverage === null
    ? "진로선택 미반영 · 공통·일반 100%"
    : `${result.careerAverageRaw.toFixed(10)} × ${Math.round(result.careerWeight * 100)}%`;
  const formula = result.careerAverage === null
    ? `${result.commonAverageRaw.toFixed(10)} × 100% × 10`
    : `(${result.commonAverageRaw.toFixed(10)} × ${Math.round(result.commonWeight * 100)}% + ${careerDescription}) × 10`;
  const careerSummary = summary.legacyGraduate
    ? "2021년 졸업자까지 · 미반영"
    : `${summary.careerCount}과목 · ${summary.careerCredits}단위`;
  container.innerHTML = `<div class="calculator-score-head">
    <div>
      <span>${escapeHtml(track.label)} · 1,000점 기준</span>
      <strong>${result.score.toFixed(8)}</strong>
      <small>보통교과 기준 상담용 계산값</small>
    </div>
    <dl>
      <div><dt>공통·일반선택</dt><dd>${result.commonAverage.toFixed(8)} <small>${summary.commonGeneralCount}과목 · ${summary.commonCredits}단위</small></dd></div>
      <div><dt>진로선택 상위 3</dt><dd>${result.careerAverage === null ? "미반영" : result.careerAverage.toFixed(8)} <small>${escapeHtml(careerSummary)}</small></dd></div>
      <div><dt>반영 교과</dt><dd>${escapeHtml(track.commonSubjects.join("·"))}<small>총 ${summary.reflectedCredits}단위</small></dd></div>
    </dl>
  </div>
  <p class="calculator-formula"><b>계산식</b><span>${escapeHtml(formula)}</span></p>
  ${calculatorNoticeList(result.warnings, "calculator-warnings")}
  <details class="calculator-breakdown">
    <summary>반영·제외 과목 확인 <b>${result.included.length}과목 반영 · ${result.excluded.length}과목 제외</b></summary>
    <h4>반영 과목</h4>${includedMarkup}
    <h4>제외 과목</h4>${excludedMarkup}
  </details>`;
}

function renderDonggukCalculator(state = ConsultationCardStore.read(), trackId = state.gradeCalculatorSelections?.dongguk2027 || "humanities") {
  const container = byId("universityCalculatorResult");
  if (!container || !window.AdmissionGradeCalculators) return;
  const result = window.AdmissionGradeCalculators.calculateDongguk2027(
    state.gradeRecords,
    trackId,
    state.academicProfile
  );
  const track = result.track || result.rule.tracks[trackId];
  if (!state.gradeRecords.length) {
    container.innerHTML = `<div class="calculator-empty">
      <strong>계산할 과목이 없습니다.</strong>
      <span>${escapeHtml(track.label)} 반영 교과 ${escapeHtml(track.subjects.join("·"))} 과목을 10과목 이상 입력하세요.</span>
    </div>`;
    return;
  }

  const summary = result.summary || { reflectedCount: 0, excludedCount: 0, topCount: 10 };
  const includedMarkup = result.included.length
    ? `<div class="calculator-record-grid">${result.included.map((record) => calculatorRecordMarkup(record)).join("")}</div>`
    : '<p class="calculator-detail-empty">반영된 과목이 없습니다.</p>';
  const excludedMarkup = result.excluded.length
    ? `<div class="calculator-record-grid">${result.excluded.map((record) => calculatorRecordMarkup(record, true)).join("")}</div>`
    : '<p class="calculator-detail-empty">제외된 과목이 없습니다.</p>';

  if (!result.ok) {
    container.innerHTML = `<div class="calculator-error-summary">
      <strong>환산점수를 계산하려면 입력값을 확인하세요.</strong>
      <span>${escapeHtml(track.label)} · 석차등급 상위 ${summary.topCount}과목</span>
    </div>
    ${calculatorNoticeList(result.errors, "calculator-errors")}
    ${calculatorNoticeList(result.warnings, "calculator-warnings")}
    <details class="calculator-breakdown">
      <summary>과목 반영 내역 <b>${result.included.length}과목 후보 · ${result.excluded.length}과목 제외</b></summary>
      <h4>반영 후보 과목</h4>${includedMarkup}
      <h4>제외 과목</h4>${excludedMarkup}
    </details>`;
    return;
  }

  const period = state.academicProfile?.schoolStatus === "graduated"
    ? "졸업생 · 전 학년"
    : "재학생 · 3학년 1학기까지";
  const formula = `(${result.pointSum.toFixed(2)} ÷ 10) ÷ 10 × 700`;
  container.innerHTML = `<div class="calculator-score-head">
    <div>
      <span>${escapeHtml(track.label)} · 700점 기준</span>
      <strong>${result.score.toFixed(8)}</strong>
      <small>학교장추천인재 · 상담용 계산값</small>
    </div>
    <dl>
      <div><dt>10점 환산 평균</dt><dd>${result.averagePoint.toFixed(8)} <small>상위 10과목</small></dd></div>
      <div><dt>석차등급 평균</dt><dd>${result.averageGrade.toFixed(8)} <small>이수단위 미적용</small></dd></div>
      <div><dt>반영 학기</dt><dd>${escapeHtml(period)}<small>${escapeHtml(track.subjects.join("·"))}</small></dd></div>
    </dl>
  </div>
  <p class="calculator-formula"><b>계산식</b><span>${escapeHtml(formula)}</span></p>
  ${calculatorNoticeList(result.warnings, "calculator-warnings")}
  <details class="calculator-breakdown">
    <summary>상위 10과목·제외 과목 확인 <b>${result.included.length}과목 반영 · ${result.excluded.length}과목 제외</b></summary>
    <h4>반영 과목</h4>${includedMarkup}
    <h4>제외 과목</h4>${excludedMarkup}
  </details>`;
}

function syncGradeEditorFields() {
  const passFail = byId("gradePassFail").checked;
  const career = byId("gradeCourseType").value === "career";
  byId("rankGradeField").hidden = passFail;
  byId("achievementField").hidden = passFail || !career;
  byId("gradeRankGrade").required = !passFail && !career;
  byId("gradeAchievement").required = !passFail && career;
  byId("rankGradeLabel").textContent = career ? "석차등급 (표기된 경우)" : "석차등급";
}

function setGradeEditorError(message = "") {
  byId("gradeEditorError").textContent = message;
  byId("gradeEditorError").hidden = !message;
}

function populateGradeSubjectGroups(selected = "국어") {
  byId("gradeSubjectGroup").innerHTML = ConsultationCardStore.SUBJECT_GROUPS
    .map((group) => `<option value="${escapeHtml(group)}"${group === selected ? " selected" : ""}>${escapeHtml(group)}</option>`)
    .join("");
}

function openGradeEditor(recordId = "") {
  const state = ConsultationCardStore.read();
  const record = state.gradeRecords.find((candidate) => candidate.id === recordId) || null;
  const latest = state.gradeRecords.at(-1);
  gradeEditorRecordId = record?.id || "";
  gradeReturnFocusElement = document.activeElement;
  byId("gradeEditorTitle").textContent = record ? "과목 수정" : "과목 추가";
  byId("gradeSchoolYear").value = record?.schoolYear || latest?.schoolYear || 1;
  byId("gradeSemester").value = record?.semester || latest?.semester || 1;
  populateGradeSubjectGroups(record?.subjectGroup || latest?.subjectGroup || "국어");
  byId("gradeSubjectName").value = record?.subjectName || "";
  byId("gradeCourseType").value = record?.courseType || "common-general";
  byId("gradeCurriculumCategory").value = record?.curriculumCategory || "regular";
  byId("gradeCredits").value = record?.credits ?? "";
  byId("gradeRankGrade").value = record?.rankGrade ?? "";
  byId("gradeAchievement").value = record?.achievement || "";
  byId("gradePassFail").checked = Boolean(record?.passFail);
  byId("gradeNote").value = record?.note || "";
  setGradeEditorError();
  syncGradeEditorFields();
  byId("gradeEditor").hidden = false;
  document.body.classList.add("editor-open");
  requestAnimationFrame(() => byId("gradeSubjectName").focus());
}

function closeGradeEditor() {
  if (byId("gradeEditor").hidden) return;
  byId("gradeEditor").hidden = true;
  gradeEditorRecordId = "";
  document.body.classList.remove("editor-open");
  if (gradeReturnFocusElement?.focus) gradeReturnFocusElement.focus();
  gradeReturnFocusElement = null;
}

function saveGradeRecord(event) {
  event.preventDefault();
  setGradeEditorError();
  const passFail = byId("gradePassFail").checked;
  const courseType = byId("gradeCourseType").value;
  const record = {
    schoolYear: Number(byId("gradeSchoolYear").value),
    semester: Number(byId("gradeSemester").value),
    subjectGroup: byId("gradeSubjectGroup").value,
    subjectName: byId("gradeSubjectName").value,
    courseType,
    curriculumCategory: byId("gradeCurriculumCategory").value,
    credits: Number(byId("gradeCredits").value),
    rankGrade: passFail || byId("gradeRankGrade").value === "" ? null : Number(byId("gradeRankGrade").value),
    achievement: passFail || courseType !== "career" ? "" : byId("gradeAchievement").value,
    passFail,
    note: byId("gradeNote").value
  };
  if (!record.subjectName.trim()) return setGradeEditorError("과목명을 입력하세요.");
  if (!Number.isFinite(record.credits) || record.credits <= 0) return setGradeEditorError("이수단위·학점을 입력하세요.");
  if (!passFail && courseType === "common-general" && !(Number.isInteger(record.rankGrade) && record.rankGrade >= 1 && record.rankGrade <= 9)) {
    return setGradeEditorError("공통·일반선택 과목의 석차등급을 정수 1~9로 입력하세요.");
  }
  if (!passFail && courseType === "career" && record.rankGrade !== null && !(Number.isInteger(record.rankGrade) && record.rankGrade >= 1 && record.rankGrade <= 9)) {
    return setGradeEditorError("진로선택 과목의 석차등급은 표기된 경우에만 정수 1~9로 입력하세요.");
  }
  if (!passFail && courseType === "career" && !record.achievement) {
    return setGradeEditorError("진로선택 과목의 성취도를 선택하세요.");
  }
  const editing = Boolean(gradeEditorRecordId);
  const result = editing
    ? ConsultationCardStore.updateGradeRecord(gradeEditorRecordId, record)
    : ConsultationCardStore.addGradeRecord(record);
  if (!(result.updated || result.added)) return setGradeEditorError("과목을 저장하지 못했습니다.");
  closeGradeEditor();
  render();
  showToast(editing ? "과목 성적을 수정했습니다." : "과목 성적을 추가했습니다.");
}

function splitGradePasteLine(line, delimiter) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function normalizedSubjectGroup(value) {
  const compacted = String(value || "").replace(/[\s·ㆍ]/g, "").replace("기술가정", "기술·가정");
  return ConsultationCardStore.SUBJECT_GROUPS.find((group) => group.replace(/[\s·ㆍ]/g, "") === compacted.replace(/[\s·ㆍ]/g, "")) || "기타";
}

function parseGradePaste(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records = [];
  const errors = [];
  lines.forEach((line, index) => {
    const delimiter = line.includes("\t") ? "\t" : ",";
    const cells = splitGradePasteLine(line, delimiter);
    if (index === 0 && /학년/.test(cells[0]) && /학기/.test(cells[1] || "")) return;
    const [schoolYear, semester, subjectGroup, subjectName, courseTypeText, credits, rankGradeText, achievementText, curriculumCategoryText] = cells;
    const rowNumber = index + 1;
    const courseType = /진로/.test(courseTypeText || "") ? "career" : /공통|일반/.test(courseTypeText || "") ? "common-general" : "";
    const curriculumCategory = /전문/.test(curriculumCategoryText || "") ? "specialized" : "regular";
    const passFail = /^(P\/?F|PASS|FAIL)$/i.test(rankGradeText || "") || /^(P\/?F|PASS|FAIL)$/i.test(achievementText || "");
    const rankGrade = String(rankGradeText || "").trim() === "" ? null : Number(rankGradeText);
    const achievement = String(achievementText || "").toUpperCase();
    if (!(Number(schoolYear) >= 1 && Number(schoolYear) <= 3)) errors.push(`${rowNumber}행 학년`);
    if (!(Number(semester) >= 1 && Number(semester) <= 2)) errors.push(`${rowNumber}행 학기`);
    if (!String(subjectName || "").trim()) errors.push(`${rowNumber}행 과목명`);
    if (!courseType) errors.push(`${rowNumber}행 과목유형`);
    if (!(Number(credits) > 0)) errors.push(`${rowNumber}행 이수단위`);
    if (!passFail && courseType === "common-general" && !(Number.isInteger(rankGrade) && rankGrade >= 1 && rankGrade <= 9)) errors.push(`${rowNumber}행 석차등급`);
    if (!passFail && courseType === "career" && rankGrade !== null && !(Number.isInteger(rankGrade) && rankGrade >= 1 && rankGrade <= 9)) errors.push(`${rowNumber}행 진로선택 석차등급`);
    if (!passFail && courseType === "career" && !ConsultationCardStore.ACHIEVEMENTS.includes(achievement)) errors.push(`${rowNumber}행 성취도`);
    if (errors.some((entry) => entry.startsWith(`${rowNumber}행`))) return;
    records.push({
      schoolYear: Number(schoolYear),
      semester: Number(semester),
      subjectGroup: normalizedSubjectGroup(subjectGroup),
      subjectName,
      courseType,
      curriculumCategory,
      credits: Number(credits),
      rankGrade: passFail ? null : rankGrade,
      achievement: passFail || courseType !== "career" ? "" : achievement,
      passFail
    });
  });
  if (errors.length) throw new Error(`${errors.slice(0, 5).join(", ")} 값을 확인하세요${errors.length > 5 ? ` 외 ${errors.length - 5}건` : ""}.`);
  if (!records.length) throw new Error("추가할 과목 행을 찾지 못했습니다.");
  return records;
}

function openGradePaste() {
  gradeReturnFocusElement = document.activeElement;
  byId("gradePasteText").value = "";
  byId("gradePasteError").hidden = true;
  byId("gradePasteError").textContent = "";
  byId("gradePasteEditor").hidden = false;
  document.body.classList.add("editor-open");
  requestAnimationFrame(() => byId("gradePasteText").focus());
}

function closeGradePaste() {
  if (byId("gradePasteEditor").hidden) return;
  byId("gradePasteEditor").hidden = true;
  document.body.classList.remove("editor-open");
  if (gradeReturnFocusElement?.focus) gradeReturnFocusElement.focus();
  gradeReturnFocusElement = null;
}

function saveGradePaste(event) {
  event.preventDefault();
  try {
    const records = parseGradePaste(byId("gradePasteText").value);
    const result = ConsultationCardStore.addGradeRecords(records);
    closeGradePaste();
    render();
    showToast(`${result.added}과목을 추가했습니다.`);
  } catch (error) {
    byId("gradePasteError").textContent = error.message;
    byId("gradePasteError").hidden = false;
  }
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

function automaticTargetValue(item, key) {
  const config = OVERRIDE_CONFIG[key];
  if (!config) return "";
  const primary = String(item?.[config.source] ?? "").trim();
  if (primary) return primary;
  return config.reference ? String(item?.[config.reference] ?? "").trim() : "";
}

function targetDataStatus(item, key) {
  const config = OVERRIDE_CONFIG[key];
  if (!config) return "official_not_entered";
  const explicit = config.status ? String(item?.[config.status] ?? "").trim() : "";
  if (explicit) return explicit;
  return String(item?.[config.source] ?? "").trim() ? "official_confirmed" : "official_not_entered";
}

function dataStatusLabel(status) {
  return DATA_STATUS_LABELS[status] || "자료 상태 확인";
}

function dataStatusDescription(status) {
  return DATA_STATUS_DESCRIPTIONS[status] || "모집요강에서 최신 내용을 확인하세요.";
}

function effectiveTargetValue(item, key) {
  const config = OVERRIDE_CONFIG[key];
  if (!config) return "";
  return hasTargetOverride(item, key) ? String(item?.[config.override] ?? "") : automaticTargetValue(item, key);
}

function clearedOverrides() {
  return {
    targetOverrideFields: [],
    targetQuotaOverride: "",
    targetSelectionMethodOverride: "",
    targetMinimumOverride: "",
    targetAnnouncementDateOverride: ""
  };
}

function copiedOverrides(item) {
  return {
    targetOverrideFields: [...overrideFields(item)],
    targetQuotaOverride: String(item?.targetQuotaOverride ?? ""),
    targetSelectionMethodOverride: String(item?.targetSelectionMethodOverride ?? ""),
    targetMinimumOverride: String(item?.targetMinimumOverride ?? ""),
    targetAnnouncementDateOverride: String(item?.targetAnnouncementDateOverride ?? "")
  };
}

function withSuffix(value, suffix = "") {
  const text = String(value ?? "").trim();
  if (!text || !suffix || text.endsWith(suffix)) return text;
  return `${text}${suffix}`;
}

function allUniversityEntries(index) {
  const indexed = index.universities.filter((university) => !SUCCESSOR_UNIVERSITY_CODES.has(university.code));
  const codes = new Set(indexed.map((university) => university.code));
  return indexed.concat(MANUAL_EXEMPT_UNIVERSITIES.filter((university) => !codes.has(university.code)));
}

function activeUniversityCode(code) {
  return SUCCESSOR_UNIVERSITY_CODES.get(String(code || "")) || String(code || "");
}

function universityCodeFromUrl(value) {
  const match = String(value || "").match(/[?&]unvCd=([^&#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function universityCodeFromItem(item) {
  if (item?.targetUniversityCode && !isManualUniversity(item)) return activeUniversityCode(item.targetUniversityCode);
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

function historyConnectionMeta(item, targetLinked) {
  const status = item?.historyConnectionStatus || "";
  if (status === "approved_exact") {
    return { status, label: "같은 모집단위·전형명 확인", empty: "해당 학년도 공개값 없음", detail: "동일 명칭 기준" };
  }
  if (status === "approved_official_evidence") {
    return { status, label: "공식 근거로 변경 관계 확인", empty: "해당 학년도 공개값 없음", detail: "공식 개편 자료로 관계 확인" };
  }
  if (status === "reviewed_reference") {
    return { status, label: "공식 참고 관계 확인", empty: "자동 연결하지 않음", detail: "같은 입결 추이로 보지 않음" };
  }
  if (status === "reviewed_no_relation") {
    return { status, label: "과거 동일 전형 아님 확인", empty: "과거 입결 없음", detail: "공식 근거로 관계 없음 확인" };
  }
  if (status === "review_required") {
    return { status, label: "명칭·전형 변경 가능성 검토", empty: "자동 연결하지 않음", detail: "동일 입결인지 확인 전" };
  }
  if (status === "new_candidate") {
    return { status, label: "2027 신설 가능성", empty: "과거 입결 없음", detail: "같은 명칭의 과거 자료 없음" };
  }
  if (status === "legacy_exact") {
    return { status, label: "동일 명칭 기준 연결", empty: "연결 자료 없음", detail: "계보 자료 보완 전" };
  }
  return targetLinked
    ? { status: "lineage_unavailable", label: "연결 상태 확인 필요", empty: "연결 자료 없음", detail: "동일 모집단위·전형 기준" }
    : { status: "target_unlinked", label: "2027 전형 연결 필요", empty: "연결 자료 없음", detail: "학과·전형을 먼저 선택" };
}

function lineageRelationLabel(value, confirmed = false) {
  const suffix = confirmed ? "확인" : "가능성";
  return {
    admission_changed_candidate: `전형명 변경 ${suffix}`,
    renamed_candidate: `학과명 변경 ${suffix}`,
    university_predecessor_candidate: confirmed ? "통합 전 대학 동일 전형 확인" : "통합 전 대학 동일 전형 후보",
    merged_candidate: `학과 통합 ${suffix}`,
    split_candidate: `학과 분리 ${suffix}`,
    duplicate_current_identity_candidate: "동일 명칭 전형 구분 필요",
    similar_reference: "유사 모집단위 참고"
  }[value] || "유사 모집단위 참고";
}

function normalizedLineageEvidence(entry) {
  return {
    decision: String(entry?.decision || ""),
    relation: String(entry?.relation || ""),
    sourceUrl: String(entry?.sourceUrl || ""),
    sourceTitle: String(entry?.sourceTitle || ""),
    sourceAcademicYear: String(entry?.sourceAcademicYear || ""),
    reviewedAt: String(entry?.reviewedAt || ""),
    note: String(entry?.note || "")
  };
}

function renderLineageEvidence(item) {
  const evidence = (item.historyApprovalEvidence || []).find((entry) => entry.sourceUrl || entry.sourceTitle);
  if (!evidence) return "";
  const relation = item.historyApprovedRelation || evidence.relation;
  const confirmed = item.historyConnectionStatus === "approved_official_evidence" || evidence.decision === "approve_trend";
  const meta = [
    evidence.sourceAcademicYear ? `${evidence.sourceAcademicYear}학년도 기준` : "",
    evidence.reviewedAt ? `${evidence.reviewedAt} 확인` : ""
  ].filter(Boolean).join(" · ");
  const title = evidence.sourceTitle || "대학 공식 자료";
  return `<aside class="history-evidence-note">
    <span>${escapeHtml(item.historyConnectionStatus === "reviewed_reference" ? "공식 참고 근거" : item.historyConnectionStatus === "reviewed_no_relation" ? "관계 없음 확인 근거" : "변경 관계 확인 근거")}</span>
    <strong>${escapeHtml(title)}</strong>
    ${relation ? `<small>${escapeHtml(lineageRelationLabel(relation, confirmed))}${meta ? ` · ${escapeHtml(meta)}` : ""}</small>` : meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    ${evidence.sourceUrl ? `<a href="${escapeHtml(evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">공식 근거 보기<span aria-hidden="true">↗</span></a>` : ""}
  </aside>`;
}

function suggestionRelationLabel(entry) {
  if (entry.lineageReviewStatus === "approved_reference") return "공식 참고 관계";
  return lineageRelationLabel(entry.lineageRelation);
}

function splitHistorySuggestions(item) {
  const currentDepartment = compact(item.targetDepartment || item.department);
  const currentAdmission = admissionKey(item.targetAdmission || item.admission);
  const groups = { similarDepartments: [], otherAdmissions: [] };
  (item.historySuggestions || []).forEach((entry) => {
    const sameDepartment = currentDepartment && compact(entry.department) === currentDepartment;
    const differentAdmission = currentAdmission && admissionKey(entry.admission) !== currentAdmission;
    if (sameDepartment && differentAdmission) groups.otherAdmissions.push(entry);
    else groups.similarDepartments.push(entry);
  });
  return groups;
}

function renderHistoryReferenceGroup(entries, type) {
  if (!entries.length) return "";
  const isOtherAdmission = type === "other-admission";
  const title = isOtherAdmission ? "같은 모집단위의 다른 전형 참고" : "유사 모집단위 참고";
  const description = isOtherAdmission
    ? "학과가 같아도 전형별 평가방법과 지원자 집단이 다르므로 선택한 전형의 입결로 합치지 않습니다."
    : "학과명 변경·통합·분리 가능성이 있거나 학문 분야가 비슷한 자료입니다. 공식 계보가 확인되기 전에는 선택한 학과의 입결로 합치지 않습니다.";
  const officialReferences = entries.filter((entry) => entry.lineageReviewStatus === "approved_reference").length;
  return `<details class="similar-history history-reference-group${isOtherAdmission ? " is-other-admission" : ""}">
    <summary>${title} ${entries.length}건${officialReferences ? ` · 공식 참고 ${officialReferences}건` : ""}</summary>
    <p>${description}</p>
    <div>${entries.map((entry) => {
      const metric = gradeMetric(entry);
      return `<span><b class="${entry.lineageReviewStatus === "approved_reference" ? "is-official" : ""}">${escapeHtml(suggestionRelationLabel(entry))}</b><strong>${escapeHtml(entry.year)}학년도 ${escapeHtml(entry.department)}</strong><em>${escapeHtml(entry.admission || "전형명 확인 필요")}</em> · 경쟁률 ${escapeHtml(competitionWithRatio(entry.competitionRate) || "-")} · ${escapeHtml(metric ? `${metric[0]} ${metric[1]}` : "성적 공개값 없음")}${entry.lineageEvidence?.sourceUrl ? ` · <a href="${escapeHtml(entry.lineageEvidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">근거 보기</a>` : ""}</span>`;
    }).join("")}</div>
  </details>`;
}

function historyReferenceCandidates(item, year) {
  const targetDepartment = item.targetDepartment || item.department;
  const targetAdmission = item.targetAdmission || item.admission;
  const targetCategory = item.targetCategory || item.category;
  const unique = new Map();
  (item.historySuggestions || [])
    .filter((entry) => entry.year === year)
    .forEach((entry) => {
      const key = `${entry.year}|${compact(entry.department)}|${admissionKey(entry.admission)}`;
      const score = [
        entry.lineageReviewStatus === "approved_reference" ? 100 : 0,
        categoryKey(entry.category) === categoryKey(targetCategory) ? 30 : 0,
        admissionKey(entry.admission) === admissionKey(targetAdmission) ? 25 : 0,
        Math.round(diceSimilarity(entry.department, targetDepartment) * 20),
        Math.round(Number(entry.lineageScore || 0) * 10),
        rowMetricCount(entry)
      ].reduce((sum, value) => sum + value, 0);
      const current = unique.get(key);
      if (!current || score > current.score) unique.set(key, { entry, score });
    });
  return [...unique.values()]
    .sort((left, right) => right.score - left.score || rowMetricCount(right.entry) - rowMetricCount(left.entry))
    .slice(0, 5)
    .map(({ entry }) => entry);
}

function historyReferenceSource(entry) {
  return entry.officeSourceUrl || entry.sourceUrl || entry.lineageEvidence?.sourceUrl || "";
}

function historyDataCells(entry, options = {}) {
  const grades = compactGradeMetrics(entry);
  const suppressedGrades = new Set(entry.suppressedFields || []);
  const hasSuppressedGrade = [
    "result_mean", "result_50", "result_70", "result_75", "result_80", "result_85", "result_90"
  ].some((field) => suppressedGrades.has(field));
  const gradeText = grades.length
    ? `<span class="history-grade-list">${grades.map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`).join("")}</span>`
    : `<span class="history-muted">${hasSuppressedGrade ? "미공개" : "공개값 없음"}</span>`;
  const sourceUrl = historyReferenceSource(entry);
  const quota = entry.quota ? `${escapeHtml(entry.quota)}명` : "-";
  const additional = historyAdditionalInfo(entry);
  const competition = competitionWithRatio(historyValue(entry, "competitionRate"));
  const sourceLabel = entry.officeSourceUrl ? "입학처" : "대학어디가";
  const referenceActions = options.userReference
    ? `<span class="history-reference-actions">
        <button type="button" data-open-history-reference="${escapeHtml(options.itemId)}" data-history-year="${escapeHtml(entry.year)}">변경</button>
        <button type="button" class="is-clear" data-clear-history-reference="${escapeHtml(options.itemId)}" data-history-year="${escapeHtml(entry.year)}">해제</button>
      </span>`
    : "";
  return `<td><strong class="history-single-value">${escapeHtml(competition)}</strong></td>
    <td>${gradeText}</td>
    <td><span class="history-admit-values"><strong>${quota}</strong><i>/</i><span title="${escapeHtml(additional.label)}">${escapeHtml(additional.value)}</span></span></td>
    <td>${sourceUrl ? `<a class="history-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}<span aria-hidden="true">↗</span></a>` : '<span class="history-muted">-</span>'}${referenceActions}</td>`;
}

function renderHistoryReferencePicker(item) {
  if (!historyReferencePicker || historyReferencePicker.itemId !== item.id) return "";
  const year = historyReferencePicker.year;
  const candidates = historyReferenceCandidates(item, year);
  return `<section class="history-reference-picker" aria-label="${escapeHtml(year)}학년도 유사 모집단위 선택">
    <header>
      <div><span>${escapeHtml(year)}학년도</span><strong>참고할 유사 모집단위를 선택하세요</strong></div>
      <button type="button" data-close-history-reference aria-label="유사 모집단위 선택 닫기">×</button>
    </header>
    <p>선택한 자료는 현재 학과의 공식 입결로 합치지 않고, 상담용 참고 자료로만 표시합니다.</p>
    ${candidates.length ? `<div class="history-reference-candidates">${candidates.map((entry, index) => {
      const metric = gradeMetric(entry);
      const sourceUrl = historyReferenceSource(entry);
      return `<article>
        <div class="history-reference-candidate-head"><span>${escapeHtml(suggestionRelationLabel(entry))}</span><strong>${escapeHtml(entry.department)}</strong></div>
        <p>${escapeHtml(entry.admission || "전형명 확인 필요")}</p>
        <dl>
          <div><dt>경쟁률</dt><dd>${escapeHtml(competitionWithRatio(entry.competitionRate) || "미공개")}</dd></div>
          <div><dt>학생부</dt><dd>${escapeHtml(metric ? `${metric[0]} ${metric[1]}` : "공개값 없음")}</dd></div>
          <div><dt>모집</dt><dd>${escapeHtml(entry.quota ? `${entry.quota}명` : "미공개")}</dd></div>
        </dl>
        <footer>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">원문 확인<span aria-hidden="true">↗</span></a>` : "<span></span>"}<button type="button" data-select-history-reference="${escapeHtml(item.id)}" data-history-year="${escapeHtml(year)}" data-reference-index="${index}">이 자료로 참고</button></footer>
      </article>`;
    }).join("")}</div>` : '<div class="history-reference-empty">이 학년도에서 비교할 수 있는 유사 모집단위 후보를 찾지 못했습니다. 대학 입학처의 과거 모집단위 변동을 확인해 주세요.</div>'}
  </section>`;
}

function renderHistory(item) {
  if (isManualUniversity(item)) {
    return '<div class="history-placeholder">별도 지원 대학의 입결은 해당 대학 입학처 자료를 확인해 상담 메모에 기록합니다.</div>';
  }
  if (!item?.targetOptionId && !(item?.history || []).length) {
    return '<div class="history-placeholder">학과와 전형을 선택하면 2024~2026학년도 입결을 연결합니다.</div>';
  }
  const targetLinked = Boolean(item.targetOptionId);
  const connection = historyConnectionMeta(item, targetLinked);
  const historyByYear = new Map((item.history || []).map((entry) => [entry.year, entry]));
  const referenceByYear = new Map((item.historyUserReferences || []).map((entry) => [entry.year, entry]));
  const rows = YEARS.map((year) => {
    const entry = historyByYear.get(year);
    if (!entry) {
      const reference = referenceByYear.get(year);
      if (reference) {
        return `<tr class="has-data is-user-reference" data-year="${year}">
          <th scope="row"><span class="history-year">${year}<small>학년도</small></span><em class="is-user-reference">사용자 선택 참고</em></th>
          ${historyDataCells(reference, { userReference: true, itemId: item.id })}
        </tr>`;
      }
      return `<tr class="is-empty" data-year="${year}">
        <th scope="row"><span class="history-year">${year}</span></th>
        <td colspan="4"><span class="history-empty-copy"><span><strong>${escapeHtml(connection.empty)}</strong><small>${escapeHtml(connection.detail)}</small></span><button type="button" data-open-history-reference="${escapeHtml(item.id)}" data-history-year="${year}">유사 모집단위 참고</button></span></td>
      </tr>`;
    }
    return `<tr class="has-data" data-year="${year}">
      <th scope="row"><span class="history-year">${year}<small>학년도</small></span>${historyVerificationBadge(entry)}</th>
      ${historyDataCells(entry)}
    </tr>`;
  }).join("");
  const suggestionGroups = splitHistorySuggestions(item);
  const connectedYears = YEARS.filter((year) => historyByYear.has(year));
  const referenceYears = YEARS.filter((year) => !historyByYear.has(year) && referenceByYear.has(year));
  return `<section class="saved-history" aria-label="3개년 입결">
    <div class="history-head">
      <div class="history-heading-copy"><strong>확정 3개년 입결 추이</strong><span class="history-link-status is-${escapeHtml(connection.status)}">${escapeHtml(connection.label)}</span>${referenceYears.length ? `<span class="history-reference-count">사용자 참고 ${referenceYears.length}개년</span>` : ""}</div>
      <div class="history-coverage" aria-label="3개년 중 ${connectedYears.length}개년 연결">
        <span class="history-coverage-dots" aria-hidden="true">${YEARS.map((year) => `<i class="${historyByYear.has(year) ? "is-connected" : referenceByYear.has(year) ? "is-reference" : ""}"></i>`).join("")}</span>
        <strong>${connectedYears.length}<small>/3개년</small></strong>
      </div>
    </div>
    ${renderLineageEvidence(item)}
    <p class="history-identity-note">수능최저·모집인원·전형방법·반영비율이 달라졌다는 이유만으로 다른 모집단위가 되지 않습니다. 전형명까지 달라진 경우에만 대학 공식 근거를 확인한 다음 연결합니다. 연도별로 바뀐 조건은 학년도별 모집요강에서 따로 비교합니다.</p>
    ${referenceYears.length ? '<p class="history-user-reference-note"><strong>사용자 선택 참고</strong>는 유사 학과를 비교하기 위해 직접 고른 자료이며, 현재 학과의 공식 입결은 아닙니다.</p>' : ""}
    <div class="history-table-wrap"><table class="history-table"><thead><tr><th>학년도</th><th>경쟁률</th><th>학생부 성적</th><th>모집/추합·충원</th><th>출처</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${renderHistoryReferencePicker(item)}
    ${renderHistoryReferenceGroup(suggestionGroups.similarDepartments, "similar-department")}
    ${renderHistoryReferenceGroup(suggestionGroups.otherAdmissions, "other-admission")}
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
  const announcementDate = effectiveTargetValue(item, "announcementDate") || "직접 입력 필요";
  return `<section class="option-summary" aria-label="2027 전형 정보">
    <div><span>2027 모집인원</span><strong>${escapeHtml(quota)}</strong></div>
    <div><span>전형방법·반영비율</span><strong>${escapeHtml(item.targetSelectionMethod || "원문 확인 필요")}</strong></div>
    <div><span>수능최저</span><strong>${escapeHtml(minimum)}</strong></div>
    <div><span>최종 합격자 발표일</span><strong>${escapeHtml(announcementDate)}</strong></div>
    ${item.targetMinimumSubjects ? `<details><summary>수능최저 반영 영역 보기</summary><p>${escapeHtml(item.targetMinimumSubjects)}</p></details>` : ""}
    <nav>${item.targetSourceUrl ? `<a href="${escapeHtml(item.targetSourceUrl)}" target="_blank" rel="noopener noreferrer">2027 모집정보 원문</a>` : ""}${item.targetMinimumSourceUrl ? `<a href="${escapeHtml(item.targetMinimumSourceUrl)}" target="_blank" rel="noopener noreferrer">수능최저 상세</a>` : ""}</nav>
  </section>`;
}

function optionValueBlock(item, key, label, value, fallback, suffix = "") {
  const config = OVERRIDE_CONFIG[key];
  const overridden = hasTargetOverride(item, key);
  const manual = isManualUniversity(item) && overridden;
  const source = automaticTargetValue(item, key);
  const dataStatus = targetDataStatus(item, key);
  const shown = value ? withSuffix(value, suffix) : fallback;
  const status = overridden ? `<span class="option-value-status">${manual ? "직접 입력" : "직접 수정"}</span>` : "";
  const sourceStatus = overridden
    ? ""
    : key === "announcementDate"
      ? '<span class="option-source-status is-missing" title="모집요강 확인 후 직접 입력하세요.">직접 입력</span>'
      : `<span class="option-source-status ${dataStatusClass(dataStatus)}" title="${escapeHtml(dataStatusDescription(dataStatus))}">${escapeHtml(dataStatusLabel(dataStatus))}</span>`;
  const original = overridden ? `<small class="option-original">자동값: ${escapeHtml(source ? withSuffix(source, suffix) : "입력 없음")}</small>` : "";
  return `<div><span>${escapeHtml(label)}${status}${sourceStatus}</span><strong>${escapeHtml(shown)}</strong>${original}</div>`;
}

function dataStatusClass(status) {
  if (status === "counseling_reference_exact") return "is-reference";
  if (status === "official_confirmed_reference_conflict") return "is-conflict";
  if (status === "official_confirmed") return "is-official";
  return "is-missing";
}

function formatRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return "";
  return `${Number.isInteger(ratio) ? ratio : ratio.toFixed(1)}%`;
}

function selectionBreakdownMarkup(item) {
  if (hasTargetOverride(item, "selectionMethod")) return "";
  const stages = Array.isArray(item?.targetSelectionBreakdown) ? item.targetSelectionBreakdown : [];
  if (!stages.length) return "";
  return `<div class="selection-breakdown" aria-label="전형방법 단계별 구성">
    <span class="selection-breakdown-title">단계별 반영</span>
    <div>${stages.map((stage) => `<span class="selection-stage"><b>${escapeHtml(stage.stage)}</b>${stage.elements.map((element) => `<em>${escapeHtml(element.name)} ${escapeHtml(formatRatio(element.ratio))}</em>`).join("")}</span>`).join("")}</div>
  </div>`;
}

function renderOptionSummaryV2(item, bucket = "standard") {
  if (!item?.targetOptionId && !isManualUniversity(item)) {
    return `<section class="option-summary is-unlinked" aria-label="2027 전형 정보 연결 필요">
      <div><span>2027 모집인원</span><strong>전형 연결 후 표시</strong></div>
      <div><span>반영 요소·비율</span><strong>전형 연결 후 표시</strong></div>
      <div><span>수능최저학력기준</span><strong>전형 연결 후 표시</strong></div>
      <div><span>최종 합격자 발표일</span><strong>직접 입력 필요</strong></div>
      <div class="option-connect-notice"><span><strong>2027 학과·전형을 연결하세요.</strong> 모집인원, 반영비율, 수능최저가 자동으로 채워집니다.</span><button type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${escapeHtml(bucket)}">2027 전형 연결</button></div>
    </section>`;
  }
  const quota = effectiveTargetValue(item, "quota");
  const selectionMethod = effectiveTargetValue(item, "selectionMethod");
  const minimum = effectiveTargetValue(item, "minimum");
  const announcementDate = effectiveTargetValue(item, "announcementDate");
  const hasManualData = [quota, selectionMethod, minimum, announcementDate].some(Boolean);
  if (isManualUniversity(item) && !hasManualData) {
    return `<section class="option-summary is-unlinked" aria-label="2027 전형 정보 직접 입력">
      <div><span>2027 모집인원</span><strong>직접 입력 필요</strong></div>
      <div><span>반영 요소·비율</span><strong>직접 입력 필요</strong></div>
      <div><span>수능최저학력기준</span><strong>직접 입력 필요</strong></div>
      <div><span>최종 합격자 발표일</span><strong>직접 입력 필요</strong></div>
      <div class="option-connect-notice"><span><strong>모집요강을 확인해 정보를 보완하세요.</strong> 수정값은 이 상담카드에만 저장됩니다.</span><button type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${escapeHtml(bucket)}">정보 입력</button></div>
    </section>`;
  }
  const minimumStatus = targetDataStatus(item, "minimum");
  const minimumFallback = minimumStatus === "official_not_entered"
    ? "대학어디가 입력 없음 · 모집요강 확인"
    : minimumStatus === "official_non_csat_detail"
      ? "수능최저 외 별도 기준 확인"
      : "모집요강 확인 필요";
  return `<section class="option-summary" aria-label="2027 전형 정보">
    ${optionValueBlock(item, "quota", "2027 모집인원", quota, "모집인원 미지정", "명")}
    ${optionValueBlock(item, "selectionMethod", "반영 요소·비율", selectionMethod, "원문 확인 필요")}
    ${optionValueBlock(item, "minimum", "수능최저학력기준", minimum, minimumFallback)}
    ${optionValueBlock(item, "announcementDate", "최종 합격자 발표일", announcementDate, "직접 입력 필요")}
    ${selectionBreakdownMarkup(item)}
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

function savedSimilarDepartmentRangeText(candidate) {
  const range = candidate?.gradeRanges?.all
    || candidate?.gradeRanges?.subject
    || candidate?.gradeRanges?.holistic
    || candidate?.gradeRanges?.essay
    || candidate?.gradeRanges?.performance;
  if (!range) return "동일 명칭 공개 입결 없음";
  const minimum = Number(range.min);
  const maximum = Number(range.max);
  const gradeText = minimum === maximum ? minimum.toFixed(2) : `${minimum.toFixed(2)}~${maximum.toFixed(2)}`;
  return `${range.year || "최근"}학년도 ${gradeText}등급 · ${Number(range.count || 0)}개 전형`;
}

function renderSavedSimilarDepartments(item) {
  const candidates = Array.isArray(item.similarDepartmentCandidates) ? item.similarDepartmentCandidates : [];
  if (!candidates.length) return "";
  return `<section class="saved-similar-departments">
    <header><strong>검토 중인 유사학과</strong><span>${candidates.length}/3개 · 수시카드 파일과 교사용 화면에 포함</span></header>
    <div>${candidates.map((candidate) => `<article>
      <div><strong>${escapeHtml(candidate.university)}${candidate.campus ? ` · ${escapeHtml(candidate.campus)}` : ""}</strong><span>${escapeHtml(candidate.department)}</span></div>
      <dl><div><dt>지역</dt><dd>${escapeHtml(candidate.region || "-")}</dd></div><div><dt>전형</dt><dd>${escapeHtml((candidate.categories || []).join(" · ") || "확인 필요")}</dd></div></dl>
      <small>${escapeHtml(savedSimilarDepartmentRangeText(candidate))}</small>
      ${candidate.note ? `<p>${escapeHtml(candidate.note)}</p>` : ""}
    </article>`).join("")}</div>
  </section>`;
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
  const calculatorUniversityId = calculatorUniversityIdFromName(item.university);
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
      ${renderSavedSimilarDepartments(item)}
      <div class="card-inputs">
        <div><span class="field-label">지원 판단</span><div class="strategy-control" aria-label="지원 판단">${STRATEGIES.map((value) => `<button type="button" data-strategy-id="${escapeHtml(item.id)}" data-strategy="${value}" class="${item.strategy === value ? "is-active" : ""}" aria-pressed="${item.strategy === value}">${value}</button>`).join("")}</div></div>
        <label class="memo-field"><span class="field-label">상담 메모</span><textarea data-memo-id="${escapeHtml(item.id)}" placeholder="지원 이유, 수능최저 준비, 확인할 내용을 적어보세요.">${escapeHtml(item.memo)}</textarea></label>
      </div>
      <div class="card-detail-actions">
        ${item.targetDepartment || item.department ? `<button class="secondary-button similar-department-card-link" type="button" data-open-similar-departments="${escapeHtml(item.id)}">${item.similarDepartmentCandidates?.length ? `유사학과 비교 ${item.similarDepartmentCandidates.length}/3` : "유사학과 추천"}</button>` : ""}
        ${calculatorUniversityId ? `<button class="secondary-button calculator-card-link" type="button" data-open-calculator="${escapeHtml(calculatorUniversityId)}">학생부 환산</button>` : ""}
        <button class="secondary-button" type="button" data-edit-id="${escapeHtml(item.id)}" data-edit-bucket="${isExempt ? "exempt" : "standard"}">2027 전형·순위 수정</button>
        <button class="delete-button" type="button" data-delete-id="${escapeHtml(item.id)}">지원안 삭제</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const state = ConsultationCardStore.read();
  if (expandedCardId && !state.items.some((item) => item.id === expandedCardId)) expandedCardId = "";
  if (historyReferencePicker && !state.items.some((item) => item.id === historyReferencePicker.itemId)) historyReferencePicker = null;
  if (similarDepartmentSession && !state.items.some((item) => item.id === similarDepartmentSession.itemId)) {
    closeSimilarDepartmentEditor({ restoreFocus: false });
  }
  const regularCount = state.slots.slice(0, 6).filter((slot) => slot.item).length;
  const reserveCount = state.slots.slice(6, 9).filter((slot) => slot.item).length;
  byId("savedCount").textContent = `${state.items.length}개 지원안`;
  byId("slotStatus").textContent = `일반지원 ${regularCount}/6 · 예비후보 ${reserveCount}/3 · 제한 외 ${state.exemptItems.length}`;
  const hasConsultationContent = state.consultations.some(consultationHasContent);
  byId("resetCard").disabled = state.items.length === 0 && !state.studentNumber && !state.overallOpinion
    && !state.gradeRecords.length && !state.academicProfile.graduationYear && !hasConsultationContent;
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
  renderGradeRecords(state);
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
  return Boolean(
    state.studentNumber
    || state.overallOpinion
    || state.academicProfile?.graduationYear
    || state.gradeRecords?.length
    || state.consultations.some(consultationHasContent)
  );
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
    ? `수시카드 파일 ${localDateTime(state.lastExportedAt)}`
    : "수시카드 파일 저장 이력 없음";
  byId("lastPrintedAt").textContent = state.lastPrintedAt
    ? `인쇄·PDF ${localDateTime(state.lastPrintedAt)}`
    : "인쇄·PDF 기록 없음";
  const backups = ConsultationCardStore.feedbackBackups();
  byId("restoreFeedbackBackup").hidden = backups.length === 0;
  if (backups.length) {
    byId("restoreFeedbackBackup").title = `${localDateTime(backups[0].createdAt)} 상태로 복원`;
  }
  const receipt = state.teacherFeedbackReceipt;
  byId("teacherFeedbackReceipt").hidden = !receipt;
  if (receipt) {
    byId("teacherFeedbackReceiptTitle").textContent = `${localDateTime(receipt.appliedAt)} 교사 확인본 적용`;
    byId("teacherFeedbackReceiptMeta").textContent = receipt.sourceFileName
      ? `${receipt.sourceFileName} · 교사 저장 ${localDateTime(receipt.exportedAt)}`
      : `교사 저장 ${localDateTime(receipt.exportedAt)}`;
    byId("teacherFeedbackReceiptHistory").innerHTML = receipt.revisionLog.length
      ? [...receipt.revisionLog].reverse().map((entry) => `<div><time>${escapeHtml(localDateTime(entry.editedAt))}</time><span>${escapeHtml(entry.label || "교사가 상담카드를 확인했습니다.")}</span></div>`).join("")
      : "<p>기록된 교사 확인 이력이 없습니다.</p>";
  }
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
  byId("schoolStatus").value = state.academicProfile.schoolStatus;
  byId("graduationYear").value = state.academicProfile.graduationYear || "";
  byId("calculatorUniversity").value = state.gradeCalculatorSelections.activeUniversity;
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
    academicProfile: {
      schoolStatus: byId("schoolStatus").value,
      graduationYear: byId("graduationYear").value
    },
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

async function downloadCardFile() {
  persistDocumentForm();
  const exportedAt = new Date();
  const payload = ConsultationCardStore.exportData(exportedAt.toISOString(), { recordExport: false });
  const studentNumber = safeFilenamePart(payload.studentNumber, "학번미입력");
  const filename = `수시지원상담카드_${studentNumber}_${filenameTimestamp(exportedAt)}.anjwacard`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const result = await window.FileSaveUtils.saveBlob({
    blob,
    filename,
    description: "안좌고 수시 지원 상담카드",
    accept: { "application/json": [".anjwacard", ".json"] }
  });
  if (!result.saved) {
    showToast("상담카드 저장을 취소했습니다.");
    return;
  }
  const state = ConsultationCardStore.updateDocument({ lastExportedAt: exportedAt.toISOString() });
  updateDocumentStatus(state);
  if (result.method === "download") {
    showToast("브라우저 다운로드 폴더에 저장했습니다.");
  } else {
    showToast("선택한 위치에 상담카드를 저장했습니다.");
  }
}

const FEEDBACK_ITEM_FIELDS = Object.freeze({
  university: "대학",
  campus: "캠퍼스",
  targetDepartment: "학과·모집단위",
  targetAdmission: "전형명",
  targetCategory: "전형 유형",
  targetField: "모집 계열",
  targetQuota: "공식 모집인원",
  targetQuotaOverride: "모집인원",
  targetSelectionMethod: "공식 전형방법·반영비율",
  targetSelectionMethodOverride: "전형방법·반영비율",
  targetMinimumOfficial: "공식 수능최저",
  targetMinimumOverride: "수능최저",
  targetAnnouncementDate: "공식 최종 합격자 발표일",
  targetAnnouncementDateOverride: "최종 합격자 발표일",
  history: "과거 입결 연결",
  strategy: "지원 판단",
  memo: "상담 메모"
});

function feedbackItems(payload) {
  const standard = (payload?.slots || []).map((slot) => slot?.item).filter(Boolean);
  return [...standard, ...(payload?.exemptItems || [])];
}

function feedbackItemLabel(item) {
  if (!item) return "지원안 확인 필요";
  return `${item.university || "대학 미입력"} · ${item.targetDepartment || item.department || "학과 미입력"}`;
}

function feedbackDisplayValue(value) {
  if (Array.isArray(value)) {
    if (value.some((entry) => entry && typeof entry === "object")) return value.length ? `${value.length}개 항목` : "없음";
    return value.join(" · ") || "없음";
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "").trim() || "미입력";
}

function feedbackItemFieldValue(item, field) {
  if (!item) return "";
  if (field === "targetDepartment") return item.targetDepartment || item.department || "";
  if (field === "targetAdmission") return item.targetAdmission || item.admission || "";
  return item[field];
}

function collectFeedbackComparison(current, feedback) {
  const reviewed = feedback.reviewedPayload;
  const currentItems = new Map(feedbackItems(current).map((item) => [item.id, item]));
  const reviewedItems = new Map(feedbackItems(reviewed).map((item) => [item.id, item]));
  const addedIds = new Set(feedback.teacherChanges.addedItemIds);
  const itemFields = new Map();
  const documentFields = new Set();
  feedback.teacherChanges.patches.forEach((patch) => {
    if (patch.scope === "document") {
      Object.keys(patch.fields || {}).forEach((field) => documentFields.add(field));
      return;
    }
    if (!patch.itemId) return;
    if (!itemFields.has(patch.itemId)) itemFields.set(patch.itemId, new Set());
    Object.keys(patch.fields || {}).forEach((field) => itemFields.get(patch.itemId).add(field));
  });

  const changedItems = [...itemFields].map(([itemId, fields]) => {
    const before = currentItems.get(itemId);
    const after = reviewedItems.get(itemId);
    const changes = [...fields].filter((field) => FEEDBACK_ITEM_FIELDS[field]).map((field) => {
      const beforeValue = feedbackItemFieldValue(before, field);
      const afterValue = feedbackItemFieldValue(after, field);
      const changed = JSON.stringify(beforeValue ?? null) !== JSON.stringify(afterValue ?? null);
      const beforeText = feedbackDisplayValue(beforeValue);
      const afterText = feedbackDisplayValue(afterValue);
      return {
        field,
        label: FEEDBACK_ITEM_FIELDS[field],
        before: beforeText,
        after: changed && beforeText === afterText ? `${afterText} · 교사 재확인` : afterText,
        changed
      };
    }).filter((change) => change.changed);
    return { itemId, item: after || before, changes };
  }).filter((entry) => entry.changes.length);

  const addedItems = [...addedIds].filter((id) => !currentItems.has(id)).map((id) => reviewedItems.get(id)).filter(Boolean);
  const documentChanges = [...documentFields].map((field) => ({
    field,
    label: field === "overallOpinion" ? "담임교사 종합 의견" : field,
    before: feedbackDisplayValue(current?.[field]),
    after: feedbackDisplayValue(reviewed?.[field])
  })).filter((change) => change.before !== change.after);
  return { changedItems, addedItems, documentChanges };
}

function feedbackChangeMarkup(comparison) {
  const sections = [];
  if (comparison.changedItems.length) {
    sections.push(`<section><header><strong>교사가 수정한 지원안</strong><span>${comparison.changedItems.length}개</span></header>
      <div class="feedback-plan-list">${comparison.changedItems.map(({ item, changes }) => `<article>
        <h3>${escapeHtml(feedbackItemLabel(item))}</h3>
        <dl>${changes.map((change) => `<div><dt>${escapeHtml(change.label)}</dt><dd><span>${escapeHtml(change.before)}</span><b aria-hidden="true">→</b><strong>${escapeHtml(change.after)}</strong></dd></div>`).join("")}</dl>
      </article>`).join("")}</div>
    </section>`);
  }
  if (comparison.addedItems.length) {
    sections.push(`<section><header><strong>교사가 추가한 지원안</strong><span>${comparison.addedItems.length}개</span></header>
      <div class="feedback-added-list">${comparison.addedItems.map((item) => `<article><strong>${escapeHtml(feedbackItemLabel(item))}</strong><span>${escapeHtml(item.targetAdmission || item.admission || "전형 미입력")} · ${escapeHtml(item.strategy || "지원 판단 미입력")}</span></article>`).join("")}</div>
    </section>`);
  }
  if (comparison.documentChanges.length) {
    sections.push(`<section><header><strong>상담 의견</strong><span>${comparison.documentChanges.length}개</span></header>
      ${comparison.documentChanges.map((change) => `<article class="feedback-opinion"><span>${escapeHtml(change.before)}</span><strong>${escapeHtml(change.after)}</strong></article>`).join("")}
    </section>`);
  }
  return sections.join("") || '<div class="feedback-no-change"><strong>현재 상담카드와 달라진 값이 없습니다.</strong><span>교사 확인 이력은 아래에서 확인할 수 있습니다.</span></div>';
}

function closeFeedbackEditor({ restoreFocus = true } = {}) {
  if (byId("feedbackEditor").hidden) return;
  byId("feedbackEditor").hidden = true;
  document.body.classList.remove("editor-open");
  feedbackSession = null;
  if (restoreFocus && feedbackReturnFocusElement?.focus) feedbackReturnFocusElement.focus();
  feedbackReturnFocusElement = null;
}

function openFeedbackEditor(payload, fileName = "") {
  const feedback = window.SusiCardTransfer.normalizeTeacherFeedback(payload);
  const current = ConsultationCardStore.read();
  const comparison = collectFeedbackComparison(current, feedback);
  const mismatch = Boolean(current.studentNumber && feedback.studentNumber && current.studentNumber !== feedback.studentNumber);
  const standardAdded = comparison.addedItems.filter((item) => !item.exemptFromSixLimit).length;
  const capacityBlocked = current.standardItems.length + standardAdded > ConsultationCardStore.MAX_STANDARD_SLOTS;
  const blocked = mismatch || capacityBlocked;
  feedbackSession = { feedback, comparison, fileName, mismatch, capacityBlocked, blocked };
  feedbackReturnFocusElement = document.activeElement;
  byId("feedbackTitle").textContent = `${feedback.studentNumber || "학번 미입력"} 학생 교사 피드백`;
  byId("feedbackMeta").innerHTML = `<div><span>피드백 파일</span><strong>${escapeHtml(fileName || "교사 피드백 확인본")}</strong></div><div><span>교사 저장</span><strong>${escapeHtml(localDateTime(feedback.exportedAt) || "시간 확인 필요")}</strong></div>`;
  byId("feedbackStudentMismatch").hidden = !blocked;
  byId("feedbackStudentMismatch").textContent = mismatch
    ? `현재 학번 ${current.studentNumber}과 피드백 파일의 학번 ${feedback.studentNumber}이 다릅니다. 해당 학생의 기기에서 다시 불러오세요.`
    : capacityBlocked
      ? `교사가 추가한 지원안을 넣을 자리가 부족합니다. 현재 일반·예비 지원안을 ${current.standardItems.length + standardAdded - ConsultationCardStore.MAX_STANDARD_SLOTS}개 정리한 뒤 다시 불러오세요.`
      : "";
  const total = comparison.changedItems.length + comparison.addedItems.length + comparison.documentChanges.length;
  byId("feedbackSummary").innerHTML = `<div><strong>${comparison.changedItems.length}</strong><span>수정 지원안</span></div><div><strong>${comparison.addedItems.length}</strong><span>추가 지원안</span></div><div><strong>${comparison.documentChanges.length}</strong><span>상담 의견</span></div><p>${total ? "적용하면 아래 교사 확인본으로 현재 상담카드가 갱신됩니다." : "교사 확인 이력만 있고 현재 값과의 차이는 없습니다."}</p>`;
  byId("feedbackChanges").innerHTML = feedbackChangeMarkup(comparison);
  const history = [...feedback.teacherChanges.revisionLog].reverse();
  byId("feedbackHistory").innerHTML = history.length
    ? history.map((entry) => `<div><time>${escapeHtml(localDateTime(entry.editedAt))}</time><p>${escapeHtml(entry.label || "교사가 상담카드를 확인했습니다.")}</p></div>`).join("")
    : '<p class="feedback-history-empty">기록된 교사 확인 이력이 없습니다.</p>';
  byId("feedbackConfirm").checked = false;
  byId("feedbackConfirm").disabled = blocked;
  byId("applyTeacherFeedback").disabled = true;
  byId("feedbackEditor").hidden = false;
  document.body.classList.add("editor-open");
  byId("feedbackConfirm").focus();
}

function applyTeacherFeedback() {
  if (!feedbackSession || feedbackSession.blocked || !byId("feedbackConfirm").checked) return;
  try {
    ConsultationCardStore.backupBeforeTeacherFeedback({
      studentNumber: feedbackSession.feedback.studentNumber,
      feedbackExportedAt: feedbackSession.feedback.exportedAt
    });
    const merged = window.SusiCardTransfer.applyTeacherFeedback(
      ConsultationCardStore.read(),
      feedbackSession.feedback
    );
    const imported = ConsultationCardStore.importData(merged);
    closeFeedbackEditor({ restoreFocus: false });
    expandedCardId = "";
    reorderMode = false;
    closeEditor();
    closeSimilarDepartmentEditor({ restoreFocus: false });
    loadDocumentForm();
    render();
    updateDocumentStatus(imported);
    showToast("교사 피드백을 적용했습니다. 적용 전 상태도 이 기기에 보관했습니다.");
  } catch (error) {
    window.alert(`교사 피드백을 적용하지 못했습니다.\n${error.message}`);
  }
}

async function importCardFile(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (window.SusiCardTransfer?.isTeacherFeedback(payload)) {
      openFeedbackEditor(payload, file.name);
      return;
    }
    const current = ConsultationCardStore.read();
    const hasCurrentData = current.items.length || current.studentNumber || current.overallOpinion
      || current.gradeRecords.length || current.academicProfile.graduationYear
      || current.consultations.some(consultationHasContent);
    if (hasCurrentData && !window.confirm("현재 상담카드를 불러온 파일의 내용으로 바꿀까요?")) return;
    ConsultationCardStore.clearFeedbackBackups();
    const imported = ConsultationCardStore.importData(payload);
    if (!UNIVERSITY_CALCULATOR_CONFIG[payload.gradeCalculatorSelections?.activeUniversity]) {
      const linkedUniversity = imported.items
        .map((item) => calculatorUniversityIdFromName(item.university))
        .find(Boolean);
      if (linkedUniversity) selectCalculatorUniversity(linkedUniversity);
    }
    expandedCardId = "";
    reorderMode = false;
    closeEditor();
    closeSimilarDepartmentEditor({ restoreFocus: false });
    loadDocumentForm();
    render();
    showToast("수시카드 파일을 불러왔습니다.");
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
  showToast("인쇄 창에서 ‘PDF로 저장’을 선택한 뒤 저장 위치를 지정하세요.");
  window.setTimeout(() => window.print(), 120);
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

async function loadRecommendationIndex() {
  if (!dataCache.recommendationIndexPromise) {
    dataCache.recommendationIndexPromise = fetch("./admission-data/options-2027/department-recommendations.json?v=20260729b").then((response) => {
      if (!response.ok) throw new Error(`유사학과 추천 목록을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    });
  }
  return dataCache.recommendationIndexPromise;
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

async function loadLineageIndex() {
  if (!dataCache.lineageIndexPromise) {
    dataCache.lineageIndexPromise = fetch("./admission-data/entity-lineage/index.json?v=20260719a").then((response) => {
      if (!response.ok) throw new Error(`모집단위 연결 목록을 불러오지 못했습니다: ${response.status}`);
      return response.json();
    });
  }
  return dataCache.lineageIndexPromise;
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

async function loadHistoryUniversities(codes) {
  const uniqueCodes = [...new Set((codes || []).filter(Boolean))];
  if (!uniqueCodes.length) return { rows: [] };
  const payloads = await Promise.all(uniqueCodes.map((code) => loadHistoryUniversity(code)));
  const rowsById = new Map();
  payloads.forEach((payload) => {
    (payload?.rows || []).forEach((row) => {
      const key = row.id || `${row.year}|${row.universityCode || ""}|${row.department}|${row.admission}`;
      const current = rowsById.get(key);
      if (!current || rowMetricCount(row) > rowMetricCount(current)) rowsById.set(key, row);
    });
  });
  return { rows: [...rowsById.values()] };
}

function lineageHistoryCodes(lineageData, currentCode) {
  const configured = Array.isArray(lineageData?.historyUniversityCodes)
    ? lineageData.historyUniversityCodes
    : [];
  return [...new Set([currentCode, ...configured].filter(Boolean))];
}

async function loadLineageUniversity(code) {
  if (!code) return { options: [] };
  const index = await loadLineageIndex();
  const entry = index.universities.find((university) => university.code === code);
  if (!entry) return { options: [] };
  if (!dataCache.lineageUniversities.has(code)) {
    dataCache.lineageUniversities.set(code, fetch(`./admission-data/entity-lineage/${entry.file}?v=${encodeURIComponent(index.generatedAt)}`).then((response) => {
      if (!response.ok) throw new Error(`모집단위 연결 자료를 불러오지 못했습니다: ${response.status}`);
      return response.json();
    }));
  }
  return dataCache.lineageUniversities.get(code);
}

function matchingUniversity(index, item) {
  const manual = MANUAL_EXEMPT_UNIVERSITIES.find((university) => university.code === item.targetUniversityCode);
  if (manual) return manual;
  if (item.targetUniversityCode) {
    const exactCode = index.universities.find((university) => university.code === activeUniversityCode(item.targetUniversityCode));
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

function legacyHistoryMatch(rows, departmentName, option) {
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
  const similarDepartments = sameAdmission
    .filter((row) => compact(row.department) !== departmentKey)
    .map((row) => ({ ...row, similarity: diceSimilarity(row.department, departmentName), matchType: "similar", lineageRelation: "similar_reference" }))
    .filter((row) => row.similarity >= 0.34)
    .sort((left, right) => right.similarity - left.similarity || Number(right.year) - Number(left.year));
  const otherAdmissions = rows
    .filter((row) => categoryKey(row.category) === optionCategory
      && compact(row.department) === departmentKey
      && admissionKey(row.admission) !== optionAdmission)
    .map((row) => ({ ...row, matchType: "similar", lineageRelation: "admission_changed_candidate" }))
    .sort((left, right) => Number(right.year) - Number(left.year) || rowMetricCount(right) - rowMetricCount(left));
  const uniqueSuggestions = [];
  const seen = new Set();
  [...otherAdmissions, ...similarDepartments].forEach((row) => {
    const key = `${row.year}|${row.department}|${row.admission}`;
    if (!seen.has(key) && uniqueSuggestions.length < 15) {
      seen.add(key);
      uniqueSuggestions.push(row);
    }
  });
  return { history: YEARS.map((year) => byYear.get(year)).filter(Boolean), suggestions: uniqueSuggestions };
}

function matchHistory(rows, departmentName, option, lineagePayload = null) {
  const lineage = (lineagePayload?.options || []).find((entry) => entry.optionId === option.optionId);
  if (!lineage) {
    const fallback = legacyHistoryMatch(rows, departmentName, option);
    return {
      ...fallback,
      connectionStatus: fallback.history.length ? "legacy_exact" : "lineage_unavailable",
      connectionLabel: fallback.history.length ? "동일 명칭 기준 연결" : "연결 자료 확인 필요",
      entityId: "",
      matchMethod: "legacy_exact_normalized_identity",
      reviewCandidateCount: fallback.suggestions.length
    };
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const approved = (lineage.approvedHistoryIds || [])
    .map((id) => rowsById.get(id))
    .filter(Boolean)
    .map((row) => ({
      ...row,
      matchType: "exact",
      lineageRelation: lineage.approvedRelation || "same",
      lineageScore: "1",
      lineageReviewStatus: lineage.connectionStatus === "approved_official_evidence" ? "approved_trend" : "approved_exact"
    }));
  const byYear = new Map();
  approved.forEach((row) => {
    const current = byYear.get(row.year);
    if (!current || rowMetricCount(row) > rowMetricCount(current)) byYear.set(row.year, row);
  });

  const suggestions = [];
  const seen = new Set();
  [...(lineage.candidates || [])]
    .filter((candidate) => !["approved_trend", "rejected"].includes(candidate.reviewStatus))
    .sort((left, right) => Number(right.reviewStatus === "approved_reference") - Number(left.reviewStatus === "approved_reference"))
    .forEach((candidate) => {
      const candidateRows = (candidate.historicalRecordIds || [])
        .map((id) => rowsById.get(id))
        .filter(Boolean)
        .sort((left, right) => Number(right.year) - Number(left.year) || rowMetricCount(right) - rowMetricCount(left));
      candidateRows.forEach((row) => {
        const key = `${row.year}|${row.department}|${row.admission}`;
        if (seen.has(key) || suggestions.length >= 15) return;
        seen.add(key);
        suggestions.push({
          ...row,
          matchType: "similar",
          lineageRelation: candidate.relation || "similar_reference",
          lineageScore: String(candidate.score ?? ""),
          lineageCandidateId: candidate.candidateId || "",
          lineageReviewStatus: candidate.reviewStatus || "manual_review",
          lineageEvidence: normalizedLineageEvidence(candidate.reviewEvidence)
        });
      });
    });

  return {
    history: YEARS.map((year) => byYear.get(year)).filter(Boolean),
    suggestions,
    connectionStatus: lineage.connectionStatus || "lineage_unavailable",
    connectionLabel: lineage.connectionLabel || "연결 상태 확인 필요",
    entityId: lineage.entityId || "",
    matchMethod: lineage.matchMethod || "",
    reviewCandidateCount: Number(lineage.reviewCandidateCount || 0),
    approvedRelation: lineage.approvedRelation || "",
    approvalEvidence: (lineage.approvalEvidence || []).map(normalizedLineageEvidence).filter((entry) => entry.sourceUrl || entry.sourceTitle)
  };
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
    targetReferenceQuota: option.referenceQuota == null ? "" : String(option.referenceQuota),
    targetQuotaDataStatus: option.quotaDataStatus || "official_not_entered",
    targetSelectionMethod: option.selectionMethod || "",
    targetReferenceSelectionMethod: option.referenceSelectionMethod || "",
    targetSelectionMethodDataStatus: option.selectionMethodDataStatus || "official_not_entered",
    targetSelectionBreakdown: Array.isArray(option.selectionBreakdown) ? option.selectionBreakdown : [],
    targetSourceUrl: option.sourceUrl || "",
    targetMinimumStatus: option.minimumStatus || "",
    targetMinimumOfficial: option.minimumStandard || "",
    targetReferenceMinimum: option.referenceMinimum || "",
    targetMinimumDataStatus: option.minimumDataStatus || option.minimumStatus || "official_not_entered",
    targetReferenceSourceType: option.referenceSourceType || "",
    targetMinimumSubjects: option.minimumSubjects || "",
    targetMinimumSourceUrl: option.minimumSourceUrl || "",
    targetAnnouncementDate: option.announcementDate || "",
    historyEntityId: matched.entityId || "",
    historyConnectionStatus: matched.connectionStatus || "",
    historyConnectionLabel: matched.connectionLabel || "",
    historyMatchMethod: matched.matchMethod || "",
    historyReviewCandidateCount: Number(matched.reviewCandidateCount || 0),
    historyApprovedRelation: matched.approvedRelation || "",
    historyApprovalEvidence: matched.approvalEvidence || [],
    history: matched.history,
    historySuggestions: matched.suggestions,
    historyUserReferences: []
  };
}

async function refreshHistoryReferences(item) {
  if (!item?.targetOptionId || isManualUniversity(item)) return item;
  const code = activeUniversityCode(item.targetUniversityCode || universityCodeFromItem(item));
  if (!code) return item;
  const data = await loadOptionUniversity(code);
  const department = inferDepartment(data, item);
  const option = inferOption(department, item);
  if (!department || !option) return item;
  const lineageData = await loadLineageUniversity(code);
  const historyData = await loadHistoryUniversities(lineageHistoryCodes(lineageData, code));
  const matched = matchHistory(historyData.rows || [], department.name, option, lineageData);
  ConsultationCardStore.update(item.id, {
    historyEntityId: matched.entityId || "",
    historyConnectionStatus: matched.connectionStatus || "",
    historyConnectionLabel: matched.connectionLabel || "",
    historyMatchMethod: matched.matchMethod || "",
    historyReviewCandidateCount: Number(matched.reviewCandidateCount || 0),
    historyApprovedRelation: matched.approvedRelation || "",
    historyApprovalEvidence: matched.approvalEvidence || [],
    history: matched.history,
    historySuggestions: matched.suggestions,
    historyUserReferences: item.historyUserReferences || []
  });
  return ConsultationCardStore.read().items.find((candidate) => candidate.id === item.id) || item;
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
    const effectiveQuota = option.quota == null ? option.referenceQuota : option.quota;
    const quota = effectiveQuota == null ? "모집인원 미지정" : `${effectiveQuota}명`;
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
    targetReferenceQuota: "",
    targetQuotaDataStatus: "",
    targetSelectionMethod: "",
    targetReferenceSelectionMethod: "",
    targetSelectionMethodDataStatus: "",
    targetSelectionBreakdown: [],
    targetSourceUrl: "",
    targetMinimumStatus: "",
    targetMinimumOfficial: "",
    targetReferenceMinimum: "",
    targetMinimumDataStatus: "",
    targetReferenceSourceType: "",
    targetMinimumSubjects: "",
    targetMinimumSourceUrl: "",
    targetAnnouncementDate: "",
    historyEntityId: "",
    historyConnectionStatus: "",
    historyConnectionLabel: "",
    historyMatchMethod: "",
    historyReviewCandidateCount: 0,
    historyApprovedRelation: "",
    historyApprovalEvidence: [],
    history: [],
    historySuggestions: [],
    historyUserReferences: []
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
  const announcementDate = effectiveTargetValue(item, "announcementDate");
  const historyStatus = ["approved_exact", "approved_official_evidence"].includes(item.historyConnectionStatus)
    ? `${item.history?.length || 0}/3개년 확인`
    : item.historyConnectionLabel || `${item.history?.length || 0}/3개년 연결`;
  return `<div class="editor-preview-grid">
    <div><span>2027 모집</span><strong>${escapeHtml(quota ? withSuffix(quota, "명") : "인원 미지정")}</strong></div>
    <div><span>전형방법</span><strong>${escapeHtml(selectionMethod || "원문 확인 필요")}</strong></div>
    <div><span>수능최저</span><strong>${escapeHtml(minimum || "모집요강 확인 필요")}</strong></div>
    <div><span>최종 발표일</span><strong>${escapeHtml(announcementDate || "직접 입력 필요")}</strong></div>
    <div><span>과거 입결</span><strong>${escapeHtml(manual ? "입학처 확인" : historyStatus)}</strong></div>
  </div>`;
}

function syncOverrideEditor(item, { writeInputs = true } = {}) {
  const fields = overrideFields(item);
  Object.entries(OVERRIDE_CONFIG).forEach(([key, config]) => {
    const input = byId(config.input);
    const source = automaticTargetValue(item, key);
    const sourceStatus = targetDataStatus(item, key);
    const overridden = fields.has(key);
    const value = overridden ? String(item?.[config.override] ?? "") : source;
    if (writeInputs) input.value = value;
    input.disabled = !item?.university;

    const status = document.querySelector(`[data-override-status="${key}"]`);
    const sourceNote = document.querySelector(`[data-override-source="${key}"]`);
    const reset = document.querySelector(`[data-reset-override="${key}"]`);
    const manual = overridden && !source;
    const manualEntryRequired = key === "announcementDate" && !source;
    status.textContent = overridden ? (manual ? "직접 입력" : "직접 수정") : (source ? dataStatusLabel(sourceStatus) : manualEntryRequired ? "직접 입력" : "입력 전");
    status.classList.toggle("is-edited", overridden && !manual);
    status.classList.toggle("is-manual", manual || manualEntryRequired);
    sourceNote.textContent = source
      ? `${dataStatusLabel(sourceStatus)}: ${key === "quota" ? withSuffix(source, "명") : source}`
      : key === "announcementDate"
        ? "일정 데이터 없음 · 모집요강 확인 후 직접 입력"
        : "자동 입력값 없음 · 모집요강 확인";
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
    historyUserReferences: existing?.historyUserReferences || [],
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
      const lineageData = await loadLineageUniversity(data.code);
      const historyData = await loadHistoryUniversities(lineageHistoryCodes(lineageData, data.code));
      if (!editorSession || sequence !== editorSequence) return;
      const matched = matchHistory(historyData.rows || [], department.name, option, lineageData);
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

function similarDepartmentGroupLabels(groupIds, groups) {
  const ids = new Set(groupIds || []);
  return (groups || []).filter((group) => ids.has(group.id)).map((group) => group.label);
}

function readSimilarDepartmentReferenceGrade() {
  try {
    const value = Number(localStorage.getItem(REFERENCE_GRADE_STORAGE_KEY));
    return window.DepartmentRecommendations.validReferenceGrade(value) ? value : null;
  } catch {
    return null;
  }
}

function persistSimilarDepartmentReferenceGrade(value) {
  try {
    if (window.DepartmentRecommendations.validReferenceGrade(value)) {
      localStorage.setItem(REFERENCE_GRADE_STORAGE_KEY, Number(value).toFixed(2));
    } else {
      localStorage.removeItem(REFERENCE_GRADE_STORAGE_KEY);
    }
  } catch {
    // 로컬 저장을 사용할 수 없어도 현재 추천 비교는 계속 제공한다.
  }
}

function syncSimilarDepartmentReferenceStatus(error = false) {
  const input = byId("similarDepartmentReferenceGrade");
  const status = byId("similarDepartmentReferenceStatus");
  input.setAttribute("aria-invalid", String(error));
  status.classList.toggle("is-error", error);
  if (error) {
    status.textContent = "내 참고등급은 1.00~9.00 사이로 입력하세요.";
  } else if (similarDepartmentSession?.referenceGrade !== null) {
    status.textContent = `내 ${similarDepartmentSession.referenceGrade.toFixed(2)}등급 위치 표시 · 이 기기에만 저장`;
  } else {
    status.textContent = "최근 공개 입결은 동일 명칭 모집단위의 단순 참고값입니다.";
  }
}

function gradeScalePosition(value) {
  return Math.max(0, Math.min(100, ((Number(value) - 1) / 8) * 100));
}

function similarDepartmentGradeMarkup(candidate, session) {
  const recommendationApi = window.DepartmentRecommendations;
  const selectedCategory = byId("similarDepartmentCategory").value || session.source.category;
  const preferredKey = recommendationApi.categoryKey(selectedCategory);
  const range = recommendationApi.gradeRangeForCandidate(candidate, selectedCategory);
  if (!range) {
    return '<section class="similar-department-grade is-empty"><span>최근 공개 학생부 입결</span><strong>동일 명칭 공개값 없음</strong></section>';
  }

  const exactCategoryRange = candidate.gradeRanges?.[preferredKey] === range;
  const categoryLabel = exactCategoryRange ? {
    subject: "학생부교과",
    holistic: "학생부종합",
    essay: "논술",
    performance: "실기·특기"
  }[preferredKey] || "선택 전형" : "전체 전형";
  const minimum = Number(range.min);
  const maximum = Number(range.max);
  const rangeStart = gradeScalePosition(minimum);
  const rangeWidth = Math.max(1.5, gradeScalePosition(maximum) - rangeStart);
  const reference = recommendationApi.referenceGradePosition(session.referenceGrade, range);
  const referenceLabel = !reference
    ? ""
    : reference.status === "within"
      ? "내 등급이 공개 범위 안"
      : reference.status === "ahead"
        ? `공개 범위보다 숫자상 ${reference.difference.toFixed(2)}등급 앞`
        : `공개 범위보다 숫자상 ${reference.difference.toFixed(2)}등급 뒤`;
  const gradeText = minimum === maximum ? minimum.toFixed(2) : `${minimum.toFixed(2)}~${maximum.toFixed(2)}`;

  return `<section class="similar-department-grade">
    <header><span>${escapeHtml(range.year)}학년도 ${escapeHtml(categoryLabel)} 공개값</span><strong>${escapeHtml(gradeText)}</strong></header>
    <div class="similar-grade-track" aria-label="1등급부터 9등급 중 공개 범위 ${escapeHtml(gradeText)}${referenceLabel ? `, ${escapeHtml(referenceLabel)}` : ""}">
      <span>1</span><div><i style="left:${rangeStart}%;width:${rangeWidth}%"></i>${reference ? `<b style="left:${gradeScalePosition(session.referenceGrade)}%" title="내 ${session.referenceGrade.toFixed(2)}등급"></b>` : ""}</div><span>9</span>
    </div>
    <footer><span>동일 명칭 ${escapeHtml(range.count)}개 전형</span>${referenceLabel ? `<em class="is-${escapeHtml(reference.status)}">${escapeHtml(referenceLabel)}</em>` : ""}</footer>
  </section>`;
}

function populateSimilarDepartmentFilters(session) {
  const regions = [...new Set(session.candidates.map((candidate) => candidate.region).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "ko"));
  const categories = [...new Set(session.candidates.flatMap((candidate) => candidate.categories || []).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "ko"));
  byId("similarDepartmentRegion").innerHTML = '<option value="">전체 지역</option>'
    + regions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join("");
  byId("similarDepartmentCategory").innerHTML = '<option value="">전체 전형 유형</option>'
    + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  byId("similarDepartmentQuery").value = "";
}

function sameSimilarDepartment(left, right) {
  return left?.universityCode === right?.universityCode
    && compact(left?.department) === compact(right?.department);
}

function similarDepartmentComparisonCardMarkup(candidate, session, index) {
  const categoryText = (candidate.categories || []).join(" · ") || "전형 유형 확인";
  const fieldText = (candidate.fields || []).join(" · ") || "계열 확인";
  const university = `${candidate.university}${candidate.campus ? ` · ${candidate.campus}` : ""}`;
  return `<article class="similar-department-compare-card">
    <header>
      <span>후보 ${index + 1}</span>
      <button type="button" data-remove-similar-comparison="${index}" aria-label="${escapeHtml(university)} ${escapeHtml(candidate.department)} 비교에서 빼기">빼기</button>
    </header>
    <div>
      <h3>${escapeHtml(university)}</h3>
      <p>${escapeHtml(candidate.department)}</p>
    </div>
    <dl>
      <div><dt>지역</dt><dd>${escapeHtml(candidate.region || "-")}</dd></div>
      <div><dt>2027 전형 유형</dt><dd>${escapeHtml(categoryText)}</dd></div>
      <div><dt>모집 계열</dt><dd>${escapeHtml(fieldText)}</dd></div>
      <div><dt>전형 수</dt><dd>${escapeHtml(candidate.optionCount)}개</dd></div>
    </dl>
    ${similarDepartmentGradeMarkup(candidate, session)}
    <label class="similar-department-compare-note">
      <span>선택 이유·상담 메모</span>
      <textarea data-similar-department-note="${index}" maxlength="500" placeholder="교육과정, 지역, 전형 조건 등 검토 이유를 적어보세요.">${escapeHtml(candidate.note || "")}</textarea>
    </label>
    <button class="similar-department-compare-choose" type="button" data-choose-compared-department="${index}"${session.standardFull ? " disabled" : ""}>${session.standardFull ? "지원안 가득 참" : "이 학과 전형 선택"}</button>
  </article>`;
}

function persistSimilarDepartmentCandidates({ refreshCard = true } = {}) {
  if (!similarDepartmentSession) return;
  const now = new Date().toISOString();
  similarDepartmentSession.selectedCandidates = similarDepartmentSession.selectedCandidates.map((candidate) => ({
    ...candidate,
    savedAt: candidate.savedAt || now
  }));
  ConsultationCardStore.update(similarDepartmentSession.itemId, {
    similarDepartmentCandidates: similarDepartmentSession.selectedCandidates
  });
  if (refreshCard) render();
}

function renderSimilarDepartmentComparison() {
  if (!similarDepartmentSession) return;
  const selected = similarDepartmentSession.selectedCandidates || [];
  const comparison = byId("similarDepartmentCompare");
  comparison.hidden = selected.length === 0;
  byId("similarDepartmentCompareCount").textContent = `${selected.length}/3`;
  byId("similarDepartmentCompareGrid").innerHTML = selected.map((candidate, index) => (
    similarDepartmentComparisonCardMarkup(candidate, similarDepartmentSession, index)
  )).join("");
}

function similarDepartmentCandidateMarkup(candidate, session, index) {
  const sharedGroups = similarDepartmentGroupLabels(
    (candidate.groupIds || []).filter((id) => session.sourceGroupIds.includes(id)),
    session.index.groups
  );
  const categoryText = (candidate.categories || []).join(" · ") || "전형 유형 확인";
  const fieldText = (candidate.fields || []).join(" · ") || "계열 확인";
  const full = session.standardFull;
  const compared = (session.selectedCandidates || []).some((selected) => sameSimilarDepartment(selected, candidate));
  return `<article class="similar-department-card${compared ? " is-compared" : ""}">
    <div>
      <header>
        ${sharedGroups.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
        <em>${escapeHtml(candidate.region || "지역 확인")}</em>
      </header>
      <h3>${escapeHtml(candidate.university)}${candidate.campus ? ` · ${escapeHtml(candidate.campus)}` : ""}</h3>
      <p>${escapeHtml(candidate.department)}</p>
    </div>
    <div class="similar-department-card-actions">
      <button class="similar-department-compare-toggle" type="button" data-toggle-similar-comparison="${index}" aria-pressed="${compared}">${compared ? "비교에서 빼기" : "비교 담기"}</button>
      <button type="button" data-choose-similar-department="${index}"${full ? " disabled" : ""}>${full ? "지원안 가득 참" : "전형 선택"}</button>
    </div>
    <dl>
      <div><dt>지역</dt><dd>${escapeHtml(candidate.region || "-")}</dd></div>
      <div><dt>2027 전형 유형</dt><dd>${escapeHtml(categoryText)}</dd></div>
      <div><dt>전형 수</dt><dd>${escapeHtml(candidate.optionCount)}개</dd></div>
      <div><dt>모집 계열</dt><dd>${escapeHtml(fieldText)}</dd></div>
    </dl>
    ${similarDepartmentGradeMarkup(candidate, session)}
  </article>`;
}

function renderSimilarDepartmentResults() {
  if (!similarDepartmentSession) return;
  const recommendationApi = window.DepartmentRecommendations;
  const region = byId("similarDepartmentRegion").value;
  const category = byId("similarDepartmentCategory").value;
  const query = byId("similarDepartmentQuery").value;
  const ranked = recommendationApi.rankCandidates(
    similarDepartmentSession.source,
    similarDepartmentSession.candidates,
    {
      sourceGroupIds: similarDepartmentSession.sourceGroupIds,
      region,
      category,
      query,
      limit: Math.max(1, similarDepartmentSession.candidates.length)
    }
  );
  similarDepartmentSession.visibleCandidates = ranked.slice(0, 40);
  similarDepartmentSession.standardFull = ConsultationCardStore.read().standardFull;
  byId("similarDepartmentResultCount").textContent = ranked.length > 40
    ? `${ranked.length.toLocaleString("ko-KR")}개 후보 중 상위 40개`
    : `${ranked.length.toLocaleString("ko-KR")}개 후보`;
  byId("similarDepartmentResults").innerHTML = similarDepartmentSession.visibleCandidates.length
    ? similarDepartmentSession.visibleCandidates.map((candidate, index) => (
      similarDepartmentCandidateMarkup(candidate, similarDepartmentSession, index)
    )).join("")
    : `<div class="similar-department-empty">
      <strong>조건에 맞는 유사학과 후보가 없습니다.</strong>
      지역·전형 유형 필터나 검색어를 지우고 다시 확인하세요.
    </div>`;
  renderSimilarDepartmentComparison();
}

async function openSimilarDepartmentEditor(itemId) {
  const recommendationApi = window.DepartmentRecommendations;
  if (!recommendationApi) {
    showToast("유사학과 추천 기능을 불러오지 못했습니다.");
    return;
  }
  const item = ConsultationCardStore.read().items.find((candidate) => candidate.id === itemId);
  if (!item) return;
  const department = item.targetDepartment || item.department;
  if (!department) {
    showToast("학과·모집단위를 먼저 선택하세요.");
    return;
  }

  similarDepartmentReturnFocusElement = document.activeElement;
  byId("similarDepartmentTitle").textContent = `${department} 유사학과`;
  byId("similarDepartmentSource").innerHTML = `<div><span>기준 지원안</span><strong>${escapeHtml(item.university)} · ${escapeHtml(department)}</strong></div><em>2027 모집단위 기준</em>`;
  byId("similarDepartmentResultCount").textContent = "후보를 불러오는 중입니다.";
  byId("similarDepartmentReferenceGrade").value = "";
  byId("similarDepartmentReferenceStatus").textContent = "최근 공개 입결은 동일 명칭 모집단위의 단순 참고값입니다.";
  byId("similarDepartmentCompare").hidden = true;
  byId("similarDepartmentCompareCount").textContent = "0/3";
  byId("similarDepartmentCompareGrid").innerHTML = "";
  byId("similarDepartmentResults").innerHTML = '<div class="similar-department-empty"><strong>2027 유사학과를 찾고 있습니다.</strong>잠시만 기다려주세요.</div>';
  byId("similarDepartmentEditor").hidden = false;
  document.body.classList.add("editor-open");

  try {
    const index = await loadRecommendationIndex();
    if (byId("similarDepartmentEditor").hidden) return;
    const sourceGroupIds = recommendationApi.matchingGroups(department, index.groups).map((group) => group.id);
    const sourceCode = activeUniversityCode(item.targetUniversityCode || universityCodeFromItem(item));
    const sourceEntry = index.departments.find((candidate) => (
      candidate.universityCode === sourceCode
      && compact(candidate.department) === compact(department)
    ));
    const source = {
      universityCode: sourceCode,
      department,
      category: item.targetCategory || item.category || "",
      field: item.targetField || "",
      region: sourceEntry?.region || ""
    };
    const groupIdSet = new Set(sourceGroupIds);
    const candidates = index.departments.filter((candidate) => (
      (candidate.groupIds || []).some((id) => groupIdSet.has(id))
    ));
    const savedCandidates = Array.isArray(item.similarDepartmentCandidates) ? item.similarDepartmentCandidates : [];
    const selectedCandidates = savedCandidates.map((saved) => {
      const current = index.departments.find((candidate) => sameSimilarDepartment(candidate, saved));
      return {
        ...saved,
        ...(current || {}),
        note: saved.note || "",
        savedAt: saved.savedAt || ""
      };
    });
    similarDepartmentSession = {
      itemId,
      index,
      source,
      sourceGroupIds,
      candidates,
      visibleCandidates: [],
      selectedCandidates,
      standardFull: ConsultationCardStore.read().standardFull,
      referenceGrade: readSimilarDepartmentReferenceGrade()
    };
    const groupLabels = similarDepartmentGroupLabels(sourceGroupIds, index.groups);
    byId("similarDepartmentSource").innerHTML = `<div><span>기준 지원안</span><strong>${escapeHtml(item.university)} · ${escapeHtml(department)}</strong></div><em>${escapeHtml(groupLabels.join(" · ") || "분류 없음")}</em>`;
    populateSimilarDepartmentFilters(similarDepartmentSession);
    byId("similarDepartmentReferenceGrade").value = similarDepartmentSession.referenceGrade === null
      ? ""
      : similarDepartmentSession.referenceGrade.toFixed(2);
    syncSimilarDepartmentReferenceStatus();
    if (!sourceGroupIds.length) {
      byId("similarDepartmentResultCount").textContent = "추천 분류 없음";
      byId("similarDepartmentResults").innerHTML = `<div class="similar-department-empty">
        <strong>이 학과에 연결된 유사학과 주제어가 아직 없습니다.</strong>
        일반검색 모드의 학과명 검색을 이용하거나 학과 교육과정을 직접 비교하세요.
      </div>`;
      renderSimilarDepartmentComparison();
      return;
    }
    renderSimilarDepartmentResults();
    byId("similarDepartmentRegion").focus();
  } catch (error) {
    similarDepartmentSession = null;
    byId("similarDepartmentResultCount").textContent = "후보를 불러오지 못했습니다.";
    byId("similarDepartmentResults").innerHTML = `<div class="similar-department-empty"><strong>유사학과 목록을 열 수 없습니다.</strong>${escapeHtml(error.message)}</div>`;
  }
}

function closeSimilarDepartmentEditor({ restoreFocus = true } = {}) {
  if (byId("similarDepartmentEditor").hidden) return;
  byId("similarDepartmentEditor").hidden = true;
  document.body.classList.remove("editor-open");
  similarDepartmentSession = null;
  render();
  if (restoreFocus && similarDepartmentReturnFocusElement?.focus) similarDepartmentReturnFocusElement.focus();
  similarDepartmentReturnFocusElement = null;
}

async function openEditor({
  slot = 0,
  itemId = "",
  bucket = "standard",
  prefillUniversityCode = "",
  prefillDepartment = ""
} = {}) {
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
  byId("editorTitle").textContent = item
    ? "지원안 수정"
    : prefillDepartment
      ? "추천 학과 지원안 추가"
      : bucket === "exempt" ? "별도 지원 대학 추가" : "지원 대학 추가";
  byId("editorEyebrow").textContent = item
    ? (bucket === "exempt" ? "별도 지원 수정" : slotLabel(sourceSlot))
    : prefillDepartment ? "유사학과 추천에서 추가" : "지원안 입력";
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
    const entry = item
      ? matchingUniversity(index, item)
      : prefillUniversityCode
        ? allUniversityEntries(index).find((university) => university.code === activeUniversityCode(prefillUniversityCode)) || null
        : null;
    populateUniversitySelect(byId("editorUniversity"), index, entry?.code || "", bucket === "exempt");
    const prefillItem = !item && prefillDepartment
      ? { department: prefillDepartment, targetDepartment: prefillDepartment }
      : null;
    await configureEditorUniversity(entry, item || prefillItem);
    if (prefillDepartment && editorSession?.department) byId("editorAdmission").focus();
    else byId("editorUniversity").focus();
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
    targetReferenceQuota: "",
    targetQuotaDataStatus: "",
    targetSelectionMethod: "",
    targetReferenceSelectionMethod: "",
    targetSelectionMethodDataStatus: "",
    targetSelectionBreakdown: [],
    targetMinimumOfficial: "",
    targetReferenceMinimum: "",
    targetMinimumDataStatus: "",
    targetReferenceSourceType: "",
    targetAnnouncementDate: "",
    historyEntityId: "",
    historyConnectionStatus: "",
    historyConnectionLabel: "",
    historyMatchMethod: "",
    historyReviewCandidateCount: 0,
    historyApprovedRelation: "",
    historyApprovalEvidence: [],
    history: [],
    historySuggestions: [],
    historyUserReferences: []
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
      targetCategory: "",
      targetField: "",
      targetQuota: "",
      targetQuotaStatus: "",
      targetReferenceQuota: "",
      targetQuotaDataStatus: "",
      targetSelectionMethod: "",
      targetReferenceSelectionMethod: "",
      targetSelectionMethodDataStatus: "",
      targetSelectionBreakdown: [],
      targetSourceUrl: "",
      targetMinimumStatus: "",
      targetMinimumOfficial: "",
      targetReferenceMinimum: "",
      targetMinimumDataStatus: "",
      targetReferenceSourceType: "",
      targetMinimumSubjects: "",
      targetMinimumSourceUrl: "",
      targetAnnouncementDate: "",
      historyEntityId: "",
      historyConnectionStatus: "",
      historyConnectionLabel: "",
      historyMatchMethod: "",
      historyReviewCandidateCount: 0,
      historyApprovedRelation: "",
      historyApprovalEvidence: [],
      history: [],
      historySuggestions: [],
      historyUserReferences: []
    };
    refreshEditorPreview();
    return;
  }
  const sequence = ++editorSequence;
  byId("editorPreview").textContent = "2027 모집정보와 과거 입결을 연결하는 중입니다.";
  try {
    const lineageData = await loadLineageUniversity(editorSession.data.code);
    const historyData = await loadHistoryUniversities(
      lineageHistoryCodes(lineageData, editorSession.data.code)
    );
    if (!editorSession || sequence !== editorSequence) return;
    const matched = matchHistory(historyData.rows || [], editorSession.department.name, option, lineageData);
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
  const previousItem = editorSession.itemId
    ? ConsultationCardStore.read().items.find((item) => item.id === editorSession.itemId)
    : null;
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
  if (previousItem && compact(previousItem.targetDepartment || previousItem.department) !== compact(changes.targetDepartment || changes.department)) {
    changes.similarDepartmentCandidates = [];
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
  const linkedCalculator = calculatorUniversityIdFromName(changes.university);
  if (linkedCalculator) selectCalculatorUniversity(linkedCalculator);
  closeEditor();
  render();
  const savedMessage = edited ? "지원안을 수정했습니다." : "상담카드에 지원안을 추가했습니다.";
  showToast(linkedCalculator
    ? `${savedMessage} ${calculatorUniversityLabel(linkedCalculator)} 환산계산기도 선택했습니다.`
    : savedMessage);
}

async function handleCardClick(event) {
  const openButton = event.target.closest("[data-open-slot]");
  if (openButton) {
    await openEditor({ slot: Number(openButton.dataset.openSlot) });
    return;
  }
  const similarDepartmentButton = event.target.closest("[data-open-similar-departments]");
  if (similarDepartmentButton) {
    await openSimilarDepartmentEditor(similarDepartmentButton.dataset.openSimilarDepartments);
    return;
  }
  const calculatorButton = event.target.closest("[data-open-calculator]");
  if (calculatorButton) {
    selectCalculatorUniversity(calculatorButton.dataset.openCalculator, { scroll: true, notify: true });
    return;
  }
  const openHistoryReferenceButton = event.target.closest("[data-open-history-reference]");
  if (openHistoryReferenceButton) {
    const itemId = openHistoryReferenceButton.dataset.openHistoryReference;
    const year = openHistoryReferenceButton.dataset.historyYear;
    const item = ConsultationCardStore.read().items.find((candidate) => candidate.id === itemId);
    if (!item || !YEARS.includes(year)) return;
    historyReferencePicker = { itemId, year };
    render();
    try {
      await refreshHistoryReferences(item);
      render();
    } catch (error) {
      render();
      showToast("유사 모집단위 후보를 새로 불러오지 못했습니다. 저장된 후보를 표시합니다.");
    }
    return;
  }
  const selectHistoryReferenceButton = event.target.closest("[data-select-history-reference]");
  if (selectHistoryReferenceButton) {
    const itemId = selectHistoryReferenceButton.dataset.selectHistoryReference;
    const year = selectHistoryReferenceButton.dataset.historyYear;
    const index = Number(selectHistoryReferenceButton.dataset.referenceIndex);
    const item = ConsultationCardStore.read().items.find((candidate) => candidate.id === itemId);
    const selected = item ? historyReferenceCandidates(item, year)[index] : null;
    if (!item || !selected) {
      showToast("선택한 참고 자료를 찾지 못했습니다.");
      return;
    }
    const references = (item.historyUserReferences || []).filter((entry) => entry.year !== year);
    references.push({
      ...selected,
      userSelected: true,
      userSelectedAt: new Date().toISOString(),
      userSelectionLabel: "사용자 선택 참고"
    });
    ConsultationCardStore.update(itemId, { historyUserReferences: references });
    historyReferencePicker = null;
    render();
    showToast(`${year}학년도 유사 모집단위를 상담용 참고 자료로 저장했습니다.`);
    return;
  }
  const clearHistoryReferenceButton = event.target.closest("[data-clear-history-reference]");
  if (clearHistoryReferenceButton) {
    const itemId = clearHistoryReferenceButton.dataset.clearHistoryReference;
    const year = clearHistoryReferenceButton.dataset.historyYear;
    const item = ConsultationCardStore.read().items.find((candidate) => candidate.id === itemId);
    if (!item) return;
    ConsultationCardStore.update(itemId, {
      historyUserReferences: (item.historyUserReferences || []).filter((entry) => entry.year !== year)
    });
    historyReferencePicker = null;
    render();
    showToast(`${year}학년도 참고 연결을 해제했습니다.`);
    return;
  }
  if (event.target.closest("[data-close-history-reference]")) {
    historyReferencePicker = null;
    render();
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
  if (!window.confirm("학번, 학생부 과목, 지원안, 상담 메모와 상담 기록을 모두 초기화할까요?")) return;
  ConsultationCardStore.clear();
  expandedCardId = "";
  reorderMode = false;
  closeEditor();
  closeSimilarDepartmentEditor({ restoreFocus: false });
  closeFeedbackEditor({ restoreFocus: false });
  loadDocumentForm();
  render();
  showToast("상담카드를 초기화했습니다.");
});

byId("cardEditor").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-editor]")) closeEditor();
});
byId("similarDepartmentEditor").addEventListener("click", async (event) => {
  if (event.target.closest("[data-close-similar-departments]")) {
    closeSimilarDepartmentEditor();
    return;
  }
  if (!similarDepartmentSession) return;
  if (event.target.closest("[data-clear-similar-comparison]")) {
    similarDepartmentSession.selectedCandidates = [];
    persistSimilarDepartmentCandidates();
    renderSimilarDepartmentResults();
    return;
  }
  const removeButton = event.target.closest("[data-remove-similar-comparison]");
  if (removeButton) {
    similarDepartmentSession.selectedCandidates.splice(Number(removeButton.dataset.removeSimilarComparison), 1);
    persistSimilarDepartmentCandidates();
    renderSimilarDepartmentResults();
    return;
  }
  const toggleButton = event.target.closest("[data-toggle-similar-comparison]");
  if (toggleButton) {
    const candidate = similarDepartmentSession.visibleCandidates[Number(toggleButton.dataset.toggleSimilarComparison)];
    if (!candidate) return;
    const selectedIndex = similarDepartmentSession.selectedCandidates.findIndex((selected) => (
      sameSimilarDepartment(selected, candidate)
    ));
    if (selectedIndex >= 0) {
      similarDepartmentSession.selectedCandidates.splice(selectedIndex, 1);
    } else if (similarDepartmentSession.selectedCandidates.length >= 3) {
      showToast("비교 후보는 3개까지 담을 수 있습니다.");
      return;
    } else {
      similarDepartmentSession.selectedCandidates.push({ ...candidate, note: "", savedAt: new Date().toISOString() });
    }
    persistSimilarDepartmentCandidates();
    renderSimilarDepartmentResults();
    return;
  }
  const comparedButton = event.target.closest("[data-choose-compared-department]");
  const chooseButton = event.target.closest("[data-choose-similar-department]");
  if (!chooseButton && !comparedButton) return;
  const candidate = comparedButton
    ? similarDepartmentSession.selectedCandidates[Number(comparedButton.dataset.chooseComparedDepartment)]
    : similarDepartmentSession.visibleCandidates[Number(chooseButton.dataset.chooseSimilarDepartment)];
  if (!candidate) return;
  closeSimilarDepartmentEditor({ restoreFocus: false });
  await openEditor({
    prefillUniversityCode: candidate.universityCode,
    prefillDepartment: candidate.department
  });
});
byId("similarDepartmentEditor").addEventListener("input", (event) => {
  const note = event.target.closest("[data-similar-department-note]");
  if (!note || !similarDepartmentSession) return;
  const candidate = similarDepartmentSession.selectedCandidates[Number(note.dataset.similarDepartmentNote)];
  if (!candidate) return;
  candidate.note = note.value.slice(0, 500);
  persistSimilarDepartmentCandidates({ refreshCard: false });
});
byId("similarDepartmentRegion").addEventListener("change", renderSimilarDepartmentResults);
byId("similarDepartmentCategory").addEventListener("change", renderSimilarDepartmentResults);
byId("similarDepartmentQuery").addEventListener("input", renderSimilarDepartmentResults);
byId("similarDepartmentReferenceGrade").addEventListener("input", () => {
  if (!similarDepartmentSession) return;
  const raw = byId("similarDepartmentReferenceGrade").value.trim();
  const value = Number(raw);
  const error = raw !== "" && !window.DepartmentRecommendations.validReferenceGrade(value);
  similarDepartmentSession.referenceGrade = error || raw === "" ? null : value;
  persistSimilarDepartmentReferenceGrade(similarDepartmentSession.referenceGrade);
  syncSimilarDepartmentReferenceStatus(error);
  renderSimilarDepartmentResults();
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
byId("schoolStatus").addEventListener("change", persistDocumentForm);
byId("graduationYear").addEventListener("input", scheduleDocumentSave);
byId("calculatorUniversity").addEventListener("change", () => {
  const current = ConsultationCardStore.read();
  const state = ConsultationCardStore.updateDocument({
    gradeCalculatorSelections: {
      ...current.gradeCalculatorSelections,
      activeUniversity: byId("calculatorUniversity").value
    }
  });
  renderUniversityCalculator(state);
  updateDocumentStatus(state);
});
byId("calculatorTrack").addEventListener("change", () => {
  const current = ConsultationCardStore.read();
  const activeUniversity = byId("calculatorUniversity").value;
  const selectionKey = UNIVERSITY_CALCULATOR_CONFIG[activeUniversity]?.selectionKey || "sejong2027";
  const state = ConsultationCardStore.updateDocument({
    gradeCalculatorSelections: {
      ...current.gradeCalculatorSelections,
      activeUniversity,
      [selectionKey]: byId("calculatorTrack").value
    }
  });
  renderUniversityCalculator(state);
  updateDocumentStatus(state);
});
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
byId("restoreFeedbackBackup").addEventListener("click", () => {
  const backup = ConsultationCardStore.feedbackBackups()[0];
  if (!backup || !window.confirm(`${localDateTime(backup.createdAt)} 피드백 적용 전 상태로 되돌릴까요? 현재 내용은 바뀝니다.`)) return;
  const result = ConsultationCardStore.restoreFeedbackBackup(backup.id);
  if (!result.restored) return;
  expandedCardId = "";
  reorderMode = false;
  loadDocumentForm();
  render();
  showToast("교사 피드백 적용 전 상태로 복원했습니다.");
});
byId("feedbackEditor").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-feedback]")) closeFeedbackEditor();
});
byId("feedbackConfirm").addEventListener("change", () => {
  byId("applyTeacherFeedback").disabled = !feedbackSession
    || feedbackSession.blocked
    || !byId("feedbackConfirm").checked;
});
byId("applyTeacherFeedback").addEventListener("click", applyTeacherFeedback);
byId("openGradeEditor").addEventListener("click", () => openGradeEditor());
byId("openGradePaste").addEventListener("click", openGradePaste);
byId("gradeCourseType").addEventListener("change", syncGradeEditorFields);
byId("gradePassFail").addEventListener("change", syncGradeEditorFields);
byId("gradeEditorForm").addEventListener("submit", saveGradeRecord);
byId("gradePasteForm").addEventListener("submit", saveGradePaste);
byId("gradeEditor").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-grade-editor]")) closeGradeEditor();
});
byId("gradePasteEditor").addEventListener("click", (event) => {
  if (event.target.closest("[data-close-grade-paste]")) closeGradePaste();
});
byId("gradeRecordList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-grade]");
  if (editButton) {
    openGradeEditor(editButton.dataset.editGrade);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-grade]");
  if (!deleteButton) return;
  const record = ConsultationCardStore.read().gradeRecords.find((candidate) => candidate.id === deleteButton.dataset.deleteGrade);
  if (!record || !window.confirm(`${record.subjectName} 과목을 삭제할까요?`)) return;
  ConsultationCardStore.removeGradeRecord(record.id);
  render();
  showToast("과목 성적을 삭제했습니다.");
});
document.querySelectorAll("[data-print-card]").forEach((button) => {
  button.addEventListener("click", printConsultationCard);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!byId("feedbackEditor").hidden) closeFeedbackEditor();
  else if (!byId("gradeEditor").hidden) closeGradeEditor();
  else if (!byId("gradePasteEditor").hidden) closeGradePaste();
  else if (!byId("similarDepartmentEditor").hidden) closeSimilarDepartmentEditor();
  else if (!byId("cardEditor").hidden) closeEditor();
});
window.addEventListener("storage", (event) => {
  loadDocumentForm();
  render();
  if (similarDepartmentSession && (!event.key || event.key === REFERENCE_GRADE_STORAGE_KEY)) {
    similarDepartmentSession.referenceGrade = readSimilarDepartmentReferenceGrade();
    byId("similarDepartmentReferenceGrade").value = similarDepartmentSession.referenceGrade === null
      ? ""
      : similarDepartmentSession.referenceGrade.toFixed(2);
    syncSimilarDepartmentReferenceStatus();
    renderSimilarDepartmentResults();
  }
});

loadDocumentForm();
render();
loadUniversityLinks().then(render).catch((error) => console.warn(error));
