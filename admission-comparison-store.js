(function admissionComparisonStoreModule() {
  "use strict";

  const STORAGE_KEY = "anjwa.admissionComparison.v1";
  const MAX_ITEMS = 6;
  const TEXT_FIELDS = [
    "id", "year", "universityCode", "university", "campus", "region", "category",
    "admission", "admissionType", "department", "departmentGroup", "quota", "applicants",
    "competition_rate", "additional_admits", "waitlist_last_rank", "additional_metric_type",
    "additional_metric_label", "metric_definition_status", "registered_count", "result_metric_type",
    "result_mean", "result_50", "result_70", "result_75", "result_80", "result_85", "result_90",
    "conversion_score_50", "conversion_score_70", "verification", "sourceUrl", "officeSourceUrl"
  ];

  function clean(value) {
    return String(value ?? "").trim();
  }

  function normalizeItem(source) {
    const item = {};
    TEXT_FIELDS.forEach((field) => { item[field] = clean(source?.[field]); });
    item.suppressedFields = Array.isArray(source?.suppressedFields)
      ? source.suppressedFields.map(clean).filter(Boolean)
      : [];
    item.supplementedFields = Array.isArray(source?.supplementedFields)
      ? source.supplementedFields.map(clean).filter(Boolean)
      : [];
    item.derivedFields = Array.isArray(source?.derivedFields)
      ? source.derivedFields.map(clean).filter(Boolean)
      : [];
    item.searchAlias = source?.searchAlias && typeof source.searchAlias === "object"
      ? JSON.parse(JSON.stringify(source.searchAlias))
      : null;
    item.addedAt = clean(source?.addedAt) || new Date().toISOString();
    return item;
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items.map(normalizeItem).filter((item) => item.id).slice(0, MAX_ITEMS);
    } catch {
      return [];
    }
  }

  function write(items) {
    const normalized = items.map(normalizeItem).filter((item) => item.id).slice(0, MAX_ITEMS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        items: normalized
      }));
    } catch {
      return { saved: false, items: read() };
    }
    window.dispatchEvent(new CustomEvent("admission-comparison-change", { detail: normalized }));
    return { saved: true, items: normalized };
  }

  function add(row) {
    const items = read();
    if (items.some((item) => item.id === clean(row?.id))) return { added: false, reason: "duplicate", items };
    if (items.length >= MAX_ITEMS) return { added: false, reason: "full", items };
    const result = write([...items, row]);
    return { added: result.saved, reason: result.saved ? "added" : "storage", items: result.items };
  }

  function remove(id) {
    const items = read();
    const next = items.filter((item) => item.id !== clean(id));
    if (next.length === items.length) return { removed: false, reason: "not-found", items };
    const result = write(next);
    return { removed: result.saved, reason: result.saved ? "removed" : "storage", items: result.items };
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      return { cleared: false, items: read() };
    }
    window.dispatchEvent(new CustomEvent("admission-comparison-change", { detail: [] }));
    return { cleared: true, items: [] };
  }

  window.AdmissionComparisonStore = Object.freeze({
    STORAGE_KEY,
    MAX_ITEMS,
    read,
    add,
    remove,
    clear
  });
})();
