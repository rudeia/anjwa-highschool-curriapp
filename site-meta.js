(() => {
  const RELEASE = Object.freeze({
    version: "1.02.00",
    releasedAt: "2026-07-23T08:34:00+09:00"
  });

  function seoulDateParts(value) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(value);
    return Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  }

  function renderFooter() {
    if (document.querySelector(".site-update-footer")) return;
    const parts = seoulDateParts(new Date(RELEASE.releasedAt));
    const displayDate = `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
    const footer = document.createElement("footer");
    footer.className = "site-update-footer";
    footer.setAttribute("aria-label", "페이지 버전 정보");
    footer.innerHTML = `
      <span>버전</span>
      <strong>${RELEASE.version}</strong>
      <time datetime="${RELEASE.releasedAt}">(${displayDate})</time>
      <a class="teacher-dashboard-link" href="./teacher-dashboard.html">교사 상담용</a>
    `;
    document.body.append(footer);
  }

  function addStyles() {
    if (document.querySelector("style[data-site-update-footer]")) return;
    const style = document.createElement("style");
    style.dataset.siteUpdateFooter = "true";
    style.textContent = `
      .site-update-footer {
        box-sizing: border-box;
        width: min(100% - 32px, 1440px);
        margin: 32px auto 18px;
        padding: 14px 4px 0;
        border-top: 1px solid #d9e1dc;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
        color: #66736d;
        font-family: inherit;
        font-size: 13px;
        letter-spacing: 0;
      }
      .site-update-footer strong { color: #17211c; }
      .site-update-footer time { color: #66736d; font-weight: 600; }
      .site-update-footer .teacher-dashboard-link {
        min-height: 28px;
        margin-left: 5px;
        padding: 4px 8px;
        border: 1px solid #d9e1dc;
        border-radius: 5px;
        background: #fff;
        color: #405149;
        font-size: 12px;
        font-weight: 750;
        line-height: 18px;
        text-decoration: none;
      }
      .site-update-footer .teacher-dashboard-link:hover { border-color: #267a55; color: #267a55; }
      @media (max-width: 620px) {
        .site-update-footer { width: calc(100% - 24px); margin-top: 24px; }
      }
    `;
    document.head.append(style);
  }

  function init() {
    addStyles();
    renderFooter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
