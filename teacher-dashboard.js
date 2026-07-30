(function teacherDashboardModule() {
  "use strict";

  const PASSWORD_HASH = "116345b63a9ddada441b3bcf09fec1ae3f29ecfbb2dbb2a57d6b97abef6db7e3";
  const PASSWORD_HASH_PREFIX = "anjwa-highschool-curriapp:";
  const SESSION_KEY = "anjwa.teacherDashboard.unlocked";
  const DB_NAME = "anjwa-teacher-dashboard";
  const DB_VERSION = 1;
  const MAX_STUDENTS = 40;
  const ITEM_EDIT_FIELDS = [
    "university", "campus", "targetDepartment", "targetAdmission",
    "targetQuotaOverride", "targetSelectionMethodOverride", "targetMinimumOverride", "targetAnnouncementDateOverride",
    "strategy", "memo"
  ];

  const state = {
    db: null,
    classes: [],
    classId: "",
    students: [],
    studentId: "",
    optionIndex: null,
    optionUniversity: null,
    manifest: null,
    lookupDepartment: null,
    lookupOption: null
  };

  const byId = (id) => document.getElementById(id);
  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function hashPassword(value) {
    const bytes = new TextEncoder().encode(`${PASSWORD_HASH_PREFIX}${value}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function passwordMatches(value) {
    if (!globalThis.crypto?.subtle) return false;
    return (await hashPassword(value)) === PASSWORD_HASH;
  }

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

  function fileTimestamp(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  }

  function safeFilePart(value, fallback) {
    return clean(value).replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || fallback;
  }

  function showToast(message) {
    const toast = byId("dashboardToast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("classes")) db.createObjectStore("classes", { keyPath: "id" });
        if (!db.objectStoreNames.contains("students")) {
          const store = db.createObjectStore("students", { keyPath: "id" });
          store.createIndex("classId", "classId", { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function store(name, mode = "readonly") {
    return state.db.transaction(name, mode).objectStore(name);
  }

  async function getAllClasses() {
    return requestToPromise(store("classes").getAll());
  }

  async function getStudents(classId) {
    return requestToPromise(store("students").index("classId").getAll(classId));
  }

  async function saveClass(record) {
    await requestToPromise(store("classes", "readwrite").put(record));
  }

  async function saveStudent(record) {
    record.updatedAt = nowIso();
    await requestToPromise(store("students", "readwrite").put(record));
  }

  async function removeStudent(id) {
    await requestToPromise(store("students", "readwrite").delete(id));
  }

  async function removeClassData(classId) {
    const transaction = state.db.transaction(["classes", "students"], "readwrite");
    transaction.objectStore("classes").delete(classId);
    const index = transaction.objectStore("students").index("classId");
    const range = IDBKeyRange.only(classId);
    await new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve();
        cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function normalizePayload(payload) {
    if (!window.SusiCardTransfer) throw new Error("수시카드 전달 형식을 불러오지 못했습니다.");
    return window.SusiCardTransfer.normalizeTeacherPayload(payload);
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
    const addedItems = clone(record.teacherAddedItems || []);
    const patches = Array.isArray(record.teacherPatches) ? record.teacherPatches : [];
    patches.forEach((patch) => {
      if (patch.scope === "document") {
        Object.assign(payload, patch.fields || {});
        return;
      }
      const item = itemById(payload, patch.itemId) || addedItems.find((candidate) => candidate.id === patch.itemId);
      if (!item) return;
      Object.assign(item, patch.fields || {});
      if (Object.prototype.hasOwnProperty.call(patch.fields || {}, "targetQuotaOverride")) addOverrideField(item, "quota");
      if (Object.prototype.hasOwnProperty.call(patch.fields || {}, "targetSelectionMethodOverride")) addOverrideField(item, "selectionMethod");
      if (Object.prototype.hasOwnProperty.call(patch.fields || {}, "targetMinimumOverride")) addOverrideField(item, "minimum");
      if (Object.prototype.hasOwnProperty.call(patch.fields || {}, "targetAnnouncementDateOverride")) addOverrideField(item, "announcementDate");
    });
    addedItems.forEach((item) => {
      if (itemById(payload, item.id)) return;
      if (item.exemptFromSixLimit) payload.exemptItems.push(item);
      else {
        let slot = payload.slots.find((candidate) => !candidate.item);
        if (!slot && payload.slots.length < 9) {
          slot = { slot: payload.slots.length + 1, item: null };
          payload.slots.push(slot);
        }
        if (slot) slot.item = item;
      }
    });
    payload.studentNumber = record.studentNumber;
    const teacherChanges = [
      ...(record.teacherPatches || []),
      ...(record.revisionLog || []).filter((entry) => /지원안을 공식자료 조회로 추가/.test(entry.label || ""))
    ].sort((a, b) => clean(a.editedAt).localeCompare(clean(b.editedAt)));
    payload.teacherDashboard = {
      reviewedAt: teacherChanges.at(-1)?.editedAt || "",
      patchCount: record.teacherPatches?.length || 0,
      addedItemCount: record.teacherAddedItems?.length || 0,
      sourceImportedAt: record.importedAt,
      sourceFileName: record.sourceFileName
    };
    return payload;
  }

  function addOverrideField(item, field) {
    const fields = new Set(Array.isArray(item.targetOverrideFields) ? item.targetOverrideFields : []);
    fields.add(field);
    item.targetOverrideFields = [...fields];
  }

  function studentSort(a, b) {
    return clean(a.studentNumber).localeCompare(clean(b.studentNumber), "ko", { numeric: true });
  }

  async function ensureDefaultClass() {
    state.classes = (await getAllClasses()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!state.classes.length) {
      const record = { id: uid("CLASS"), name: "1반", createdAt: nowIso(), updatedAt: nowIso() };
      await saveClass(record);
      state.classes = [record];
    }
    const remembered = localStorage.getItem("anjwa.teacherDashboard.classId");
    state.classId = state.classes.some((item) => item.id === remembered) ? remembered : state.classes[0].id;
  }

  async function refreshStudents(preferredId = "") {
    state.students = (await getStudents(state.classId)).sort(studentSort);
    if (preferredId && state.students.some((student) => student.id === preferredId)) state.studentId = preferredId;
    else if (!state.students.some((student) => student.id === state.studentId)) state.studentId = state.students[0]?.id || "";
    renderAll();
  }

  function currentStudent() {
    return state.students.find((student) => student.id === state.studentId) || null;
  }

  function teacherFeedbackSignature(student) {
    return JSON.stringify({
      patches: student.teacherPatches || [],
      addedItems: student.teacherAddedItems || []
    });
  }

  function feedbackState(student) {
    const delivery = student.feedbackDelivery;
    if (!delivery?.exportedAt || !delivery.reviewedSnapshot) {
      return {
        key: "none",
        label: "피드백 미발송",
        title: "아직 학생에게 저장한 교사 피드백이 없습니다.",
        meta: "교사 피드백 파일을 저장하면 학생의 재제출 여부를 이 기기에서 확인할 수 있습니다.",
        comparison: null
      };
    }
    if (delivery.teacherFeedbackSignature !== teacherFeedbackSignature(student)) {
      return {
        key: "pending",
        label: "확인 전",
        title: "피드백 저장 뒤 교사 수정이 추가되었습니다.",
        meta: "최신 내용을 반영한 교사 피드백 파일을 다시 저장해 학생에게 전달하세요.",
        comparison: null
      };
    }
    const receipt = student.sourcePayload?.teacherFeedbackReceipt;
    if (!receipt || clean(receipt.exportedAt) !== clean(delivery.exportedAt)) {
      return {
        key: "pending",
        label: "확인 전",
        title: "학생의 피드백 적용 재제출을 기다리고 있습니다.",
        meta: `피드백 저장 ${localDateTime(delivery.exportedAt)}${receipt?.exportedAt ? " · 이전 피드백 적용 기록은 있으나 최신 확인본과 다릅니다." : ""}`,
        comparison: null
      };
    }
    const comparison = window.SusiCardTransfer.compareStudentReturn(delivery.reviewedSnapshot, student.sourcePayload);
    if (comparison.hasChanges) {
      return {
        key: "review",
        label: "재검토 필요",
        title: "피드백 적용 뒤 학생이 내용을 변경했습니다.",
        meta: `학생 재제출 ${localDateTime(student.importedAt)} · 피드백 적용 ${localDateTime(receipt.appliedAt)}`,
        comparison
      };
    }
    return {
      key: "applied",
      label: "적용 완료",
      title: "학생이 교사 피드백을 적용해 다시 제출했습니다.",
      meta: `학생 재제출 ${localDateTime(student.importedAt)} · 피드백 적용 ${localDateTime(receipt.appliedAt)}`,
      comparison
    };
  }

  function reconcileFeedbackDelivery(student, payload, importedAt) {
    const delivery = student?.feedbackDelivery;
    if (!delivery?.exportedAt || !delivery.reviewedSnapshot) return delivery;
    const receipt = payload.teacherFeedbackReceipt;
    if (!receipt || clean(receipt.exportedAt) !== clean(delivery.exportedAt)) return delivery;
    const comparison = window.SusiCardTransfer.compareStudentReturn(delivery.reviewedSnapshot, payload);
    return {
      ...delivery,
      status: comparison.hasChanges ? "review" : "applied",
      returnedAt: importedAt,
      appliedAt: clean(receipt.appliedAt),
      comparison
    };
  }

  function renderClassSelect() {
    byId("classSelect").innerHTML = state.classes.map((record) => `<option value="${escapeHtml(record.id)}"${record.id === state.classId ? " selected" : ""}>${escapeHtml(record.name)}</option>`).join("");
    byId("studentListTitle").textContent = state.classes.find((record) => record.id === state.classId)?.name || "반을 선택하세요";
  }

  function renderSummary() {
    const payloads = state.students.map(applyPatches);
    const feedbackStates = state.students.map(feedbackState);
    byId("classStudentCount").textContent = `${state.students.length}명`;
    byId("classPlanCount").textContent = `${payloads.reduce((sum, payload) => sum + payloadItems(payload).length, 0)}개`;
    byId("classReviewCount").textContent = `${state.students.filter((student) => student.teacherPatches?.length || student.teacherAddedItems?.length).length}명`;
    byId("classFeedbackPendingCount").textContent = feedbackStates.filter((status) => status.key === "pending").length;
    byId("classFeedbackAppliedCount").textContent = feedbackStates.filter((status) => status.key === "applied").length;
    byId("classFeedbackReviewCount").textContent = feedbackStates.filter((status) => status.key === "review").length;
    ["printClass", "exportClassCsv", "backupClass"].forEach((id) => { byId(id).disabled = !state.students.length; });
  }

  function renderStudentList() {
    const query = clean(byId("studentSearch").value).toLocaleLowerCase("ko");
    const visible = state.students.filter((student) => !query || student.studentNumber.toLocaleLowerCase("ko").includes(query));
    byId("studentList").innerHTML = visible.length ? visible.map((student) => {
      const payload = applyPatches(student);
      const status = feedbackState(student);
      return `<button class="student-row${student.id === state.studentId ? " is-active" : ""}" type="button" data-student-id="${escapeHtml(student.id)}">
        <strong>${escapeHtml(student.studentNumber || "미입력")}</strong>
        <span>지원안 ${payloadItems(payload).length}개 · 성적 ${Array.isArray(payload.gradeRecords) ? payload.gradeRecords.length : 0}과목</span>
        <em class="feedback-status is-${escapeHtml(status.key)}">${escapeHtml(status.label)}</em>
      </button>`;
    }).join("") : '<p class="student-list-empty">불러온 학생이 없습니다.</p>';
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
    const override = clean(item[overrideMap[field]]);
    if (override) return override;
    return (sourceMap[field] || []).map((key) => clean(item[key])).find(Boolean) || "확인 필요";
  }

  function recentHistory(item) {
    const entries = Array.isArray(item.history) ? [...item.history] : [];
    entries.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    return entries[0] || null;
  }

  function recentResultText(item) {
    const entry = recentHistory(item);
    if (!entry) return "과거 입결 연결 없음";
    const rate = clean(entry.competitionRate || entry.competition_rate);
    const grades = [["50%", entry.result50 || entry.result_50], ["70%", entry.result70 || entry.result_70], ["90%", entry.result90 || entry.result_90]].filter(([, value]) => clean(value));
    return `${entry.year}학년도${rate ? ` · 경쟁률 ${rate}:1` : ""}${grades.length ? ` · ${grades.map(([label, value]) => `${label} ${clean(value)}`).join(" · ")}` : ""}`;
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
    return `<section class="teacher-similar-candidates">
      <header><strong>학생이 검토 중인 유사학과</strong><span>${candidates.length}/3개 · 학생 제출본</span></header>
      <div>${candidates.map((candidate) => `<article>
        <strong>${escapeHtml(candidate.university)}${candidate.campus ? ` · ${escapeHtml(candidate.campus)}` : ""}</strong>
        <span>${escapeHtml(candidate.department)}</span>
        <small>${escapeHtml(candidate.region || "지역 확인")} · ${escapeHtml((candidate.categories || []).join(" · ") || "전형 확인")}</small>
        <em>${escapeHtml(similarCandidateGradeText(candidate))}</em>
        ${candidate.note ? `<p>${escapeHtml(candidate.note)}</p>` : ""}
      </article>`).join("")}</div>
    </section>`;
  }

  function renderPlan(item, rank, exempt) {
    const edits = currentStudent()?.teacherPatches?.filter((patch) => patch.itemId === item.id).length || 0;
    return `<details class="support-plan" data-item-id="${escapeHtml(item.id)}">
      <summary>
        <span class="plan-rank">${exempt ? "별도" : `${rank}순위`}</span>
        <span class="plan-identity"><strong>${escapeHtml(item.university || "대학 미입력")}${item.campus ? ` · ${escapeHtml(item.campus)}` : ""}</strong><small>${escapeHtml(item.targetDepartment || item.department || "학과 미입력")}</small></span>
        <span class="plan-admission"><strong>${escapeHtml(item.targetAdmission || item.admission || "전형 미입력")}</strong><small>${escapeHtml(recentResultText(item))}</small></span>
        <span class="plan-status">${edits ? `<span class="source-badge source-teacher">교사 수정 ${edits}</span>` : '<span class="source-badge source-student">학생 입력</span>'}</span>
      </summary>
      <div class="plan-body">
        <div class="plan-facts">
          <div><span>2027 모집인원</span><strong>${escapeHtml(effectiveValue(item, "quota"))}</strong></div>
          <div><span>전형방법·반영비율</span><strong>${escapeHtml(effectiveValue(item, "selectionMethod"))}</strong></div>
          <div><span>수능최저</span><strong>${escapeHtml(effectiveValue(item, "minimum"))}</strong></div>
          <div><span>최종 합격자 발표일</span><strong>${escapeHtml(effectiveValue(item, "announcementDate"))}</strong></div>
        </div>
        ${renderSimilarCandidates(item)}
        <div class="plan-edit-grid">
          <label>대학<input data-item-field="university" value="${escapeHtml(item.university)}"></label>
          <label>캠퍼스<input data-item-field="campus" value="${escapeHtml(item.campus)}"></label>
          <label>학과·모집단위<input data-item-field="targetDepartment" value="${escapeHtml(item.targetDepartment || item.department)}"></label>
          <label>전형명<input data-item-field="targetAdmission" value="${escapeHtml(item.targetAdmission || item.admission)}"></label>
          <label>모집인원 수정<input data-item-field="targetQuotaOverride" value="${escapeHtml(clean(item.targetQuotaOverride))}" placeholder="비워두면 자동 입력값 사용"></label>
          <label>수능최저 수정<input data-item-field="targetMinimumOverride" value="${escapeHtml(clean(item.targetMinimumOverride))}" placeholder="비워두면 자동 입력값 사용"></label>
          <label>최종 합격자 발표일<input type="date" data-item-field="targetAnnouncementDateOverride" value="${escapeHtml(clean(item.targetAnnouncementDateOverride))}"></label>
          <label class="wide">전형방법·반영비율 수정<input data-item-field="targetSelectionMethodOverride" value="${escapeHtml(clean(item.targetSelectionMethodOverride))}" placeholder="비워두면 자동 입력값 사용"></label>
          <label>지원 판단<input data-item-field="strategy" value="${escapeHtml(item.strategy)}" placeholder="상향·적정·안정"></label>
          <label>상담 메모<input data-item-field="memo" value="${escapeHtml(item.memo)}"></label>
        </div>
        <div class="plan-actions"><button class="secondary-button" type="button" data-save-item="${escapeHtml(item.id)}">교사 수정 저장</button><button class="danger-button" type="button" data-restore-item="${escapeHtml(item.id)}">이 항목 수정 되돌리기</button></div>
      </div>
    </details>`;
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

  function renderStudentGradeRecords(payload) {
    const records = Array.isArray(payload.gradeRecords) ? payload.gradeRecords : [];
    const credits = records.reduce((sum, record) => sum + (Number(record.credits) || 0), 0);
    const career = records.filter((record) => record.courseType === "career").length;
    const profile = payload.academicProfile || {};
    const profileText = `${profile.schoolStatus === "graduated" ? "졸업생" : "재학생"}${profile.graduationYear ? ` · ${profile.graduationYear}년 졸업${profile.schoolStatus === "graduated" ? "" : " 예정"}` : ""}`;
    const sejongTrackId = payload.gradeCalculatorSelections?.sejong2027 || "humanities";
    const kookminTrackId = payload.gradeCalculatorSelections?.kookmin2027 || "humanities";
    const donggukTrackId = payload.gradeCalculatorSelections?.dongguk2027 || "humanities";
    const calculations = window.AdmissionGradeCalculators ? [
      {
        label: "세종대 2027",
        source: "공식 모집요강 22쪽",
        result: window.AdmissionGradeCalculators.calculateSejong2027(records, sejongTrackId)
      },
      {
        label: "국민대 2027",
        source: "학생부위주전형 가이드북 10~11쪽",
        result: window.AdmissionGradeCalculators.calculateKookmin2027(records, kookminTrackId, profile)
      },
      {
        label: "동국대(서울) 2027",
        source: "공식 모집요강 44·85~86쪽",
        result: window.AdmissionGradeCalculators.calculateDongguk2027(records, donggukTrackId, profile)
      }
    ] : [];
    const calculationMarkup = records.length
      ? `${calculations.map(({ label, source, result }) => `<div class="teacher-grade-calculation"><span>${label} · ${escapeHtml(result.track.label)}</span>${result.ok
        ? `<strong>${result.score.toFixed(8)}점</strong><small>${escapeHtml(result.rule.scale.toLocaleString("ko-KR"))}점 기준 · ${source}</small>`
        : `<strong class="is-error">계산 확인 필요</strong><small>${escapeHtml(result.errors[0] || "입력값을 확인하세요.")}</small>`}</div>`).join("")}
        <p class="teacher-grade-verification">환산 결과는 드림스쿨과 대학의 최신 모집요강에서 반드시 재확인하세요.</p>`
      : "";
    byId("studentGradeRecords").innerHTML = `<details${records.length ? "" : " class=\"is-empty\""}>
      <summary><span><strong>학생부 과목별 성적</strong><small>${escapeHtml(profileText)}</small></span><em>${records.length}과목 · 진로선택 ${career} · ${Number.isInteger(credits) ? credits : credits.toFixed(1)}단위</em></summary>
      ${records.length ? `${calculationMarkup}<div class="teacher-grade-list">${records.map((record) => `<span><b>${escapeHtml(record.schoolYear)}-${escapeHtml(record.semester)}</b><strong>${escapeHtml(record.subjectName)}</strong><small>${escapeHtml(record.subjectGroup || "기타")} · ${record.curriculumCategory === "specialized" ? "전문교과 · " : ""}${escapeHtml(record.credits ?? "-")}단위 · ${escapeHtml(gradeRecordValue(record))}</small></span>`).join("")}</div>` : '<p>학생이 입력한 과목별 성적이 없습니다.</p>'}
    </details>`;
  }

  function renderDetail() {
    const student = currentStudent();
    byId("openSelectedStudentCard").disabled = !student;
    byId("emptyStudent").hidden = Boolean(student);
    byId("studentDetail").hidden = !student;
    if (!student) return;
    const payload = applyPatches(student);
    byId("detailStudentNumber").textContent = `${student.studentNumber || "학번 미입력"} 학생`;
    byId("detailTimestamp").textContent = `최근 제출 ${localDateTime(student.importedAt)} · 마지막 변경 ${localDateTime(student.updatedAt)}`;
    byId("teacherOverallOpinion").value = clean(payload.overallOpinion);
    renderFeedbackReturn(student);
    renderStudentGradeRecords(payload);
    const standard = (payload.slots || []).map((slot) => slot?.item).filter(Boolean);
    const exempt = payload.exemptItems || [];
    byId("supportPlans").innerHTML = [
      ...standard.map((item, index) => renderPlan(item, index + 1, false)),
      ...exempt.map((item, index) => renderPlan(item, index + 1, true))
    ].join("") || '<p class="student-list-empty">저장된 지원안이 없습니다. 위 조회 영역에서 지원안을 추가할 수 있습니다.</p>';
    renderLookupTarget(payload);
    renderRevisions(student);
  }

  function renderFeedbackReturn(student) {
    const panel = byId("feedbackReturnPanel");
    const status = feedbackState(student);
    panel.hidden = status.key === "none";
    if (panel.hidden) return;
    const badge = byId("feedbackReturnBadge");
    badge.className = `feedback-status is-${status.key}`;
    badge.textContent = status.label;
    byId("feedbackReturnTitle").textContent = status.title;
    byId("feedbackReturnMeta").textContent = status.meta;
    const changes = status.comparison?.changes || [];
    const changePanel = byId("feedbackReturnChanges");
    changePanel.hidden = !changes.length;
    changePanel.innerHTML = changes.slice(0, 8).map((entry) => `<span>${escapeHtml(entry.label)}</span>`).join("");
  }

  function renderLookupTarget(payload) {
    const current = byId("lookupTarget").value;
    const options = ['<option value="new">새 지원안으로 추가</option>'];
    payloadItems(payload).forEach((item, index) => {
      options.push(`<option value="${escapeHtml(item.id)}">${index + 1}. ${escapeHtml(item.university)} · ${escapeHtml(item.targetDepartment || item.department)} · ${escapeHtml(item.targetAdmission || item.admission)}</option>`);
    });
    byId("lookupTarget").innerHTML = options.join("");
    if ([...byId("lookupTarget").options].some((option) => option.value === current)) byId("lookupTarget").value = current;
  }

  function renderRevisions(student) {
    const revisions = [...(student.revisionLog || [])].reverse();
    byId("revisionList").innerHTML = revisions.length ? revisions.map((entry) => `<div class="revision-entry"><time>${escapeHtml(localDateTime(entry.editedAt))}</time><p>${escapeHtml(entry.label || "상담카드 정보를 수정했습니다.")}</p></div>`).join("") : '<p class="revision-empty">아직 교사 수정 이력이 없습니다.</p>';
    byId("restoreTeacherEdits").disabled = !(student.teacherPatches?.length || student.teacherAddedItems?.length);
  }

  function renderAll() {
    renderClassSelect();
    renderSummary();
    renderStudentList();
    renderDetail();
  }

  async function importFiles(fileList) {
    if (!state.classId) return;
    const files = [...fileList];
    if (!files.length) return;
    const existingByNumber = new Map(state.students.map((student) => [student.studentNumber, student]));
    let inserted = 0;
    let updated = 0;
    const errors = [];
    for (const file of files) {
      try {
        const payload = normalizePayload(JSON.parse(await file.text()));
        const studentNumber = clean(payload.studentNumber);
        if (!studentNumber) throw new Error("학번이 없습니다.");
        const existing = existingByNumber.get(studentNumber);
        if (!existing && state.students.length + inserted >= MAX_STUDENTS) throw new Error(`반별 최대 ${MAX_STUDENTS}명까지 저장할 수 있습니다.`);
        const importedAt = nowIso();
        const feedbackDelivery = reconcileFeedbackDelivery(existing, payload, importedAt);
        const returnedFeedback = Boolean(
          existing?.feedbackDelivery?.exportedAt
          && clean(payload.teacherFeedbackReceipt?.exportedAt) === clean(existing.feedbackDelivery.exportedAt)
        );
        const returnComparison = returnedFeedback
          ? window.SusiCardTransfer.compareStudentReturn(existing.feedbackDelivery.reviewedSnapshot, payload)
          : null;
        const revisionLabel = returnedFeedback
          ? returnComparison.hasChanges
            ? `학생이 교사 피드백을 적용한 뒤 ${returnComparison.total}개 내용을 변경해 다시 제출했습니다. 재검토가 필요합니다.`
            : "학생이 교사 피드백을 적용한 상담카드를 다시 제출했습니다."
          : "학생이 다시 제출한 상담카드 원본을 갱신했습니다. 기존 교사 수정값은 유지했습니다.";
        const record = existing ? {
          ...existing,
          sourcePayload: payload,
          sourceFileName: file.name,
          importedAt,
          feedbackDelivery,
          revisionLog: [...(existing.revisionLog || []), { editedAt: importedAt, label: revisionLabel }]
        } : {
          id: `${state.classId}:${studentNumber}`,
          classId: state.classId,
          studentNumber,
          sourcePayload: payload,
          sourceFileName: file.name,
          importedAt,
          teacherPatches: [],
          teacherAddedItems: [],
          revisionLog: []
        };
        await saveStudent(record);
        existingByNumber.set(studentNumber, record);
        existing ? updated += 1 : inserted += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    await refreshStudents();
    showToast(`${inserted}명 추가 · ${updated}명 제출본 갱신${errors.length ? ` · ${errors.length}개 파일 확인 필요` : ""}`);
    if (errors.length) window.alert(errors.slice(0, 10).join("\n"));
  }

  async function addTeacherPatch(student, patch) {
    const entry = { ...patch, editedAt: nowIso() };
    student.teacherPatches = [...(student.teacherPatches || []), entry];
    student.revisionLog = [...(student.revisionLog || []), { editedAt: entry.editedAt, label: patch.label }];
    await saveStudent(student);
    await refreshStudents(student.id);
  }

  async function saveItemEdits(itemId, planElement) {
    const student = currentStudent();
    if (!student) return;
    const fields = {};
    ITEM_EDIT_FIELDS.forEach((field) => {
      const input = planElement.querySelector(`[data-item-field="${field}"]`);
      if (input) fields[field] = clean(input.value);
    });
    await addTeacherPatch(student, { scope: "item", itemId, fields, label: `${fields.university || "지원안"} 정보를 교사가 수정했습니다.` });
    showToast("교사 수정값을 저장했습니다.");
  }

  async function restoreItem(itemId) {
    const student = currentStudent();
    if (!student || !window.confirm("이 지원안에 적용한 교사 수정값을 모두 되돌릴까요? 학생 제출본은 유지됩니다.")) return;
    student.teacherPatches = (student.teacherPatches || []).filter((patch) => patch.itemId !== itemId);
    student.revisionLog = [...(student.revisionLog || []), { editedAt: nowIso(), label: "지원안의 교사 수정값을 학생 제출본으로 되돌렸습니다." }];
    await saveStudent(student);
    await refreshStudents(student.id);
  }

  async function saveOverallOpinion() {
    const student = currentStudent();
    if (!student) return;
    const value = clean(byId("teacherOverallOpinion").value);
    await addTeacherPatch(student, { scope: "document", fields: { overallOpinion: value }, label: "담임교사 종합 의견을 저장했습니다." });
    showToast("종합 의견을 저장했습니다.");
  }

  async function restoreAllTeacherEdits() {
    const student = currentStudent();
    if (!student || !window.confirm("이 학생의 교사 수정값과 교사가 추가한 지원안을 모두 되돌릴까요? 학생 제출본은 유지됩니다.")) return;
    student.teacherPatches = [];
    student.teacherAddedItems = [];
    student.revisionLog = [...(student.revisionLog || []), { editedAt: nowIso(), label: "모든 교사 수정값을 학생 제출본으로 되돌렸습니다." }];
    await saveStudent(student);
    await refreshStudents(student.id);
  }

  async function loadOptionIndex() {
    if (state.optionIndex) return state.optionIndex;
    const response = await fetch("./admission-data/options-2027/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("2027 대학 목록을 불러오지 못했습니다.");
    state.optionIndex = await response.json();
    return state.optionIndex;
  }

  async function initializeLookup() {
    try {
      const index = await loadOptionIndex();
      byId("lookupUniversity").innerHTML = '<option value="">대학·캠퍼스 선택</option>' + index.universities.map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)} · ${escapeHtml(item.campus)}</option>`).join("");
      byId("lookupUniversity").disabled = false;
    } catch (error) {
      byId("lookupStatus").textContent = error.message;
    }
  }

  async function handleLookupUniversity() {
    const code = byId("lookupUniversity").value;
    state.optionUniversity = null;
    state.lookupDepartment = null;
    state.lookupOption = null;
    byId("applyOfficialOption").disabled = true;
    byId("lookupDepartment").disabled = true;
    byId("lookupOption").disabled = true;
    if (!code) return;
    const entry = state.optionIndex.universities.find((item) => item.code === code);
    byId("lookupStatus").textContent = `${entry.name} 자료를 불러오는 중입니다.`;
    try {
      const response = await fetch(`./admission-data/options-2027/${entry.file}?v=${encodeURIComponent(state.optionIndex.generatedAt || "current")}`, { cache: "no-store" });
      if (!response.ok) throw new Error("대학별 모집정보를 불러오지 못했습니다.");
      state.optionUniversity = await response.json();
      byId("lookupDepartment").innerHTML = '<option value="">학과·모집단위 선택</option>' + state.optionUniversity.departments.map((department, index) => `<option value="${index}">${escapeHtml(department.name)}</option>`).join("");
      byId("lookupDepartment").disabled = false;
      byId("lookupOption").innerHTML = '<option value="">학과를 먼저 선택하세요</option>';
      byId("lookupStatus").textContent = `${entry.name} 자료를 불러왔습니다.`;
    } catch (error) {
      byId("lookupStatus").textContent = error.message;
    }
  }

  function handleLookupDepartment() {
    const index = Number(byId("lookupDepartment").value);
    state.lookupDepartment = Number.isInteger(index) ? state.optionUniversity?.departments[index] : null;
    state.lookupOption = null;
    byId("applyOfficialOption").disabled = true;
    byId("lookupOption").innerHTML = '<option value="">지원 전형 선택</option>' + (state.lookupDepartment?.options || []).map((option, optionIndex) => `<option value="${optionIndex}">${escapeHtml(option.admissionName)}${option.quota ? ` · ${option.quota}명` : ""}</option>`).join("");
    byId("lookupOption").disabled = !state.lookupDepartment;
  }

  async function handleLookupOption() {
    const index = Number(byId("lookupOption").value);
    state.lookupOption = Number.isInteger(index) ? state.lookupDepartment?.options[index] : null;
    if (!state.lookupOption) {
      byId("applyOfficialOption").disabled = true;
      return;
    }
    const option = state.lookupOption;
    byId("lookupPreview").innerHTML = `<strong>${escapeHtml(state.optionUniversity.name)} · ${escapeHtml(state.lookupDepartment.name)} · ${escapeHtml(option.admissionName)}</strong><br>모집인원 ${escapeHtml(option.quota ?? "확인 필요")}명 · ${escapeHtml(option.selectionMethod || "전형방법 확인 필요")} · 수능최저 ${escapeHtml(option.minimumStandard || "공식 입력 없음")}`;
    byId("applyOfficialOption").disabled = false;
    byId("lookupStatus").textContent = "연결 가능한 과거 입결을 확인하는 중입니다.";
    try {
      state.manifest ||= await AdmissionDataLoader.loadManifest();
      const rows = await AdmissionDataLoader.loadUniversityHistory(state.manifest, state.optionUniversity.code);
      state.lookupOptionHistory = matchHistory(rows, state.lookupDepartment.name, option);
      byId("lookupStatus").textContent = `${state.lookupOptionHistory.length}/3개년 입결을 연결했습니다.`;
    } catch (error) {
      state.lookupOptionHistory = [];
      byId("lookupStatus").textContent = "모집정보는 확인했지만 과거 입결 연결은 다시 확인해야 합니다.";
    }
  }

  function loose(value) {
    return clean(value).toLocaleLowerCase("ko").replace(/\s|[()\[\]{}.,·・\-_]/g, "").replace(/학과|학부|전공/g, "");
  }

  function matchHistory(rows, departmentName, option) {
    const departmentKey = loose(departmentName);
    const admissionKey = loose(option.admissionName).replace(/학생부|위주|전형|교과|종합/g, "");
    const candidates = rows.filter((row) => {
      const rowDepartment = loose(row.department);
      if (!(rowDepartment === departmentKey || rowDepartment.includes(departmentKey) || departmentKey.includes(rowDepartment))) return false;
      const rowAdmission = loose(row.admission).replace(/학생부|위주|전형|교과|종합/g, "");
      return !admissionKey || !rowAdmission || rowAdmission.includes(admissionKey) || admissionKey.includes(rowAdmission);
    });
    const byYear = new Map();
    candidates.forEach((row) => {
      if (!byYear.has(String(row.year))) byYear.set(String(row.year), row);
    });
    return [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year)).slice(-3).map((row) => ({
      id: clean(row.id), year: clean(row.year), category: clean(row.category), admission: clean(row.admission), department: clean(row.department), quota: clean(row.quota),
      competitionRate: clean(row.competition_rate), resultMetricType: clean(row.result_metric_type), resultMean: clean(row.result_mean), result50: clean(row.result_50), result70: clean(row.result_70), result75: clean(row.result_75), result80: clean(row.result_80), result85: clean(row.result_85), result90: clean(row.result_90), additionalAdmits: clean(row.additional_admits), waitlistLastRank: clean(row.waitlist_last_rank), sourceUrl: clean(row.source_url || row.sourceUrl), officeSourceUrl: clean(row.office_source_url || row.officeSourceUrl)
    }));
  }

  function officialItemSnapshot(existing = {}) {
    const university = state.optionUniversity;
    const department = state.lookupDepartment;
    const option = state.lookupOption;
    return {
      ...existing,
      id: existing.id || uid("TEACHER"),
      year: "2027",
      targetYear: "2027",
      university: university.name,
      campus: university.campus,
      targetUniversityCode: university.code,
      department: department.name,
      targetDepartment: department.name,
      admission: option.admissionName,
      targetAdmission: option.admissionName,
      category: option.category,
      targetCategory: option.category,
      targetField: option.field,
      targetOptionId: option.optionId,
      targetQuota: option.quota == null ? "" : String(option.quota),
      targetQuotaStatus: option.quotaStatus || "",
      targetSelectionMethod: option.selectionMethod || "",
      targetSelectionBreakdown: option.selectionBreakdown || [],
      targetSourceUrl: option.sourceUrl || "",
      targetMinimumOfficial: option.minimumStandard || "",
      targetMinimumStatus: option.minimumStatus || "",
      targetMinimumSubjects: option.minimumSubjects || "",
      targetMinimumSourceUrl: option.minimumSourceUrl || "",
      targetAnnouncementDate: option.announcementDate || "",
      history: clone(state.lookupOptionHistory || []),
      historyConnectionStatus: state.lookupOptionHistory?.length ? "teacher_official_lookup" : "not_connected",
      historyConnectionLabel: state.lookupOptionHistory?.length ? "교사용 공식자료 조회 연결" : "과거 입결 확인 필요",
      teacherOfficialCheckedAt: nowIso(),
      addedAt: existing.addedAt || nowIso(),
      exemptFromSixLimit: /과학기술원|에너지공과|전통문화/.test(university.name)
    };
  }

  async function applyOfficialOption() {
    const student = currentStudent();
    if (!student || !state.lookupOption) return;
    const payload = applyPatches(student);
    const targetId = byId("lookupTarget").value;
    if (targetId === "new") {
      if (payloadItems(payload).filter((item) => !item.exemptFromSixLimit).length >= 9 && !officialItemSnapshot().exemptFromSixLimit) {
        showToast("일반지원과 예비후보 9개가 모두 채워졌습니다.");
        return;
      }
      const item = officialItemSnapshot();
      student.teacherAddedItems = [...(student.teacherAddedItems || []), item];
      student.revisionLog = [...(student.revisionLog || []), { editedAt: nowIso(), label: `${item.university} ${item.targetDepartment} ${item.targetAdmission} 지원안을 공식자료 조회로 추가했습니다.` }];
      await saveStudent(student);
    } else {
      const existing = itemById(payload, targetId);
      if (!existing) return;
      const fields = officialItemSnapshot(existing);
      await addTeacherPatch(student, { scope: "item", itemId: targetId, fields, label: `${fields.university} ${fields.targetDepartment} ${fields.targetAdmission} 정보로 공식자료를 다시 확인해 적용했습니다.` });
      showToast("공식자료 조회 결과를 적용했습니다.");
      return;
    }
    await refreshStudents(student.id);
    showToast("공식자료 조회 결과를 지원안에 추가했습니다.");
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function exportStudentJson() {
    const student = currentStudent();
    if (!student) return;
    const exportedAt = nowIso();
    const reviewedSnapshot = applyPatches(student);
    const feedback = window.SusiCardTransfer.createTeacherFeedback(student, reviewedSnapshot, exportedAt);
    student.feedbackDelivery = {
      exportedAt,
      reviewedSnapshot: clone(reviewedSnapshot),
      teacherFeedbackSignature: teacherFeedbackSignature(student),
      status: "pending",
      returnedAt: "",
      appliedAt: "",
      comparison: null
    };
    student.revisionLog = [
      ...(student.revisionLog || []),
      { editedAt: exportedAt, label: "학생에게 전달할 교사 피드백 확인본을 저장했습니다." }
    ];
    await saveStudent(student);
    downloadBlob(
      new Blob([JSON.stringify(feedback, null, 2)], { type: "application/json;charset=utf-8" }),
      `교사피드백_${safeFilePart(student.studentNumber, "학번미입력")}_${fileTimestamp(exportedAt)}.anjwacard`
    );
    await refreshStudents(student.id);
    showToast("학생에게 전달할 교사 피드백 확인본을 저장했습니다.");
  }

  function printableStudent(student) {
    const payload = applyPatches(student);
    const items = payloadItems(payload);
    const comparisons = items.filter((item) => item.similarDepartmentCandidates?.length).map((item) => `<div><strong>${escapeHtml(item.university)} · ${escapeHtml(item.targetDepartment || item.department)}</strong><span>${item.similarDepartmentCandidates.map((candidate) => `${escapeHtml(candidate.university)} ${escapeHtml(candidate.department)}${candidate.note ? ` — ${escapeHtml(candidate.note)}` : ""}`).join("<br>")}</span></div>`).join("");
    return `<section class="print-student"><header><h1>${escapeHtml(student.studentNumber || "학번 미입력")} 수시 지원 상담카드</h1><p>출력 ${escapeHtml(localDateTime(nowIso()))}</p></header><table><thead><tr><th>순위</th><th>대학·캠퍼스</th><th>학과·모집단위</th><th>전형</th><th>모집</th><th>수능최저</th><th>최종 발표일</th><th>판단</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${item.exemptFromSixLimit ? "별도" : index + 1}</td><td>${escapeHtml(item.university)} ${escapeHtml(item.campus)}</td><td>${escapeHtml(item.targetDepartment || item.department)}</td><td>${escapeHtml(item.targetAdmission || item.admission)}</td><td>${escapeHtml(effectiveValue(item, "quota"))}</td><td>${escapeHtml(effectiveValue(item, "minimum"))}</td><td>${escapeHtml(effectiveValue(item, "announcementDate"))}</td><td>${escapeHtml(item.strategy || "")}</td></tr>`).join("")}</tbody></table>${comparisons ? `<h2>검토 중인 유사학과</h2><div class="print-comparisons">${comparisons}</div>` : ""}<h2>담임교사 종합 의견</h2><p class="opinion">${escapeHtml(payload.overallOpinion || "")}</p></section>`;
  }

  function openPrintDocument(students, title) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return showToast("팝업 차단을 해제한 뒤 다시 시도하세요.");
    printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:"Apple SD Gothic Neo",sans-serif;color:#17211c;margin:0}.print-student{page-break-after:always}.print-student:last-child{page-break-after:auto}header{display:flex;justify-content:space-between;align-items:end;border-bottom:2px solid #17211c;margin-bottom:12px}h1{font-size:24px}header p{font-size:12px;color:#66736d}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccd6d0;padding:7px;text-align:left;vertical-align:top}th{background:#eef3f0}h2{font-size:15px;margin:14px 0 5px}.print-comparisons{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.print-comparisons>div{display:grid;gap:2px;padding:6px;border:1px solid #ccd6d0;font-size:10px}.print-comparisons span{line-height:1.45}.opinion{min-height:50px;border:1px solid #ccd6d0;padding:8px;white-space:pre-wrap}</style></head><body>${students.map(printableStudent).join("")}<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
    printWindow.document.close();
  }

  function csvCell(value) {
    return `"${clean(value).replaceAll('"', '""')}"`;
  }

  function exportClassCsv() {
    const className = state.classes.find((item) => item.id === state.classId)?.name || "반";
    const rows = [["반", "학번", "순위", "대학", "캠퍼스", "학과·모집단위", "전형", "2027 모집인원", "수능최저", "최종 합격자 발표일", "최근 입결", "지원 판단", "상담 메모", "검토 중인 유사학과", "교사 수정 수", "피드백 상태", "피드백 이후 학생 변경"]];
    state.students.forEach((student) => {
      const payload = applyPatches(student);
      const status = feedbackState(student);
      const returnChanges = (status.comparison?.changes || []).map((entry) => entry.label).join(" / ");
      payloadItems(payload).forEach((item, index) => rows.push([className, student.studentNumber, item.exemptFromSixLimit ? "별도" : index + 1, item.university, item.campus, item.targetDepartment || item.department, item.targetAdmission || item.admission, effectiveValue(item, "quota"), effectiveValue(item, "minimum"), effectiveValue(item, "announcementDate"), recentResultText(item), item.strategy, item.memo, (item.similarDepartmentCandidates || []).map((candidate) => `${candidate.university} ${candidate.department}${candidate.note ? ` (${candidate.note})` : ""}`).join(" / "), student.teacherPatches?.length || 0, status.label, returnChanges]));
    });
    const csv = "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${safeFilePart(className, "반")}_수시상담요약_${fileTimestamp()}.csv`);
  }

  function backupClass() {
    const classRecord = state.classes.find((item) => item.id === state.classId);
    const payload = { format: "anjwa-teacher-dashboard-class", schemaVersion: 2, exportedAt: nowIso(), class: classRecord, students: state.students };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${safeFilePart(classRecord?.name, "반")}_상담대시보드백업_${fileTimestamp()}.json`);
  }

  async function initializeApp() {
    state.db = await openDatabase();
    await ensureDefaultClass();
    await refreshStudents();
    initializeLookup();
  }

  byId("teacherGateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;
    const matched = await passwordMatches(byId("teacherPassword").value);
    if (!matched) {
      byId("gateError").textContent = "비밀번호가 맞지 않습니다.";
      byId("gateError").hidden = false;
      if (submitButton) submitButton.disabled = false;
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    byId("teacherGate").hidden = true;
    byId("teacherApp").hidden = false;
    await initializeApp();
    if (submitButton) submitButton.disabled = false;
  });

  byId("lockDashboard").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  });
  byId("openSelectedStudentCard").addEventListener("click", () => {
    const student = currentStudent();
    if (!student) return;
    const params = new URLSearchParams({ class: state.classId, student: student.id });
    location.href = `./teacher-student-card.html?${params.toString()}`;
  });
  byId("classSelect").addEventListener("change", async () => {
    state.classId = byId("classSelect").value;
    localStorage.setItem("anjwa.teacherDashboard.classId", state.classId);
    state.studentId = "";
    await refreshStudents();
  });
  byId("addClass").addEventListener("click", async () => {
    const name = clean(window.prompt("추가할 반 이름을 입력하세요.", `${state.classes.length + 1}반`));
    if (!name) return;
    const record = { id: uid("CLASS"), name, createdAt: nowIso(), updatedAt: nowIso() };
    await saveClass(record);
    state.classes.push(record);
    state.classId = record.id;
    await refreshStudents();
  });
  byId("renameClass").addEventListener("click", async () => {
    const record = state.classes.find((item) => item.id === state.classId);
    if (!record) return;
    const name = clean(window.prompt("반 이름을 수정하세요.", record.name));
    if (!name || name === record.name) return;
    record.name = name;
    record.updatedAt = nowIso();
    await saveClass(record);
    renderAll();
  });
  byId("deleteClass").addEventListener("click", async () => {
    const record = state.classes.find((item) => item.id === state.classId);
    if (!record || !window.confirm(`${record.name}과 저장된 학생 상담카드를 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    await removeClassData(record.id);
    state.classes = state.classes.filter((item) => item.id !== record.id);
    await ensureDefaultClass();
    state.studentId = "";
    await refreshStudents();
  });
  byId("importStudents").addEventListener("click", () => byId("studentFiles").click());
  byId("studentFiles").addEventListener("change", async () => {
    await importFiles(byId("studentFiles").files);
    byId("studentFiles").value = "";
  });
  byId("studentSearch").addEventListener("input", renderStudentList);
  byId("studentList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-id]");
    if (!button) return;
    state.studentId = button.dataset.studentId;
    renderStudentList();
    renderDetail();
  });
  byId("supportPlans").addEventListener("click", async (event) => {
    const plan = event.target.closest("[data-item-id]");
    if (!plan) return;
    const saveButton = event.target.closest("[data-save-item]");
    if (saveButton) await saveItemEdits(saveButton.dataset.saveItem, plan);
    const restoreButton = event.target.closest("[data-restore-item]");
    if (restoreButton) await restoreItem(restoreButton.dataset.restoreItem);
  });
  byId("saveOverallOpinion").addEventListener("click", saveOverallOpinion);
  byId("restoreTeacherEdits").addEventListener("click", restoreAllTeacherEdits);
  byId("deleteStudent").addEventListener("click", async () => {
    const student = currentStudent();
    if (!student || !window.confirm(`${student.studentNumber} 학생의 상담카드를 이 반에서 삭제할까요?`)) return;
    await removeStudent(student.id);
    state.studentId = "";
    await refreshStudents();
  });
  byId("exportStudent").addEventListener("click", exportStudentJson);
  byId("printStudent").addEventListener("click", () => { const student = currentStudent(); if (student) openPrintDocument([student], `${student.studentNumber} 상담카드`); });
  byId("printClass").addEventListener("click", () => openPrintDocument(state.students, `${state.classes.find((item) => item.id === state.classId)?.name || "반"} 상담카드`));
  byId("exportClassCsv").addEventListener("click", exportClassCsv);
  byId("backupClass").addEventListener("click", backupClass);
  byId("lookupUniversity").addEventListener("change", handleLookupUniversity);
  byId("lookupDepartment").addEventListener("change", handleLookupDepartment);
  byId("lookupOption").addEventListener("change", handleLookupOption);
  byId("applyOfficialOption").addEventListener("click", applyOfficialOption);

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    byId("teacherGate").hidden = true;
    byId("teacherApp").hidden = false;
    initializeApp().catch((error) => {
      byId("teacherApp").hidden = true;
      byId("teacherGate").hidden = false;
      byId("gateError").textContent = `저장소를 열지 못했습니다: ${error.message}`;
      byId("gateError").hidden = false;
    });
  }
})();
