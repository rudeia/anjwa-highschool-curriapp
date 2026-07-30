(function departmentRecommendationsModule(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DepartmentRecommendations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDepartmentRecommendations() {
  "use strict";

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko")
      .replace(/[^0-9a-z가-힣]/g, "");
  }

  function bigrams(value) {
    const text = normalize(value);
    if (text.length < 2) return new Set(text ? [text] : []);
    return new Set(Array.from({ length: text.length - 1 }, (_, index) => text.slice(index, index + 2)));
  }

  function diceSimilarity(left, right) {
    const a = bigrams(left);
    const b = bigrams(right);
    if (!a.size || !b.size) return 0;
    let overlap = 0;
    a.forEach((token) => {
      if (b.has(token)) overlap += 1;
    });
    return (2 * overlap) / (a.size + b.size);
  }

  function matchingGroups(department, groups) {
    const target = normalize(department);
    if (!target) return [];
    return (Array.isArray(groups) ? groups : []).filter((group) => (
      (group.keywords || []).some((keyword) => {
        const normalizedKeyword = normalize(keyword);
        return normalizedKeyword && target.includes(normalizedKeyword);
      })
    ));
  }

  function categoryKey(value) {
    const text = normalize(value);
    if (text.includes("교과")) return "subject";
    if (text.includes("종합")) return "holistic";
    if (text.includes("논술")) return "essay";
    if (text.includes("실기") || text.includes("특기")) return "performance";
    return "other";
  }

  function gradeRangeForCandidate(candidate, preferredCategory = "") {
    const ranges = candidate?.gradeRanges || {};
    const preferred = ranges[categoryKey(preferredCategory)];
    return preferred || ranges.all || null;
  }

  function validReferenceGrade(value) {
    const grade = Number(value);
    return Number.isFinite(grade) && grade >= 1 && grade <= 9;
  }

  function referenceGradePosition(referenceGrade, range) {
    if (!validReferenceGrade(referenceGrade) || !range) return null;
    const grade = Number(referenceGrade);
    const minimum = Number(range.min);
    const maximum = Number(range.max);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return null;
    if (grade < minimum) {
      return { status: "ahead", difference: minimum - grade };
    }
    if (grade > maximum) {
      return { status: "behind", difference: grade - maximum };
    }
    return { status: "within", difference: 0 };
  }

  function candidateScore(source, candidate, sourceGroupIds) {
    const groups = new Set(Array.isArray(sourceGroupIds) ? sourceGroupIds : []);
    const sharedGroupCount = (candidate.groupIds || []).filter((id) => groups.has(id)).length;
    const sameCategory = source.category && (candidate.categories || []).includes(source.category);
    const sameField = source.field && (candidate.fields || []).includes(source.field);
    const sameRegion = source.region && candidate.region === source.region;
    return sharedGroupCount * 100
      + diceSimilarity(source.department, candidate.department) * 20
      + (sameCategory ? 10 : 0)
      + (sameField ? 5 : 0)
      + (sameRegion ? 3 : 0);
  }

  function rankCandidates(source, candidates, options = {}) {
    const sourceGroupIds = Array.isArray(options.sourceGroupIds) ? options.sourceGroupIds : [];
    const sourceGroups = new Set(sourceGroupIds);
    const query = normalize(options.query);
    const region = String(options.region || "");
    const category = String(options.category || "");
    const sourceCode = String(source.universityCode || "");
    const sourceDepartment = normalize(source.department);
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 60;

    return (Array.isArray(candidates) ? candidates : [])
      .filter((candidate) => (candidate.groupIds || []).some((id) => sourceGroups.has(id)))
      .filter((candidate) => !(
        String(candidate.universityCode || "") === sourceCode
        && normalize(candidate.department) === sourceDepartment
      ))
      .filter((candidate) => !region || candidate.region === region)
      .filter((candidate) => !category || (candidate.categories || []).includes(category))
      .filter((candidate) => {
        if (!query) return true;
        return normalize(`${candidate.university} ${candidate.campus} ${candidate.department} ${(candidate.categories || []).join(" ")}`).includes(query);
      })
      .map((candidate) => ({
        ...candidate,
        recommendationScore: candidateScore(source, candidate, sourceGroupIds)
      }))
      .sort((left, right) => (
        right.recommendationScore - left.recommendationScore
        || String(left.region || "").localeCompare(String(right.region || ""), "ko")
        || String(left.university || "").localeCompare(String(right.university || ""), "ko")
        || String(left.department || "").localeCompare(String(right.department || ""), "ko")
      ))
      .slice(0, limit);
  }

  return Object.freeze({
    normalize,
    diceSimilarity,
    matchingGroups,
    categoryKey,
    gradeRangeForCandidate,
    validReferenceGrade,
    referenceGradePosition,
    candidateScore,
    rankCandidates
  });
});
