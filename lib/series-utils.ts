type SeriesEpisode = {
  uid?: string | null;
  slug: string;
  title: string;
};

export function getSeriesTitle(series: readonly SeriesEpisode[]): string {
  const firstTitle = series[0]?.title || "";
  return firstTitle
    .replace(/\s*[-|:]?\s*(পর্ব|part|chapter|পর্বঃ)\s*[-|:]?\s*(\d+|[০-৯]+)/gi, "")
    .replace(/\s*[-|:]?\s*(\d+|[০-৯]+)\s*$/gi, "")
    .replace(/\s*\(\s*(\d+|[০-৯]+)\s*\)\s*$/gi, "")
    .trim() || firstTitle;
}

export function getSeriesId(series: readonly SeriesEpisode[]): string {
  const firstEpisode = series[0];
  const key = firstEpisode?.uid || firstEpisode?.slug || getSeriesTitle(series);
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  return `s-${(hash >>> 0).toString(36)}`;
}
