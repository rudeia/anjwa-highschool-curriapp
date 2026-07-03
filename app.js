const STORAGE_KEY = "anjwa-career-platform-plan-v1";
const curriculumData = window.ANJWA_CURRICULUM_DATA || { plans: {} };
const recommendationData = window.ANJWA_RECOMMENDATION_DATA || { records: [], sources: [] };
const curriculumPlanOrder = ["current2026", "incoming2026", "incoming2025", "incoming2024"];
const curriculumPlanLabels = {
  current2026: "전체 학년(2026학년도 현재)",
  incoming2026: "1학년(2026학년도 신입생)",
  incoming2025: "2학년(2025학년도 신입생)",
  incoming2024: "3학년(2024학년도 신입생)"
};
const recommendationCurriculumPlans = [
  { key: "incoming2026", label: "1학년(2026 신입)", shortLabel: "26신입", standard: "2022", className: "grade-1" },
  { key: "incoming2025", label: "2학년(2025 신입)", shortLabel: "25신입", standard: "2022", className: "grade-2" },
  { key: "incoming2024", label: "3학년(2024 신입)", shortLabel: "24신입", standard: "2015", className: "grade-3" }
];
const curriculumSemesterOrder = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];

const majorOptionGroups = [
  {
    label: "공학·AI·자연",
    options: ["공학계열", "기계공학", "전기전자공학", "반도체공학", "화학공학", "컴퓨터공학", "인공지능", "정보보안", "물리학", "화학", "신소재", "지구과학", "천문우주"]
  },
  {
    label: "생명·의학·보건",
    options: ["의학·보건계열", "의예", "약학", "치의예", "수의예", "간호학과", "보건", "물리치료", "작업치료", "임상병리", "생명과학", "생명공학", "식품공학", "환경생태"]
  },
  {
    label: "인문·사회·상경",
    options: ["인문·사회계열", "국어국문", "정치외교", "사회학", "사회복지", "행정", "법학", "경영", "경제", "국제통상", "빅데이터경영"]
  },
  {
    label: "교육·사관·특수대학",
    options: ["교육", "수학교육", "과학교육", "사범대", "육군사관학교 인문계열", "육군사관학교 자연계열", "사관학교", "국방", "군사"]
  },
  {
    label: "미디어·어문·문화",
    options: ["미디어·광고·어문계열", "미디어", "광고", "신문방송", "언론", "영어영문", "어문", "문화콘텐츠"]
  }
];

const courses = [
  { id: "kor_reading", name: "주제 탐구 독서", area: "국어", category: "진로 선택", credits: 3, offered: true, grades: [1, 2, 3], tracks: ["humanities", "media"] },
  { id: "kor_debate", name: "독서 토론과 글쓰기", area: "국어", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["humanities", "media"] },
  { id: "kor_media", name: "매체 의사소통", area: "국어", category: "융합 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["media"] },
  { id: "kor_film", name: "문학과 영상", area: "국어", category: "융합 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["media"] },
  { id: "math_algebra", name: "대수", area: "수학", category: "일반 선택", credits: 4, offered: true, grades: [1, 2], tracks: ["engineering", "medical"] },
  { id: "math_calc1", name: "미적분Ⅰ", area: "수학", category: "일반 선택", credits: 4, offered: true, grades: [2, 3], tracks: ["engineering", "medical"] },
  { id: "math_calc2", name: "미적분Ⅱ", area: "수학", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering", "medical"] },
  { id: "math_geometry", name: "기하", area: "수학", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering"] },
  { id: "math_ai", name: "인공지능 수학", area: "수학", category: "진로 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["engineering"] },
  { id: "math_stats", name: "확률과 통계", area: "수학", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering", "medical", "humanities"] },
  { id: "soc_politics", name: "정치", area: "사회", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["humanities"] },
  { id: "soc_economics", name: "경제", area: "사회", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["humanities"] },
  { id: "soc_culture", name: "사회와 문화", area: "사회", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["humanities", "media"] },
  { id: "soc_ethics", name: "윤리와 사상", area: "사회", category: "진로 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["humanities"] },
  { id: "soc_issue", name: "사회문제 탐구", area: "사회", category: "융합 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["humanities", "media"] },
  { id: "sci_physics", name: "물리학", area: "과학", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering"] },
  { id: "sci_chemistry", name: "화학", area: "과학", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering", "medical"] },
  { id: "sci_life", name: "생명과학", area: "과학", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["medical"] },
  { id: "sci_earth", name: "지구과학", area: "과학", category: "일반 선택", credits: 3, offered: true, grades: [2, 3], tracks: ["engineering"] },
  { id: "sci_energy", name: "물질과 에너지", area: "과학", category: "진로 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["medical", "engineering"] },
  { id: "sci_cell", name: "세포와 물질대사", area: "과학", category: "진로 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["medical"] },
  { id: "sci_gene", name: "생물의 유전", area: "과학", category: "진로 선택", credits: 3, offered: false, grades: [2, 3], tracks: ["medical"] },
  { id: "eng_presentation", name: "영어 발표와 토론", area: "영어", category: "융합 선택", credits: 3, offered: true, grades: [1, 2, 3], tracks: ["engineering", "medical", "humanities", "media"] },
  { id: "career_project", name: "진로 주제 프로젝트", area: "교양", category: "융합 선택", credits: 2, offered: true, grades: [1, 2, 3], tracks: ["engineering", "medical", "humanities", "media"] }
];

const admissionCards = [
  {
    label: "의미",
    title: "교과 성적 중심 전형",
    body: "학생부 교과전형은 교과 성적을 중심으로 선발한다. 대학에 따라 반영 교과, 반영 과목 수, 학년별 반영 방식이 달라진다."
  },
  {
    label: "준비",
    title: "반영 교과 확인",
    body: "일부 대학은 전 과목을 보지 않고 특정 교과나 상위 과목을 반영한다. 희망 대학의 반영 교과를 반드시 확인해야 한다."
  },
  {
    label: "확장",
    title: "서류 반영 교과전형",
    body: "교과전형이라도 서류를 반영하는 경우가 있다. 이때 전공 관련 과목 선택과 수업 참여 기록이 함께 검토될 수 있다."
  },
  {
    label: "차이",
    title: "종합전형과의 차이",
    body: "교과전형의 서류는 성적을 보완하거나 적합성을 확인하는 성격이 강하고, 종합전형의 서류는 평가의 중심 자료가 된다."
  },
  {
    label: "사례",
    title: "수도권 대학 사례 확인",
    body: "대학별 사례는 매년 달라진다. 플랫폼에서는 대표 유형을 설명하고, 최종 확인은 대학 입학처와 대입정보포털 링크로 연결한다."
  },
  {
    label: "전략",
    title: "쉬운 과목보다 필요한 과목",
    body: "고교학점제에서는 단순 등급 관리만으로 설명하기 어렵다. 희망 전공과 연결된 과목을 선택한 이유가 중요해진다."
  }
];

const competencies = [
  {
    label: "학업역량",
    title: "수업을 통해 배우고 탐구하는 힘",
    body: "과목 성취도, 학습 태도, 문제 해결 과정, 자료 분석, 발표와 토론 참여가 함께 드러난다."
  },
  {
    label: "진로역량",
    title: "관심 분야를 확장하는 흐름",
    body: "희망 전공과 관련된 과목 선택, 독서, 탐구활동, 동아리, 진로활동이 연결될수록 설득력이 커진다."
  },
  {
    label: "공동체역량",
    title: "함께 배우고 실천하는 태도",
    body: "협업, 의사소통, 역할 수행, 갈등 조정, 학교와 지역사회 안에서의 실천 경험이 중요하다."
  },
  {
    label: "세특",
    title: "활동 목록보다 사고 과정",
    body: "세특은 무엇을 했는지보다 수업 안에서 어떻게 생각하고 탐구하며 성장했는지를 보여주는 자료다."
  },
  {
    label: "과목 선택",
    title: "진로와 학업 흐름의 증거",
    body: "전공 관련 과목을 왜 선택했는지, 그 과목에서 어떤 탐구를 했는지가 서류 평가에서 의미를 갖는다."
  },
  {
    label: "면접 대비",
    title: "기록을 설명할 수 있어야 함",
    body: "학생이 작성한 탐구활동과 자기평가서는 면접에서 자신의 활동을 구체적으로 설명하는 기초 자료가 된다."
  }
];

const sechukExamples = {
  motivation: {
    title: "탐구 동기",
    text: "예: 통합과학 수업에서 감염병 확산 그래프를 보며, 같은 감염병도 지역의 의료 접근성에 따라 피해가 달라질 수 있다는 점이 궁금해졌습니다."
  },
  question: {
    title: "탐구 질문",
    text: "예: 의료 접근성이 낮은 지역에서는 어떤 요인이 감염병 대응을 어렵게 만들까? 교통, 병원 수, 고령 인구 비율 중 어떤 변수가 더 크게 작용할까?"
  },
  concept: {
    title: "수업 개념 연결",
    text: "예: 확률과 통계의 자료 분석, 통합사회에서 배운 지역 격차, 생명과학의 감염과 면역 개념을 함께 사용해 질문을 정리했습니다."
  },
  process: {
    title: "탐구 과정",
    text: "예: 공공데이터를 찾아 지역별 병원 수와 고령 인구 비율을 표로 정리하고, 친구들과 변수별 영향 가능성을 토론한 뒤 그래프로 비교했습니다."
  },
  result: {
    title: "결과",
    text: "예: 단순히 병원 수만 보는 것보다 이동 시간, 고령 인구 비율, 예방 정보 접근성이 함께 작용한다는 점을 알게 되었습니다."
  },
  limit: {
    title: "한계",
    text: "예: 사용한 자료가 시·군 단위라 개인별 이동 거리나 실제 진료 경험을 충분히 반영하지 못했습니다. 통계 자료만으로 판단하는 데 한계가 있었습니다."
  },
  follow: {
    title: "후속 활동",
    text: "예: 다음 진로활동에서는 보건소 접근성, 원격 진료, 지역 의료 정책을 조사하고, 사회문제 탐구나 동아리 활동에서 개선 방안을 제안해 볼 수 있습니다."
  }
};

const trackLabels = {
  engineering: "공학",
  medical: "의학·보건",
  humanities: "인문·사회",
  media: "국어·미디어"
};

const state = {
  activeView: "home",
  activeGrade: "1",
  activeCurriculumPlan: "current2026",
  activeCurriculumScope: "semester",
  curriculumSorts: [],
  selectedTrack: "engineering",
  targetMajor: "",
  plan: createEmptyPlan(),
  creative: {
    autonomy: "",
    career: "",
    club: ""
  },
  inquiry: {
    motivation: "",
    question: "",
    result: "",
    followUp: ""
  }
};

function createEmptyPlan() {
  const plan = {};
  ["1", "2", "3"].forEach((grade) => {
    plan[grade] = {};
    ["1", "2"].forEach((semester) => {
      plan[grade][semester] = {
        regular: [],
        joint: []
      };
    });
  });
  return plan;
}

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function getCourse(id) {
  return courses.find((course) => course.id === id);
}

function init() {
  loadState();
  bindNavigation();
  bindControls();
  bindCurriculumSortHeaders();
  bindCurriculumHelp();
  bindSechukFlow();
  renderCurriculumPlanOptions();
  renderAdmissionCards();
  renderCompetencies();
  renderCurriculum();
  renderRecommendationExplorer();
  renderRecommendations();
  renderCoursePool();
  renderPlanner();
  updateFormValues();
  setView("home");
}

function bindNavigation() {
  $all("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function setView(viewId) {
  state.activeView = viewId;
  $all(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $all(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindControls() {
  $("#curriculumPlan").addEventListener("change", (event) => {
    state.activeCurriculumPlan = event.target.value;
    saveState(false);
    renderCurriculum();
  });
  $("#curriculumScope").addEventListener("change", (event) => {
    state.activeCurriculumScope = event.target.value;
    saveState(false);
    renderCurriculum();
  });
  $("#curriculumGrade").addEventListener("change", renderCurriculum);
  $("#curriculumSemester").addEventListener("change", renderCurriculum);
  $("#curriculumSearch").addEventListener("input", renderCurriculum);

  $("#majorRecommendationSelect").addEventListener("change", (event) => {
    $("#majorRecommendationSearch").value = event.target.value;
    renderRecommendationExplorer();
  });
  $("#majorRecommendationSearch").addEventListener("input", () => {
    $("#majorRecommendationSelect").value = "";
    renderRecommendationExplorer();
  });
  $("#subjectRecommendationSelect").addEventListener("change", renderRecommendationExplorer);
  $("#recommendationPlanFilter").addEventListener("change", renderRecommendationExplorer);

  $("#majorTrackSelect").addEventListener("change", (event) => {
    state.selectedTrack = event.target.value;
    renderRecommendations();
    renderCoursePool();
    saveState(false);
  });

  $("#targetMajorInput").addEventListener("input", (event) => {
    state.targetMajor = event.target.value;
    saveState(false);
  });

  $("#courseSearch").addEventListener("input", renderCoursePool);

  $all(".year-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeGrade = button.dataset.grade;
      $all(".year-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.grade === state.activeGrade));
      renderPlanner();
    });
  });

  $("#savePlanButton").addEventListener("click", () => saveState(true));
  $("#printButton").addEventListener("click", printReport);

  [
    ["creativeAutonomy", "creative", "autonomy"],
    ["creativeCareer", "creative", "career"],
    ["creativeClub", "creative", "club"],
    ["inquiryMotivation", "inquiry", "motivation"],
    ["inquiryQuestion", "inquiry", "question"],
    ["inquiryResult", "inquiry", "result"],
    ["inquiryFollowUp", "inquiry", "followUp"]
  ].forEach(([id, group, key]) => {
    $(`#${id}`).addEventListener("input", (event) => {
      state[group][key] = event.target.value;
      saveState(false);
    });
  });
}

function bindCurriculumSortHeaders() {
  $all("[data-curriculum-sort]").forEach((button) => {
    button.addEventListener("click", () => cycleCurriculumSort(button.dataset.curriculumSort));
  });
}

function cycleCurriculumSort(key) {
  const existing = state.curriculumSorts.find((sort) => sort.key === key);
  if (!existing) {
    if (state.curriculumSorts.length >= 2) state.curriculumSorts.shift();
    state.curriculumSorts.push({ key, direction: "asc" });
  } else if (existing.direction === "asc") {
    existing.direction = "desc";
  } else {
    state.curriculumSorts = state.curriculumSorts.filter((sort) => sort.key !== key);
  }
  renderCurriculum();
}

function updateCurriculumSortHeaders() {
  $all("[data-curriculum-sort]").forEach((button) => {
    const sortIndex = state.curriculumSorts.findIndex((sort) => sort.key === button.dataset.curriculumSort);
    const indicator = button.querySelector(".sort-indicator");
    button.classList.toggle("active", sortIndex >= 0);
    if (!indicator) return;
    if (sortIndex < 0) {
      indicator.textContent = "";
      button.removeAttribute("aria-label");
      return;
    }

    const sort = state.curriculumSorts[sortIndex];
    const directionLabel = sort.direction === "asc" ? "오름차순" : "내림차순";
    const label = button.childNodes[0]?.textContent.trim() || button.textContent.trim();
    indicator.textContent = `${sortIndex + 1}${sort.direction === "asc" ? "↑" : "↓"}`;
    button.setAttribute("aria-label", `${label} ${sortIndex + 1}순위 ${directionLabel}`);
  });
}

function bindCurriculumHelp() {
  const button = $("#choiceHelpButton");
  const panel = $("#choiceHelpPanel");
  if (!button || !panel) return;

  button.addEventListener("click", () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
  });
}

function bindSechukFlow() {
  const buttons = $all("[data-sechuk-step]");
  if (!buttons.length) return;

  buttons.forEach((button) => {
    button.addEventListener("click", () => renderSechukExample(button.dataset.sechukStep));
  });
  renderSechukExample(buttons[0].dataset.sechukStep);
}

function renderSechukExample(stepKey) {
  const data = sechukExamples[stepKey];
  const title = $("#sechukExampleTitle");
  const text = $("#sechukExampleText");
  if (!data || !title || !text) return;

  $all("[data-sechuk-step]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sechukStep === stepKey);
  });
  title.textContent = data.title;
  text.textContent = data.text;
}

function renderAdmissionCards() {
  const target = $("#subjectAdmissionCards");
  if (!target) return;
  target.innerHTML = admissionCards
    .map(
      (card) => `
        <article class="info-card">
          <span class="label">${card.label}</span>
          <h3>${card.title}</h3>
          <p>${card.body}</p>
        </article>
      `
    )
    .join("");
}

function renderCompetencies() {
  $("#competencyCards").innerHTML = competencies
    .map(
      (card) => `
        <article class="competency-card">
          <span class="label">${card.label}</span>
          <h3>${card.title}</h3>
          <p>${card.body}</p>
        </article>
      `
    )
    .join("");
}

function renderCurriculumPlanOptions() {
  const select = $("#curriculumPlan");
  if (!select) return;
  const options = curriculumPlanOrder
    .filter((key) => curriculumData.plans[key])
    .map((key) => `<option value="${key}">${getCurriculumPlanLabel(key)}</option>`)
    .join("");
  select.innerHTML = options;
  if (!curriculumData.plans[state.activeCurriculumPlan]) {
    state.activeCurriculumPlan = curriculumPlanOrder.find((key) => curriculumData.plans[key]) || "";
  }
  select.value = state.activeCurriculumPlan;
}

function getCurriculumPlanLabel(key) {
  return curriculumPlanLabels[key] || curriculumData.plans[key]?.label || key;
}

function renderCurriculum() {
  const plan = curriculumData.plans[state.activeCurriculumPlan];
  if (!plan) return;

  $("#curriculumPlan").value = state.activeCurriculumPlan;
  $("#curriculumScope").value = state.activeCurriculumScope;
  $("#curriculumPlanTitle").textContent = getCurriculumPlanLabel(state.activeCurriculumPlan);
  $("#curriculumPlanDescription").textContent = plan.description;
  const updatedTarget = $("#curriculumUpdatedDate");
  if (updatedTarget) updatedTarget.textContent = formatDateLabel(curriculumData.updated);

  const scope = $("#curriculumScope").value;
  $("#curriculumCourseSectionTitle").textContent = getCurriculumCourseSectionTitle(scope);
  const grade = $("#curriculumGrade").value;
  const semester = $("#curriculumSemester").value;
  const semesterKeys = getCurriculumSemesterKeys(scope, grade, semester);
  const query = normalizeText($("#curriculumSearch").value);
  updateCurriculumScopeControls(scope);

  const allScopeCourses = plan.courses
    .filter((course) => course.semesters.some((semesterKey) => semesterKeys.includes(semesterKey)))
    .sort((a, b) => a.row - b.row);
  const semesterCourses = allScopeCourses
    .filter((course) => {
      if (!query) return true;
      return normalizeText(`${course.name} ${course.area} ${course.category} ${course.section}`).includes(query);
    });
  const choiceGroups = buildCurriculumChoiceGroups(plan.courses, semesterKeys);
  const courseGroupMap = buildCourseChoiceGroupMap(choiceGroups);
  const visibleCourses = sortCurriculumCourses(semesterCourses, semesterKeys, courseGroupMap);

  renderCurriculumSummary(plan, semesterKeys, semesterCourses);
  updateCurriculumSortHeaders();
  $("#curriculumTableBody").innerHTML = semesterCourses.length
    ? visibleCourses.map((course) => renderCurriculumRow(course, semesterKeys, courseGroupMap.get(course.id) || [])).join("")
    : `<tr><td colspan="6">해당 조건에 맞는 과목이 없습니다.</td></tr>`;
  renderCurriculumChoiceGroups(choiceGroups, semesterCourses, Boolean(query));
}

function renderCurriculumSummary(plan, semesterKeys, semesterCourses) {
  const summary = getCurriculumSummaryForScope(plan, semesterKeys);
  const fixedCount = semesterCourses.filter((course) => course.section.includes("학교지정")).length;
  const choiceCount = semesterCourses.filter((course) => course.section.includes("학생선택")).length;
  const jointCount = semesterCourses.filter((course) => course.section.includes("공동교육")).length;
  const totalLabel = semesterKeys.length === 1 ? "학기 총학점" : "범위 총학점";
  $("#curriculumSummary").innerHTML = `
    <span><b>${summary.courseCredits || "-"}</b>교과 이수학점</span>
    <span><b>${summary.creativeCredits || "3"}</b>창체</span>
    <span><b>${summary.totalCredits || "-"}</b>${totalLabel}</span>
    <span><b>${semesterKeys.length}</b>조회 학기</span>
    <span><b>${semesterCourses.length}</b>표시 과목</span>
    <span><b>${fixedCount}/${choiceCount}/${jointCount}</b>지정·선택·공동</span>
  `;
}

function renderCurriculumRow(course, semesterKeys, groupInfos) {
  const rowClass = groupInfos.length ? ` class="choice-linked-row ${groupInfos[0].colorClass}"` : "";
  const sectionClass = [
    getCurriculumSectionClass(course, semesterKeys),
    getCurriculumGradeClass(course, semesterKeys),
    getCurriculumGradeLabel(course, semesterKeys) ? "has-grade" : ""
  ].filter(Boolean).join(" ");
  return `
    <tr${rowClass}>
      <td><span class="section-badge ${sectionClass}">${formatCurriculumSectionLabel(course, semesterKeys)}</span></td>
      <td>${renderSemesterChoiceBadges(course, semesterKeys, groupInfos)}</td>
      <td>${escapeHtml(course.area)}</td>
      <td>${escapeHtml(course.category)}</td>
      <td><strong>${escapeHtml(course.name)}</strong></td>
      <td>${course.credits || "-"}</td>
    </tr>
  `;
}

function buildCurriculumChoiceGroups(allCourses, semesterKeys) {
  return semesterKeys.flatMap((semesterKey) => buildCurriculumChoiceGroupsForSemester(allCourses, semesterKey));
}

function buildCurriculumChoiceGroupsForSemester(allCourses, semesterKey) {
  const semesterCourses = allCourses
    .filter((course) => course.semesters.includes(semesterKey))
    .sort((a, b) => a.row - b.row);
  const groups = [];
  let currentGroup = null;
  let previousKey = "";
  let previousRow = null;

  semesterCourses.forEach((course) => {
    const marker = course.markers[semesterKey] || "";
    if (!marker.includes("택")) {
      currentGroup = null;
      previousKey = "";
      previousRow = null;
      return;
    }
    const key = `${marker} · ${course.section}`;
    const isSeparated = previousRow !== null && course.row !== previousRow + 1;
    if (!currentGroup || key !== previousKey || isSeparated) {
      currentGroup = {
        label: key,
        marker,
        section: course.section,
        semesterKey,
        courses: [],
        ...getChoiceMarkerMeta(marker)
      };
      groups.push(currentGroup);
    }
    currentGroup.courses.push(course);
    previousKey = key;
    previousRow = course.row;
  });

  return groups.map((group, index) => ({
    id: `${group.semesterKey}-choice-${index + 1}`,
    label: group.label,
    shortLabel: `선택 ${getChoiceGroupLetter(index)}`,
    choiceIndex: index,
    colorClass: `choice-group-${(index % 6) + 1}`,
    marker: group.marker,
    section: group.section,
    semesterKey: group.semesterKey,
    semesterLabel: getSemesterLabel(group.semesterKey),
    choiceText: group.choiceText,
    creditText: group.creditText,
    courses: group.courses
  }));
}

function buildCourseChoiceGroupMap(choiceGroups) {
  const groupMap = new Map();
  choiceGroups.forEach((group) => {
    group.courses.forEach((course) => {
      if (!groupMap.has(course.id)) groupMap.set(course.id, []);
      groupMap.get(course.id).push(group);
    });
  });
  return groupMap;
}

function sortCurriculumCourses(courses, semesterKeys, courseGroupMap) {
  return [...courses].sort((a, b) => {
    for (const sort of state.curriculumSorts) {
      const result = compareCurriculumBySort(a, b, sort, semesterKeys, courseGroupMap);
      if (result !== 0) return result;
    }
    return compareDefaultCurriculumCourses(a, b, semesterKeys, courseGroupMap);
  });
}

function compareCurriculumBySort(a, b, sort, semesterKeys, courseGroupMap) {
  if (sort.key === "section") {
    return compareSortTuples(
      [getCurriculumSectionSortOrder(a, semesterKeys), getCourseSortGrade(a, semesterKeys)],
      [getCurriculumSectionSortOrder(b, semesterKeys), getCourseSortGrade(b, semesterKeys)],
      sort.direction
    );
  }
  if (sort.key === "choice") return compareChoiceSort(a, b, sort.direction, courseGroupMap);
  if (sort.key === "area") return compareTextSort(a.area, b.area, sort.direction);
  if (sort.key === "category") return compareTextSort(a.category, b.category, sort.direction);
  if (sort.key === "name") return compareTextSort(a.name, b.name, sort.direction);
  if (sort.key === "credits") return compareNumberSort(a.credits, b.credits, sort.direction);
  return 0;
}

function compareDefaultCurriculumCourses(a, b, semesterKeys, courseGroupMap) {
  const sectionCompare = getCurriculumSectionSortOrder(a, semesterKeys) - getCurriculumSectionSortOrder(b, semesterKeys);
  if (sectionCompare !== 0) return sectionCompare;

  const gradeCompare = getCourseSortGrade(a, semesterKeys) - getCourseSortGrade(b, semesterKeys);
  if (gradeCompare !== 0) return gradeCompare;

  const semesterCompare = getCourseSortSemesterIndex(a, semesterKeys, courseGroupMap) - getCourseSortSemesterIndex(b, semesterKeys, courseGroupMap);
  if (semesterCompare !== 0) return semesterCompare;

  const choiceCompare = getCourseSortChoiceIndex(a, courseGroupMap) - getCourseSortChoiceIndex(b, courseGroupMap);
  if (choiceCompare !== 0) return choiceCompare;

  if (a.row !== b.row) return a.row - b.row;
  return String(a.name).localeCompare(String(b.name), "ko", { numeric: true });
}

function compareChoiceSort(a, b, direction, courseGroupMap) {
  const aGroup = getPrimaryChoiceGroup(courseGroupMap.get(a.id) || []);
  const bGroup = getPrimaryChoiceGroup(courseGroupMap.get(b.id) || []);
  if (!aGroup && !bGroup) return 0;
  if (!aGroup) return 1;
  if (!bGroup) return -1;
  return compareSortTuples(
    [getSemesterSortIndex(aGroup.semesterKey), aGroup.choiceIndex ?? 999],
    [getSemesterSortIndex(bGroup.semesterKey), bGroup.choiceIndex ?? 999],
    direction
  );
}

function compareTextSort(a, b, direction) {
  const aValue = String(a || "").trim();
  const bValue = String(b || "").trim();
  if (!aValue && !bValue) return 0;
  if (!aValue) return 1;
  if (!bValue) return -1;
  const result = aValue.localeCompare(bValue, "ko", { numeric: true });
  return direction === "asc" ? result : -result;
}

function compareNumberSort(a, b, direction) {
  const aValue = Number(a || 0);
  const bValue = Number(b || 0);
  const result = aValue - bValue;
  return direction === "asc" ? result : -result;
}

function compareSortTuples(aValues, bValues, direction) {
  for (let index = 0; index < aValues.length; index += 1) {
    const aValue = aValues[index];
    const bValue = bValues[index];
    const result = typeof aValue === "string" || typeof bValue === "string"
      ? String(aValue || "").localeCompare(String(bValue || ""), "ko", { numeric: true })
      : Number(aValue || 0) - Number(bValue || 0);
    if (result !== 0) return direction === "asc" ? result : -result;
  }
  return 0;
}

function getCurriculumSectionSortOrder(course, semesterKeys) {
  if (course.section.includes("공동교육") || course.section.includes("추가")) return 3;
  if (course.section.includes("학생선택")) return 2;
  if (course.section.includes("학교지정") && courseHasChoiceMarker(course, semesterKeys)) return 1;
  if (course.section.includes("학교지정")) return 0;
  return 4;
}

function getCourseSortGrade(course, semesterKeys) {
  const gradeLabel = getCurriculumGradeLabel(course, semesterKeys);
  const match = gradeLabel.match(/([123])학년/);
  return match ? Number(match[1]) : 9;
}

function getCourseSortSemesterIndex(course, semesterKeys, courseGroupMap) {
  const group = getPrimaryChoiceGroup(courseGroupMap.get(course.id) || []);
  const semesterKey = group?.semesterKey || getCoursePrimarySemesterKey(course, semesterKeys);
  return getSemesterSortIndex(semesterKey);
}

function getCourseSortChoiceIndex(course, courseGroupMap) {
  const group = getPrimaryChoiceGroup(courseGroupMap.get(course.id) || []);
  return group ? group.choiceIndex ?? 999 : 999;
}

function getPrimaryChoiceGroup(groups) {
  return [...groups].sort((a, b) => {
    const semesterCompare = getSemesterSortIndex(a.semesterKey) - getSemesterSortIndex(b.semesterKey);
    if (semesterCompare !== 0) return semesterCompare;
    return (a.choiceIndex ?? 999) - (b.choiceIndex ?? 999);
  })[0] || null;
}

function getSemesterSortIndex(semesterKey) {
  const index = curriculumSemesterOrder.indexOf(semesterKey);
  return index === -1 ? 99 : index;
}

function renderCurriculumChoiceGroups(choiceGroups, visibleCourses, hasQuery) {
  const visibleIds = new Set(visibleCourses.map((course) => course.id));
  const visibleGroups = hasQuery
    ? choiceGroups.filter((group) => group.courses.some((course) => visibleIds.has(course.id)))
    : choiceGroups;
  const displayGroups = mergeYearLinkedChoiceGroups(visibleGroups);

  $("#curriculumChoiceGroups").innerHTML = displayGroups.length
    ? displayGroups
        .map(
          (group) => `
            <article class="choice-group-card ${group.colorClass}">
              <div class="choice-group-title">
                ${renderChoiceBadge(group)}
                <b>${escapeHtml(getChoiceGroupSectionLabel(group))}</b>
                ${group.creditText ? `<small>${escapeHtml(`${group.creditText} 편성`)}</small>` : ""}
              </div>
              <div class="tag-list">
                ${group.courses.map((course) => `<span class="tag ${visibleIds.has(course.id) ? "selected" : ""}">${escapeHtml(course.name)} · ${course.credits}학점</span>`).join("")}
              </div>
            </article>
          `
        )
        .join("")
    : `<div class="empty-note">${hasQuery ? "검색된 과목에 연결된 선택 묶음이 없습니다." : "이 학기에는 선택 묶음 표시가 없습니다."}</div>`;
}

function getCurriculumSemesterKeys(scope, grade, semester) {
  if (scope === "plan") return curriculumSemesterOrder;
  if (scope === "semesterAllGrades") return ["1", "2", "3"].map((gradeKey) => `${gradeKey}-${semester}`);
  if (scope === "grade") return [`${grade}-1`, `${grade}-2`];
  return [`${grade}-${semester}`];
}

function getCurriculumCourseSectionTitle(scope) {
  if (scope === "plan") return "전체 교육과정 과목";
  if (scope === "semesterAllGrades") return "선택 학기 전학년 과목";
  if (scope === "grade") return "해당 학년 전체 과목";
  return "해당 학기 과목";
}

function updateCurriculumScopeControls(scope) {
  $("#curriculumGrade").disabled = scope === "plan" || scope === "semesterAllGrades";
  $("#curriculumSemester").disabled = scope === "plan" || scope === "grade";
}

function getCurriculumSummaryForScope(plan, semesterKeys) {
  if (semesterKeys.length === 1) return plan.summary[semesterKeys[0]] || {};
  return semesterKeys.reduce(
    (total, semesterKey) => {
      const summary = plan.summary[semesterKey] || {};
      total.courseCredits += Number(summary.courseCredits || 0);
      total.creativeCredits += Number(summary.creativeCredits || 0);
      total.totalCredits += Number(summary.totalCredits || 0);
      return total;
    },
    { courseCredits: 0, creativeCredits: 0, totalCredits: 0 }
  );
}

function renderSemesterChoiceBadges(course, semesterKeys, groupInfos) {
  if (!groupInfos.length) return renderSemesterBadges(course, semesterKeys);
  const displayGroups = mergeCourseChoiceGroupsForDisplay(course, semesterKeys, groupInfos);
  return `
    <div class="choice-badge-list">
      ${displayGroups
        .map((group) => renderChoiceBadge(group))
        .join("")}
    </div>
  `;
}

function renderSemesterBadges(course, semesterKeys) {
  const semesterLabels = getCourseSemesterLabels(course, semesterKeys);
  if (!semesterLabels.length) return `<span class="choice-badge none">-</span>`;
  return `
    <div class="choice-badge-list">
      ${semesterLabels
        .map((label) => `<span class="choice-badge semester-badge">${escapeHtml(label)}</span>`)
        .join("")}
    </div>
  `;
}

function renderChoiceBadge(group) {
  return `
    <span class="choice-badge ${group.colorClass} has-detail">
      <span>${escapeHtml(group.semesterLabel)}</span>
      <small>${escapeHtml(`${group.shortLabel} 중 ${group.choiceText}`)}</small>
    </span>
  `;
}

function getCourseSemesterLabels(course, semesterKeys) {
  const labels = [];
  const handledSemesters = new Set();

  ["1", "2", "3"].forEach((grade) => {
    const firstSemester = `${grade}-1`;
    const secondSemester = `${grade}-2`;
    if (isCourseYearLinked(course, semesterKeys, firstSemester, secondSemester)) {
      labels.push(getYearLinkedChoiceSemesterLabel(firstSemester));
      handledSemesters.add(firstSemester);
      handledSemesters.add(secondSemester);
    }
  });

  curriculumSemesterOrder.forEach((semesterKey) => {
    if (!semesterKeys.includes(semesterKey) || !course.semesters.includes(semesterKey) || handledSemesters.has(semesterKey)) return;
    labels.push(getSemesterLabel(semesterKey));
  });

  return labels;
}

function mergeCourseChoiceGroupsForDisplay(course, semesterKeys, groups) {
  const usedIds = new Set();
  const merged = [];

  groups.forEach((group) => {
    if (usedIds.has(group.id)) return;
    const pair = findCourseYearLinkedChoicePair(course, semesterKeys, group, groups);
    if (!pair) {
      merged.push(group);
      return;
    }

    const [firstGroup, secondGroup] = [group, pair].sort((a, b) => getSemesterSortIndex(a.semesterKey) - getSemesterSortIndex(b.semesterKey));
    usedIds.add(firstGroup.id);
    usedIds.add(secondGroup.id);
    merged.push({
      ...firstGroup,
      id: `${firstGroup.id}-course-year-linked`,
      semesterLabel: getYearLinkedChoiceSemesterLabel(firstGroup.semesterKey),
      isYearLinked: true
    });
  });

  return merged;
}

function mergeYearLinkedChoiceGroups(groups) {
  const usedIds = new Set();
  const merged = [];

  groups.forEach((group) => {
    if (usedIds.has(group.id)) return;
    const pair = findYearLinkedChoicePair(group, groups);
    if (!pair) {
      merged.push(group);
      return;
    }

    const [firstGroup, secondGroup] = [group, pair].sort((a, b) => getSemesterSortIndex(a.semesterKey) - getSemesterSortIndex(b.semesterKey));
    usedIds.add(firstGroup.id);
    usedIds.add(secondGroup.id);
    merged.push({
      ...firstGroup,
      id: `${firstGroup.id}-year-linked`,
      semesterLabel: getYearLinkedChoiceSemesterLabel(firstGroup.semesterKey),
      isYearLinked: true
    });
  });

  return merged;
}

function findYearLinkedChoicePair(group, groups) {
  const [grade, semester] = group.semesterKey.split("-");
  const otherSemesterKey = `${grade}-${semester === "1" ? "2" : "1"}`;
  const courseKey = getChoiceGroupCourseKey(group);
  return groups.find((candidate) => (
    candidate.id !== group.id &&
    candidate.semesterKey === otherSemesterKey &&
    candidate.marker === group.marker &&
    candidate.section === group.section &&
    getChoiceGroupCourseKey(candidate) === courseKey
  ));
}

function findCourseYearLinkedChoicePair(course, semesterKeys, group, groups) {
  const [grade, semester] = group.semesterKey.split("-");
  const otherSemesterKey = `${grade}-${semester === "1" ? "2" : "1"}`;
  if (!isCourseYearLinked(course, semesterKeys, group.semesterKey, otherSemesterKey)) return null;
  return groups.find((candidate) => (
    candidate.id !== group.id &&
    candidate.semesterKey === otherSemesterKey &&
    candidate.marker === group.marker &&
    candidate.section === group.section &&
    candidate.shortLabel === group.shortLabel &&
    candidate.courses.some((candidateCourse) => candidateCourse.id === course.id)
  ));
}

function getChoiceGroupCourseKey(group) {
  return group.courses.map((course) => course.id).sort().join("|");
}

function isCourseYearLinked(course, semesterKeys, firstSemester, secondSemester) {
  if (!semesterKeys.includes(firstSemester) || !semesterKeys.includes(secondSemester)) return false;
  if (!course.semesters.includes(firstSemester) || !course.semesters.includes(secondSemester)) return false;
  const firstMarker = String(course.markers?.[firstSemester] || "").trim();
  const secondMarker = String(course.markers?.[secondSemester] || "").trim();
  return Boolean(firstMarker && firstMarker === secondMarker);
}

function getYearLinkedChoiceSemesterLabel(semesterKey) {
  const [grade] = semesterKey.split("-");
  return `${grade}학년(학년제 편성)`;
}

function getSemesterLabel(semesterKey) {
  const [grade, semester] = semesterKey.split("-");
  return `${grade}학년 ${semester}학기`;
}

function getChoiceGroupLetter(index) {
  return String.fromCharCode(65 + index);
}

function getChoiceMarkerMeta(marker) {
  const match = marker.match(/\[?\s*택\s*(\d+)\s*\]?\s*\/\s*(\d+)/);
  if (!match) {
    return {
      choiceText: marker || "선택",
      creditText: ""
    };
  }
  return {
    choiceText: `${match[1]}개 선택`,
    creditText: `${match[2]}학점`
  };
}

function getChoiceGroupSectionLabel(group) {
  const base = group.section.replace(/\s*\(.+?\)\s*/g, "").replace(/\s+/g, " ").trim();
  if (base.includes("학교지정") && String(group.marker || "").includes("택")) return "지정선택";
  return base;
}

function getCurriculumSectionClass(course, semesterKeys) {
  if (course.section.includes("공동교육") || course.section.includes("추가")) return "joint";
  if (course.section.includes("학생선택")) return "choice";
  if (course.section.includes("학교지정") && courseHasChoiceMarker(course, semesterKeys)) return "fixed fixed-choice";
  return "fixed";
}

function getCurriculumGradeClass(course, semesterKeys) {
  const sectionGrade = course.section.match(/([123])학년/);
  if (sectionGrade) return `grade-${sectionGrade[1]}`;
  const activeSemester = getCoursePrimarySemesterKey(course, semesterKeys);
  if (!activeSemester) return "";
  return `grade-${activeSemester.split("-")[0]}`;
}

function formatCurriculumSectionLabel(course, semesterKeys) {
  const baseLabel = getCurriculumSectionBaseLabel(course, semesterKeys);
  const gradeLabel = getCurriculumGradeLabel(course, semesterKeys);
  if (!gradeLabel) return escapeHtml(baseLabel);
  return `${escapeHtml(baseLabel)}<small>(${escapeHtml(gradeLabel)})</small>`;
}

function getCurriculumSectionBaseLabel(course, semesterKeys) {
  const base = course.section.replace(/\s*\(.+?\)\s*/g, "").replace(/\s+/g, " ").trim();
  if (base.includes("학교지정") && courseHasChoiceMarker(course, semesterKeys)) return "지정선택";
  return base;
}

function getCurriculumGradeLabel(course, semesterKeys) {
  const sectionGrade = course.section.match(/([123])학년/);
  if (sectionGrade) return `${sectionGrade[1]}학년`;
  const activeSemester = getCoursePrimarySemesterKey(course, semesterKeys);
  if (!activeSemester) return "";
  return `${activeSemester.split("-")[0]}학년`;
}

function getCoursePrimarySemesterKey(course, semesterKeys) {
  return curriculumSemesterOrder.find((semesterKey) => semesterKeys.includes(semesterKey) && course.semesters.includes(semesterKey)) || "";
}

function courseHasChoiceMarker(course, semesterKeys) {
  return semesterKeys.some((semesterKey) => String(course.markers?.[semesterKey] || "").includes("택"));
}

function renderRecommendations() {
  const recommended = courses.filter((course) => course.tracks.includes(state.selectedTrack));
  $("#recommendBox").innerHTML = `
    <strong>${trackLabels[state.selectedTrack]} 계열 추천 과목</strong>
    <div class="tag-list">
      ${recommended
        .slice(0, 8)
        .map((course) => `<span class="tag">${course.name}</span>`)
        .join("")}
    </div>
  `;
}

function renderRecommendationExplorer() {
  const searchInput = $("#majorRecommendationSearch");
  const majorSelect = $("#majorRecommendationSelect");
  const subjectSelect = $("#subjectRecommendationSelect");
  if (!searchInput || !majorSelect || !subjectSelect) return;

  renderMajorRecommendationOptions(majorSelect);
  renderMajorSuggestionList();
  renderSubjectRecommendationOptions(subjectSelect);
  renderQuickMajorButtons();

  const query = normalizeText(searchInput.value);
  const majorMatches = query
    ? recommendationData.records.filter((record) => recordMatchesMajor(record, query))
    : getFeaturedRecommendationRecords();
  $("#majorRecommendationResults").innerHTML = `
    <div class="recommendation-result-head">
      <h4>${query ? "학과·계열 검색 결과" : "먼저 보면 좋은 추천 과목 예시"}</h4>
      <span>${majorMatches.length}개</span>
    </div>
    ${majorMatches.length ? majorMatches.map((record) => renderRecommendationCard(record)).join("") : renderEmptyRecommendation("검색어와 맞는 학과·계열을 찾지 못했습니다. 간호, 기계, 미디어처럼 넓게 입력해 보세요.")}
  `;

  const selectedSubject = subjectSelect.value;
  const subjectMatches = selectedSubject
    ? recommendationData.records.filter((record) => recordHasSubject(record, selectedSubject))
    : [];
  $("#subjectRecommendationResults").innerHTML = selectedSubject
    ? `
      <div class="recommendation-result-head">
        <h4>${escapeHtml(selectedSubject)} 과목과 연결되는 학과·계열</h4>
        <span>${subjectMatches.length}개</span>
      </div>
      ${subjectMatches.length ? subjectMatches.map((record) => renderSubjectMatchCard(record, selectedSubject)).join("") : renderEmptyRecommendation("이 과목과 직접 연결된 학과·계열 데이터가 아직 없습니다.")}
    `
    : `
      <div class="empty-note">과목을 선택하면 그 과목을 핵심 또는 권장으로 언급한 학과·계열이 나타납니다.</div>
    `;
  bindMajorQueryButtons();
}

function renderMajorSuggestionList() {
  const datalist = $("#majorSuggestionList");
  if (!datalist) return;
  const names = new Set();
  recommendationData.records.forEach((record) => {
    names.add(record.major);
    record.aliases.forEach((alias) => names.add(alias));
  });
  datalist.innerHTML = [...names].sort((a, b) => a.localeCompare(b, "ko")).map((name) => `<option value="${escapeHtml(name)}"></option>`).join("");
}

function renderMajorRecommendationOptions(select) {
  const currentValue = select.value;
  const optionValues = getAllMajorOptionValues();
  select.innerHTML = `
    <option value="">학과·계열 선택</option>
    ${majorOptionGroups
      .map(
        (group) => `
          <optgroup label="${escapeHtml(group.label)}">
            ${group.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}
          </optgroup>
        `
      )
      .join("")}
  `;
  if (optionValues.includes(currentValue)) {
    select.value = currentValue;
  }
}

function renderSubjectRecommendationOptions(select) {
  const currentValue = select.value;
  const subjects = getAllRecommendationSubjects();
  select.innerHTML = `<option value="">과목 선택</option>${subjects.map((subject) => `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`).join("")}`;
  if (subjects.includes(currentValue)) select.value = currentValue;
}

function renderQuickMajorButtons() {
  const target = $("#quickMajorButtons");
  if (!target || target.dataset.bound === "true") return;
  const quickQueries = [
    { label: "공학", query: "공학" },
    { label: "의학·보건", query: "의학" },
    { label: "간호", query: "간호" },
    { label: "컴퓨터·AI", query: "컴퓨터" },
    { label: "반도체", query: "반도체" },
    { label: "생명·바이오", query: "생명" },
    { label: "인문·사회", query: "인문" },
    { label: "경영·법·행정", query: "경영" },
    { label: "미디어·어문", query: "미디어" },
    { label: "교육", query: "교육" },
    { label: "사관학교", query: "사관학교" }
  ];
  target.innerHTML = `<span>주요 계열</span>${quickQueries.map((item) => `<button type="button" data-major-query="${escapeHtml(item.query)}">${escapeHtml(item.label)}</button>`).join("")}`;
  target.dataset.bound = "true";
}

function bindMajorQueryButtons() {
  $all("[data-major-query]").forEach((button) => {
    button.onclick = () => {
      const query = button.dataset.majorQuery;
      const searchInput = $("#majorRecommendationSearch");
      const majorSelect = $("#majorRecommendationSelect");
      searchInput.value = query;
      if (majorSelect) {
        majorSelect.value = getAllMajorOptionValues().includes(query) ? query : "";
      }
      renderRecommendationExplorer();
    };
  });
}

function getAllMajorOptionValues() {
  return majorOptionGroups.flatMap((group) => group.options);
}

function getAllRecommendationSubjects() {
  const subjects = new Set();
  recommendationData.records.forEach((record) => {
    [...record.coreSubjects, ...record.recommendedSubjects].forEach((subject) => subjects.add(subject));
  });
  return [...subjects].sort((a, b) => a.localeCompare(b, "ko"));
}

function getFeaturedRecommendationRecords() {
  const featuredIds = ["seoul_natural_science_engineering", "general_engineering", "medical_health_general", "english_media_language", "computer_ai_data_security"];
  return featuredIds.map((id) => recommendationData.records.find((record) => record.id === id)).filter(Boolean);
}

function recordMatchesMajor(record, query) {
  const haystack = normalizeText(`${record.major} ${record.field} ${record.aliases.join(" ")}`);
  return haystack.includes(query);
}

function recordHasSubject(record, subject) {
  const target = normalizeText(subject);
  return [...record.coreSubjects, ...record.recommendedSubjects].some((item) => normalizeText(item) === target);
}

function renderRecommendationCard(record) {
  return `
    <article class="recommendation-card">
      <div class="recommendation-card-head">
        <div>
          <span class="label">${escapeHtml(record.field)}</span>
          <h4>${escapeHtml(record.major)}</h4>
        </div>
      </div>
      <div class="subject-badge-section">
        <b>핵심 과목</b>
        ${renderSubjectBadgeRow(record.coreSubjects, "core", "직접 명시된 핵심 과목은 학과별 확인이 필요합니다.")}
      </div>
      <div class="subject-badge-section">
        <b>권장 과목</b>
        ${renderSubjectBadgeRow(record.recommendedSubjects, "recommended", "직접 확인된 권장 과목 자료가 아직 없습니다.")}
      </div>
      <p>${escapeHtml(record.note)}</p>
      <small>출처: ${escapeHtml(record.source)}</small>
    </article>
  `;
}

function renderSubjectBadgeRow(subjects, importance, emptyMessage) {
  if (!subjects.length) return `<div class="empty-note compact">${escapeHtml(emptyMessage)}</div>`;
  return `<div class="subject-badge-row">${renderRecommendedSubjectBadges(subjects, importance)}</div>`;
}

function renderSubjectMatchCard(record, subject) {
  const type = record.coreSubjects.some((item) => normalizeText(item) === normalizeText(subject)) ? "핵심 과목" : "권장 과목";
  return `
    <article class="subject-match-card">
      <div>
        <span class="label">${escapeHtml(type)}</span>
        <h4>${escapeHtml(record.major)}</h4>
        <p>${escapeHtml(record.note)}</p>
      </div>
      <button type="button" data-major-query="${escapeHtml(record.major)}">학과로 보기</button>
    </article>
  `;
}

function renderRecommendedSubjectBadges(subjects, importance) {
  return subjects
    .map((subject) => {
      const availability = getSubjectCurriculumAvailability(subject);
      if (availability.length) {
        return renderSubjectAvailabilityBadges(subject, availability);
      }

      const missingClass = importance === "core" ? "missing-core" : "missing-recommended";
      return `<span class="subject-badge ${missingClass}">${escapeHtml(subject)}<small>${getMissingSubjectLabel()}</small></span>`;
    })
    .join("");
}

function renderSubjectAvailabilityBadges(subject, availability) {
  return groupSubjectAvailabilityByMatchedName(subject, availability)
    .map((group) => {
      const badgeClass = group.plans.length === 1 ? group.plans[0].className : "grade-multi";
      return `<span class="subject-badge ${badgeClass}">${escapeHtml(group.name)}<small>${renderMatchedSubjectAvailabilityLabel(group.plans)}</small></span>`;
    })
    .join("");
}

function groupSubjectAvailabilityByMatchedName(subject, availability) {
  const groups = new Map();
  const sourceKey = normalizeText(subject);

  availability.forEach((plan) => {
    plan.matches.forEach((match) => {
      const matchedName = match.name;
      const key = `${normalizeText(matchedName)}-${plan.standard}`;
      if (!groups.has(key)) {
        groups.set(key, {
          name: matchedName,
          exact: normalizeText(matchedName) === sourceKey,
          plans: []
        });
      }
      groups.get(key).plans.push({
        ...plan,
        courseGradeLabel: getCourseGradeLabelFromSemesters(match.semesters)
      });
    });
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      plans: dedupePlans(group.plans)
    }))
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return getFirstPlanOrder(a.plans) - getFirstPlanOrder(b.plans) || a.name.localeCompare(b.name, "ko");
    });
}

function dedupePlans(plans) {
  const seen = new Set();
  return plans.filter((plan) => {
    const key = `${plan.key}-${plan.courseGradeLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getFirstPlanOrder(plans) {
  return Math.min(...plans.map((plan) => recommendationCurriculumPlans.findIndex((item) => item.key === plan.key)).filter((index) => index >= 0));
}

function getMissingSubjectLabel() {
  const selectedPlan = $("#recommendationPlanFilter")?.value || "all";
  if (selectedPlan === "incoming2024") return "미개설(15)";
  if (selectedPlan === "incoming2025" || selectedPlan === "incoming2026") return "미개설(22)";
  return "미개설(22·15)";
}

function renderEmptyRecommendation(message) {
  return `<div class="empty-note">${escapeHtml(message)}</div>`;
}

function getSubjectCurriculumAvailability(subject) {
  const selectedPlan = $("#recommendationPlanFilter")?.value || "all";
  const plans = selectedPlan === "all"
    ? recommendationCurriculumPlans
    : recommendationCurriculumPlans.filter((plan) => plan.key === selectedPlan);
  return plans
    .map((plan) => ({ ...plan, matches: getSubjectCurriculumMatches(subject, plan.key) }))
    .filter((plan) => plan.matches.length);
}

function renderMatchedSubjectAvailabilityLabel(plans) {
  if (plans.length === 1) return renderPlanCourseLabel(plans[0]);
  return `<span class="availability-marks">${plans.map((plan) => `<span class="availability-mark ${plan.className}">${renderPlanCourseLabel(plan)}</span>`).join("")}</span>`;
}

function renderPlanCourseLabel(plan) {
  return escapeHtml(`${plan.shortLabel} · ${plan.courseGradeLabel || "학년 확인"}`);
}

function getSubjectCurriculumMatches(subject, planKey) {
  const schoolSubjects = getSchoolSubjectMap(planKey);
  const matched = getSubjectCompareNames(subject, planKey)
    .flatMap((name) => schoolSubjects.get(normalizeText(name)) || [])
    .map((course) => ({
      name: course.name,
      semesters: course.semesters || []
    }));
  return dedupeSubjectMatches(matched);
}

function dedupeSubjectMatches(matches) {
  const seen = new Set();
  return matches.filter((match) => {
    const key = `${normalizeText(match.name)}-${(match.semesters || []).join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCourseGradeLabelFromSemesters(semesters) {
  const grades = [...new Set((semesters || []).map((semesterKey) => String(semesterKey).split("-")[0]).filter(Boolean))];
  if (!grades.length) return "";
  if (grades.length === 1) return `${grades[0]}학년`;
  return `${grades.join("·")}학년`;
}

function getSchoolSubjectMap(planKey) {
  if (!getSchoolSubjectMap.cache) getSchoolSubjectMap.cache = {};
  if (getSchoolSubjectMap.cache[planKey]) return getSchoolSubjectMap.cache[planKey];
  const subjects = new Map();
  const plan = curriculumData.plans?.[planKey];
  if (plan) {
    plan.courses.forEach((course) => {
      const key = normalizeText(course.name);
      if (!subjects.has(key)) subjects.set(key, []);
      subjects.get(key).push(course);
    });
  }
  getSchoolSubjectMap.cache[planKey] = subjects;
  return subjects;
}

function getSubjectCompareNames(subject, planKey) {
  const plan = recommendationCurriculumPlans.find((item) => item.key === planKey);
  const to2022 = {
    "미적분": ["미적분Ⅰ", "미적분Ⅱ"],
    "수학Ⅰ": ["대수"],
    "수학Ⅱ": ["미적분Ⅰ"],
    "물리학Ⅰ": ["물리학"],
    "화학Ⅰ": ["화학"],
    "생명과학Ⅰ": ["생명과학"],
    "지구과학Ⅰ": ["지구과학"],
    "화법과 작문": ["화법과 언어", "독서와 작문"],
    "독서": ["독서와 작문", "주제 탐구 독서"],
    "영어Ⅰ": ["공통영어1", "공통영어2"],
    "영어Ⅱ": ["공통영어1", "공통영어2"],
    "세계사(지리)": ["세계사", "세계시민과 지리"],
    "세계지리": ["세계시민과 지리"]
  };
  const to2015 = {
    "대수": ["수학Ⅰ"],
    "미적분Ⅰ": ["수학Ⅱ"],
    "미적분Ⅱ": ["미적분"],
    "물리학": ["물리학Ⅰ", "물리학Ⅱ"],
    "화학": ["화학Ⅰ", "화학Ⅱ"],
    "생명과학": ["생명과학Ⅰ", "생명과학Ⅱ"],
    "지구과학": ["지구과학Ⅰ", "지구과학Ⅱ"],
    "화법과 언어": ["화법과 작문"],
    "독서와 작문": ["독서"],
    "주제 탐구 독서": ["독서"],
    "공통영어1": ["영어Ⅰ"],
    "공통영어2": ["영어Ⅱ"],
    "세계시민과 지리": ["세계지리"]
  };
  const equivalents = plan?.standard === "2015" ? to2015 : to2022;
  return [...new Set([subject, ...(equivalents[subject] || [])])];
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFC")
    .replaceAll("Ⅰ", "1")
    .replaceAll("ⅰ", "1")
    .replaceAll("Ⅱ", "2")
    .replaceAll("ⅱ", "2")
    .replaceAll("Ⅲ", "3")
    .replaceAll("ⅲ", "3")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

function renderCoursePool() {
  const query = $("#courseSearch").value.trim().toLowerCase();
  const filtered = courses.filter((course) => {
    const haystack = `${course.name} ${course.area} ${course.category}`.toLowerCase();
    return haystack.includes(query);
  });

  $("#coursePool").innerHTML = filtered
    .map((course) => {
      const recommended = course.tracks.includes(state.selectedTrack);
      return `
        <div class="course-card ${course.offered ? "" : "extra"} ${recommended ? "recommended" : ""}"
          draggable="true"
          data-course-id="${course.id}">
          <strong>${course.name}</strong>
          <small>${course.area} · ${course.category} · ${course.credits}학점 · ${course.offered ? "학교 개설" : "추가 희망"}</small>
          <div class="quick-add-row">
            <button type="button" data-add-course="${course.id}" data-semester="1">1학기 추가</button>
            <button type="button" data-add-course="${course.id}" data-semester="2">2학기 추가</button>
          </div>
        </div>
      `;
    })
    .join("");

  $all(".course-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", card.dataset.courseId);
    });
  });

  $all("[data-add-course]").forEach((button) => {
    button.addEventListener("click", () => {
      addCourseToPlan(button.dataset.addCourse, state.activeGrade, button.dataset.semester, "regular");
    });
  });
}

function renderPlanner() {
  $("#semesterGrid").innerHTML = ["1", "2"].map((semester) => renderSemesterBoard(state.activeGrade, semester)).join("");
  bindDropZones();
  bindCreditInputs();
  bindRemoveButtons();
  updateFormValues();
}

function renderSemesterBoard(grade, semester) {
  const semesterPlan = state.plan[grade][semester];
  const regularCredits = sumCredits(semesterPlan.regular);
  const jointCredits = sumCredits(semesterPlan.joint);
  const totalWithFixed = regularCredits + 2;
  const badgeClass = totalWithFixed === 31 ? "ok" : "warn";

  return `
    <section class="semester-board">
      <div class="semester-head">
        <div>
          <h3>${grade}학년 ${semester}학기</h3>
          <p>일반 교과 29학점 + 공강 2학점 = 31학점</p>
        </div>
        <span class="credit-badge ${badgeClass}">${totalWithFixed}/31</span>
      </div>
      <div class="drop-zone" data-grade="${grade}" data-semester="${semester}" data-zone="regular">
        <p class="board-label">일반 과목 영역</p>
        ${semesterPlan.regular.map((item, index) => renderPlannedCourse(item, grade, semester, "regular", index)).join("")}
      </div>
      <div class="joint-zone" data-grade="${grade}" data-semester="${semester}" data-zone="joint">
        <p class="board-label">공동교육과정 별도 영역, 최대 6학점</p>
        ${semesterPlan.joint.map((item, index) => renderPlannedCourse(item, grade, semester, "joint", index)).join("")}
      </div>
      <div class="semester-summary">
        <span class="summary-chip"><b>${regularCredits}</b>일반 교과</span>
        <span class="summary-chip"><b>2</b>공강</span>
        <span class="summary-chip"><b>${jointCredits}/6</b>공동교육</span>
      </div>
    </section>
  `;
}

function renderPlannedCourse(item, grade, semester, zone, index) {
  const course = getCourse(item.id);
  if (!course) return "";
  return `
    <div class="planned-course ${course.offered ? "" : "extra"}">
      <div>
        <strong>${course.name}</strong>
        <small>${course.area} · ${course.offered ? "학교 개설" : "추가 희망"}</small>
      </div>
      <input type="number" min="1" max="6" value="${item.credits}" aria-label="${course.name} 학점"
        data-grade="${grade}" data-semester="${semester}" data-zone="${zone}" data-index="${index}">
      <button class="remove-course" type="button" aria-label="${course.name} 삭제"
        data-grade="${grade}" data-semester="${semester}" data-zone="${zone}" data-index="${index}">×</button>
    </div>
  `;
}

function bindDropZones() {
  $all(".drop-zone, .joint-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");
      const courseId = event.dataTransfer.getData("text/plain");
      addCourseToPlan(courseId, zone.dataset.grade, zone.dataset.semester, zone.dataset.zone);
    });
  });
}

function bindCreditInputs() {
  $all(".planned-course input").forEach((input) => {
    input.addEventListener("change", () => {
      const list = state.plan[input.dataset.grade][input.dataset.semester][input.dataset.zone];
      const value = Math.max(1, Math.min(6, Number(input.value) || 1));
      list[Number(input.dataset.index)].credits = value;
      saveState(false);
      renderPlanner();
    });
  });
}

function bindRemoveButtons() {
  $all(".remove-course").forEach((button) => {
    button.addEventListener("click", () => {
      const list = state.plan[button.dataset.grade][button.dataset.semester][button.dataset.zone];
      list.splice(Number(button.dataset.index), 1);
      saveState(false);
      renderPlanner();
    });
  });
}

function addCourseToPlan(courseId, grade, semester, zone) {
  const course = getCourse(courseId);
  if (!course) return;

  const list = state.plan[grade][semester][zone];
  list.push({ id: course.id, credits: course.credits });

  const jointCredits = sumCredits(state.plan[grade][semester].joint);
  if (zone === "joint" && jointCredits > 6) {
    list.pop();
    showToast("공동교육과정은 학기당 최대 6학점까지 입력합니다.");
    return;
  }

  saveState(false);
  renderPlanner();
}

function sumCredits(list) {
  return list.reduce((sum, item) => sum + Number(item.credits || 0), 0);
}

function updateFormValues() {
  $("#majorTrackSelect").value = state.selectedTrack;
  $("#targetMajorInput").value = state.targetMajor;
  $("#creativeAutonomy").value = state.creative.autonomy;
  $("#creativeCareer").value = state.creative.career;
  $("#creativeClub").value = state.creative.club;
  $("#inquiryMotivation").value = state.inquiry.motivation;
  $("#inquiryQuestion").value = state.inquiry.question;
  $("#inquiryResult").value = state.inquiry.result;
  $("#inquiryFollowUp").value = state.inquiry.followUp;
}

function saveState(showMessage) {
  const data = {
    activeGrade: state.activeGrade,
    activeCurriculumPlan: state.activeCurriculumPlan,
    activeCurriculumScope: state.activeCurriculumScope,
    selectedTrack: state.selectedTrack,
    targetMajor: state.targetMajor,
    plan: state.plan,
    creative: state.creative,
    inquiry: state.inquiry
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (showMessage) showToast("저장했습니다. 이 브라우저에서 이어서 작성할 수 있습니다.");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    state.activeGrade = saved.activeGrade || state.activeGrade;
    state.activeCurriculumPlan = saved.activeCurriculumPlan || state.activeCurriculumPlan;
    state.activeCurriculumScope = saved.activeCurriculumScope || state.activeCurriculumScope;
    state.selectedTrack = saved.selectedTrack || state.selectedTrack;
    state.targetMajor = saved.targetMajor || "";
    state.plan = saved.plan || createEmptyPlan();
    state.creative = { ...state.creative, ...(saved.creative || {}) };
    state.inquiry = { ...state.inquiry, ...(saved.inquiry || {}) };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function printReport() {
  saveState(false);
  $("#printReport").innerHTML = buildReportHtml();
  window.print();
}

function buildReportHtml() {
  const rows = [];
  ["1", "2", "3"].forEach((grade) => {
    ["1", "2"].forEach((semester) => {
      const regular = state.plan[grade][semester].regular;
      const joint = state.plan[grade][semester].joint;
      const regularNames = regular.map((item) => `${getCourse(item.id)?.name || ""}(${item.credits})`).join(", ");
      const jointNames = joint.map((item) => `${getCourse(item.id)?.name || ""}(${item.credits})`).join(", ");
      rows.push(`
        <tr>
          <td>${grade}학년 ${semester}학기</td>
          <td>${regularNames || "미입력"}</td>
          <td>${sumCredits(regular)} + 공강 2 = ${sumCredits(regular) + 2}</td>
          <td>${jointNames || "미입력"}</td>
          <td>${sumCredits(joint)}/6</td>
        </tr>
      `);
    });
  });

  return `
    <h1>진로진학 상담용 학생 설계 자료</h1>
    <p>희망 계열: ${trackLabels[state.selectedTrack]} / 희망 학과: ${state.targetMajor || "미입력"}</p>

    <h2>학기별 과목 설계</h2>
    <table>
      <thead>
        <tr>
          <th>학기</th>
          <th>일반 과목</th>
          <th>기본 학점</th>
          <th>공동교육과정</th>
          <th>공동 학점</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>

    <h2>창체 자기기록</h2>
    <table>
      <tbody>
        <tr><th>자율활동</th><td>${escapeHtml(state.creative.autonomy) || "미입력"}</td></tr>
        <tr><th>진로활동</th><td>${escapeHtml(state.creative.career) || "미입력"}</td></tr>
        <tr><th>동아리활동</th><td>${escapeHtml(state.creative.club) || "미입력"}</td></tr>
      </tbody>
    </table>

    <h2>탐구활동 자기평가</h2>
    <table>
      <tbody>
        <tr><th>탐구 동기</th><td>${escapeHtml(state.inquiry.motivation) || "미입력"}</td></tr>
        <tr><th>탐구 질문</th><td>${escapeHtml(state.inquiry.question) || "미입력"}</td></tr>
        <tr><th>과정과 결과</th><td>${escapeHtml(state.inquiry.result) || "미입력"}</td></tr>
        <tr><th>후속 활동</th><td>${escapeHtml(state.inquiry.followUp) || "미입력"}</td></tr>
      </tbody>
    </table>

    <h2>상담 메모</h2>
    <table>
      <tbody>
        <tr><th>담임교사 메모</th><td style="height: 80px;"></td></tr>
        <tr><th>교과교사 메모</th><td style="height: 80px;"></td></tr>
      </tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function formatDateLabel(value) {
  if (!value) return "확인 중";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${year}.${month}.${day}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

document.addEventListener("DOMContentLoaded", init);
