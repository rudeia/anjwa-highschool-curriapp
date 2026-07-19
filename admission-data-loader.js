(function admissionDataLoaderModule() {
  "use strict";

  const yearCache = new Map();
  const universityHistoryCache = new Map();
  const universityLineageCache = new Map();
  let manifestPromise;
  let historyIndexPromise;
  let lineageIndexPromise;
  let searchAliasesPromise;

  function numericValue(value) {
    const normalized = String(value ?? "").replaceAll(",", "").trim();
    if (!normalized || normalized === "-") return null;
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function formatRate(value) {
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  function normalizeRow(source) {
    const supplementedFields = Array.isArray(source.supplementedFields) ? source.supplementedFields : [];
    const additionalValue = source.additional_admits ?? source.additionalAdmits ?? "";
    const waitlistValue = source.waitlist_last_rank ?? source.waitlistLastRank ?? "";
    const inferredAdditionalType = waitlistValue
      ? "waitlist_last_rank"
      : additionalValue
        ? supplementedFields.includes("additional_admits") ? "unknown" : "additional_count"
        : "none";
    const additionalType = source.additional_metric_type ?? source.additionalMetricType ?? inferredAdditionalType;
    const additionalLabel = {
      additional_count: "충원인원",
      waitlist_last_rank: "최종 충원순위",
      unknown: "추합·충원 공개값",
      none: "추합·충원 관련값"
    }[additionalType] || "추합·충원 관련값";
    const row = {
      ...source,
      competition_rate: source.competition_rate ?? source.competitionRate ?? "",
      additional_admits: additionalValue,
      waitlist_last_rank: waitlistValue,
      additional_metric_type: additionalType,
      additional_metric_label: source.additional_metric_label ?? source.additionalMetricLabel ?? additionalLabel,
      metric_definition_status: source.metric_definition_status ?? source.metricDefinitionStatus
        ?? (additionalType === "unknown" ? "needs_review" : additionalType === "none" ? "not_available" : "confirmed"),
      registered_count: source.registered_count ?? source.registeredCount ?? "",
      result_metric_type: source.result_metric_type ?? source.resultMetricType ?? "",
      result_mean: source.result_mean ?? source.resultMean ?? "",
      result_50: source.result_50 ?? source.result50 ?? "",
      result_70: source.result_70 ?? source.result70 ?? "",
      result_75: source.result_75 ?? source.result75 ?? "",
      result_80: source.result_80 ?? source.result80 ?? "",
      result_85: source.result_85 ?? source.result85 ?? "",
      result_90: source.result_90 ?? source.result90 ?? "",
      conversion_score_50: source.conversion_score_50 ?? source.conversionScore50 ?? "",
      conversion_score_70: source.conversion_score_70 ?? source.conversionScore70 ?? "",
      suppressedFields: Array.isArray(source.suppressedFields) ? source.suppressedFields : [],
      supplementedFields,
      derivedFields: Array.isArray(source.derivedFields) ? [...source.derivedFields] : []
    };

    if (!String(row.competition_rate).trim()) {
      const quota = numericValue(row.quota);
      const applicants = numericValue(row.applicants);
      if (quota && applicants !== null) {
        row.competition_rate = formatRate(applicants / quota);
        if (!row.derivedFields.includes("competition_rate")) row.derivedFields.push("competition_rate");
      }
    }
    return row;
  }

  async function fetchJson(path, version = "") {
    const separator = path.includes("?") ? "&" : "?";
    const url = version ? `${path}${separator}v=${encodeURIComponent(version)}` : path;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`자료를 불러오지 못했습니다: ${response.status}`);
    return response.json();
  }

  function loadManifest() {
    if (!manifestPromise) manifestPromise = fetchJson("./admission-data/manifest.json");
    return manifestPromise;
  }

  async function loadYear(manifest, year) {
    if (yearCache.has(year)) return yearCache.get(year);
    const entry = (manifest.years || []).find((item) => item.year === year);
    if (!entry) throw new Error(`${year}학년도 입시결과 파일을 찾지 못했습니다.`);
    const promise = fetchJson(
      `./admission-data/${entry.file}`,
      manifest.generatedAt || "current"
    ).then((rows) => rows.map(normalizeRow));
    yearCache.set(year, promise);
    return promise;
  }

  function loadHistoryIndex(version = "") {
    if (!historyIndexPromise) {
      historyIndexPromise = fetchJson("./admission-data/history/index.json", version);
    }
    return historyIndexPromise;
  }

  function loadSearchAliases(version = "") {
    if (!searchAliasesPromise) {
      searchAliasesPromise = fetchJson(
        "./admission-data/entity-lineage/search-aliases.json",
        version
      ).catch(() => ({ historyAliases: {} }));
    }
    return searchAliasesPromise;
  }

  function loadLineageIndex(version = "") {
    if (!lineageIndexPromise) {
      lineageIndexPromise = fetchJson("./admission-data/entity-lineage/index.json", version)
        .catch(() => ({ universities: [] }));
    }
    return lineageIndexPromise;
  }

  async function loadUniversityLineage(manifest, universityCode) {
    const code = String(universityCode || "").trim();
    if (!code) return null;
    if (universityLineageCache.has(code)) return universityLineageCache.get(code);
    const promise = loadLineageIndex(manifest.generatedAt || "current").then(async (index) => {
      const entry = (index.universities || []).find((item) => item.code === code);
      if (!entry) return null;
      return fetchJson(
        `./admission-data/entity-lineage/${entry.file}`,
        index.generatedAt || manifest.generatedAt || "current"
      );
    });
    universityLineageCache.set(code, promise);
    return promise;
  }

  async function loadUniversityHistory(manifest, universityCode) {
    const code = String(universityCode || "").trim();
    if (!code) return [];
    if (universityHistoryCache.has(code)) return universityHistoryCache.get(code);

    const promise = loadHistoryIndex(manifest.generatedAt || "current").then(async (index) => {
      const entry = (index.universities || []).find((item) => item.code === code);
      if (!entry) return [];
      const payload = await fetchJson(
        `./admission-data/history/${entry.file}`,
        index.generatedAt || manifest.generatedAt || "current"
      );
      return (payload.rows || []).map(normalizeRow);
    });
    universityHistoryCache.set(code, promise);
    return promise;
  }

  function coverage(rows) {
    const total = rows.length;
    const count = (predicate) => rows.reduce((sum, row) => sum + (predicate(row) ? 1 : 0), 0);
    const gradeFields = ["result_mean", "result_50", "result_70", "result_75", "result_80", "result_85", "result_90"];
    const grade = count((row) => gradeFields.some((field) => numericValue(row[field]) !== null));
    const competition = count((row) => numericValue(row.competition_rate) !== null);
    const quota = count((row) => numericValue(row.quota) !== null);
    const additional = count((row) => numericValue(row.additional_admits || row.waitlist_last_rank) !== null);
    const percent = (value) => total ? Math.round((value / total) * 100) : 0;
    return {
      total,
      grade,
      competition,
      quota,
      additional,
      gradePercent: percent(grade),
      competitionPercent: percent(competition),
      quotaPercent: percent(quota),
      additionalPercent: percent(additional)
    };
  }

  window.AdmissionDataLoader = Object.freeze({
    loadManifest,
    loadYear,
    loadUniversityHistory,
    loadUniversityLineage,
    loadSearchAliases,
    normalizeRow,
    coverage
  });
})();
