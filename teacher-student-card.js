(function teacherStudentCardViewer() {
  "use strict";

  const SESSION_KEY = "anjwa.teacherDashboard.unlocked";
  const DB_NAME = "anjwa-teacher-dashboard";
  const DB_VERSION = 1;
  const params = new URLSearchParams(location.search);
  const classId = params.get("class") || "";
  const studentId = params.get("student") || "";
  const state = { db: null, classRecord: null, student: null, mode: "teacher" };

  const byId = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function escapeHtml(value) {
    return clean(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
  }

  function localDateTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "기록 없음";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).format(date);
  }

  function fileTimestamp(date = new Date()) {
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function getRecord(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = state.db.transaction(storeName).objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function payloadItems(payload) {
    const standard = (payload.slots || []).map((slot) => slot?.item).filter(Boolean);
    return [...standard, ...(payload.exemptItems || [])];
  }

  function itemById(payload, itemId) {
    return payloadItems(payload).find((item) => clean(item.id) === clean(itemId));
  }

  function applyPatches(record) {
    const payload = clone(record.sourcePayload);
    payload.slots = Array.isArray(payload.slots) ? payload.slots : [];
    payload.exemptItems = Array.isArray(payload.exemptItems) ? payload.exemptItems : [];
    const addedItems = clone(record.teacherAddedItems || []);
    (record.teacherPatches || []).forEach((patch) => {
      if (patch.scope === "document") return Object.assign(payload, patch.fields || {});
      const item = itemById(payload, patch.itemId) || addedItems.find((candidate) => clean(candidate.id) === clean(patch.itemId));
      if (item) Object.assign(item, patch.fields || {});
    });
    addedItems.forEach((item) => {
      if (item.exemptFromSixLimit) return payload.exemptItems.push(item);
      let slot = payload.slots.find((candidate) => !candidate.item);
      if (!slot && payload.slots.length < 9) {
        slot = { slot: payload.slots.length + 1, item: null };
        payload.slots.push(slot);
      }
      if (slot) slot.item = item;
    });
    return payload;
  }

  function sourcePayload() {
    const payload = clone(state.student.sourcePayload);
    payload.slots = Array.isArray(payload.slots) ? payload.slots : [];
    payload.exemptItems = Array.isArray(payload.exemptItems) ? payload.exemptItems : [];
    return payload;
  }

  function currentPayload() {
    return state.mode === "teacher" ? applyPatches(state.student) : sourcePayload();
  }

  function effectiveValue(item, field) {
    const overrideMap = {
      quota: "targetQuotaOverride", selectionMethod: "targetSelectionMethodOverride", minimum: "targetMinimumOverride",
      announcementDate: "targetAnnouncementDateOverride"
    };
    const sourceMap = {
      quota: ["targetQuota", "targetReferenceQuota", "quota"],
      selectionMethod: ["targetSelectionMethod", "targetReferenceSelectionMethod"],
      minimum: ["targetMinimumOfficial", "targetReferenceMinimum", "targetMinimum"],
      announcementDate: ["targetAnnouncementDate"]
    };
    return clean(item[overrideMap[field]]) || sourceMap[field].map((key) => clean(item[key])).find(Boolean) || "확인 필요";
  }

  function resultValue(entry) {
    const cuts = [["50%", entry.result50 || entry.result_50], ["70%", entry.result70 || entry.result_70], ["90%", entry.result90 || entry.result_90]]
      .filter(([, value]) => clean(value));
    return cuts.length ? cuts.map(([label, value]) => `${label} ${clean(value)}`).join(" · ") : clean(entry.resultMean || entry.result_mean) || "성적 미공개";
  }

  function renderHistory(item) {
    const officialByYear = new Map((item.history || []).map((entry) => [clean(entry.year), entry]));
    const referenceByYear = new Map((item.historyUserReferences || []).map((entry) => [clean(entry.year), entry]));
    const history = ["2024", "2025", "2026"].map((year) => {
      const official = officialByYear.get(year);
      if (official) return { ...official, userReference: false };
      const reference = referenceByYear.get(year);
      return reference ? { ...reference, userReference: true } : null;
    }).filter(Boolean);
    if (!history.length) return '<div class="history-list"><div class="empty-row">연결된 과거 입결이 없습니다.</div></div>';
    return `<div class="history-list">${history.map((entry) => {
      const rate = clean(entry.competitionRate || entry.competition_rate);
      const quota = clean(entry.quota);
      const additional = clean(entry.additionalAdmits || entry.additional_admits);
      return `<div class="history-item${entry.userReference ? " is-user-reference" : ""}"><strong>${escapeHtml(entry.year)}학년도${entry.userReference ? "<em>사용자 선택 참고</em>" : ""}</strong>${entry.userReference ? `<small>${escapeHtml(entry.department || "유사 모집단위")} · ${escapeHtml(entry.admission || "전형명 확인 필요")}</small>` : ""}<span>경쟁률 ${escapeHtml(rate ? `${rate}:1` : "미공개")}</span><span>${escapeHtml(resultValue(entry))}</span><span>모집 ${escapeHtml(quota || "-")} · 충원 ${escapeHtml(additional || "-")}</span></div>`;
    }).join("")}</div>`;
  }

  function similarCandidateGradeText(candidate) {
    const ranges = candidate?.gradeRanges || {};
    const range = ranges.all || ranges.subject || ranges.holistic || ranges.essay || ranges.performance;
    if (!range) return "동일 명칭 공개 입결 없음";
    const minimum = Number(range.min);
    const maximum = Number(range.max);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return "동일 명칭 공개 입결 없음";
    const grades = minimum === maximum ? minimum.toFixed(2) : `${minimum.toFixed(2)}~${maximum.toFixed(2)}`;
    return `${clean(range.year) || "최근"}학년도 ${grades}등급`;
  }

  function renderSimilarCandidates(item) {
    const candidates = Array.isArray(item.similarDepartmentCandidates) ? item.similarDepartmentCandidates.slice(0, 3) : [];
    if (!candidates.length) return "";
    return `<section class="viewer-similar-candidates">
      <header><strong>검토 중인 유사학과</strong><span>${candidates.length}/3개 · 학생 제출 내용</span></header>
      <div>${candidates.map((candidate) => `<article>
        <strong>${escapeHtml(candidate.university)}${candidate.campus ? ` · ${escapeHtml(candidate.campus)}` : ""}</strong>
        <span>${escapeHtml(candidate.department)}</span>
        <small>${escapeHtml(candidate.region || "지역 확인")} · ${escapeHtml((candidate.categories || []).join(" · ") || "전형 확인")}</small>
        <em>${escapeHtml(similarCandidateGradeText(candidate))}</em>
        ${candidate.note ? `<p>${escapeHtml(candidate.note)}</p>` : ""}
      </article>`).join("")}</div>
    </section>`;
  }

  function renderPlan(item, index) {
    return `<article class="plan-card">
      <div class="plan-main">
        <span class="plan-rank">${item.exemptFromSixLimit ? "별도" : `${index + 1}순위`}</span>
        <div class="plan-identity"><strong>${escapeHtml(item.university || "대학 미입력")}${item.campus ? ` · ${escapeHtml(item.campus)}` : ""}</strong><span>${escapeHtml(item.targetDepartment || item.department || "학과 미입력")}</span></div>
        <div class="plan-admission"><strong>${escapeHtml(item.targetAdmission || item.admission || "전형 미입력")}</strong><span>${escapeHtml(item.strategy || "지원 판단 미입력")}</span></div>
      </div>
      <div class="plan-facts">
        <div><span>2027 모집인원</span><strong>${escapeHtml(effectiveValue(item, "quota"))}</strong></div>
        <div><span>전형방법·반영비율</span><strong>${escapeHtml(effectiveValue(item, "selectionMethod"))}</strong></div>
        <div><span>수능최저</span><strong>${escapeHtml(effectiveValue(item, "minimum"))}</strong></div>
        <div><span>최종 합격자 발표일</span><strong>${escapeHtml(effectiveValue(item, "announcementDate"))}</strong></div>
      </div>
      ${renderSimilarCandidates(item)}
      ${renderHistory(item)}
    </article>`;
  }

  function gradeRecordValue(record) {
    if (record.passFail) return "P/F";
    if (record.courseType === "career") {
      return [
        record.achievement ? `성취도 ${record.achievement}` : "성취도 미입력",
        record.rankGrade ? `${record.rankGrade}등급` : ""
      ].filter(Boolean).join(" · ");
    }
    return record.rankGrade ? `${record.rankGrade}등급` : "석차등급 미입력";
  }

  function renderGradeRecords(payload) {
    const records = Array.isArray(payload.gradeRecords) ? payload.gradeRecords : [];
    const credits = records.reduce((sum, record) => sum + (Number(record.credits) || 0), 0);
    const profile = payload.academicProfile || {};
    const profileText = `${profile.schoolStatus === "graduated" ? "졸업생" : "재학생"}${profile.graduationYear ? ` · ${profile.graduationYear}년 졸업${profile.schoolStatus === "graduated" ? "" : " 예정"}` : ""}`;
    const sejongTrackId = payload.gradeCalculatorSelections?.sejong2027 || "humanities";
    const kookminTrackId = payload.gradeCalculatorSelections?.kookmin2027 || "humanities";
    const donggukTrackId = payload.gradeCalculatorSelections?.dongguk2027 || "humanities";
    const calculations = window.AdmissionGradeCalculators ? [
      {
        label: "세종대 2027",
        result: window.AdmissionGradeCalculators.calculateSejong2027(records, sejongTrackId)
      },
      {
        label: "국민대 2027",
        result: window.AdmissionGradeCalculators.calculateKookmin2027(records, kookminTrackId, profile)
      },
      {
        label: "동국대(서울) 2027",
        result: window.AdmissionGradeCalculators.calculateDongguk2027(records, donggukTrackId, profile)
      }
    ] : [];
    const calculationMarkup = records.length
      ? `${calculations.map(({ label, result }) => `<div class="student-grade-calculation"><span>${label} · ${escapeHtml(result.track.label)}</span>${result.ok
        ? `<strong>${result.score.toFixed(8)}점</strong><small>${escapeHtml(result.rule.scale.toLocaleString("ko-KR"))}점 기준 · 지원 가능성 판정값 아님</small>`
        : `<strong class="is-error">계산 확인 필요</strong><small>${escapeHtml(result.errors[0] || "입력값을 확인하세요.")}</small>`}</div>`).join("")}
        <p class="student-grade-verification">환산 결과는 드림스쿨과 대학의 최신 모집요강에서 반드시 재확인하세요.</p>`
      : "";
    byId("studentGradeRecordBody").innerHTML = records.length
      ? `<div class="student-grade-meta"><span>${escapeHtml(profileText)}</span><strong>${records.length}과목 · ${Number.isInteger(credits) ? credits : credits.toFixed(1)}단위</strong></div>
        ${calculationMarkup}
        <div class="student-grade-list">${records.map((record) => `<article><span>${escapeHtml(record.schoolYear)}-${escapeHtml(record.semester)}</span><div><strong>${escapeHtml(record.subjectName)}</strong><small>${escapeHtml(record.subjectGroup || "기타")} · ${escapeHtml(record.courseType === "career" ? "진로선택" : "공통·일반선택")}${record.curriculumCategory === "specialized" ? " · 전문교과" : ""}</small></div><em>${escapeHtml(record.credits ?? "-")}단위</em><b>${escapeHtml(gradeRecordValue(record))}</b></article>`).join("")}</div>`
      : '<div class="empty-row">학생이 입력한 과목별 성적이 없습니다.</div>';
  }

  function renderRevisions() {
    const revisions = state.mode === "teacher" ? [...(state.student.revisionLog || [])].reverse() : [];
    byId("revisionList").innerHTML = revisions.length
      ? revisions.map((entry) => `<div class="revision-entry"><time>${escapeHtml(localDateTime(entry.editedAt))}</time><p>${escapeHtml(entry.label || "상담카드를 확인했습니다.")}</p></div>`).join("")
      : `<div class="empty-row">${state.mode === "teacher"
        ? "아직 교사 확인 이력이 없습니다."
        : "학생 제출 원본에는 교사 수정 이력을 적용하지 않습니다."}</div>`;
  }

  function render() {
    const payload = currentPayload();
    const items = payloadItems(payload);
    const teacherCount = (state.student.teacherPatches?.length || 0) + (state.student.teacherAddedItems?.length || 0);
    byId("studentTitle").textContent = `${state.student.studentNumber || "학번 미입력"} 학생 상담카드`;
    byId("studentMeta").textContent = `최근 제출 ${localDateTime(state.student.importedAt)} · 마지막 변경 ${localDateTime(state.student.updatedAt)}`;
    byId("className").textContent = state.classRecord?.name || "반 미확인";
    byId("studentNumber").textContent = state.student.studentNumber || "미입력";
    byId("planCount").textContent = `${items.length}개`;
    byId("teacherEditCount").textContent = state.mode === "teacher" ? `${teacherCount}건` : "미적용";
    byId("viewLabel").textContent = state.mode === "teacher" ? "교사 확인본" : "학생 제출 원본";
    byId("viewLabel").className = `source-badge ${state.mode === "teacher" ? "source-teacher" : "source-student"}`;
    byId("planList").innerHTML = items.length ? items.map(renderPlan).join("") : '<div class="empty-row">작성된 지원안이 없습니다.</div>';
    renderGradeRecords(payload);
    byId("overallOpinion").textContent = clean(payload.overallOpinion) || "작성된 의견이 없습니다.";
    byId("showTeacherView").classList.toggle("is-active", state.mode === "teacher");
    byId("showStudentSource").classList.toggle("is-active", state.mode === "source");
    byId("exportStudentJson").textContent = state.mode === "teacher" ? "교사 피드백" : "학생 원본";
    renderRevisions();
  }

  function downloadCurrentJson() {
    const payload = currentPayload();
    const exportedAt = new Date().toISOString();
    const downloadPayload = state.mode === "teacher"
      ? window.SusiCardTransfer.createTeacherFeedback(state.student, payload, exportedAt)
      : { ...payload, exportedAt, teacherViewerMode: state.mode };
    const blob = new Blob([JSON.stringify(downloadPayload, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${state.mode === "teacher" ? "교사피드백" : "수시지원상담카드"}_${clean(state.student.studentNumber) || "학번미입력"}_${state.mode === "teacher" ? "확인본" : "학생원본"}_${fileTimestamp()}.anjwacard`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function initialize() {
    if (sessionStorage.getItem(SESSION_KEY) !== "1") {
      location.replace("./teacher-dashboard.html");
      return;
    }
    if (!classId || !studentId) throw new Error("선택한 반 또는 학생 정보가 없습니다.");
    state.db = await openDatabase();
    [state.classRecord, state.student] = await Promise.all([getRecord("classes", classId), getRecord("students", studentId)]);
    if (!state.student || state.student.classId !== classId) throw new Error("교사용 대시보드에서 해당 학생 상담카드를 찾지 못했습니다.");
    byId("cardStatus").hidden = true;
    byId("cardContent").hidden = false;
    byId("exportStudentJson").disabled = false;
    byId("printStudentCard").disabled = false;
    render();
  }

  byId("backDashboard").addEventListener("click", () => { location.href = "./teacher-dashboard.html"; });
  byId("showTeacherView").addEventListener("click", () => { state.mode = "teacher"; render(); });
  byId("showStudentSource").addEventListener("click", () => { state.mode = "source"; render(); });
  byId("exportStudentJson").addEventListener("click", downloadCurrentJson);
  byId("printStudentCard").addEventListener("click", () => window.print());

  initialize().catch((error) => {
    byId("cardStatus").textContent = error.message;
    byId("cardContent").hidden = true;
  });
})();
