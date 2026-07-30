(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SusiCardTransfer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CARD_FORMAT = "anjwa-consultation-card";
  const FEEDBACK_FORMAT = "anjwa-consultation-card-feedback";
  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function payloadItems(payload) {
    const standard = (payload.slots || []).map((slot) => slot?.item).filter(Boolean);
    return [...standard, ...(payload.exemptItems || [])];
  }

  function normalizeTeacherPayload(payload) {
    if (!payload || typeof payload !== "object") throw new Error("수시카드 파일 형식이 아닙니다.");
    if (payload.format !== CARD_FORMAT && !Array.isArray(payload.slots) && !Array.isArray(payload.items)) {
      throw new Error("이 플랫폼에서 저장한 수시카드 파일이 아닙니다.");
    }
    const normalized = clone(payload);
    normalized.format = CARD_FORMAT;
    normalized.schemaVersion = Number(normalized.schemaVersion || 2);
    normalized.studentNumber = clean(normalized.studentNumber);
    normalized.academicProfile = normalized.academicProfile && typeof normalized.academicProfile === "object"
      ? normalized.academicProfile
      : { schoolStatus: "current", graduationYear: null };
    normalized.gradeRecords = Array.isArray(normalized.gradeRecords) ? normalized.gradeRecords : [];
    normalized.slots = Array.isArray(normalized.slots) ? normalized.slots : [];
    normalized.exemptItems = Array.isArray(normalized.exemptItems) ? normalized.exemptItems : [];
    if (!normalized.slots.length && Array.isArray(normalized.items)) {
      normalized.slots = normalized.items.slice(0, 9).map((item, index) => ({ slot: index + 1, item }));
    }
    payloadItems(normalized).forEach((item) => {
      item.similarDepartmentCandidates = Array.isArray(item.similarDepartmentCandidates)
        ? item.similarDepartmentCandidates.slice(0, 3)
        : [];
    });
    return normalized;
  }

  function createTeacherFeedback(record, reviewedPayload, exportedAt = new Date().toISOString()) {
    const reviewed = normalizeTeacherPayload(reviewedPayload);
    reviewed.studentNumber = clean(record?.studentNumber || reviewed.studentNumber);
    reviewed.exportedAt = exportedAt;
    return {
      format: FEEDBACK_FORMAT,
      schemaVersion: 1,
      exportedAt,
      studentNumber: clean(record?.studentNumber || reviewed.studentNumber),
      sourceFileName: clean(record?.sourceFileName),
      sourceImportedAt: clean(record?.importedAt),
      reviewedPayload: reviewed,
      teacherChanges: {
        patches: Array.isArray(record?.teacherPatches) ? clone(record.teacherPatches) : [],
        addedItemIds: Array.isArray(record?.teacherAddedItems)
          ? record.teacherAddedItems.map((item) => clean(item?.id)).filter(Boolean)
          : [],
        revisionLog: Array.isArray(record?.revisionLog) ? clone(record.revisionLog) : []
      }
    };
  }

  function normalizeTeacherFeedback(payload) {
    if (!payload || payload.format !== FEEDBACK_FORMAT || !payload.reviewedPayload) {
      throw new Error("교사 피드백 확인본 파일이 아닙니다.");
    }
    const normalized = clone(payload);
    normalized.format = FEEDBACK_FORMAT;
    normalized.schemaVersion = Number(normalized.schemaVersion || 1);
    normalized.exportedAt = clean(normalized.exportedAt);
    normalized.studentNumber = clean(normalized.studentNumber);
    normalized.sourceFileName = clean(normalized.sourceFileName);
    normalized.sourceImportedAt = clean(normalized.sourceImportedAt);
    normalized.reviewedPayload = normalizeTeacherPayload(normalized.reviewedPayload);
    normalized.teacherChanges = {
      patches: Array.isArray(normalized.teacherChanges?.patches) ? normalized.teacherChanges.patches : [],
      addedItemIds: Array.isArray(normalized.teacherChanges?.addedItemIds)
        ? normalized.teacherChanges.addedItemIds.map(clean).filter(Boolean)
        : [],
      revisionLog: Array.isArray(normalized.teacherChanges?.revisionLog) ? normalized.teacherChanges.revisionLog : []
    };
    return normalized;
  }

  function isTeacherFeedback(payload) {
    return Boolean(payload && payload.format === FEEDBACK_FORMAT);
  }

  function applyTeacherFeedback(currentPayload, feedbackPayload, appliedAt = new Date().toISOString()) {
    const feedback = normalizeTeacherFeedback(feedbackPayload);
    const merged = normalizeTeacherPayload(currentPayload);
    const reviewedItems = new Map(payloadItems(feedback.reviewedPayload).map((item) => [clean(item.id), item]));
    const mergedItems = () => new Map(payloadItems(merged).map((item) => [clean(item.id), item]));
    const placeReviewedItem = (item) => {
      if (!item || mergedItems().has(clean(item.id))) return;
      const cloned = clone(item);
      if (cloned.exemptFromSixLimit) {
        merged.exemptItems.push(cloned);
        return;
      }
      let slot = merged.slots.find((candidate) => !candidate?.item);
      if (!slot && merged.slots.length < 9) {
        slot = { slot: merged.slots.length + 1, item: null };
        merged.slots.push(slot);
      }
      if (slot) slot.item = cloned;
    };

    feedback.teacherChanges.patches.forEach((patch) => {
      if (patch.scope === "document") {
        Object.assign(merged, clone(patch.fields || {}));
        return;
      }
      const reviewed = reviewedItems.get(clean(patch.itemId));
      let item = mergedItems().get(clean(patch.itemId));
      if (!item && reviewed) {
        placeReviewedItem(reviewed);
        item = mergedItems().get(clean(patch.itemId));
      }
      if (!item) return;
      Object.assign(item, clone(patch.fields || {}));
      if (Array.isArray(reviewed?.targetOverrideFields)) {
        item.targetOverrideFields = clone(reviewed.targetOverrideFields);
      }
    });
    feedback.teacherChanges.addedItemIds.forEach((id) => placeReviewedItem(reviewedItems.get(clean(id))));
    merged.teacherFeedbackReceipt = {
      appliedAt,
      exportedAt: feedback.exportedAt,
      sourceFileName: feedback.sourceFileName,
      revisionLog: clone(feedback.teacherChanges.revisionLog)
    };
    return merged;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }

  function sameValue(left, right) {
    return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
  }

  function comparableItem(item) {
    const comparable = clone(item || {});
    delete comparable.teacherOfficialCheckedAt;
    return comparable;
  }

  function itemPositionMap(payload) {
    const positions = new Map();
    (payload.slots || []).forEach((slot, index) => {
      if (slot?.item?.id) positions.set(clean(slot.item.id), `일반 ${index + 1}`);
    });
    (payload.exemptItems || []).forEach((item, index) => {
      if (item?.id) positions.set(clean(item.id), `별도 ${index + 1}`);
    });
    return positions;
  }

  function itemLabel(item) {
    return [clean(item?.university), clean(item?.targetDepartment || item?.department)].filter(Boolean).join(" · ") || "지원안";
  }

  function compareStudentReturn(reviewedPayload, returnedPayload) {
    const reviewed = normalizeTeacherPayload(reviewedPayload);
    const returned = normalizeTeacherPayload(returnedPayload);
    const changes = [];
    const documentChecks = [
      ["student", "학생 정보 변경", reviewed.academicProfile, returned.academicProfile],
      ["grades", "학생부 성적 변경", reviewed.gradeRecords, returned.gradeRecords],
      ["calculators", "대학별 환산 설정 변경", reviewed.gradeCalculatorSelections || {}, returned.gradeCalculatorSelections || {}],
      ["consultations", "상담 기록 변경", reviewed.consultations || [], returned.consultations || []],
      ["opinion", "담임교사 종합 의견 변경", clean(reviewed.overallOpinion), clean(returned.overallOpinion)]
    ];
    documentChecks.forEach(([type, label, before, after]) => {
      if (!sameValue(before, after)) changes.push({ type, label, scope: "document" });
    });

    const reviewedItems = new Map(payloadItems(reviewed).map((item) => [clean(item.id), item]));
    const returnedItems = new Map(payloadItems(returned).map((item) => [clean(item.id), item]));
    reviewedItems.forEach((item, id) => {
      if (!returnedItems.has(id)) {
        changes.push({ type: "removed", label: `${itemLabel(item)} 삭제`, scope: "item", itemId: id });
        return;
      }
      if (!sameValue(comparableItem(item), comparableItem(returnedItems.get(id)))) {
        changes.push({ type: "updated", label: `${itemLabel(returnedItems.get(id))} 수정`, scope: "item", itemId: id });
      }
    });
    returnedItems.forEach((item, id) => {
      if (!reviewedItems.has(id)) changes.push({ type: "added", label: `${itemLabel(item)} 추가`, scope: "item", itemId: id });
    });

    const reviewedPositions = itemPositionMap(reviewed);
    const returnedPositions = itemPositionMap(returned);
    const moved = [...reviewedPositions.keys()].filter((id) => (
      returnedPositions.has(id) && reviewedPositions.get(id) !== returnedPositions.get(id)
    ));
    if (moved.length) changes.push({ type: "order", label: "지원 순위 변경", scope: "document" });

    return {
      hasChanges: changes.length > 0,
      total: changes.length,
      changes
    };
  }

  return Object.freeze({
    CARD_FORMAT,
    FEEDBACK_FORMAT,
    normalizeTeacherPayload,
    createTeacherFeedback,
    normalizeTeacherFeedback,
    isTeacherFeedback,
    applyTeacherFeedback,
    compareStudentReturn,
    payloadItems
  });
});
