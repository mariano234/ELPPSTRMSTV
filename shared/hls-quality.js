export function variantHeight(line) {
  const resolution = /^#EXT-X-STREAM-INF:.*\bRESOLUTION=\d+x(\d+)(?:,|$)/i.exec(line);
  return resolution ? Number(resolution[1]) : 0;
}
