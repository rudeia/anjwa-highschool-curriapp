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
    const history = [...(item.history || [])].sort((a, b) => Number(a.year) - Number(b.year)).slice(-3);
    if (!history.length) return '<div class="history-list"><div class="empty-row">연결된 과거 입결이 없습니다.</div></div>';
    return `<div class="history-list">${history.map((entry) => {
      const rate = clean(entry.competitionRate || entry.competition_rate);
      const quota = clean(entry.quota);
      const additional = clean(entry.additionalAdmits || entry.additional_admits);
      return `<div class="history-item"><strong>${escapeHtml(entry.year)}학년도</strong><span>경쟁률 ${escapeHtml(rate ? `${rate}:1` : "미공개")}</span><span>${escapeHtml(resultValue(entry))}</span><span>모집 ${escapeHtml(quota || "-")} · 충원 ${escapeHtml(additional || "-")}</span></div>`;
    }).join("")}</div>`;
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
      ${renderHistory(item)}
    </article>`;
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
    byId("overallOpinion").textContent = clean(payload.overallOpinion) || "작성된 의견이 없습니다.";
    byId("showTeacherView").classList.toggle("is-active", state.mode === "teacher");
    byId("showStudentSource").classList.toggle("is-active", state.mode === "source");
    renderRevisions();
  }

  function downloadCurrentJson() {
    const payload = currentPayload();
    payload.exportedAt = new Date().toISOString();
    payload.teacherViewerMode = state.mode;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `수시지원상담카드_${clean(state.student.studentNumber) || "학번미입력"}_${state.mode === "teacher" ? "교사확인본" : "학생원본"}_${fileTimestamp()}.anjwacard`;
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
