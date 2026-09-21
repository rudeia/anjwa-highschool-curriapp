"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const summaryElement = { innerHTML: "" };
const context = {
  window: {},
  document: {
    addEventListener() {},
    querySelector(selector) {
      return selector === "#curriculumSummary" ? summaryElement : null;
    }
  }
};

vm.runInNewContext(fs.readFileSync(path.join(root, "curriculum-data.js"), "utf8"), context);
vm.runInNewContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);

for (const [plan, grade] of Object.entries({
  incoming2027: "1",
  incoming2026: "1",
  incoming2025: "2",
  incoming2024: "3"
})) {
  assert.equal(vm.runInNewContext(`currentCurriculumGradeByPlan.${plan}`, context), grade);
}

for (const plan of ["incoming2027", "incoming2026", "incoming2025"]) {
  assert.doesNotThrow(() => vm.runInNewContext(
    `renderCurriculumSummary(curriculumData.plans.${plan}, ["2-1"], [])`, context
  ));
  assert.match(summaryElement.innerHTML, /-<\/b>교과 이수학점/);
}

vm.runInNewContext(
  'renderCurriculumSummary(curriculumData.plans.current2026, ["1-1"], [])', context
);
assert.match(summaryElement.innerHTML, /29<\/b>교과 이수학점/);

console.log("curriculum filter tests passed");
