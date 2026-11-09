export function money(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function date(value) {
  return new Date(value).toLocaleDateString();
}

export function dateTime(value) {
  return new Date(value).toLocaleString();
}
