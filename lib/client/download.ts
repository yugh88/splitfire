import { strToU8, zipSync } from "fflate";

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadText(name: string, text: string, type = "text/plain") {
  downloadBlob(name, new Blob([text], { type: `${type};charset=utf-8` }));
}

export function downloadZip(name: string, files: Record<string, string>) {
  const zipped = zipSync(
    Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])),
  );
  downloadBlob(name, new Blob([zipped as BlobPart], { type: "application/zip" }));
}
