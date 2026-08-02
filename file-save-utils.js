(() => {
  "use strict";

  function fallbackDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveBlob({ blob, filename, description = "파일", accept = {} }) {
    if (!(blob instanceof Blob)) throw new TypeError("저장할 파일 데이터가 없습니다.");

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description, accept }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { saved: true, method: "picker", filename };
      } catch (error) {
        if (error?.name === "AbortError") return { saved: false, canceled: true, filename };
        console.warn("저장 위치 선택 창을 열지 못해 다른 저장 방식을 사용합니다.", error);
      }
    }

    if (typeof File === "function" && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return { saved: true, method: "share", filename };
        } catch (error) {
          if (error?.name === "AbortError") return { saved: false, canceled: true, filename };
          console.warn("파일 공유 창을 열지 못해 다운로드 방식으로 저장합니다.", error);
        }
      }
    }

    fallbackDownload(blob, filename);
    return { saved: true, method: "download", filename };
  }

  window.FileSaveUtils = Object.freeze({ saveBlob });
})();
