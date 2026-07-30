"use strict";

const assert = require("node:assert/strict");
const {
  calculateSejong2027,
  calculateKookmin2027,
  calculateDongguk2027,
  rules
} = require("../admission-grade-calculators.js");

function record(overrides = {}) {
  return {
    id: `TEST-${Math.random().toString(36).slice(2, 8)}`,
    schoolYear: 1,
    semester: 1,
    subjectGroup: "국어",
    subjectName: "국어",
    courseType: "common-general",
    curriculumCategory: "regular",
    credits: 1,
    rankGrade: 1,
    achievement: "",
    passFail: false,
    ...overrides
  };
}

{
  const result = calculateSejong2027([
    record({ subjectGroup: "국어", subjectName: "국어", credits: 3, rankGrade: 1 }),
    record({ subjectGroup: "수학", subjectName: "수학Ⅰ", credits: 1, rankGrade: 2 }),
    record({ subjectGroup: "영어", subjectName: "영어Ⅰ", credits: 1, rankGrade: 1 }),
    record({ subjectGroup: "사회", subjectName: "통합사회", credits: 1, rankGrade: 1 }),
    record({ subjectGroup: "사회", subjectName: "사회문제탐구", courseType: "career", credits: 2, rankGrade: null, achievement: "A" }),
    record({ subjectGroup: "국어", subjectName: "고전읽기", courseType: "career", credits: 1, rankGrade: null, achievement: "B" })
  ], "humanities");

  assert.equal(result.ok, true);
  assert.equal(result.commonAverage, 998.33333333);
  assert.equal(result.careerAverage, 993.33333333);
  assert.equal(result.score, 997.33333333);
  assert.equal(result.commonWeight, 0.8);
  assert.equal(result.careerWeight, 0.2);
  assert.deepEqual(result.summary.missingGroups, []);
}

{
  const result = calculateSejong2027([
    record({ subjectGroup: "국어", subjectName: "국어", credits: 2, rankGrade: 2 }),
    record({ subjectGroup: "수학", subjectName: "수학", credits: 1, rankGrade: 9 }),
    record({ subjectGroup: "영어", subjectName: "영어", credits: 2, rankGrade: 3 }),
    record({ subjectGroup: "과학", subjectName: "통합과학", credits: 1, rankGrade: 1 })
  ], "natural");

  assert.equal(result.ok, true);
  assert.equal(result.score, 823.33333333);
  assert.equal(result.careerAverage, null);
  assert.equal(result.commonWeight, 1);
  assert.equal(result.careerWeight, 0);
  assert.deepEqual(result.summary.missingGroups, []);
}

{
  const result = calculateSejong2027([
    record({ subjectGroup: "국어", subjectName: "국어", rankGrade: 1 }),
    record({ subjectGroup: "수학", subjectName: "수학", rankGrade: 2 }),
    record({ subjectGroup: "영어", subjectName: "영어", rankGrade: 3 }),
    record({ subjectGroup: "사회", subjectName: "통합사회", rankGrade: 4 }),
    record({ schoolYear: 3, semester: 2, subjectGroup: "국어", subjectName: "화법과 언어", rankGrade: 1 }),
    record({ subjectGroup: "한국사", subjectName: "한국사", rankGrade: 1 }),
    record({ subjectGroup: "사회", subjectName: "여행지리", courseType: "career", credits: 1, rankGrade: null, achievement: "", passFail: true })
  ], "humanities");

  assert.equal(result.ok, true);
  assert.equal(result.included.length, 4);
  assert.equal(result.excluded.length, 3);
  assert.ok(result.excluded.some((item) => item.reason === "3학년 1학기까지만 반영"));
  assert.ok(result.excluded.some((item) => item.reason === "선택 계열의 반영 교과 아님"));
  assert.ok(result.excluded.some((item) => item.reason === "P/F 과목 미반영"));
}

{
  const result = calculateSejong2027([
    record({ subjectGroup: "국어", subjectName: "국어", rankGrade: 1 }),
    record({ subjectGroup: "수학", subjectName: "수학", rankGrade: 2.5 }),
    record({ subjectGroup: "영어", subjectName: "영어", rankGrade: 3 })
  ], "free");

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("정수 1~9")));
  assert.ok(result.warnings.some((message) => message.includes("50단위 이하")));
}

{
  const result = calculateSejong2027([
    record({ subjectGroup: "국어", subjectName: "국어", rankGrade: 1 }),
    record({ subjectGroup: "수학", subjectName: "수학", rankGrade: 2 }),
    record({ subjectGroup: "영어", subjectName: "영어", rankGrade: 3 }),
    record({ subjectGroup: "과학", subjectName: "과학과제연구", courseType: "career", rankGrade: null, achievement: "D" })
  ], "natural");

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("A·B·C")));
}

assert.equal(rules.sejong2027.academicYear, 2027);
assert.equal(rules.sejong2027.sourcePage, 22);

{
  const result = calculateKookmin2027([
    record({ subjectGroup: "국어", subjectName: "국어", credits: 3, rankGrade: 1 }),
    record({ subjectGroup: "영어", subjectName: "영어", credits: 2, rankGrade: 2 }),
    record({ subjectGroup: "수학", subjectName: "수학Ⅰ", credits: 2, rankGrade: 3 }),
    record({ subjectGroup: "사회", subjectName: "통합사회", credits: 1, rankGrade: 4 }),
    record({ subjectGroup: "국어", subjectName: "고전읽기", courseType: "career", credits: 1, rankGrade: null, achievement: "A" }),
    record({ subjectGroup: "사회", subjectName: "사회문제탐구", courseType: "career", credits: 3, rankGrade: null, achievement: "A" }),
    record({ subjectGroup: "수학", subjectName: "기하", courseType: "career", credits: 4, rankGrade: null, achievement: "B" }),
    record({ subjectGroup: "영어", subjectName: "영미문학읽기", courseType: "career", credits: 10, rankGrade: null, achievement: "C" })
  ], "humanities", { schoolStatus: "current", graduationYear: 2027 });

  assert.equal(result.ok, true);
  assert.equal(result.commonAverage, 98.625);
  assert.equal(result.careerAverage, 99);
  assert.equal(result.score, 986.8125);
  assert.equal(result.summary.careerCount, 3);
  assert.ok(result.excluded.some((item) => item.reason === "진로선택 성취도 상위 3과목 외"));
}

{
  const result = calculateKookmin2027([
    record({ subjectGroup: "국어", subjectName: "국어", credits: 2, rankGrade: 2 }),
    record({ subjectGroup: "영어", subjectName: "영어", credits: 2, rankGrade: 3 }),
    record({ subjectGroup: "예술", subjectName: "미술 전공 실기", courseType: "career", credits: 2, rankGrade: null, achievement: "A" }),
    record({ subjectGroup: "체육", subjectName: "스포츠 생활", courseType: "career", credits: 1, rankGrade: null, achievement: "B" }),
    record({ subjectGroup: "국어", subjectName: "전문 국어", curriculumCategory: "specialized", rankGrade: 1 }),
    record({ subjectGroup: "제2외국어/한문", subjectName: "일본어Ⅰ", rankGrade: 1 })
  ], "arts", { schoolStatus: "current", graduationYear: 2027 });

  assert.equal(result.ok, true);
  assert.equal(result.summary.careerCount, 2);
  assert.ok(result.included.some((item) => item.subjectGroup === "예술"));
  assert.ok(result.included.some((item) => item.subjectGroup === "체육"));
  assert.ok(result.excluded.some((item) => item.reason === "전문교과 미반영"));
  assert.ok(result.excluded.some((item) => item.reason === "제2외국어·한문 미반영"));
}

{
  const result = calculateKookmin2027([
    record({ subjectGroup: "국어", subjectName: "국어", credits: 2, rankGrade: 2 }),
    record({ subjectGroup: "영어", subjectName: "영어", credits: 2, rankGrade: 3 }),
    record({ subjectGroup: "수학", subjectName: "수학", credits: 2, rankGrade: 4 }),
    record({ subjectGroup: "사회", subjectName: "사회", credits: 2, rankGrade: 5 }),
    record({ subjectGroup: "사회", subjectName: "사회문제탐구", courseType: "career", credits: 2, rankGrade: null, achievement: "A" })
  ], "humanities", { schoolStatus: "graduated", graduationYear: 2021 });

  assert.equal(result.ok, true);
  assert.equal(result.careerAverage, null);
  assert.equal(result.commonWeight, 1);
  assert.equal(result.summary.legacyGraduate, true);
  assert.ok(result.excluded.some((item) => item.reason === "2021년 졸업자까지 진로선택 미반영"));
}

assert.equal(rules.kookmin2027.academicYear, 2027);
assert.deepEqual(rules.kookmin2027.sourcePages, [10, 11]);

{
  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 8, 9];
  const result = calculateDongguk2027(grades.map((rankGrade, index) => record({
    schoolYear: Math.floor(index / 6) + 1,
    semester: index % 2 + 1,
    subjectGroup: index % 2 ? "수학" : "국어",
    subjectName: `과목 ${index + 1}`,
    credits: index + 1,
    rankGrade
  })), "humanities", { schoolStatus: "current", graduationYear: 2027 });

  assert.equal(result.ok, true);
  assert.equal(result.included.length, 10);
  assert.equal(result.excluded.length, 2);
  assert.equal(result.averagePoint, 7.784);
  assert.equal(result.averageGrade, 4.5);
  assert.equal(result.score, 544.88);
  assert.ok(result.excluded.every((item) => item.reason === "석차등급 상위 10과목 외"));
}

{
  const base = Array.from({ length: 9 }, (_, index) => record({
    subjectGroup: index % 2 ? "사회" : "국어",
    subjectName: `기본 ${index + 1}`,
    rankGrade: Math.min(index + 1, 9)
  }));
  const result = calculateDongguk2027([
    ...base,
    record({ schoolYear: 3, semester: 2, subjectName: "3학년 2학기 국어", rankGrade: 1 }),
    record({ subjectGroup: "사회", subjectName: "여행지리", courseType: "career", rankGrade: null, achievement: "A" }),
    record({ subjectGroup: "한국사", subjectName: "한국사 P/F", passFail: true, rankGrade: null })
  ], "humanities", { schoolStatus: "current", graduationYear: 2027 });

  assert.equal(result.ok, false);
  assert.equal(result.included.length, 9);
  assert.ok(result.excluded.some((item) => item.reason === "재학생은 3학년 1학기까지만 반영"));
  assert.ok(result.excluded.some((item) => item.reason === "석차등급 미표기 진로선택"));
  assert.ok(result.excluded.some((item) => item.reason === "P/F 과목 미반영"));
  assert.ok(result.errors.some((message) => message.includes("9과목")));
}

{
  const result = calculateDongguk2027(Array.from({ length: 10 }, (_, index) => record({
    schoolYear: index === 9 ? 3 : 2,
    semester: index === 9 ? 2 : 1,
    subjectGroup: index % 2 ? "과학" : "수학",
    subjectName: `자연 ${index + 1}`,
    courseType: index === 8 ? "career" : "common-general",
    achievement: index === 8 ? "A" : "",
    rankGrade: index + 1 > 9 ? 9 : index + 1
  })), "natural", { schoolStatus: "graduated", graduationYear: 2026 });

  assert.equal(result.ok, true);
  assert.equal(result.included.length, 10);
  assert.ok(result.included.some((item) => item.schoolYear === 3 && item.semester === 2));
  assert.ok(result.included.some((item) => item.courseType === "career" && item.rankGrade === 9));
}

{
  const records = Array.from({ length: 10 }, (_, index) => record({
    subjectName: `검증 ${index + 1}`,
    rankGrade: index === 4 ? 2.5 : Math.min(index + 1, 9)
  }));
  const result = calculateDongguk2027(records, "humanities", { schoolStatus: "current" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("정수 1~9")));
}

assert.equal(rules.dongguk2027.academicYear, 2027);
assert.equal(rules.dongguk2027.scale, 700);
assert.deepEqual(rules.dongguk2027.sourcePages, [44, 85, 86]);

console.log("admission grade calculator tests passed");
