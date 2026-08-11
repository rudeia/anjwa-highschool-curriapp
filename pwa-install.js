(() => {
  const panel = document.querySelector("[data-pwa-install]");
  const button = panel?.querySelector("[data-pwa-install-button]");
  const status = panel?.querySelector("[data-pwa-install-status]");
  let deferredPrompt = null;
  let guide = null;

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isFileProtocol = window.location.protocol === "file:";
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function closeGuide() {
    if (!guide) return;
    guide.hidden = true;
    document.body.classList.remove("pwa-guide-open");
    button?.focus();
  }

  function ensureGuide() {
    if (guide) return guide;
    guide = document.createElement("div");
    guide.className = "pwa-guide";
    guide.hidden = true;
    guide.innerHTML = `
      <div class="pwa-guide-backdrop" data-pwa-guide-close></div>
      <section class="pwa-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="pwaGuideTitle">
        <button class="pwa-guide-close" type="button" aria-label="닫기" data-pwa-guide-close>×</button>
        <h2 id="pwaGuideTitle">홈 화면에 설치하기</h2>
        <div data-pwa-guide-content></div>
      </section>
    `;
    guide.querySelectorAll("[data-pwa-guide-close]").forEach((target) => {
      target.addEventListener("click", closeGuide);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !guide.hidden) closeGuide();
    });
    document.body.append(guide);
    return guide;
  }

  function openGuide() {
    const target = ensureGuide();
    const content = target.querySelector("[data-pwa-guide-content]");
    content.innerHTML = isFileProtocol
      ? `
        <p>파일을 직접 연 화면에서는 앱을 설치할 수 없습니다.</p>
        <ol>
          <li>배포된 진로진학 플랫폼 웹 주소로 접속합니다.</li>
          <li>이 화면의 <b>홈 화면에 설치</b> 버튼을 다시 누릅니다.</li>
        </ol>
      `
      : isIos
      ? `
        <p>iPhone과 iPad에서는 브라우저의 공유 메뉴를 이용합니다.</p>
        <ol>
          <li>브라우저 하단 또는 상단의 <b>공유</b> 버튼을 누릅니다.</li>
          <li><b>홈 화면에 추가</b>를 선택합니다.</li>
          <li>이름을 확인한 뒤 <b>추가</b>를 누릅니다.</li>
        </ol>
      `
      : `
        <p>현재 브라우저에서 자동 설치창을 열 수 없습니다.</p>
        <ol>
          <li>주소창의 설치 아이콘 또는 브라우저 메뉴를 엽니다.</li>
          <li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택합니다.</li>
          <li>메뉴가 보이지 않으면 Chrome이나 Edge에서 다시 열어주세요.</li>
        </ol>
      `;
    target.hidden = false;
    document.body.classList.add("pwa-guide-open");
    target.querySelector(".pwa-guide-close")?.focus();
  }

  async function installApp() {
    if (!deferredPrompt) {
      openGuide();
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (choice.outcome === "accepted") {
      setStatus("설치를 진행하고 있습니다.");
    } else {
      setStatus("원할 때 다시 설치할 수 있습니다.");
    }
  }

  if (isStandalone) {
    if (panel) panel.hidden = true;
  } else {
    setStatus(
      isFileProtocol
        ? "배포된 웹 주소에서 설치할 수 있습니다."
        : isIos
          ? "iPhone·iPad 설치 안내"
          : "기기에 따라 설치창 또는 안내가 열립니다."
    );
    button?.addEventListener("click", installApp);
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (panel) panel.hidden = false;
    setStatus("이 기기에 설치할 수 있습니다.");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (panel) panel.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
        .catch((error) => console.warn("서비스 워커 등록 실패", error));
    }, { once: true });
  }
})();
