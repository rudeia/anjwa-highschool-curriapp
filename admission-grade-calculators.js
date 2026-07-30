(function gradeCalculatorModule(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AdmissionGradeCalculators = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGradeCalculators() {
  "use strict";

  const SEJONG_2027 = Object.freeze({
    id: "sejong-2027-student-record",
    university: "세종대학교",
    academicYear: 2027,
    scale: 1000,
    verifiedAt: "2026-07-29",
    sourceTitle: "2027학년도 세종대학교 수시모집요강",
    sourceUrl: "https://ipsi.sejong.ac.kr/board/upload_file/pdf/20266159234314522.pdf",
    sourcePage: 22,
    tracks: Object.freeze({
      free: Object.freeze({ label: "자유전공학부", subjects: Object.freeze(["국어", "수학", "영어"]) }),
      humanities: Object.freeze({ label: "인문계열", subjects: Object.freeze(["국어", "수학", "영어", "사회"]) }),
      natural: Object.freeze({ label: "자연계열", subjects: Object.freeze(["국어", "수학", "영어", "과학"]) }),
      arts: Object.freeze({ label: "예체능", subjects: Object.freeze(["국어", "영어"]) })
    }),
    commonGeneralScores: Object.freeze({
      1: 1000,
      2: 990,
      3: 980,
      4: 950,
      5: 900,
      6: 800,
      7: 700,
      8: 500,
      9: 0
    }),
    careerScores: Object.freeze({
      A: 1000,
      B: 980,
      C: 900
    }),
    weights: Object.freeze({
      commonGeneral: 0.8,
      career: 0.2
    })
  });

  const KOOKMIN_2027 = Object.freeze({
    id: "kookmin-2027-student-record",
    university: "국민대학교",
    academicYear: 2027,
    scale: 1000,
    verifiedAt: "2026-07-29",
    sourceTitle: "2027학년도 국민대학교 학생부위주전형 가이드북(2026.06.01.)",
    sourceUrl: "https://admission.kookmin.ac.kr/common/file_download.php?id=notice&no=2178",
    sourcePages: Object.freeze([10, 11]),
    tracks: Object.freeze({
      humanities: Object.freeze({
        label: "인문계·자유전공(A)·미래융합전공(A)",
        commonSubjects: Object.freeze(["국어", "영어", "수학", "사회"]),
        careerSubjects: Object.freeze(["국어", "영어", "수학", "사회"])
      }),
      natural: Object.freeze({
        label: "자연계·자유전공(B)·미래융합전공(B)",
        commonSubjects: Object.freeze(["국어", "영어", "수학", "과학"]),
        careerSubjects: Object.freeze(["국어", "영어", "수학", "과학"])
      }),
      arts: Object.freeze({
        label: "예·체능계",
        commonSubjects: Object.freeze(["국어", "영어"]),
        careerSubjects: Object.freeze(["국어", "영어", "예술", "체육"])
      })
    }),
    commonGeneralScores: Object.freeze({
      1: 100,
      2: 99,
      3: 98,
      4: 95,
      5: 90,
      6: 70,
      7: 50,
      8: 30,
      9: 0
    }),
    careerScores: Object.freeze({
      A: 100,
      B: 98,
      C: 90
    }),
    weights: Object.freeze({
      commonGeneral: 0.85,
      career: 0.15
    }),
    careerTopCount: 3,
    legacyGraduationYear: 2021
  });

  const DONGGUK_2027 = Object.freeze({
    id: "dongguk-seoul-2027-student-record",
    university: "동국대학교(서울)",
    academicYear: 2027,
    scale: 700,
    verifiedAt: "2026-07-29",
    sourceTitle: "2027학년도 동국대학교 수시모집요강",
    sourceUrl: "https://ipsi.dongguk.edu/upload/file/202605291309499DW33F.PDF",
    sourcePages: Object.freeze([44, 85, 86]),
    tracks: Object.freeze({
      humanities: Object.freeze({
        label: "인문계·영화영상학과·열린전공학부(인문)",
        subjects: Object.freeze(["국어", "수학", "사회", "영어", "한국사"])
      }),
      natural: Object.freeze({
        label: "자연계·열린전공학부(자연)",
        subjects: Object.freeze(["국어", "수학", "과학", "영어", "한국사"])
      })
    }),
    gradeScores: Object.freeze({
      1: 10,
      2: 9.99,
      3: 9.95,
      4: 9.9,
      5: 9,
      6: 8,
      7: 5,
      8: 3,
      9: 0
    }),
    topCount: 10
  });

  function clean(value) {
    return String(value ?? "").trim();
  }

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function truncateToEight(value) {
    const correction = Number.EPSILON * Math.max(1, Math.abs(value)) * 16;
    return Math.trunc((value + correction) * 100000000) / 100000000;
  }

  function recordLabel(record) {
    const period = `${record.schoolYear || "?"}-${record.semester || "?"}`;
    return `${period} ${clean(record.subjectName) || "과목명 없음"}`;
  }

  function excludedRecord(record, reason) {
    return {
      id: clean(record?.id),
      schoolYear: numberOrNull(record?.schoolYear),
      semester: numberOrNull(record?.semester),
      subjectGroup: clean(record?.subjectGroup),
      subjectName: clean(record?.subjectName),
      courseType: clean(record?.courseType),
      credits: numberOrNull(record?.credits),
      reason
    };
  }

  function reflectedRecord(record, score, credits) {
    return {
      id: clean(record?.id),
      schoolYear: Number(record.schoolYear),
      semester: Number(record.semester),
      subjectGroup: clean(record.subjectGroup),
      subjectName: clean(record.subjectName),
      courseType: clean(record.courseType),
      credits,
      rankGrade: numberOrNull(record.rankGrade),
      achievement: clean(record.achievement).toUpperCase(),
      score,
      weightedScore: score * credits
    };
  }

  function calculateSejong2027(records, trackId = "humanities") {
    const rule = SEJONG_2027;
    const track = rule.tracks[trackId];
    if (!track) {
      return {
        ok: false,
        rule,
        trackId,
        errors: ["지원 계열을 다시 선택하세요."],
        warnings: [],
        included: [],
        excluded: []
      };
    }

    const source = Array.isArray(records) ? records : [];
    const included = [];
    const excluded = [];
    const errors = [];
    const warnings = [];

    source.forEach((record) => {
      const schoolYear = numberOrNull(record?.schoolYear);
      const semester = numberOrNull(record?.semester);
      const subjectName = clean(record?.subjectName);
      const subjectGroup = clean(record?.subjectGroup);
      if (!subjectName) {
        excluded.push(excludedRecord(record, "과목명 없음"));
        return;
      }
      if (!Number.isInteger(schoolYear) || !Number.isInteger(semester) || schoolYear < 1 || schoolYear > 3 || semester < 1 || semester > 2) {
        excluded.push(excludedRecord(record, "학년·학기 확인 필요"));
        return;
      }
      if (schoolYear === 3 && semester === 2) {
        excluded.push(excludedRecord(record, "3학년 1학기까지만 반영"));
        return;
      }
      if (!track.subjects.includes(subjectGroup)) {
        excluded.push(excludedRecord(record, "선택 계열의 반영 교과 아님"));
        return;
      }
      if (record.passFail) {
        excluded.push(excludedRecord(record, "P/F 과목 미반영"));
        return;
      }

      const credits = numberOrNull(record.credits);
      if (!(credits > 0)) {
        errors.push(`${recordLabel(record)}의 이수단위·학점을 확인하세요.`);
        return;
      }

      if (record.courseType === "common-general") {
        const rankGrade = numberOrNull(record.rankGrade);
        if (!Number.isInteger(rankGrade) || !Object.prototype.hasOwnProperty.call(rule.commonGeneralScores, rankGrade)) {
          errors.push(`${recordLabel(record)}의 석차등급을 정수 1~9로 입력하세요.`);
          return;
        }
        included.push(reflectedRecord(record, rule.commonGeneralScores[rankGrade], credits));
        return;
      }

      if (record.courseType === "career") {
        const achievement = clean(record.achievement).toUpperCase();
        const score = rule.careerScores[achievement];
        if (!score) {
          errors.push(`${recordLabel(record)}의 진로선택 성취도는 A·B·C 중 하나여야 합니다.`);
          return;
        }
        included.push(reflectedRecord(record, score, credits));
        return;
      }

      errors.push(`${recordLabel(record)}의 과목 유형을 확인하세요.`);
    });

    const commonGeneral = included.filter((record) => record.courseType === "common-general");
    const career = included.filter((record) => record.courseType === "career");
    const commonCredits = commonGeneral.reduce((sum, record) => sum + record.credits, 0);
    const careerCredits = career.reduce((sum, record) => sum + record.credits, 0);
    const reflectedCredits = commonCredits + careerCredits;

    if (!commonGeneral.length) errors.push("반영 가능한 공통·일반선택 과목이 없습니다.");

    const reflectedGroups = new Set(included.map((record) => record.subjectGroup));
    const missingGroups = track.subjects.filter((subject) => !reflectedGroups.has(subject));
    if (missingGroups.length) {
      warnings.push(`반영 교과 중 ${missingGroups.join(", ")} 과목이 없습니다. 지원 자격을 모집요강에서 확인하세요.`);
    }
    if (trackId === "free" && reflectedCredits <= 50) {
      warnings.push("자유전공학부는 반영 교과 총 이수단위가 50단위 이하이면 지원할 수 없습니다.");
    }

    if (errors.length) {
      return {
        ok: false,
        rule,
        trackId,
        track,
        errors,
        warnings,
        included,
        excluded,
        summary: {
          commonGeneralCount: commonGeneral.length,
          careerCount: career.length,
          commonCredits,
          careerCredits,
          reflectedCredits,
          missingGroups
        }
      };
    }

    const commonAverage = commonGeneral.reduce((sum, record) => sum + record.weightedScore, 0) / commonCredits;
    const careerAverage = careerCredits
      ? career.reduce((sum, record) => sum + record.weightedScore, 0) / careerCredits
      : null;
    const commonWeight = careerCredits ? rule.weights.commonGeneral : 1;
    const careerWeight = careerCredits ? rule.weights.career : 0;
    const rawScore = commonAverage * commonWeight + (careerAverage || 0) * careerWeight;
    const score = truncateToEight(rawScore);

    return {
      ok: true,
      rule,
      trackId,
      track,
      score,
      rawScore,
      commonAverageRaw: commonAverage,
      careerAverageRaw: careerAverage,
      commonAverage: truncateToEight(commonAverage),
      careerAverage: careerAverage === null ? null : truncateToEight(careerAverage),
      commonWeight,
      careerWeight,
      included,
      excluded,
      errors,
      warnings,
      summary: {
        commonGeneralCount: commonGeneral.length,
        careerCount: career.length,
        commonCredits,
        careerCredits,
        reflectedCredits,
        missingGroups
      }
    };
  }

  function calculateKookmin2027(records, trackId = "humanities", academicProfile = {}) {
    const rule = KOOKMIN_2027;
    const track = rule.tracks[trackId];
    if (!track) {
      return {
        ok: false,
        rule,
        trackId,
        errors: ["지원 계열을 다시 선택하세요."],
        warnings: [],
        included: [],
        excluded: []
      };
    }

    const source = Array.isArray(records) ? records : [];
    const commonGeneral = [];
    const careerCandidates = [];
    const excluded = [];
    const errors = [];
    const warnings = [];
    const graduationYear = numberOrNull(academicProfile?.graduationYear);
    const isGraduated = academicProfile?.schoolStatus === "graduated";
    const legacyGraduate = isGraduated && Number.isInteger(graduationYear) && graduationYear <= rule.legacyGraduationYear;

    if (isGraduated && !Number.isInteger(graduationYear)) {
      warnings.push("졸업생은 졸업 연도를 입력하세요. 현재 계산은 2022년 이후 졸업자 기준입니다.");
    }

    source.forEach((record, index) => {
      const schoolYear = numberOrNull(record?.schoolYear);
      const semester = numberOrNull(record?.semester);
      const subjectName = clean(record?.subjectName);
      const subjectGroup = clean(record?.subjectGroup);
      if (!subjectName) {
        excluded.push(excludedRecord(record, "과목명 없음"));
        return;
      }
      if (!Number.isInteger(schoolYear) || !Number.isInteger(semester) || schoolYear < 1 || schoolYear > 3 || semester < 1 || semester > 2) {
        excluded.push(excludedRecord(record, "학년·학기 확인 필요"));
        return;
      }
      if (schoolYear === 3 && semester === 2) {
        excluded.push(excludedRecord(record, "3학년 1학기까지만 반영"));
        return;
      }
      if (record.curriculumCategory === "specialized") {
        excluded.push(excludedRecord(record, "전문교과 미반영"));
        return;
      }
      if (subjectGroup === "제2외국어/한문") {
        excluded.push(excludedRecord(record, "제2외국어·한문 미반영"));
        return;
      }
      if (record.passFail) {
        excluded.push(excludedRecord(record, "P/F 과목 미반영"));
        return;
      }

      const credits = numberOrNull(record.credits);
      if (!(credits > 0)) {
        errors.push(`${recordLabel(record)}의 이수단위·학점을 확인하세요.`);
        return;
      }

      if (record.courseType === "common-general") {
        if (!track.commonSubjects.includes(subjectGroup)) {
          excluded.push(excludedRecord(record, "선택 계열의 공통·일반 반영 교과 아님"));
          return;
        }
        const rankGrade = numberOrNull(record.rankGrade);
        if (!Number.isInteger(rankGrade) || !Object.prototype.hasOwnProperty.call(rule.commonGeneralScores, rankGrade)) {
          errors.push(`${recordLabel(record)}의 석차등급을 정수 1~9로 입력하세요.`);
          return;
        }
        commonGeneral.push({
          ...reflectedRecord(record, rule.commonGeneralScores[rankGrade], credits),
          sourceIndex: index
        });
        return;
      }

      if (record.courseType === "career") {
        if (legacyGraduate) {
          excluded.push(excludedRecord(record, "2021년 졸업자까지 진로선택 미반영"));
          return;
        }
        if (!track.careerSubjects.includes(subjectGroup)) {
          excluded.push(excludedRecord(record, "선택 계열의 진로선택 반영 교과 아님"));
          return;
        }
        const achievement = clean(record.achievement).toUpperCase();
        const score = rule.careerScores[achievement];
        if (!score) {
          errors.push(`${recordLabel(record)}의 진로선택 성취도는 A·B·C 중 하나여야 합니다.`);
          return;
        }
        careerCandidates.push({
          ...reflectedRecord(record, score, credits),
          sourceIndex: index
        });
        return;
      }

      errors.push(`${recordLabel(record)}의 과목 유형을 확인하세요.`);
    });

    careerCandidates.sort((left, right) => (
      right.score - left.score
      || right.credits - left.credits
      || left.sourceIndex - right.sourceIndex
    ));
    const career = careerCandidates.slice(0, rule.careerTopCount);
    careerCandidates.slice(rule.careerTopCount).forEach((record) => {
      excluded.push(excludedRecord(record, "진로선택 성취도 상위 3과목 외"));
    });
    const included = [...commonGeneral, ...career].map(({ sourceIndex, ...record }) => record);

    if (!commonGeneral.length) errors.push("반영 가능한 공통·일반선택 과목이 없습니다.");

    const reflectedGroups = new Set(commonGeneral.map((record) => record.subjectGroup));
    const missingGroups = track.commonSubjects.filter((subject) => !reflectedGroups.has(subject));
    if (missingGroups.length) {
      warnings.push(`공통·일반 반영 교과 중 ${missingGroups.join(", ")} 과목이 없습니다. 학교생활기록부와 모집요강을 확인하세요.`);
    }
    if (!legacyGraduate && career.length > 0 && career.length < rule.careerTopCount) {
      warnings.push(`반영 가능한 진로선택 과목이 ${career.length}과목입니다. 입력 누락이 없는지 확인하세요.`);
    }

    const commonCredits = commonGeneral.reduce((sum, record) => sum + record.credits, 0);
    const careerCredits = career.reduce((sum, record) => sum + record.credits, 0);
    const reflectedCredits = commonCredits + careerCredits;
    const summary = {
      commonGeneralCount: commonGeneral.length,
      careerCount: career.length,
      commonCredits,
      careerCredits,
      reflectedCredits,
      missingGroups,
      legacyGraduate
    };

    if (errors.length) {
      return {
        ok: false,
        rule,
        trackId,
        track,
        errors,
        warnings,
        included,
        excluded,
        summary
      };
    }

    const commonAverage = commonGeneral.reduce((sum, record) => sum + record.weightedScore, 0) / commonCredits;
    const careerAverage = careerCredits
      ? career.reduce((sum, record) => sum + record.weightedScore, 0) / careerCredits
      : null;
    const commonWeight = careerCredits && !legacyGraduate ? rule.weights.commonGeneral : 1;
    const careerWeight = careerCredits && !legacyGraduate ? rule.weights.career : 0;
    const rawAverage = commonAverage * commonWeight + (careerAverage || 0) * careerWeight;
    const rawScore = rawAverage * 10;

    return {
      ok: true,
      rule,
      trackId,
      track,
      score: truncateToEight(rawScore),
      rawScore,
      commonAverageRaw: commonAverage,
      careerAverageRaw: careerAverage,
      commonAverage: truncateToEight(commonAverage),
      careerAverage: careerAverage === null ? null : truncateToEight(careerAverage),
      commonWeight,
      careerWeight,
      included,
      excluded,
      errors,
      warnings,
      summary
    };
  }

  function calculateDongguk2027(records, trackId = "humanities", academicProfile = {}) {
    const rule = DONGGUK_2027;
    const track = rule.tracks[trackId];
    if (!track) {
      return {
        ok: false,
        rule,
        trackId,
        errors: ["지원 계열을 다시 선택하세요."],
        warnings: [],
        included: [],
        excluded: []
      };
    }

    const source = Array.isArray(records) ? records : [];
    const candidates = [];
    const excluded = [];
    const errors = [];
    const warnings = [];
    const isGraduated = academicProfile?.schoolStatus === "graduated";

    source.forEach((record, sourceIndex) => {
      const schoolYear = numberOrNull(record?.schoolYear);
      const semester = numberOrNull(record?.semester);
      const subjectName = clean(record?.subjectName);
      const subjectGroup = clean(record?.subjectGroup);
      if (!subjectName) {
        excluded.push(excludedRecord(record, "과목명 없음"));
        return;
      }
      if (!Number.isInteger(schoolYear) || !Number.isInteger(semester) || schoolYear < 1 || schoolYear > 3 || semester < 1 || semester > 2) {
        excluded.push(excludedRecord(record, "학년·학기 확인 필요"));
        return;
      }
      if (!isGraduated && schoolYear === 3 && semester === 2) {
        excluded.push(excludedRecord(record, "재학생은 3학년 1학기까지만 반영"));
        return;
      }
      if (!track.subjects.includes(subjectGroup)) {
        excluded.push(excludedRecord(record, "선택 계열의 반영 교과 아님"));
        return;
      }
      if (record.passFail) {
        excluded.push(excludedRecord(record, "P/F 과목 미반영"));
        return;
      }

      const rankGrade = numberOrNull(record.rankGrade);
      if (record.courseType === "career" && !Number.isInteger(rankGrade)) {
        excluded.push(excludedRecord(record, "석차등급 미표기 진로선택"));
        return;
      }
      if (!["common-general", "career"].includes(record.courseType)) {
        errors.push(`${recordLabel(record)}의 과목 유형을 확인하세요.`);
        return;
      }
      if (!Number.isInteger(rankGrade) || !Object.prototype.hasOwnProperty.call(rule.gradeScores, rankGrade)) {
        errors.push(`${recordLabel(record)}의 석차등급을 정수 1~9로 입력하세요.`);
        return;
      }

      candidates.push({
        ...reflectedRecord(record, rule.gradeScores[rankGrade], numberOrNull(record.credits) || 0),
        sourceIndex
      });
    });

    candidates.sort((left, right) => left.rankGrade - right.rankGrade || left.sourceIndex - right.sourceIndex);
    const chosen = candidates.slice(0, rule.topCount);
    candidates.slice(rule.topCount).forEach((record) => {
      excluded.push(excludedRecord(record, "석차등급 상위 10과목 외"));
    });
    const included = chosen.map(({ sourceIndex, ...record }) => record);

    if (included.length < rule.topCount) {
      errors.push(`반영 가능한 석차등급 과목이 ${included.length}과목입니다. 상위 10과목 계산을 위해 입력 누락을 확인하세요.`);
    }

    const summary = {
      candidateCount: candidates.length,
      reflectedCount: included.length,
      excludedCount: excluded.length,
      topCount: rule.topCount
    };
    if (errors.length) {
      return {
        ok: false,
        rule,
        trackId,
        track,
        errors,
        warnings,
        included,
        excluded,
        summary
      };
    }

    const pointSum = included.reduce((sum, record) => sum + record.score, 0);
    const averagePointRaw = pointSum / rule.topCount;
    const averageGradeRaw = included.reduce((sum, record) => sum + record.rankGrade, 0) / rule.topCount;
    const rawScore = averagePointRaw / 10 * rule.scale;

    return {
      ok: true,
      rule,
      trackId,
      track,
      score: truncateToEight(rawScore),
      rawScore,
      pointSum,
      averagePoint: truncateToEight(averagePointRaw),
      averagePointRaw,
      averageGrade: truncateToEight(averageGradeRaw),
      averageGradeRaw,
      included,
      excluded,
      errors,
      warnings,
      summary
    };
  }

  return Object.freeze({
    rules: Object.freeze({
      sejong2027: SEJONG_2027,
      kookmin2027: KOOKMIN_2027,
      dongguk2027: DONGGUK_2027
    }),
    truncateToEight,
    calculateSejong2027,
    calculateKookmin2027,
    calculateDongguk2027
  });
});
