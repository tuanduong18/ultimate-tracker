/**
 * Hand a fetched file to the browser's own download, then let the memory go.
 *
 * For files the API builds (the export, the import template): they are
 * fetched with the bearer token, so there is no URL a plain link could point at.
 */
export function saveFile(file: Blob, name: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // After the click has been handled, not during it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
