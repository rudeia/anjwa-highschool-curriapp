window.ANJWA_ADMISSION_PAGES = {
  groups: {
    subject: [
      { key: "subject", label: "첫 이해", href: "./subject.html" },
      { key: "subject-flow", label: "이해 순서", href: "./subject-flow.html" },
      { key: "subject-score", label: "성적 계산", href: "./subject-score.html" },
      { key: "subject-calculation", label: "대학 사례", href: "./subject-calculation.html" },
      { key: "subject-minimum", label: "수능최저", href: "./subject-minimum.html" },
      { key: "subject-document", label: "서류·출결", href: "./subject-document.html" },
      { key: "subject-misunderstanding", label: "오해 정리", href: "./subject-misunderstanding.html" }
    ],
    holistic: [
      { key: "holistic", label: "첫 이해", href: "./holistic.html" },
      { key: "holistic-flow", label: "이해 순서", href: "./holistic-flow.html" },
      { key: "holistic-record", label: "학생부 항목", href: "./holistic-record.html" },
      { key: "holistic-competency", label: "평가역량", href: "./holistic-competency.html" },
      { key: "holistic-subjects", label: "추천 과목", href: "./holistic-subjects.html" },
      { key: "holistic-sechuk", label: "세특 흐름", href: "./holistic-sechuk.html" },
      { key: "holistic-ai", label: "AI 활용", href: "./holistic-ai.html" },
      { key: "holistic-interview", label: "면접", href: "./holistic-interview.html" }
    ]
  },
  pages: {
    subject: {
      group: "subject",
      tone: "subject",
      title: "수시 학생부 교과전형",
      summary: "교과 성적이 중심이지만, 평균등급 하나로 끝나지 않는 전형입니다.",
      heroLabel: "학생용 첫 이해",
      heroTitle: "교과전형은 내 평균등급이 아니라 대학 방식으로 다시 계산한 내 성적을 보는 전형입니다.",
      heroText: "처음에는 내신 전형으로 이해해도 됩니다. 다만 실제 지원에서는 과목별 학점수, 대학별 산출 방식, 반영 교과, 수능최저, 학교장추천, 서류와 출결 반영 여부를 함께 확인해야 합니다.",
      body: `
        <div class="learner-summary">
          <span class="label">핵심만 먼저 보기</span>
          <h3>교과전형을 볼 때는 성적, 계산법, 조건, 기록을 나누어 봅니다.</h3>
          <div class="learner-points">
            <article><b>1. 성적이 출발점입니다</b><span>교과전형의 기본은 수업과 평가에서 받은 교과 성적입니다.</span></article>
            <article><b>2. 학점수가 영향을 줍니다</b><span>같은 등급이어도 학점수가 큰 과목은 평균과 환산점수에 더 크게 들어갈 수 있습니다.</span></article>
            <article><b>3. 대학마다 계산법이 다릅니다</b><span>전 과목, 특정 교과, 상위 과목, 진로선택 반영 방식이 대학마다 다릅니다.</span></article>
            <article><b>4. 조건을 마지막에 확인합니다</b><span>수능최저, 추천 가능 여부, 서류·출결 반영 여부를 놓치면 지원 판단이 흔들립니다.</span></article>
          </div>
        </div>
        <div class="subject-page-grid">
          <article class="explainer-card">
            <span class="label">학생 질문</span>
            <h3>내신이 좋으면 끝인가요?</h3>
            <p>아닙니다. 평균등급은 출발점입니다. 대학이 어떤 과목을 얼마나 반영하는지에 따라 같은 평균등급도 다른 결과로 계산될 수 있습니다.</p>
          </article>
          <article class="explainer-card">
            <span class="label">상담 질문</span>
            <h3>지원 전 무엇을 확인하나요?</h3>
            <p>희망 대학의 모집요강에서 반영 교과, 반영 과목 수, 학년별 반영 여부, 수능최저, 학교장추천, 서류·출결 반영 여부를 확인합니다.</p>
          </article>
          <article class="explainer-card">
            <span class="label">과목 선택</span>
            <h3>교과전형도 과목 선택이 중요합니다</h3>
            <p>서류나 교과정성평가가 있는 교과전형에서는 지원 학과와 과목 이수 흐름이 맞는지도 확인합니다.</p>
          </article>
        </div>
        <div class="external-resource-card">
          <div>
            <span class="label">수시 입결 확인</span>
            <h3>대학별 수시 입시 결과를 살펴보세요.</h3>
            <p>수시 입결 조회 사이트로 이동합니다. 지원 전에는 반드시 해당 대학 입학처의 최신 모집요강과 함께 확인하세요.</p>
          </div>
          <a class="primary-button page-link-button" href="https://doctor-noh.vercel.app/" target="_blank" rel="noopener noreferrer">수시 입결 조회</a>
        </div>
      `
    },
    "subject-flow": {
      group: "subject",
      tone: "subject",
      title: "교과전형 이해 순서",
      summary: "성적표를 보는 눈에서 시작해 대학별 조건 확인으로 이어집니다.",
      heroLabel: "읽는 순서",
      heroTitle: "교과전형은 성적표를 대학의 계산 방식으로 다시 읽는 과정입니다.",
      heroText: "학생은 평균등급만 외우기보다 내 성적이 어떤 대학에서 유리하게 계산되는지 확인해야 합니다.",
      body: `
        <div class="content-block">
          <h3>4단계로 이해하기</h3>
          <div class="process-cards">
            <article><span>01</span><b>내 성적 읽기</b><p>평균등급, 과목별 등급, 학점수, 학기별 추이를 함께 봅니다.</p></article>
            <article><span>02</span><b>대학 반영 방식 확인</b><p>전 과목인지, 특정 교과인지, 상위 과목인지, 진로선택을 어떻게 보는지 확인합니다.</p></article>
            <article><span>03</span><b>환산점수로 다시 보기</b><p>대학 산출식에 넣으면 평균등급과 다른 결과가 나올 수 있습니다.</p></article>
            <article><span>04</span><b>최종 조건 확인</b><p>수능최저, 추천 가능 여부, 서류·면접·출결 반영 여부를 마지막에 확인합니다.</p></article>
          </div>
        </div>
        <div class="content-block">
          <h3>학년별 준비 흐름</h3>
          <div class="timeline-cards">
            <div><b>고1</b><span>공통과목 성취를 안정적으로 만들고, 희망 계열을 넓게 탐색합니다.</span></div>
            <div><b>고2</b><span>희망 계열과 이어지는 선택과목을 듣기 시작하고, 주요 대학의 반영 교과와 수능최저를 확인합니다.</span></div>
            <div><b>고3</b><span>대학별 환산점수, 수능최저, 추천 가능 여부, 서류·출결 반영 여부를 최종 확인합니다.</span></div>
          </div>
        </div>
        <div class="check-panel">
          <div><h3>학생 점검</h3><p>교과전형을 준비하는 학생은 아래 질문에 답할 수 있어야 합니다.</p></div>
          <div class="checklist">
            <label><input type="checkbox" /> 내 평균등급과 학점수 반영 평균의 차이를 설명할 수 있다.</label>
            <label><input type="checkbox" /> 희망 대학이 보는 반영 교과를 확인했다.</label>
            <label><input type="checkbox" /> 수능최저가 있는 전형인지 확인했다.</label>
            <label><input type="checkbox" /> 학교장추천 전형이면 추천 가능성을 확인했다.</label>
          </div>
        </div>
      `
    },
    "subject-score": {
      group: "subject",
      tone: "subject",
      title: "교과 성적 계산",
      summary: "평균등급, 학점수, 대학별 환산점수를 구분해서 봅니다.",
      heroLabel: "성적 해석",
      heroTitle: "성적은 하나의 숫자가 아니라 과목, 학점수, 대학 산출식이 결합된 결과입니다.",
      heroText: "학생 상담에서는 단순 평균에서 멈추지 않고, 학점수가 큰 과목의 영향과 대학별 환산 방식을 함께 봅니다.",
      body: `
        <div class="comparison-table">
          <h3>평균등급과 학점수 반영 평균</h3>
          <p>2학점 과목 1등급과 4학점 과목 3등급을 똑같이 한 과목으로 보면 평균은 2.00처럼 보입니다. 그러나 학점수를 반영하면 (1×2 + 3×4) ÷ 6 = 2.33입니다.</p>
          <div class="credit-example">
            <div><b>단순 평균</b><span>과목 수만 보고 계산하므로 빠르게 위치를 볼 수 있습니다.</span></div>
            <div><b>학점수 반영</b><span>운영학점이 큰 과목의 등급이 더 크게 반영됩니다.</span></div>
            <div><b>대학 환산점수</b><span>대학이 정한 반영 교과와 산출식으로 다시 계산합니다.</span></div>
          </div>
        </div>
        <div class="content-block">
          <h3>학생에게 필요한 해석</h3>
          <div class="insight-grid">
            <article><b>몇 등급이 몇 개인가</b><span>성적 분포를 빠르게 볼 때 필요합니다.</span></article>
            <article><b>그 과목이 몇 학점인가</b><span>학점수가 큰 과목은 성적 추이에 더 큰 영향을 줍니다.</span></article>
            <article><b>반영 교과에 들어가는가</b><span>희망 대학이 보지 않는 교과는 계산에서 빠질 수 있습니다.</span></article>
            <article><b>대학 방식으로 유리한가</b><span>상위 과목 반영, 특정 교과 반영이면 유불리가 달라질 수 있습니다.</span></article>
          </div>
        </div>
        <div class="external-resource-card">
          <div>
            <span class="label">실제 입결 비교</span>
            <h3>계산 방식을 이해했다면 대학별 입시 결과도 함께 비교해 보세요.</h3>
            <p>입결은 전형·모집단위·학년도에 따라 달라지므로 동일한 조건인지 확인하며 보세요.</p>
          </div>
          <a class="primary-button page-link-button" href="https://doctor-noh.vercel.app/" target="_blank" rel="noopener noreferrer">수시 입결 조회</a>
        </div>
      `
    },
    "subject-calculation": {
      group: "subject",
      tone: "subject",
      title: "대학별 산출 방식 사례",
      summary: "대학마다 교과 성적을 다르게 계산한다는 점을 확인합니다.",
      basis: "2026학년도 공개 전형 자료를 중심으로 정리한 이해용 사례입니다. 실제 지원 시에는 지원 학년도의 모집요강에서 반영 교과와 산출식을 다시 확인하세요.",
      heroLabel: "대학 사례",
      heroTitle: "같은 성적도 대학별 산출 방식에 따라 유불리가 달라집니다.",
      heroText: "사례의 목적은 숫자를 외우는 것이 아니라, 지원 전 반드시 모집요강의 계산 방식을 확인해야 한다는 점을 이해하는 것입니다.",
      body: `
        <div class="comparison-table compact-table">
          <h3>산출 방식 비교</h3>
          <table>
            <thead><tr><th>대학</th><th>전형 또는 사례</th><th>산출 방식의 특징</th><th>학생이 볼 점</th></tr></thead>
            <tbody>
              <tr><td>용인대</td><td>일반학생 등</td><td>국·수·영·사·과 중 학년별 과목 구조를 활용합니다.</td><td>전체 평균보다 학년별 강점 과목 확보가 중요합니다.</td></tr>
              <tr><td>가천대</td><td>학생부우수자</td><td>반영교과 전체와 우수 과목 방식 중 유리한 방식을 적용하는 사례가 있습니다.</td><td>전 과목 평균만으로 판단하지 않습니다.</td></tr>
              <tr><td>동국대 서울</td><td>학교장추천인재</td><td>교과와 서류를 함께 반영하는 구조입니다.</td><td>강점 과목과 학생부 흐름을 함께 봅니다.</td></tr>
              <tr><td>서울시립대</td><td>고교추천</td><td>교과정성평가가 들어갑니다.</td><td>과목 이수의 충실성과 전공 관련 흐름이 의미를 가집니다.</td></tr>
              <tr><td>부산대</td><td>학생부 교과</td><td>교과 성적과 학업역량평가를 함께 보는 구조가 있습니다.</td><td>모집단위별 수능최저와 평가 방식을 따로 확인합니다.</td></tr>
              <tr><td>충남대</td><td>학생부교과 일반</td><td>교과 중심으로 넓게 반영합니다.</td><td>전체 교과 안정성과 수능최저를 함께 봅니다.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="content-block">
          <h3>상담에서 바꿔야 할 질문</h3>
          <div class="type-grid">
            <div><b>나의 평균은?</b><span>출발 질문입니다.</span></div>
            <div><b>대학은 무엇을 보나?</b><span>반영 교과와 과목 수를 확인합니다.</span></div>
            <div><b>어떤 방식이 유리한가?</b><span>전 과목, 상위 과목, 특정 교과 방식의 차이를 봅니다.</span></div>
            <div><b>최저와 서류가 있나?</b><span>성적 외 조건을 확인합니다.</span></div>
          </div>
        </div>
      `
    },
    "subject-minimum": {
      group: "subject",
      tone: "subject",
      title: "수능최저 확인",
      summary: "수능최저는 교과전형의 중요한 문턱입니다.",
      basis: "대학별 예시는 2026학년도 공개 자료를 중심으로 정리했습니다. 수능최저는 전형·모집단위·학년도에 따라 달라지므로 최신 모집요강을 다시 확인하세요.",
      heroLabel: "최저 기준",
      heroTitle: "내신이 좋아도 수능최저를 맞추지 못하면 합격할 수 없습니다.",
      heroText: "특히 지방거점 국립대와 주요 대학 교과전형은 모집단위별 수능최저가 다르게 적용될 수 있습니다.",
      body: `
        <div class="content-block">
          <h3>수능최저를 볼 때 확인할 것</h3>
          <div class="type-grid">
            <div><b>적용 여부</b><span>전형과 모집단위별로 수능최저가 있는지 확인합니다.</span></div>
            <div><b>영역 조합</b><span>2합, 3합, 탐구 반영 과목 수를 확인합니다.</span></div>
            <div><b>필수 영역</b><span>수학 또는 과탐 필수 조건이 있는지 확인합니다.</span></div>
            <div><b>변화 여부</b><span>전년도보다 강화되었는지 완화되었는지 봅니다.</span></div>
          </div>
        </div>
        <div class="comparison-table compact-table">
          <h3>지방거점 국립대 확인 예시</h3>
          <table>
            <thead><tr><th>대학</th><th>확인 포인트</th><th>학생 상담에서 볼 점</th></tr></thead>
            <tbody>
              <tr><td>부산대</td><td>학과군별 기준 차이</td><td>경영, 공학, 자연계열 기준을 따로 확인합니다.</td></tr>
              <tr><td>경북대</td><td>교과우수자 기준</td><td>공학계열은 수학 조건을 함께 확인합니다.</td></tr>
              <tr><td>강원대</td><td>일반교과 기준</td><td>모집단위별 3합 기준과 필수 과목 조건을 봅니다.</td></tr>
              <tr><td>경상국립대</td><td>일반 전형 기준</td><td>모집단위에 따라 수능최저가 없거나 다를 수 있습니다.</td></tr>
              <tr><td>전남대·전북대·충남대·충북대</td><td>계열별 기준 차이</td><td>경영, 국문, 전기, 기계, 물리 등 모집단위별로 확인합니다.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="table-caption">수능최저는 지원 가능성을 가르는 문턱이고, 전년도 입결은 지난해 결과입니다. 두 값을 같은 의미로 해석하면 안 됩니다.</p>
      `
    },
    "subject-document": {
      group: "subject",
      tone: "subject",
      title: "서류·출결 반영",
      summary: "일부 교과전형은 성적 외 요소도 함께 봅니다.",
      basis: "서류·출결 반영 사례는 2026학년도 공개 자료를 중심으로 확인했습니다. 반영 요소와 비율은 지원 학년도의 모집요강을 기준으로 판단하세요.",
      heroLabel: "서류 영향",
      heroTitle: "교과전형에서도 서류평가의 영향력이 작지 않은 경우가 있습니다.",
      heroText: "교과 성적이 중심이어도 서류, 교과정성, 학업역량평가, 출결이 들어가면 과목 선택과 학생부 흐름을 함께 봐야 합니다.",
      body: `
        <div class="content-block">
          <h3>서류가 들어가면 무엇을 보나요?</h3>
          <div class="type-grid">
            <div><b>과목 이수</b><span>지원 학과와 이어지는 과목을 들었는지 봅니다.</span></div>
            <div><b>세특 흐름</b><span>수업 속 질문, 탐구 과정, 성취가 보이는지 확인합니다.</span></div>
            <div><b>학업 태도</b><span>성적뿐 아니라 수업 참여와 학습 태도를 봅니다.</span></div>
            <div><b>출결</b><span>미인정 결석, 지각, 조퇴 등이 감점 요소가 될 수 있습니다.</span></div>
          </div>
        </div>
        <div class="document-impact">
          <div>
            <span class="label">사례로 이해하기</span>
            <h3>성적이 좋아도 학생부 방향이 맞지 않으면 흔들릴 수 있습니다</h3>
            <p>학과와 맞지 않는 과목 이수 흐름, 전공 관련 핵심 과목 미이수, 학생부에 반복되는 다른 진로 관심은 교과형 서류평가에서 약점이 될 수 있습니다.</p>
          </div>
          <div class="impact-list">
            <article><b>전공 관련 과목 흐름</b><ul><li>공학 지원인데 물리 흐름이 약한 경우</li><li>생명·식품 계열인데 화학 이수가 부족한 경우</li><li>수학교육 지원인데 교육 관심과 수학 성취 설명이 약한 경우</li></ul></article>
            <article><b>학생부 방향성</b><ul><li>지원 학과와 다른 관심사가 학생부 전반에 강하게 남은 경우</li><li>전공 관련 질문보다 활동명만 반복된 경우</li><li>수업과 탐구의 연결이 보이지 않는 경우</li></ul></article>
          </div>
        </div>
      `
    },
    "subject-misunderstanding": {
      group: "subject",
      tone: "subject",
      title: "교과전형 자주 하는 오해",
      summary: "학생들이 자주 착각하는 부분을 질문 형태로 정리합니다.",
      heroLabel: "오해 정리",
      heroTitle: "교과전형은 단순히 내신 평균만 보는 전형이 아닙니다.",
      heroText: "아래 질문을 하나씩 열어 보면 교과전형을 더 정확하게 이해할 수 있습니다.",
      body: `
        <div class="content-block">
          <h3>자주 하는 질문</h3>
          <div class="accordion-list">
            <details open><summary>교과전형은 내신 평균등급만 좋으면 되나요?</summary><p>아닙니다. 평균등급은 출발점입니다. 과목별 학점수, 반영 교과, 대학별 산출 방식, 수능최저, 서류·출결 반영 여부를 함께 봐야 합니다.</p></details>
            <details><summary>어떤 교과목을 듣는지는 신경 쓰지 않아도 되나요?</summary><p>신경 써야 합니다. 대학이 반영하는 교과에 들어가는지, 희망 학과와 이어지는 과목인지, 서류평가에서 설명 가능한 흐름인지 확인해야 합니다.</p></details>
            <details><summary>교과전형이면 수능 준비는 덜 해도 되나요?</summary><p>수능최저가 있는 전형에서는 위험한 생각입니다. 내신이 좋아도 수능최저를 맞추지 못하면 합격할 수 없습니다.</p></details>
            <details><summary>학교장추천은 성적만 맞으면 되나요?</summary><p>아닙니다. 추천 인원 제한, 재학생 지원 조건, 학교 내부 추천 기준을 함께 확인해야 합니다.</p></details>
            <details><summary>출결은 종합전형에서만 중요한가요?</summary><p>아닙니다. 일부 교과전형도 출결을 감점 요소로 반영합니다. 성실성의 기본 자료로 볼 수 있습니다.</p></details>
          </div>
        </div>
      `
    },
    holistic: {
      group: "holistic",
      tone: "holistic",
      title: "수시 학생부 종합전형",
      summary: "과목 선택, 수업 참여, 세특, 탐구활동을 하나의 성장 흐름으로 봅니다.",
      heroLabel: "학생용 첫 이해",
      heroTitle: "종합전형은 활동량이 아니라 수업 속 성장의 연결을 읽는 전형입니다.",
      heroText: "대학은 학생부를 통해 학업역량, 진로역량, 공동체역량을 함께 봅니다. 중요한 것은 무엇을 많이 했는가가 아니라 수업, 과목 선택, 세특, 탐구, 창체, 면접이 하나의 흐름으로 설명되는가입니다.",
      body: `
        <div class="learner-summary">
          <span class="label">핵심만 먼저 보기</span>
          <h3>종합전형은 내가 선택한 과목에서 어떤 질문을 만들고, 어떻게 배우고, 다음 활동으로 이어 갔는가를 보여주는 전형입니다.</h3>
          <div class="learner-points">
            <article><b>1. 수업이 출발점입니다</b><span>세특과 탐구는 수업 개념에서 출발할 때 가장 자연스럽습니다.</span></article>
            <article><b>2. 과목 선택이 증거입니다</b><span>희망 학과와 관련된 과목을 왜 선택했는지 설명할 수 있어야 합니다.</span></article>
            <article><b>3. 활동보다 연결이 중요합니다</b><span>창체, 동아리, 진로활동은 수업 속 질문과 이어질 때 힘이 생깁니다.</span></article>
            <article><b>4. 면접은 확인 과정입니다</b><span>학생부에 적힌 내용을 자기 언어로 설명할 수 있어야 합니다.</span></article>
          </div>
        </div>
        <div class="subject-page-grid">
          <article class="explainer-card"><span class="label">수업</span><h3>교과 개념에서 질문을 만듭니다</h3><p>수업 시간에 배운 개념을 그냥 외우는 데서 끝내지 않고, 왜 그런지, 어디에 쓰이는지, 다른 자료와 맞는지 질문합니다.</p></article>
          <article class="explainer-card"><span class="label">과목 선택</span><h3>진로역량의 증거가 됩니다</h3><p>핵심·권장·추천 과목은 희망 학과와 고교 과목을 연결하는 기준으로 사용합니다.</p></article>
          <article class="explainer-card"><span class="label">세특</span><h3>학업역량을 보여주는 중심입니다</h3><p>세특은 활동명보다 질문, 과정, 결과, 한계, 후속 탐구가 보일 때 설득력이 생깁니다.</p></article>
        </div>
      `
    },
    "holistic-flow": {
      group: "holistic",
      tone: "holistic",
      title: "종합전형 이해 순서",
      summary: "전형 방식에서 시작해 과목, 세특, 면접으로 이어집니다.",
      heroLabel: "읽는 순서",
      heroTitle: "종합전형은 스펙을 쌓는 전형이 아니라 배움의 흐름을 만드는 전형입니다.",
      heroText: "전형 방식, 학생부 항목, 평가역량, 과목 선택, 세특 흐름, 면접을 차례대로 이해하면 준비 방향이 분명해집니다.",
      body: `
        <div class="content-block">
          <h3>6단계 이해 흐름</h3>
          <div class="process-cards">
            <article><span>01</span><b>전형 방식 확인</b><p>서류형, 면접형, 수능최저 적용 여부를 먼저 봅니다.</p></article>
            <article><span>02</span><b>학생부 항목 확인</b><p>출결, 창체, 교과학습발달상황, 행동특성을 봅니다.</p></article>
            <article><span>03</span><b>평가역량 이해</b><p>학업역량, 진로역량, 공동체역량의 의미를 잡습니다.</p></article>
            <article><span>04</span><b>과목 선택 점검</b><p>희망 학과의 핵심·권장·추천 과목과 학교 교육과정을 연결합니다.</p></article>
            <article><span>05</span><b>세특·탐구 연결</b><p>동기, 질문, 개념, 과정, 결과, 후속 활동을 남깁니다.</p></article>
            <article><span>06</span><b>면접 대비</b><p>기록의 이유와 배운 점을 학생 자신의 말로 설명합니다.</p></article>
          </div>
        </div>
        <div class="content-block">
          <h3>자료에서 반복되는 준비 포인트</h3>
          <div class="insight-grid">
            <article><b>권장과목은 장식이 아닙니다</b><span>대학 전공 수업을 따라가기 위한 기초 과목으로 제시되는 경우가 많습니다. 가능한 범위에서 이수 여부를 먼저 점검합니다.</span></article>
            <article><b>전공을 억지로 붙이지 않습니다</b><span>좋은 기록은 진로명 반복보다 수업 개념, 호기심, 탐구 과정, 깨달음, 후속 확장이 보입니다.</span></article>
            <article><b>학과 이름이 같아도 관점이 다릅니다</b><span>교육학과와 교과교육과, 간호학과와 의예과처럼 같은 계열 안에서도 필요한 과목과 탐구 방향이 다를 수 있습니다.</span></article>
            <article><b>면접까지 이어져야 합니다</b><span>학생부에 적힌 탐구는 나중에 학생이 직접 설명할 수 있어야 합니다. 모르는 표현은 오히려 부담이 됩니다.</span></article>
          </div>
        </div>
      `
    },
    "holistic-record": {
      group: "holistic",
      tone: "holistic",
      title: "대입에서 읽히는 학생부 항목",
      summary: "학생부 항목은 따로 존재하지만, 대학은 그 연결을 함께 읽습니다.",
      heroLabel: "학생부 항목",
      heroTitle: "학생부는 활동 목록이 아니라 수업과 학교생활의 흐름을 보여주는 자료입니다.",
      heroText: "출결, 창체, 교과학습발달상황, 행동특성은 서로 분리되어 보이지만, 실제 평가는 학생의 태도와 성장 흐름을 함께 확인합니다.",
      body: `
        <div class="content-block">
          <h3>주요 항목</h3>
          <div class="type-grid">
            <div><b>출결상황</b><span>성실성과 학교생활 기본 태도를 확인합니다.</span></div>
            <div><b>창의적체험활동</b><span>자율, 동아리, 진로활동의 역할과 연결을 봅니다.</span></div>
            <div><b>교과학습발달상황</b><span>성적, 과목 이수, 세특을 통해 학업 흐름을 봅니다.</span></div>
            <div><b>행동특성 및 종합의견</b><span>학교생활 전반의 태도와 공동체성을 봅니다.</span></div>
          </div>
        </div>
        <div class="content-block">
          <h3>독서와 탐구의 관계</h3>
          <p>독서활동상황 자체는 대입 반영에서 제외되지만, 독서가 수업 토론, 세특, 창체, 탐구 질문으로 이어지면 학생의 사고 확장으로 남을 수 있습니다. 독서는 탐구 동기가 될 수 있고, 탐구 과정에서 자료 해석의 기준이 될 수도 있습니다.</p>
        </div>
        <div class="content-block">
          <h3>좋은 학생부 흐름</h3>
          <div class="type-grid">
            <div><b>수업</b><span>교과 개념을 이해하고, 그 안에서 질문을 만듭니다.</span></div>
            <div><b>세특</b><span>질문, 과정, 결과, 한계, 후속 탐구가 드러납니다.</span></div>
            <div><b>창체</b><span>수업에서 생긴 관심을 동아리, 진로활동, 자율활동으로 확장합니다.</span></div>
            <div><b>면접</b><span>왜 그 활동을 했고 무엇을 배웠는지 자신의 말로 설명합니다.</span></div>
          </div>
        </div>
      `
    },
    "holistic-competency": {
      group: "holistic",
      tone: "holistic",
      title: "평가역량 3대 축",
      summary: "학업역량, 진로역량, 공동체역량을 수업 안에서 보여줍니다.",
      heroLabel: "평가역량",
      heroTitle: "가장 중심은 학업역량이고, 진로역량과 공동체역량이 함께 연결됩니다.",
      heroText: "모든 과목은 학업역량을 보여줄 기회입니다. 희망 진로와 직접 연결되지 않는 과목도 질문 만들기, 자료 해석, 토론, 협력, 피드백 반영을 통해 의미 있는 기록이 될 수 있습니다.",
      feature: "competencies",
      body: `
        <div class="content-block">
          <h3>평가역량 3대 축</h3>
          <div class="competency-grid" id="competencyCards"></div>
        </div>
        <div class="subject-page-grid">
          <article class="explainer-card"><span class="label">학업역량</span><h3>수업을 이해하고 질문으로 확장합니다</h3><p>개념 이해, 자료 분석, 문제 해결, 탐구 과정이 가장 중요한 근거가 됩니다.</p></article>
          <article class="explainer-card"><span class="label">진로역량</span><h3>과목 선택과 탐구 방향이 이어집니다</h3><p>희망 학과와 관련 과목을 선택하고, 수업 속 질문을 전공 관심으로 확장합니다.</p></article>
          <article class="explainer-card"><span class="label">공동체역량</span><h3>수업 속 협력과 책임을 보여줍니다</h3><p>토론, 발표, 피드백, 공동 탐구에서 자신의 역할과 변화가 드러나야 합니다.</p></article>
        </div>
        <div class="content-block">
          <h3>과목별로 다르게 드러나는 역량</h3>
          <div class="insight-grid">
            <article><b>수학·과학</b><span>개념을 적용해 문제를 해결하고, 자료나 실험 결과를 해석하는 과정이 학업역량의 근거가 됩니다.</span></article>
            <article><b>사회·역사·윤리·지리</b><span>자료를 읽고 쟁점을 비교하며, 가치 판단이나 정책 대안을 논리적으로 설명하는 힘이 중요합니다.</span></article>
            <article><b>국어·영어·어문</b><span>텍스트를 해석하고, 근거를 들어 주장하며, 읽은 내용을 탐구 질문으로 바꾸는 힘을 보여줄 수 있습니다.</span></article>
            <article><b>예체능·교양</b><span>진로와 직접 연결되지 않아도 표현, 협업, 성찰, 공동체 기여를 보여줄 좋은 기회가 됩니다.</span></article>
          </div>
        </div>
      `
    },
    "holistic-subjects": {
      group: "holistic",
      tone: "holistic",
      title: "학과별 추천 과목 찾기",
      summary: "학과를 고르면 과목을, 과목을 고르면 관련 학과를 확인합니다.",
      heroLabel: "과목 선택",
      heroTitle: "희망 학과와 연결되는 선택과목을 찾아봅니다.",
      heroText: "학과나 과목으로 먼저 찾아보고, 우리학교에서 들을 수 있는 과목인지 확인합니다. 학교에 없는 과목은 담임·교과 선생님과 다른 이수 방법을 함께 상의하면 됩니다.",
      feature: "recommendations",
      body: `
        <div class="content-block">
          <h3>추천 과목 조회</h3>
          <p>희망 학과가 정해졌다면 학과명으로, 아직 넓게 고민 중이라면 계열명으로 찾아보세요. 관심 과목을 먼저 고르면 그 과목과 연결해 생각해 볼 수 있는 학과 예시도 확인할 수 있습니다.</p>
          <div class="recommendation-use-grid">
            <article>
              <b>핵심과목</b>
              <span>학과 공부를 시작할 때 특히 먼저 확인하면 좋은 과목입니다. 자료에 없으면 비워 둡니다.</span>
            </article>
            <article>
              <b>권장과목</b>
              <span>들어두면 전공 공부를 이해하는 데 도움이 되는 과목입니다. 모두 들어야 한다는 뜻은 아닙니다.</span>
            </article>
            <article>
              <b>추천과목</b>
              <span>공식 요구 과목이 아니라, 과목 선택을 넓게 생각해 보기 위한 참고 과목입니다.</span>
            </article>
          </div>
          <div class="recommendation-view-panel">
            <div class="recommendation-view-tabs" aria-label="추천 과목 보기 방식">
              <button class="active" type="button" data-recommendation-mode="major">학과·계열로 찾기</button>
              <button type="button" data-recommendation-mode="subject">과목으로 찾기</button>
              <button type="button" data-recommendation-mode="university">대학별로 찾기</button>
              <a class="recommendation-deep-link" href="./advanced-recommendations.html">심화자료</a>
            </div>
            <p id="recommendationModeHelp">희망 학과나 계열을 고르면 연결 과목과 우리학교 개설 여부를 함께 볼 수 있습니다.</p>
          </div>
          <div class="recommendation-tool">
            <div class="recommendation-controls">
              <label class="recommendation-major-control">학과·계열 고르기<select id="majorRecommendationSelect"></select></label>
              <label class="recommendation-major-control">학과·계열 검색<input id="majorRecommendationSearch" type="search" placeholder="예: 간호학과, 의학 보건계열, 지리교육과, 경영" /></label>
              <label class="recommendation-subject-control">과목으로 찾기<select id="subjectRecommendationSelect"></select></label>
              <label class="recommendation-university-control">대학명 검색<input id="universityRecommendationSearch" type="search" placeholder="예: 서울대, 부산대, 국민대" /></label>
              <label class="recommendation-university-control">학과명 검색<input id="universityMajorSearch" type="search" placeholder="예: 간호, 경영, 기계, 교육" /></label>
              <label class="recommendation-plan-control">교육과정 기준<select id="recommendationPlanFilter"><option value="all">전체 학년</option><option value="incoming2026">1학년(2026 신입)</option><option value="incoming2025">2학년(2025 신입)</option><option value="incoming2024">3학년(2024 신입)</option></select></label>
            </div>
            <div class="quick-major-row" id="quickMajorButtons"></div>
            <div class="recommendation-results" id="majorRecommendationResults"></div>
            <div class="recommendation-results" id="subjectRecommendationResults"></div>
          </div>
          <div class="recommendation-legend" aria-label="추천 과목 배지 범례">
            <span><b class="legend-chip grade-1"></b> 1학년 교육과정</span>
            <span><b class="legend-chip grade-2"></b> 2학년 교육과정</span>
            <span><b class="legend-chip grade-3"></b> 3학년 교육과정</span>
            <span><b class="legend-chip missing-core"></b> 핵심 과목 미개설</span>
            <span><b class="legend-chip missing-recommended"></b> 권장 과목 미개설</span>
          </div>
        </div>
        <div class="content-block">
          <h3>조회 결과를 해석하는 법</h3>
          <div class="insight-grid">
            <article><b>공통과목은 빼고 봅니다</b><span>공통국어, 공통수학, 공통영어, 통합사회, 통합과학, 한국사는 대부분 학생이 듣기 때문에 선택과목 판단에서는 크게 차이가 나지 않습니다.</span></article>
            <article><b>비어 있어도 이상한 것은 아닙니다</b><span>모든 학과가 핵심·권장과목을 자세히 제시하는 것은 아닙니다. 결과가 비어 있으면 다른 대학 자료나 추천과목을 함께 비교해 봅니다.</span></article>
            <article><b>미개설은 함께 방법을 찾습니다</b><span>학교에 없는 과목은 공동교육과정, 온라인 수업, 독서·탐구 확장처럼 다른 방법을 상담할 수 있습니다.</span></article>
            <article><b>진로와 무관한 과목도 중요합니다</b><span>모든 과목은 학업역량을 보여줄 기회입니다. 질문 만들기, 자료 해석, 토론, 피드백 반영이 기록의 힘이 됩니다.</span></article>
          </div>
        </div>
      `
    },
    "holistic-sechuk": {
      group: "holistic",
      tone: "holistic",
      title: "세특 작성의 좋은 흐름",
      summary: "세특은 수업 개념에서 시작해 탐구 과정과 후속 활동으로 이어집니다.",
      heroLabel: "세특 흐름",
      heroTitle: "좋은 세특은 진로를 끼워 넣는 글이 아니라 수업 속 질문이 커지는 과정입니다.",
      heroText: "탐구 동기, 질문, 수업 개념, 과정, 결과, 한계, 후속 활동이 이어질 때 학생의 학업역량이 잘 드러납니다.",
      feature: "sechuk",
      body: `
        <div class="content-block">
          <h3>세특 흐름을 눌러 예시 보기</h3>
          <div class="timeline-band sechuk-flow">
            <div class="sechuk-flow-grid" id="sechukFlowGrid">
              <button class="sechuk-step active" type="button" data-sechuk-step="motivation"><span>01</span><b>탐구 동기</b><small>수업에서 생긴 호기심</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="question"><span>02</span><b>탐구 질문</b><small>해결하고 싶은 물음</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="concept"><span>03</span><b>수업 개념 연결</b><small>교과 개념과 연결</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="process"><span>04</span><b>탐구 과정</b><small>조사·분석·토론</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="result"><span>05</span><b>결과</b><small>알게 된 점 정리</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="limit"><span>06</span><b>한계</b><small>부족한 점과 반성</small></button>
              <button class="sechuk-step" type="button" data-sechuk-step="follow"><span>07</span><b>후속 활동</b><small>다음 수업·창체로 확장</small></button>
            </div>
            <div class="sechuk-example-panel" id="sechukExamplePanel" aria-live="polite">
              <span class="label">예시</span>
              <h4 id="sechukExampleTitle">탐구 동기</h4>
              <p id="sechukExampleText">수업 중 다룬 개념에서 이상하거나 더 알고 싶은 지점을 발견합니다.</p>
            </div>
          </div>
        </div>
        <div class="insight-grid">
          <article><b>좋은 방향</b><span>수업 개념 → 호기심 → 질문 → 자료 분석·실험·토론 → 깨달음 → 다음 탐구로 이어집니다.</span></article>
          <article><b>피할 방향</b><span>진로명만 반복하거나, 활동명만 많고 질문과 과정이 없는 기록은 설득력이 약합니다.</span></article>
          <article><b>수업 시간이 부족할 때</b><span>수업과 수행평가를 바탕으로 하되, 교과 선생님과 이야기해 개별 탐구 질문을 정리할 수 있습니다.</span></article>
        </div>
        <div class="content-block">
          <h3>학생이 자기평가서에 남기면 좋은 문장 재료</h3>
          <div class="type-grid">
            <div><b>동기</b><span>수업에서 어떤 개념이나 자료가 궁금했는지 씁니다.</span></div>
            <div><b>과정</b><span>조사, 분석, 실험, 토론, 비교 중 무엇을 했는지 구체화합니다.</span></div>
            <div><b>결과</b><span>처음 생각과 달라진 점, 새로 알게 된 점을 남깁니다.</span></div>
            <div><b>후속</b><span>다음 수업, 독서, 창체, 진로활동으로 어떻게 이어갈지 씁니다.</span></div>
          </div>
        </div>
      `
    },
    "holistic-ai": {
      group: "holistic",
      tone: "holistic",
      title: "AI 활용",
      summary: "AI는 학생부 문장 작성보다 탐구 질문 확장에 사용합니다.",
      heroLabel: "AI 활용 기준",
      heroTitle: "AI는 세특을 대신 써주는 도구가 아니라 질문을 넓히는 도구입니다.",
      heroText: "생성형 AI로 학생부 문장을 대신 만들면 진정성과 면접 설명력이 약해질 수 있습니다. 대신 주제 후보, 반론, 한계, 추가 자료를 찾는 데 사용합니다.",
      body: `
        <div class="content-block">
          <h3>AI를 써도 되는 장면</h3>
          <div class="type-grid">
            <div><b>질문 확장</b><span>수업 개념에서 더 물어볼 수 있는 질문을 찾습니다.</span></div>
            <div><b>자료 관점 찾기</b><span>같은 주제를 사회, 과학, 윤리, 경제 관점으로 나눠 봅니다.</span></div>
            <div><b>반론 찾기</b><span>내 주장과 반대되는 근거를 찾아 탐구의 균형을 잡습니다.</span></div>
            <div><b>한계 정리</b><span>내 탐구에서 부족한 자료, 방법, 변수 통제를 확인합니다.</span></div>
          </div>
        </div>
        <div class="content-block">
          <h3>AI를 조심해야 하는 장면</h3>
          <p>세특 문장 자체를 AI가 대신 쓰게 하면 학생이 면접에서 설명하기 어렵고, 실제 수업 경험과 맞지 않는 표현이 생길 수 있습니다. 최종 자기평가서와 상담 자료는 학생 자신의 말로 정리해야 합니다.</p>
        </div>
        <div class="content-block">
          <h3>AI 질문 예시</h3>
          <div class="type-grid">
            <div><b>질문 만들기</b><span>이 개념에서 고등학생이 탐구할 수 있는 질문을 세 가지로 좁혀 달라고 요청합니다.</span></div>
            <div><b>관점 나누기</b><span>같은 주제를 과학, 사회, 윤리, 경제 관점으로 비교해 달라고 요청합니다.</span></div>
            <div><b>한계 찾기</b><span>내 탐구 방법에서 부족한 자료나 변수를 찾아 달라고 요청합니다.</span></div>
            <div><b>면접 대비</b><span>내 탐구를 설명할 때 받을 수 있는 질문을 예상해 달라고 요청합니다.</span></div>
          </div>
        </div>
      `
    },
    "holistic-interview": {
      group: "holistic",
      tone: "holistic",
      title: "면접 대비",
      summary: "면접은 학생부를 외우는 시간이 아니라 사고 과정을 설명하는 시간입니다.",
      heroLabel: "면접",
      heroTitle: "학생부에 적힌 탐구를 학생 자신의 말로 설명할 수 있어야 합니다.",
      heroText: "서류 기반 면접은 활동의 진정성과 이해도를 확인합니다. 활동 동기, 사용한 개념, 과정, 결과, 한계, 후속 활동을 말할 수 있어야 합니다.",
      body: `
        <div class="content-block">
          <h3>면접 질문으로 바꿔 보기</h3>
          <div class="type-grid">
            <div><b>왜 시작했나요?</b><span>탐구 동기와 수업 개념을 설명합니다.</span></div>
            <div><b>무엇을 사용했나요?</b><span>자료, 실험, 조사, 토론 방법을 설명합니다.</span></div>
            <div><b>무엇을 알게 되었나요?</b><span>결과와 깨달음을 구체적으로 말합니다.</span></div>
            <div><b>다음에는 무엇을 할 건가요?</b><span>한계와 후속 탐구를 연결합니다.</span></div>
          </div>
        </div>
        <div class="check-panel">
          <div><h3>면접 전 점검</h3><p>학생부에 적힌 내용이 내 말로 설명 가능한지 확인합니다.</p></div>
          <div class="checklist">
            <label><input type="checkbox" /> 세특에 적힌 핵심 개념을 설명할 수 있다.</label>
            <label><input type="checkbox" /> 탐구 과정에서 내가 맡은 역할을 말할 수 있다.</label>
            <label><input type="checkbox" /> 결과뿐 아니라 한계도 말할 수 있다.</label>
            <label><input type="checkbox" /> 다음 탐구나 진로 관심으로 어떻게 이어졌는지 말할 수 있다.</label>
          </div>
        </div>
      `
    }
  }
};
