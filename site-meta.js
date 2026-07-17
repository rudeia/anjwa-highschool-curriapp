(() => {
  const RELEASE_FALLBACK = new Date("2026-07-17T00:00:00+09:00");

  function validDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  function seoulDateParts(value) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value);
    return Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  }

  function renderFooter(value) {
    if (document.querySelector(".site-update-footer")) return;
    const parts = seoulDateParts(value);
    const isoDate = `${parts.year}-${parts.month}-${parts.day}`;
    const displayDate = `${parts.year}.${parts.month}.${parts.day}`;
    const footer = document.createElement("footer");
    footer.className = "site-update-footer";
    footer.setAttribute("aria-label", "페이지 수정 정보");
    footer.innerHTML = `<span>최종 수정일</span><time datetime="${isoDate}">${displayDate}</time>`;
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
        gap: 8px;
        color: #66736d;
        font-family: inherit;
        font-size: 13px;
        letter-spacing: 0;
      }
      .site-update-footer time { color: #17211c; font-weight: 700; }
      @media (max-width: 620px) {
        .site-update-footer { width: calc(100% - 24px); margin-top: 24px; }
      }
    `;
    document.head.append(style);
  }

  async function resolveModifiedDate() {
    let modified = new Date(document.lastModified);
    if (location.protocol === "http:" || location.protocol === "https:") {
      try {
        const response = await fetch(new URL("./site-meta.js", document.baseURI), {
          method: "HEAD",
          cache: "no-store"
        });
        const headerDate = new Date(response.headers.get("last-modified") || "");
        if (validDate(headerDate)) modified = headerDate;
      } catch (_error) {
        // document.lastModified and the release fallback remain available offline.
      }
    }
    if (!validDate(modified) || modified < RELEASE_FALLBACK) return RELEASE_FALLBACK;
    return modified;
  }

  async function init() {
    addStyles();
    renderFooter(await resolveModifiedDate());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
