"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

global.window = {};
require("../curriculum-data.js");

const curriculum = window.ANJWA_CURRICULUM_DATA;
const plans = curriculum.plans;

assert.equal(curriculum.updated, "2026-09-21");
assert.equal(plans.incoming2024.courses.length, 58);
assert.equal(plans.incoming2025.courses.length, 84);
assert.equal(plans.incoming2026.courses.length, 84);
assert.equal(plans.incoming2027.courses.length, 80);
assert.equal(plans.incoming2027.label, "2027학년도 신입생(예정)");

function digestPlan(plan) {
  return crypto.createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

// 2027 추가 작업에서 건드리지 않기로 한 기존 기준 데이터의 고정값.
assert.equal(
  digestPlan(plans.incoming2024),
  "6b1597d70164c25aea42a712da6b811e3dc38355c8cbec86afa0776e3071f552"
);
assert.equal(
  digestPlan(plans.current2026),
  "9e9ab159c0c5853bcd1a7892588b6154c329d5ff1ce5775c5148aaccf0d3652c"
);

function findCourse(planKey, name) {
  return plans[planKey].courses.find((course) => course.name === name);
}

function assertCourse(planKey, name, credits, semesters) {
  const course = findCourse(planKey, name);
  assert.ok(course, `${planKey}에 ${name} 과목이 있어야 합니다.`);
  assert.equal(course.credits, credits);
  assert.deepEqual(course.semesters, semesters);
}

assertCourse("incoming2027", "(온) 정보", 3, ["1-1"]);
assertCourse("incoming2027", "(온) 인공지능 기초", 3, ["1-2"]);
assertCourse("incoming2027", "진로와 직업", 2, ["1-1"]);
assertCourse("incoming2027", "(온) (고시외)비판적 질문과 창의적 해결", 2, ["1-2"]);
assertCourse("incoming2027", "독서와 작문", 3, ["2-1"]);
assertCourse("incoming2027", "문학", 3, ["2-2"]);

for (const removedName of [
  "심화 영어",
  "미디어 영어",
  "현대사회와 윤리",
  "심화 영어 독해와 작문",
  "영어 발표와 토론"
]) {
  assert.equal(findCourse("incoming2027", removedName), undefined, `${removedName}은 2027 편성에서 제외되어야 합니다.`);
}

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const admissionSource = fs.readFileSync(path.join(root, "admission-pages.js"), "utf8");
const advancedSource = fs.readFileSync(path.join(root, "advanced-recommendations.html"), "utf8");

assert.match(appSource, /plannerPlanOrder\s*=\s*\["incoming2027",\s*"incoming2026",\s*"incoming2025",\s*"incoming2024"\]/);
assert.match(appSource, /incoming2027:\s*"2027학년도 신입생\(예정\)"/);
assert.match(appSource, /state\.courseDesignerPlan === "incoming2027"/);
assert.match(appSource, /label:\s*"입학 후 배우는 과목"/);

const currentGradeMapping = appSource.match(/const currentGradeByPlan\s*=\s*\{([^}]+)\}/);
assert.ok(currentGradeMapping);
assert.doesNotMatch(currentGradeMapping[1], /incoming2027/);
assert.match(currentGradeMapping[1], /incoming2026:\s*1/);
assert.match(currentGradeMapping[1], /incoming2025:\s*2/);
assert.match(currentGradeMapping[1], /incoming2024:\s*3/);

assert.match(admissionSource, /option value="incoming2027">2027 신입생\(예정\)<\/option>/);
assert.match(advancedSource, /option value="incoming2027">2027 신입생\(예정\)<\/option>/);

console.log("2027 curriculum integration tests passed");
