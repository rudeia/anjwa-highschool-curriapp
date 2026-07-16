const state = { manifest: null, allRows: [], trends: new Map(), rows: [], filtered: [], selectedYear: "", targetSlot: 0, targetBucket: "" };
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);

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

function selectedRegions() {
  return new Set([...document.querySelectorAll('input[name="regionFilter"]:checked')].map((input) => input.value));
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
    if (metricName === "additional") return numericValue(row.additional_admits || row.waitlist_last_rank);
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

const FIELD_LABELS = {
  quota: "모집인원",
  competition_rate: "경쟁률",
  additional_admits: "충원",
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
  if (row.verification === "adiga_reference_snapshot") {
    return "현재 화면에서 다시 확인하기 어려운 과거 대학어디가 공개값을 확인해 보완한 자료입니다.";
  }
  if (row.verification === "reference_snapshot_supplemented") {
    const fields = fieldList(row.supplementedFields);
    return `대학어디가 원문을 기준으로${fields ? `, 비어 있던 ${fields}은` : " 일부 빈 값은"} 과거 공개자료로 보완했습니다.`;
  }
  if (row.verification === "official_primary_partial") {
    const fields = fieldList(row.suppressedFields);
    return `대학어디가 원문에서 확인된 값만 표시합니다.${fields ? ` 자료의 의미가 달랐던 ${fields}은 표시하지 않았습니다.` : " 서로 다르게 확인된 값은 표시하지 않았습니다."}`;
  }
  return "";
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
    const rendered = value || (undisclosed ? "미공개" : "-");
    return `<span class="grade-cut${value ? "" : " is-empty"}"><b>${escapeHtml(label)}</b><strong>${escapeHtml(rendered)}</strong></span>`;
  }).join("")}</span>`;

  return `<dl class="metric metric-primary grade-cut-metric"><dt>학생부 성적 CUT</dt><dd>${content}</dd></dl>`;
}

function countWithUnit(value, unit) {
  const text = String(value || "").trim();
  if (!text) return "-";
  return /[가-힣]/.test(text) ? text : `${text}${unit}`;
}

function admissionVolume(row) {
  const quota = countWithUnit(row.quota, "명");
  if (row.additional_admits) {
    return { label: "모집 / 충원", value: `${quota} / ${countWithUnit(row.additional_admits, "명")}` };
  }
  if (row.waitlist_last_rank) {
    return { label: "모집 / 최종 예비", value: `${quota} / ${countWithUnit(row.waitlist_last_rank, "번")}` };
  }
  const suppressed = new Set(row.suppressedFields || []);
  return { label: "모집 / 충원", value: `${quota} / ${suppressed.has("additional_admits") ? "미공개" : "-"}` };
}

function competitionSummary(row) {
  const value = String(row.competition_rate || "").trim();
  if (value) return value.includes(":") ? value : `${value}:1`;
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

function trendConnectionLabel(item, selected) {
  if (item.department !== selected.department) return "유사 모집단위 참고";
  if (cleanAdmissionName(item.admission) !== cleanAdmissionName(selected.admission)) return "전형명 변경 연결";
  return "동일 모집단위·전형";
}

function trendAdditionalSummary(row) {
  const suppressed = new Set(row.suppressedFields || []);
  if (row.additional_admits) {
    const quota = numericValue(row.quota);
    const additional = numericValue(row.additional_admits);
    const rate = quota && additional !== null ? ` · ${Math.round((additional / quota) * 100)}%` : "";
    return { label: "충원", value: `${countWithUnit(row.additional_admits, "명")}${rate}` };
  }
  if (row.waitlist_last_rank) {
    return { label: "최종 예비", value: countWithUnit(row.waitlist_last_rank, "번") };
  }
  return { label: "충원", value: suppressed.has("additional_admits") ? "미공개" : "-" };
}

function trendRows(row) {
  const key = trendKey(row);
  const same = [...(state.trends.get(key) || [])];
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
        verifiedRow: true
      });
    }
  });
  return ["2024", "2025", "2026"].map((year) => byYear.get(year) || { year });
}

function gradeValue(row) {
  return row.result_70 || row.result_50 || row.result_90 || row.result_85
    || row.result_80 || row.result_75 || row.result_mean || "";
}

function trendChart(row) {
  const rows = trendRows(row);
  const visibleCount = rows.filter((item) => item.id).length;
  return `
    <section class="trend-section" aria-label="3개년 입결 추이">
      <div class="trend-head">
        <div><strong>3개년 입결 추이</strong><span>동일 대학·학과·전형 세부 유형을 연결한 결과입니다.</span></div>
        <em>${visibleCount}/3개년 확인</em>
      </div>
      <div class="trend-grid">
        ${rows.map((item) => {
          if (!item.id) return `<article class="trend-year is-empty">
            <header class="trend-year-head"><strong>${item.year}학년도</strong><span>모집 -</span></header>
            <p>동일 모집단위·전형 연결 자료 없음</p>
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
    </section>`;
}

function displayPair(first, second, suppressed) {
  if (first || second) return `${escapeHtml(first || "-")} / ${escapeHtml(second || "-")}`;
  return suppressed.has("result_50") || suppressed.has("result_70") ? "미공개" : "-";
}

function renderGradeTrack(rows) {
  const points = rows.map((row) => ({ year: row.year, value: Number(gradeValue(row)) })).filter((point) => Number.isFinite(point.value) && point.value > 0);
  if (points.length < 2) return '<p class="trend-help">등급 수치가 2개년 이상 확인되면 추이 그래프가 나타납니다.</p>';
  return `<div class="grade-track" aria-label="등급 추이 그래프">
    <div class="grade-axis"><span>1등급</span><span>5등급</span><span>9등급</span></div>
    ${points.map((point) => {
      const position = Math.max(0, Math.min(100, ((point.value - 1) / 8) * 100));
      return `<div class="grade-row"><strong>${point.year}</strong><div><i style="left:${position}%"></i></div><span>${point.value.toFixed(2)}</span></div>`;
    }).join("")}
  </div>`;
}

function render() {
  const university = byId("universityFilter").value;
  const category = byId("categoryFilter").value;
  const admissionType = byId("admissionTypeFilter").value;
  const group = byId("groupFilter").value;
  const query = byId("textFilter").value.trim().toLocaleLowerCase("ko");
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
      const haystack = `${row.university} ${row.admission} ${row.admissionType} ${row.department} ${row.departmentGroup} ${row.region} ${row.ownershipGroup}`.toLocaleLowerCase("ko");
      if (!haystack.includes(query)) return false;
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
  byId("resultList").innerHTML = state.filtered.slice(0, 300).map((row) => {
    const isSaved = cardIds.has(row.id);
    const admissionName = cleanAdmissionName(row.admission);
    const buttonText = state.targetBucket === "exempt"
      ? "별도 지원에 담기"
      : state.targetSlot
        ? `${slotLabel(state.targetSlot)}에 담기`
        : "상담카드에 추가";
    const sourceNote = verificationNote(row);
    const sourceLinkLabel = row.verification === "adiga_reference_snapshot" ? "대학어디가 대학 정보" : "대학어디가 원문";
    const volume = admissionVolume(row);
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
      <div class="result-metrics">
        ${gradeCutMetric(row)}
        ${metric("경쟁률", competitionSummary(row))}
        ${metric(volume.label, volume.value)}
      </div>
      <div class="result-controls">
        <details class="result-detail">
          <summary>3개년·상세 보기</summary>
          ${trendChart(row)}
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
        <button class="add-card-button${isSaved ? " is-saved" : ""}" type="button" data-card-id="${escapeHtml(row.id)}" ${isSaved ? "disabled" : ""}>
          ${isSaved ? "상담카드에 추가됨" : buttonText}
        </button>
      </div>
    </article>`;
  }).join("");
  if (state.filtered.length > 300) {
    byId("resultList").insertAdjacentHTML("beforeend", '<div class="empty-state">검색 결과가 많아 처음 300개만 표시합니다. 조건을 더 좁혀주세요.</div>');
  }
}

byId("resultList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-card-id]");
  if (!button) return;
  const row = state.allRows.find((item) => item.id === button.dataset.cardId);
  if (!row) return;
  if (state.targetBucket === "exempt" && !ConsultationCardStore.isExemptUniversity(row.university)) {
    showToast("현재 이 대학은 지원 횟수 제한 제외 목록으로 분류되지 않았습니다.");
    return;
  }
  const history = trendRows(row).filter((entry) => entry.id);
  const result = ConsultationCardStore.place({ ...row, history }, state.targetSlot || undefined);
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
});

async function loadAllYears() {
  const years = [...state.manifest.years].sort((a, b) => a.year.localeCompare(b.year));
  const payloads = await Promise.all(years.map(async (entry) => {
    const response = await fetch(`./admission-data/${entry.file}?v=${encodeURIComponent(state.manifest.generatedAt || "20260716f")}`);
    if (!response.ok) throw new Error(`자료를 불러오지 못했습니다: ${response.status}`);
    return response.json();
  }));
  state.allRows = payloads.flat();
  state.trends = new Map();
  state.allRows.forEach((row) => {
    const key = trendKey(row);
    if (!state.trends.has(key)) state.trends.set(key, []);
    state.trends.get(key).push(row);
  });
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
  const totalRows = (state.manifest.years || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
  const totalUniversities = Number(state.manifest.universityCount || 0);
  byId("metadataStatus").textContent = `${totalRows.toLocaleString("ko-KR")}건의 2024~2026학년도 입시결과와 ${totalUniversities}개 대학 정보를 조회할 수 있습니다.`;
}

function selectYear(year) {
  state.selectedYear = year;
  state.rows = state.allRows.filter((row) => row.year === year);
  fillUniversitySelect();
  fillSelect(byId("admissionTypeFilter"), uniqueValues("admissionType"), "전체 세부 유형");
  fillSelect(byId("groupFilter"), uniqueValues("departmentGroup"), "전체 계열");
  const entry = state.manifest.years.find((item) => item.year === year);
  byId("dataScope").textContent = `${entry.universities.length}개 대학 · 상세에서 3개년 추이 확인`;
  byId("disclosureLegend").hidden = !state.rows.some((row) => row.suppressedFields?.length);
  render();
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
    const response = await fetch("./admission-data/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`목록을 불러오지 못했습니다: ${response.status}`);
    state.manifest = await response.json();
    const years = [...state.manifest.years].sort((a, b) => b.year.localeCompare(a.year));
    byId("yearFilter").innerHTML = years.map((item) => `<option value="${item.year}">${item.year}학년도 입결</option>`).join("");
    await loadAllYears();
    renderAdvancedMetadata();
    selectYear(years[0].year);
  } catch (error) {
    byId("resultList").innerHTML = `<div class="empty-state">${escapeHtml(error.message)} 로컬 서버에서 다시 확인해주세요.</div>`;
  }
}

byId("yearFilter").addEventListener("change", (event) => selectYear(event.target.value));
["universityFilter", "categoryFilter", "admissionTypeFilter", "groupFilter", "sortFilter", "gradeMetricFilter", "ownershipFilter", "publishedGradeFilter"].forEach((id) => byId(id).addEventListener("change", render));
["gradeMinFilter", "gradeMaxFilter"].forEach((id) => byId(id).addEventListener("input", render));
byId("textFilter").addEventListener("input", render);
byId("regionOptions").addEventListener("change", render);
byId("clearRegions").addEventListener("click", () => {
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => { input.checked = false; });
  render();
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
  render();
  byId("resultCount").scrollIntoView({ behavior: "smooth", block: "center" });
});
byId("resetFilters").addEventListener("click", () => {
  ["universityFilter", "categoryFilter", "admissionTypeFilter", "groupFilter", "textFilter", "ownershipFilter", "gradeMinFilter", "gradeMaxFilter"].forEach((id) => { byId(id).value = ""; });
  byId("sortFilter").value = "default";
  byId("gradeMetricFilter").value = "auto";
  byId("publishedGradeFilter").checked = false;
  document.querySelectorAll('input[name="regionFilter"]').forEach((input) => { input.checked = false; });
  render();
});
window.addEventListener("consultation-card-change", () => {
  updateCardCount();
  render();
});
window.addEventListener("storage", updateCardCount);
updateCardCount();
init();
