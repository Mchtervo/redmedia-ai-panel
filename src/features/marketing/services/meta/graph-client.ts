/**
 * Meta Graph API HTTP istemcisi.
 * Token loglanmaz; hata mesajları sadeleştirilir.
 */

export class MetaGraphError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly fbCode: number | null;

  constructor(
    message: string,
    opts: { code: string; httpStatus: number; fbCode?: number | null }
  ) {
    super(message);
    this.name = "MetaGraphError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.fbCode = opts.fbCode ?? null;
  }
}

export type GraphPaging = {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
};

export type GraphListResponse<T> = {
  data: T[];
  paging?: GraphPaging;
};

function graphVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || "v22.0";
}

export function graphBaseUrl(): string {
  return `https://graph.facebook.com/${graphVersion()}`;
}

type GraphGetOptions = {
  accessToken?: string;
  path: string;
  params?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
  /** true ise access_token query'ye eklenmez (oauth/access_token vb.) */
  omitAccessToken?: boolean;
};

function sanitizeErrorMessage(raw: string): string {
  // Token / secret sızmasını engelle
  return raw
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/EAA[A-Za-z0-9]+/g, "[redacted_token]")
    .slice(0, 400);
}

export async function graphGet<T>(opts: GraphGetOptions): Promise<T> {
  const url = new URL(
    opts.path.startsWith("http")
      ? opts.path
      : `${graphBaseUrl()}/${opts.path.replace(/^\//, "")}`
  );
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  if (!opts.omitAccessToken && opts.accessToken) {
    url.searchParams.set("access_token", opts.accessToken);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      signal: opts.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new MetaGraphError("Meta Graph ağına ulaşılamadı.", {
      code: "network_error",
      httpStatus: 0,
    });
  }

  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: number; type?: string };
  } | null;

  if (!response.ok || json?.error) {
    const msg = sanitizeErrorMessage(
      json?.error?.message ?? `HTTP ${response.status}`
    );
    const fbCode = json?.error?.code ?? null;
    const isToken =
      fbCode === 190 ||
      /session has expired|invalid oauth|cannot parse access token/i.test(msg);
    throw new MetaGraphError(
      isToken ? "Meta erişim tokeni geçersiz veya süresi dolmuş." : msg,
      {
        code: isToken ? "token_expired" : "graph_error",
        httpStatus: response.status,
        fbCode,
      }
    );
  }

  return json as T;
}

/** Tüm sayfaları dolaşır (maxPages güvenlik limiti). */
export async function graphGetAll<T>(
  opts: Omit<GraphGetOptions, "path"> & {
    path: string;
    limit?: number;
    maxPages?: number;
  }
): Promise<T[]> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 50;
  const collected: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const res = await graphGet<GraphListResponse<T>>({
      accessToken: opts.accessToken,
      path: opts.path,
      params: {
        ...opts.params,
        limit,
        after,
      },
      signal: opts.signal,
    });
    collected.push(...(res.data ?? []));
    after = res.paging?.cursors?.after;
    if (!after || !res.paging?.next) break;
  }

  return collected;
}

export async function graphPostForm<T>(opts: {
  path: string;
  body: Record<string, string>;
}): Promise<T> {
  const url = `${graphBaseUrl()}/${opts.path.replace(/^\//, "")}`;
  const body = new URLSearchParams(opts.body);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    });
  } catch {
    throw new MetaGraphError("Meta OAuth ağına ulaşılamadı.", {
      code: "network_error",
      httpStatus: 0,
    });
  }

  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: number };
    access_token?: string;
  } | null;

  if (!response.ok || json?.error) {
    throw new MetaGraphError(
      sanitizeErrorMessage(json?.error?.message ?? `HTTP ${response.status}`),
      {
        code: "oauth_error",
        httpStatus: response.status,
        fbCode: json?.error?.code ?? null,
      }
    );
  }

  return json as T;
}

/** Graph JSON POST (Messaging API vb.). */
export async function graphPostJson<T>(opts: {
  accessToken: string;
  path: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<T> {
  const url = new URL(
    `${graphBaseUrl()}/${opts.path.replace(/^\//, "")}`
  );
  url.searchParams.set("access_token", opts.accessToken);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(opts.body),
      signal: opts.signal,
      cache: "no-store",
    });
  } catch {
    throw new MetaGraphError("Meta Graph ağına ulaşılamadı.", {
      code: "network_error",
      httpStatus: 0,
    });
  }

  const json = (await response.json().catch(() => null)) as {
    error?: { message?: string; code?: number; error_subcode?: number };
  } | null;

  if (!response.ok || json?.error) {
    const msg = sanitizeErrorMessage(
      json?.error?.message ?? `HTTP ${response.status}`
    );
    const fbCode = json?.error?.code ?? null;
    const isToken =
      fbCode === 190 ||
      /session has expired|invalid oauth|cannot parse access token/i.test(msg);
    throw new MetaGraphError(
      isToken ? "Meta erişim tokeni geçersiz veya süresi dolmuş." : msg,
      {
        code: isToken ? "token_expired" : "graph_error",
        httpStatus: response.status,
        fbCode,
      }
    );
  }

  return json as T;
}
