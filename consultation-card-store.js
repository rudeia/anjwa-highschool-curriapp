(function () {
  "use strict";

  const STORAGE_KEY = "anjwa.admissionConsultationCard.v1";
  const VERSION = 6;
  const BASE_SLOT_COUNT = 6;
  const MAX_STANDARD_SLOTS = 9;
  const CONSULTATION_COUNT = 3;
  const OVERRIDE_FIELDS = ["quota", "selectionMethod", "minimum"];
  const EXEMPT_UNIVERSITY_ALIASES = [
    ["한국과학기술원", "카이스트", "KAIST"],
    ["광주과학기술원", "지스트", "GIST"],
    ["대구경북과학기술원", "디지스트", "DGIST"],
    ["울산과학기술원", "유니스트", "UNIST"],
    ["한국에너지공과대학교", "한국에너지공과대", "켄텍", "KENTECH"],
    ["한국전통문화대학교", "한국전통문화대"]
  ];

  function clean(value) {
    return String(value ?? "").trim();
  }

  function loose(value) {
    return clean(value).toLocaleUpperCase("ko").replace(/\s|[()\[\]{}.,·・\-_]/g, "").replace(/대학교$/u, "대");
  }

  function isExemptUniversity(university) {
    const target = loose(university);
    if (!target) return false;
    return EXEMPT_UNIVERSITY_ALIASES.some((aliases) => aliases.some((alias) => loose(alias) === target));
  }

  function historyEntry(entry) {
    const suppressedFields = Array.isArray(entry.suppressedFields) ? entry.suppressedFields.map(clean).filter(Boolean) : [];
    const supplementedFields = Array.isArray(entry.supplementedFields) ? entry.supplementedFields.map(clean).filter(Boolean) : [];
    return {
      id: clean(entry.id),
      year: clean(entry.year),
      category: clean(entry.category),
      admission: clean(entry.admission),
      department: clean(entry.department),
      quota: clean(entry.quota),
      competitionRate: clean(entry.competitionRate ?? entry.competition_rate),
      resultMetricType: clean(entry.resultMetricType ?? entry.result_metric_type),
      resultMean: clean(entry.resultMean ?? entry.result_mean),
      result50: clean(entry.result50 ?? entry.result_50),
      result70: clean(entry.result70 ?? entry.result_70),
      result75: clean(entry.result75 ?? entry.result_75),
      result80: clean(entry.result80 ?? entry.result_80),
      result85: clean(entry.result85 ?? entry.result_85),
      result90: clean(entry.result90 ?? entry.result_90),
      additionalAdmits: clean(entry.additionalAdmits ?? entry.additional_admits),
      waitlistLastRank: clean(entry.waitlistLastRank ?? entry.waitlist_last_rank),
      verification: clean(entry.verification),
      suppressedFields,
      supplementedFields,
      sourceUrl: clean(entry.sourceUrl),
      officeSourceUrl: clean(entry.officeSourceUrl),
      matchType: clean(entry.matchType)
    };
  }

  function normalizeItem(row, resetLegacyTarget = false) {
    const shouldResetTarget = resetLegacyTarget && clean(row.targetDepartment || row.targetOptionId);
    const targetOverrideFields = Array.isArray(row.targetOverrideFields)
      ? row.targetOverrideFields.map(clean).filter((field) => OVERRIDE_FIELDS.includes(field))
      : [];
    return {
      id: clean(row.id),
      year: clean(row.year),
      targetYear: "2027",
      university: clean(row.university),
      campus: clean(row.campus),
      region: clean(row.region),
      category: clean(row.category),
      admission: clean(row.admission),
      admissionType: clean(row.admissionType),
      department: clean(row.department),
      departmentGroup: clean(row.departmentGroup),
      targetUniversityCode: shouldResetTarget ? "" : clean(row.targetUniversityCode),
      targetDepartment: shouldResetTarget ? "" : clean(row.targetDepartment),
      targetOptionId: shouldResetTarget ? "" : clean(row.targetOptionId),
      targetAdmission: shouldResetTarget ? "" : clean(row.targetAdmission),
      targetCategory: shouldResetTarget ? "" : clean(row.targetCategory),
      targetField: shouldResetTarget ? "" : clean(row.targetField),
      targetQuota: shouldResetTarget ? "" : clean(row.targetQuota),
      targetQuotaStatus: shouldResetTarget ? "" : clean(row.targetQuotaStatus),
      targetSelectionMethod: shouldResetTarget ? "" : clean(row.targetSelectionMethod),
      targetSourceUrl: shouldResetTarget ? "" : clean(row.targetSourceUrl),
      targetMinimum: shouldResetTarget ? "" : clean(row.targetMinimum),
      targetMinimumStatus: shouldResetTarget ? "" : clean(row.targetMinimumStatus),
      targetMinimumOfficial: shouldResetTarget ? "" : clean(row.targetMinimumOfficial),
      targetMinimumSubjects: shouldResetTarget ? "" : clean(row.targetMinimumSubjects),
      targetMinimumSourceUrl: shouldResetTarget ? "" : clean(row.targetMinimumSourceUrl),
      targetOverrideFields: shouldResetTarget ? [] : targetOverrideFields,
      targetQuotaOverride: shouldResetTarget ? "" : clean(row.targetQuotaOverride),
      targetSelectionMethodOverride: shouldResetTarget ? "" : clean(row.targetSelectionMethodOverride),
      targetMinimumOverride: shouldResetTarget ? "" : clean(row.targetMinimumOverride),
      strategy: ["상향", "적정", "안정"].includes(row.strategy) ? row.strategy : "",
      memo: clean(row.memo),
      sourceUrl: clean(row.sourceUrl),
      officeSourceUrl: clean(row.officeSourceUrl),
      history: shouldResetTarget ? [] : (Array.isArray(row.history) ? row.history.map(historyEntry).filter((entry) => entry.year) : []),
      historySuggestions: shouldResetTarget ? [] : (Array.isArray(row.historySuggestions) ? row.historySuggestions.map(historyEntry).filter((entry) => entry.year) : []),
      exemptFromSixLimit: isExemptUniversity(row.university),
      addedAt: clean(row.addedAt) || new Date().toISOString()
    };
  }

  function emptySlot(index) {
    return { slot: index + 1, item: null };
  }

  function normalizeSlots(parsed) {
    const slots = Array.from({ length: MAX_STANDARD_SLOTS }, (_, index) => emptySlot(index));
    const resetLegacyTarget = Number(parsed?.version || 0) < 5;
    if (Array.isArray(parsed?.slots)) {
      parsed.slots.slice(0, MAX_STANDARD_SLOTS).forEach((sourceSlot, index) => {
        if (!sourceSlot?.item) return;
        const normalized = normalizeItem(sourceSlot.item, resetLegacyTarget);
        if (normalized.id && !normalized.exemptFromSixLimit) slots[index].item = normalized;
      });
    } else if (Array.isArray(parsed?.items)) {
      parsed.items.filter((item) => !isExemptUniversity(item?.university)).slice(0, MAX_STANDARD_SLOTS).forEach((item, index) => {
        const normalized = normalizeItem(item, resetLegacyTarget);
        if (normalized.id) slots[index].item = normalized;
      });
    }
    return slots;
  }

  function normalizeExemptItems(parsed) {
    const resetLegacyTarget = Number(parsed?.version || 0) < 5;
    const source = Array.isArray(parsed?.exemptItems)
      ? parsed.exemptItems
      : Array.isArray(parsed?.items)
        ? parsed.items.filter((item) => isExemptUniversity(item?.university))
        : [];
    return source.map((item) => normalizeItem(item, resetLegacyTarget)).filter((item) => item.id);
  }

  function normalizeConsultation(entry, index) {
    return {
      id: `CONSULT-${index + 1}`,
      date: clean(entry?.date),
      topics: clean(entry?.topics),
      notes: clean(entry?.notes),
      nextAction: clean(entry?.nextAction),
      studentConfirmed: Boolean(entry?.studentConfirmed),
      guardianConfirmed: Boolean(entry?.guardianConfirmed)
    };
  }

  function normalizeConsultations(source) {
    const entries = Array.isArray(source) ? source : [];
    return Array.from({ length: CONSULTATION_COUNT }, (_, index) => normalizeConsultation(entries[index], index));
  }

  function documentFields(source) {
    return {
      studentNumber: clean(source?.studentNumber),
      consultations: normalizeConsultations(source?.consultations),
      overallOpinion: clean(source?.overallOpinion),
      lastExportedAt: clean(source?.lastExportedAt),
      lastPrintedAt: clean(source?.lastPrintedAt)
    };
  }

  function visibleSlotCount(slots) {
    const highestOccupied = slots.reduce((highest, slot, index) => slot.item ? index + 1 : highest, 0);
    let visible = BASE_SLOT_COUNT;
    if (slots.slice(0, BASE_SLOT_COUNT).every((slot) => slot.item)) visible = 7;
    if (slots[6]?.item) visible = 8;
    if (slots[7]?.item || slots[8]?.item) visible = 9;
    return Math.max(visible, highestOccupied, BASE_SLOT_COUNT);
  }

  function stateFromParts(slots, exemptItems, updatedAt, source = {}) {
    const standardItems = slots.map((slot) => slot.item).filter(Boolean);
    const document = documentFields(source);
    return {
      version: VERSION,
      updatedAt: clean(updatedAt),
      slots,
      exemptItems,
      standardItems,
      items: [...standardItems, ...exemptItems],
      visibleSlotCount: visibleSlotCount(slots),
      standardFull: standardItems.length >= MAX_STANDARD_SLOTS,
      ...document
    };
  }

  function emptyState() {
    return stateFromParts(Array.from({ length: MAX_STANDARD_SLOTS }, (_, index) => emptySlot(index)), [], "", {});
  }

  function normalizeState(source) {
    return stateFromParts(normalizeSlots(source), normalizeExemptItems(source), source?.updatedAt, source);
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed) return emptyState();
      const state = normalizeState(parsed);
      if (Number(parsed.version || 0) < VERSION) write(state);
      return state;
    } catch (error) {
      return emptyState();
    }
  }

  function write(state) {
    const slots = normalizeSlots({ ...state, version: VERSION });
    const exemptItems = normalizeExemptItems({ ...state, version: VERSION });
    const document = documentFields(state);
    const persisted = { version: VERSION, updatedAt: new Date().toISOString(), slots, exemptItems, ...document };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    const next = stateFromParts(slots, exemptItems, persisted.updatedAt, persisted);
    window.dispatchEvent(new CustomEvent("consultation-card-change", { detail: next }));
    return next;
  }

  function generatedId(prefix = "PLAN") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function upsertSlot(slotNumber, changes) {
    const state = read();
    const index = Number(slotNumber) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= MAX_STANDARD_SLOTS) {
      return { updated: false, reason: "invalid-slot", state };
    }
    if (index >= state.visibleSlotCount) return { updated: false, reason: "locked", state };
    const existing = state.slots[index].item;
    const item = normalizeItem({ ...existing, ...changes, id: existing?.id || clean(changes?.id) || generatedId(`PLAN${slotNumber}`) });
    if (!item.university) {
      state.slots[index].item = null;
      return { updated: true, reason: "cleared", bucket: "standard", slot: slotNumber, state: write(state) };
    }
    if (item.exemptFromSixLimit) {
      state.slots[index].item = null;
      state.exemptItems.push(item);
      return { updated: true, reason: "moved-exempt", bucket: "exempt", slot: state.exemptItems.length, state: write(state), item };
    }
    state.slots[index].item = item;
    return { updated: true, reason: existing ? "updated" : "created", bucket: "standard", slot: slotNumber, state: write(state), item };
  }

  function addExempt(changes) {
    const state = read();
    const item = normalizeItem({ ...changes, id: clean(changes?.id) || generatedId("EXEMPT") });
    if (!item.university || !item.exemptFromSixLimit) return { added: false, reason: "not-exempt", state };
    state.exemptItems.push(item);
    return { added: true, reason: "added-exempt", bucket: "exempt", slot: state.exemptItems.length, state: write(state), item };
  }

  function place(row, preferredSlot) {
    const state = read();
    const item = normalizeItem({ ...row, id: clean(row.id) || generatedId("SEARCH") });
    if (state.items.some((saved) => saved.id === item.id)) return { added: false, reason: "duplicate", state };
    if (item.exemptFromSixLimit) {
      state.exemptItems.push(item);
      return { added: true, reason: "added-exempt", bucket: "exempt", slot: state.exemptItems.length, state: write(state) };
    }
    const requestedIndex = Number(preferredSlot) - 1;
    let index = -1;
    if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < MAX_STANDARD_SLOTS) {
      if (requestedIndex >= state.visibleSlotCount) return { added: false, reason: "locked", state };
      index = requestedIndex;
    } else {
      index = state.slots.slice(0, state.visibleSlotCount).findIndex((slot) => !slot.item);
      if (index < 0 && state.visibleSlotCount < MAX_STANDARD_SLOTS) index = state.visibleSlotCount;
    }
    if (index < 0) return { added: false, reason: "full", state };
    if (state.slots[index].item) return { added: false, reason: "occupied", state };
    state.slots[index].item = item;
    return { added: true, reason: "added", bucket: "standard", slot: index + 1, state: write(state) };
  }

  function remove(id) {
    const state = read();
    const slot = state.slots.find((candidate) => candidate.item?.id === id);
    if (slot) slot.item = null;
    const before = state.exemptItems.length;
    state.exemptItems = state.exemptItems.filter((item) => item.id !== id);
    if (!slot && before === state.exemptItems.length) return state;
    return write(state);
  }

  function update(id, changes) {
    const state = read();
    const slot = state.slots.find((candidate) => candidate.item?.id === id);
    if (slot) slot.item = normalizeItem({ ...slot.item, ...changes, id });
    const exemptIndex = state.exemptItems.findIndex((item) => item.id === id);
    if (exemptIndex >= 0) state.exemptItems[exemptIndex] = normalizeItem({ ...state.exemptItems[exemptIndex], ...changes, id });
    if (!slot && exemptIndex < 0) return state;
    return write(state);
  }

  function updateDocument(changes) {
    const state = read();
    return write({ ...state, ...changes });
  }

  function updateConsultation(index, changes) {
    const state = read();
    const position = Number(index);
    if (!Number.isInteger(position) || position < 0 || position >= CONSULTATION_COUNT) return state;
    state.consultations[position] = normalizeConsultation({ ...state.consultations[position], ...changes }, position);
    return write(state);
  }

  function exportData(exportedAt = new Date().toISOString()) {
    const state = read();
    const next = write({ ...state, lastExportedAt: exportedAt });
    return {
      format: "anjwa-consultation-card",
      schemaVersion: 1,
      exportedAt,
      version: VERSION,
      studentNumber: next.studentNumber,
      consultations: next.consultations,
      overallOpinion: next.overallOpinion,
      lastExportedAt: exportedAt,
      lastPrintedAt: next.lastPrintedAt,
      updatedAt: next.updatedAt,
      slots: next.slots,
      exemptItems: next.exemptItems
    };
  }

  function importData(payload) {
    if (!payload || typeof payload !== "object") throw new Error("상담카드 파일이 아닙니다.");
    const supported = payload.format === "anjwa-consultation-card" || Array.isArray(payload.slots) || Array.isArray(payload.items);
    if (!supported) throw new Error("이 앱에서 저장한 상담카드 파일이 아닙니다.");
    const normalized = normalizeState(payload);
    return write({ ...normalized, lastExportedAt: clean(payload.exportedAt || payload.lastExportedAt) });
  }

  function markPrinted(printedAt = new Date().toISOString()) {
    return updateDocument({ lastPrintedAt: printedAt });
  }

  function move(id, targetSlotNumber) {
    const state = read();
    const sourceIndex = state.slots.findIndex((slot) => slot.item?.id === id);
    const targetIndex = Number(targetSlotNumber) - 1;
    if (sourceIndex < 0) return { moved: false, reason: "not-found", state };
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= MAX_STANDARD_SLOTS) {
      return { moved: false, reason: "invalid-slot", state };
    }
    if (targetIndex >= state.visibleSlotCount) return { moved: false, reason: "locked", state };
    if (sourceIndex === targetIndex) return { moved: false, reason: "same-slot", state };
    const displaced = state.slots[targetIndex].item;
    state.slots[targetIndex].item = state.slots[sourceIndex].item;
    state.slots[sourceIndex].item = displaced;
    return {
      moved: true,
      reason: displaced ? "swapped" : "moved",
      from: sourceIndex + 1,
      to: targetIndex + 1,
      state: write(state)
    };
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    const state = emptyState();
    window.dispatchEvent(new CustomEvent("consultation-card-change", { detail: state }));
    return state;
  }

  window.ConsultationCardStore = {
    STORAGE_KEY,
    BASE_SLOT_COUNT,
    MAX_STANDARD_SLOTS,
    EXEMPT_UNIVERSITY_ALIASES,
    CONSULTATION_COUNT,
    OVERRIDE_FIELDS,
    isExemptUniversity,
    read,
    place,
    add: place,
    upsertSlot,
    addExempt,
    remove,
    update,
    updateDocument,
    updateConsultation,
    exportData,
    importData,
    markPrinted,
    move,
    clear
  };
})();
