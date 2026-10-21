export type MapContext = {
  level: "B1" | "B2" | "C1";
  query: string;
  status: string;
  page: number;
  selectedId: string | null;
};

// Only known map fields are restored; never accept a return URL from input.
export function readMapContext(params: Pick<URLSearchParams, "get">): MapContext {
  const level = params.get("level");
  const status = params.get("status") || "all";
  const page = Number(params.get("page") || 1);
  return {
    level: level === "B2" || level === "C1" ? level : "B1",
    query: (params.get("q") || "").slice(0, 100),
    status: ["all", "new", "learning", "known", "mastered"].includes(status) ? status : "all",
    page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1,
    selectedId: (params.get("selected") || "").slice(0, 100) || null,
  };
}

export function mapContextQuery(context: MapContext): string {
  const params = new URLSearchParams({ level: context.level, q: context.query, status: context.status, page: String(context.page) });
  if (context.selectedId) params.set("selected", context.selectedId);
  return params.toString();
}

export function mapReturnHref(encodedContext: string | null): string {
  return `/knowledge-map?${mapContextQuery(readMapContext(new URLSearchParams(encodedContext || "")))}`;
}
