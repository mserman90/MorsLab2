export type FileDownload = {
  url: string;
  filename: string;
  download: () => void;
  dispose: () => void;
};

// Safari may not read a blob until the user confirms its download prompt.
const DOWNLOAD_GRACE_PERIOD = 60_000;

export function createFileDownload(blob: Blob, filename: string): FileDownload {
  const url = URL.createObjectURL(blob);
  const anchors = new Set<HTMLAnchorElement>();
  let disposed = false;

  return {
    url,
    filename,
    download() {
      if (disposed) throw new Error('Dosya bağlantısı kapatıldı. WAV dosyasını yeniden oluşturun.');
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      anchor.hidden = true;
      anchors.add(anchor);
      document.body.append(anchor);
      anchor.click();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.setTimeout(() => {
        anchors.forEach((anchor) => anchor.remove());
        anchors.clear();
        URL.revokeObjectURL(url);
      }, DOWNLOAD_GRACE_PERIOD);
    },
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const file = createFileDownload(blob, filename);
  try { file.download(); } finally { file.dispose(); }
}