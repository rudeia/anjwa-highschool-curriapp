"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  matchingGroups,
  gradeRangeForCandidate,
  referenceGradePosition,
  rankCandidates
} = require("../department-recommendations.js");

const groups = [
  { id: "computer", label: "컴퓨터·AI", keywords: ["컴퓨터", "인공지능", "데이터"] },
  { id: "business", label: "경영·회계", keywords: ["경영", "회계"] }
];

assert.deepEqual(
  matchingGroups("AI컴퓨터공학과", groups).map((group) => group.id),
  ["computer"]
);
assert.deepEqual(matchingGroups("국어국문학과", groups), []);

const source = {
  universityCode: "A",
  department: "컴퓨터공학과",
  category: "학생부위주(교과)",
  field: "공학계열",
  region: "서울"
};
const candidates = [
  {
    universityCode: "A",
    university: "현재대학교",
    campus: "본교",
    region: "서울",
    department: "컴퓨터공학과",
    groupIds: ["computer"],
    categories: ["학생부위주(교과)"],
    fields: ["공학계열"]
  },
  {
    universityCode: "B",
    university: "가대학교",
    campus: "본교",
    region: "서울",
    department: "소프트웨어학과",
    groupIds: ["computer"],
    categories: ["학생부위주(교과)"],
    fields: ["공학계열"]
  },
  {
    universityCode: "C",
    university: "나다대학교",
    campus: "본교",
    region: "부산",
    department: "데이터사이언스학과",
    groupIds: ["computer"],
    categories: ["학생부위주(종합)"],
    fields: ["자연과학계열"]
  },
  {
    universityCode: "D",
    university: "다대학교",
    campus: "본교",
    region: "서울",
    department: "경영학과",
    groupIds: ["business"],
    categories: ["학생부위주(교과)"],
    fields: ["인문사회계열"]
  }
];

{
  const ranked = rankCandidates(source, candidates, { sourceGroupIds: ["computer"] });
  assert.deepEqual(ranked.map((candidate) => candidate.universityCode), ["B", "C"]);
  assert.ok(ranked[0].recommendationScore > ranked[1].recommendationScore);
}

{
  const ranked = rankCandidates(source, candidates, {
    sourceGroupIds: ["computer"],
    region: "부산",
    category: "학생부위주(종합)",
    query: "데이터"
  });
  assert.deepEqual(ranked.map((candidate) => candidate.universityCode), ["C"]);
}

{
  const candidate = {
    gradeRanges: {
      all: { year: "2026", min: 2.1, max: 3.4, count: 4 },
      subject: { year: "2025", min: 1.8, max: 2.6, count: 2 }
    }
  };
  assert.deepEqual(
    gradeRangeForCandidate(candidate, "학생부위주(교과)"),
    { year: "2025", min: 1.8, max: 2.6, count: 2 }
  );
  assert.deepEqual(referenceGradePosition(2.2, candidate.gradeRanges.subject), { status: "within", difference: 0 });
  assert.deepEqual(referenceGradePosition(1.5, candidate.gradeRanges.subject), { status: "ahead", difference: 0.30000000000000004 });
  assert.deepEqual(referenceGradePosition(3.1, candidate.gradeRanges.subject), { status: "behind", difference: 0.5 });
}

{
  const index = JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "admission-data", "options-2027", "department-recommendations.json"),
    "utf8"
  ));
  const groupIds = new Set(index.groups.map((group) => group.id));
  assert.equal(index.academicYear, 2027);
  assert.equal(index.departmentCount, index.departments.length);
  assert.ok(index.departments.length > 3000);
  assert.ok(index.departments.every((department) => (
    department.universityCode
    && department.department
    && department.groupIds.length
    && department.groupIds.every((id) => groupIds.has(id))
  )));
  assert.ok(index.departments.some((department) => department.groupIds.includes("geography-spatial")));
  assert.ok(index.departments.filter((department) => department.gradeRanges?.all).length > 4000);
  assert.ok(index.departments.some((department) => department.gradeRanges?.subject));
  assert.ok(index.departments.some((department) => department.gradeRanges?.holistic));
}

console.log("department recommendation tests passed");
