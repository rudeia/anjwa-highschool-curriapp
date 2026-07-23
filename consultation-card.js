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
const SUCCESSOR_UNIVERSITY_CODES = new Map([
  ["0000001", "0003363"],
  ["0000002", "0003364"]
]);
const OVERRIDE_CONFIG = {
  quota: { source: "targetQuota", override: "targetQuotaOverride", input: "editorQuotaOverride", fallback: "모집인원 미지정" },
  selectionMethod: { source: "targetSelectionMethod", override: "targetSelectionMethodOverride", input: "editorSelectionMethodOverride", fallback: "원문 확인 피요" },
  minimum: { source: "targetMinimumOfficial", override: "targetMinimumOverride", input: "editorMinimumOverride", fallback: "모집요강 확인 피요" },
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
  const rows = YEARS.map((year) => {
    const entry = historyByYear.get(year);
    if (!entry) {
      return `<tr class="is-empty" data-year="${year}">
        <th scope="row"><span class="history-year">${year}</span></th>
        <td colspan="4"><span class="history-empty-copy"><strong>${escapeHtml(connection.empty)}</strong><small>${escapeHtml(connection.detail)}</small></span></td>
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
    const additional = historyAdditionalInfo(entry);
    const competition = competitionWithRatio(historyValue(entry, "competitionRate"));
    const sourceLabel = entry.officeSourceUrl ? "입학처" : "대학어디가";
    return `<tr class="has-data" data-year="${year}">
      <th scope="row"><span class="history-year">${year}<small>학년도</small></span>${historyVerificationBadge(entry)}</th>
      <td><strong class="history-single-value">${escapeHtml(competition)}</strong></td>
      <td>${gradeText}</td>
      <td><span class="history-admit-values"><strong>${quota}</strong><i>/</i><span title="${escapeHtml(additional.label)}">${escapeHtml(additional.value)}</span></span></td>
      <td>${sourceUrl ? `<a class="history-source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${sourceLabel}<span aria-hidden="true">↗</span></a>` : '<span class="history-muted">-</span>'}</td>
    </tr>`;
  }).join("");
  const suggestionGroups = splitHistorySuggestions(item);
  const connectedYears = YEARS.filter((year) => historyByYear.has(year));
  return `<section class="saved-history" aria-label="3개년 입결">
    <div class="history-head">
      <div class="history-heading-copy"><strong>확정 3개년 입결 추이</strong><span class="history-link-status is-${escapeHtml(connection.status)}">${escapeHtml(connection.label)}</span></div>
      <div class="history-coverage" aria-label="3개년 중 ${connectedYears.length}개년 연결">
        <span class="history-coverage-dots" aria-hidden="true">${YEARS.map((year) => `<i class="${historyByYear.has(year) ? "is-connected" : ""}"></i>`).join("")}</span>
        <strong>${connectedYears.length}<small>/3개년</small></strong>
      </div>
    </div>
    ${renderLineageEvidence(item)}
    <p class="history-identity-note">수능최저·모집인원·전형방법·반영비율이 달라졌다는 이유만으로 다른 모집단위가 되지 않습니다. 전형명까지 달라진 경우에만 대학 공식 근거를 확인한 다음 연결합니다. 연도별로 바뀐 조건은 학년도별 모집요강에서 따로 비교합니다.</p>
    <div class="history-table-wrap"><table class="history-table"><thead><tr><th>학년도</th><th>경쟁률</th><th>학생부 성적</th><th>모집/추합·충원</th><th>출처</th></tr></thead><tbody>${rows}</tbody></table></div>
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
  const status = overridden ? `<span class="option-value-status">${manual ? "직접 입력" : "직접 수정"}</span>` : "";
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
    if (!seen.has(key) && uniqueSuggestions.length < 6) {
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
      const row = candidateRows[0];
      if (!row) return;
      const key = `${row.year}|${row.department}|${row.admission}`;
      if (seen.has(key) || suggestions.length >= 6) return;
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
      historySuggestions: []
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
document.querySelectorAll("[data-print-card]").forEach((button) => {
  button.addEventListener("click", printConsultationCard);
});
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
