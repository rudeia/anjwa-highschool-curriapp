const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const projectRoot = path.resolve(__dirname, "..");
const values = new Map();
global.localStorage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
  removeItem(key) {
    values.delete(key);
  }
};
global.CustomEvent = class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options?.detail;
  }
};
global.window = { dispatchEvent() {} };

const storeSource = fs.readFileSync(path.join(projectRoot, "consultation-card-store.js"), "utf8");
vm.runInThisContext(storeSource, { filename: "consultation-card-store.js" });

const store = window.ConsultationCardStore;
const {
  FEEDBACK_FORMAT,
  normalizeTeacherPayload,
  createTeacherFeedback,
  normalizeTeacherFeedback,
  isTeacherFeedback,
  applyTeacherFeedback,
  compareStudentReturn,
  payloadItems
} = require(path.join(projectRoot, "susi-card-transfer.js"));
const candidates = [
  {
    universityCode: "A001",
    university: "가람대학교",
    campus: "본교",
    department: "도시공학과",
    region: "서울",
    categories: ["학생부교과", "학생부종합"],
    fields: ["자연"],
    optionCount: 2,
    gradeRanges: { all: { year: "2026", min: 2.1, max: 3.4, count: 2 } },
    note: "도시계획 교육과정과 통학 조건을 함께 확인",
    savedAt: "2026-07-30T00:00:00.000Z"
  },
  {
    universityCode: "A002",
    university: "나루대학교",
    department: "도시계획학과",
    region: "경기",
    categories: ["학생부종합"],
    fields: ["자연"],
    optionCount: 1,
    gradeRanges: { holistic: { year: "2026", min: 2.8, max: 3.2, count: 1 } },
    note: "면접 여부 재확인"
  },
  {
    universityCode: "A003",
    university: "다온대학교",
    department: "교통공학과",
    region: "충남",
    categories: ["학생부교과"],
    fields: ["자연"],
    optionCount: 1,
    gradeRanges: {},
    note: ""
  },
  {
    universityCode: "A004",
    university: "라온대학교",
    department: "건설환경공학과",
    region: "부산"
  }
];

let result = store.upsertSlot(1, {
  id: "PLAN-1",
  university: "기준대학교",
  department: "도시공학과",
  targetDepartment: "도시공학과",
  targetAdmission: "학생부교과",
  similarDepartmentCandidates: candidates
});
assert.equal(result.updated, true);
assert.equal(result.item.similarDepartmentCandidates.length, 3);
assert.equal(result.item.similarDepartmentCandidates[0].note, candidates[0].note);
assert.deepEqual(result.item.similarDepartmentCandidates[0].gradeRanges.all, {
  year: "2026",
  min: 2.1,
  max: 3.4,
  count: 2
});

const exported = store.exportData("2026-07-30T00:10:00.000Z");
assert.equal(exported.schemaVersion, 5);
assert.equal(exported.version, 16);
assert.equal(exported.slots[0].item.similarDepartmentCandidates.length, 3);

const teacherPayload = normalizeTeacherPayload(exported);
const teacherItem = payloadItems(teacherPayload)[0];
assert.equal(teacherPayload.studentNumber, "");
assert.equal(teacherItem.similarDepartmentCandidates.length, 3);
assert.equal(teacherItem.similarDepartmentCandidates[0].university, "가람대학교");
assert.equal(teacherItem.similarDepartmentCandidates[0].note, candidates[0].note);
assert.equal(teacherItem.similarDepartmentCandidates[0].gradeRanges.all.min, 2.1);
assert.notStrictEqual(teacherPayload, exported);

const reviewedPayload = JSON.parse(JSON.stringify(teacherPayload));
reviewedPayload.studentNumber = "30101";
reviewedPayload.slots[0].item.strategy = "적정";
reviewedPayload.slots[0].item.memo = "교사가 수능최저 준비 상태를 확인함";
reviewedPayload.overallOpinion = "면접 준비 일정까지 함께 점검하세요.";
reviewedPayload.slots[1].item = {
  id: "TEACHER-2",
  university: "새길대학교",
  department: "도시행정학과",
  targetDepartment: "도시행정학과",
  targetAdmission: "학생부종합",
  strategy: "안정"
};
const feedback = createTeacherFeedback({
  studentNumber: "30101",
  sourceFileName: "수시지원상담카드_30101.anjwacard",
  importedAt: "2026-07-30T00:05:00.000Z",
  teacherPatches: [
    { scope: "item", itemId: "PLAN-1", fields: { strategy: "적정", memo: "교사가 수능최저 준비 상태를 확인함" }, editedAt: "2026-07-30T00:15:00.000Z" },
    { scope: "document", fields: { overallOpinion: reviewedPayload.overallOpinion }, editedAt: "2026-07-30T00:16:00.000Z" }
  ],
  teacherAddedItems: [reviewedPayload.slots[1].item],
  revisionLog: [{ editedAt: "2026-07-30T00:16:00.000Z", label: "담임교사 종합 의견을 저장했습니다." }]
}, reviewedPayload, "2026-07-30T00:20:00.000Z");
assert.equal(feedback.format, FEEDBACK_FORMAT);
assert.equal(feedback.reviewedPayload.slots[0].item.strategy, "적정");
assert.equal(feedback.teacherChanges.patches.length, 2);
assert.equal(isTeacherFeedback(feedback), true);
const normalizedFeedback = normalizeTeacherFeedback(feedback);
assert.equal(normalizedFeedback.studentNumber, "30101");
assert.equal(normalizedFeedback.teacherChanges.revisionLog.length, 1);
assert.throws(() => normalizeTeacherFeedback(exported), /교사 피드백/);
const unchangedReturn = applyTeacherFeedback(reviewedPayload, normalizedFeedback, "2026-07-30T00:20:30.000Z");
assert.equal(compareStudentReturn(reviewedPayload, unchangedReturn).hasChanges, false);
const changedReturn = JSON.parse(JSON.stringify(unchangedReturn));
changedReturn.slots[0].item.memo = "학생이 피드백 적용 후 상담 메모를 보완함";
changedReturn.gradeRecords.push({
  id: "GRADE-1",
  schoolYear: 3,
  semester: 1,
  subjectName: "화법과 작문",
  courseType: "common-general",
  grade: 2,
  credits: 3
});
const returnComparison = compareStudentReturn(reviewedPayload, changedReturn);
assert.equal(returnComparison.hasChanges, true);
assert.equal(returnComparison.changes.some((entry) => entry.type === "updated" && entry.itemId === "PLAN-1"), true);
assert.equal(returnComparison.changes.some((entry) => entry.type === "grades"), true);

store.update("PLAN-1", {
  similarDepartmentCandidates: [{
    ...store.read().items[0].similarDepartmentCandidates[0],
    note: "학생이 피드백 대기 중 추가한 메모"
  }]
});
const backup = store.backupBeforeTeacherFeedback({
  studentNumber: "30101",
  feedbackExportedAt: normalizedFeedback.exportedAt
});
assert.equal(store.feedbackBackups()[0].id, backup.id);
const mergedFeedback = applyTeacherFeedback(store.read(), normalizedFeedback, "2026-07-30T00:21:00.000Z");
store.importData(mergedFeedback);
assert.equal(store.read().items[0].memo, "교사가 수능최저 준비 상태를 확인함");
assert.equal(store.read().items[0].similarDepartmentCandidates[0].note, "학생이 피드백 대기 중 추가한 메모");
assert.equal(store.read().items[1].university, "새길대학교");
assert.equal(store.read().teacherFeedbackReceipt.appliedAt, "2026-07-30T00:21:00.000Z");
assert.equal(store.exportData("2026-07-30T00:22:00.000Z").teacherFeedbackReceipt.revisionLog.length, 1);
const restored = store.restoreFeedbackBackup(backup.id);
assert.equal(restored.restored, true);
assert.equal(restored.state.items[0].memo, "");
assert.equal(restored.state.items[0].similarDepartmentCandidates[0].note, "학생이 피드백 대기 중 추가한 메모");
assert.equal(restored.state.items.length, 1);

store.clear();
const imported = store.importData(teacherPayload);
assert.equal(imported.items[0].similarDepartmentCandidates.length, 3);
assert.equal(imported.items[0].similarDepartmentCandidates[1].department, "도시계획학과");

const legacy = normalizeTeacherPayload({
  format: "anjwa-consultation-card",
  schemaVersion: 2,
  studentNumber: "30101",
  items: [{ id: "OLD-1", university: "옛대학교", department: "국어국문학과" }]
});
assert.deepEqual(payloadItems(legacy)[0].similarDepartmentCandidates, []);
assert.throws(() => normalizeTeacherPayload({ format: "unknown" }), /수시카드/);

console.log("susi card transfer tests passed");
