/**
 * Facebook Page ID çözümleme — /me/accounts üzerinden, elle ID varsayımı yok.
 */
import { graphGetAll } from "@/features/marketing/services/meta/graph-client";
import { envIgAccountId, envPageId } from "@/features/marketing/services/meta/meta-mappers";

export type MetaPageAccount = {
  id: string;
  name: string;
  category?: string | null;
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string | null;
  } | null;
};

export type ResolvePageHints = {
  envPageId?: string;
  envIgAccountId?: string;
};

export type ResolvedFacebookPage = {
  pageId: string;
  page: MetaPageAccount;
  /** env ile karşılaştırma */
  envPageId: string;
  envMismatch: boolean;
  reason:
    | "env_page_in_accounts"
    | "instagram_account_link"
    | "single_accessible_page";
};

export async function listAccessibleFacebookPages(
  accessToken: string
): Promise<MetaPageAccount[]> {
  return graphGetAll<MetaPageAccount>({
    accessToken,
    path: "me/accounts",
    params: {
      fields:
        "id,name,category,access_token,instagram_business_account{id,username}",
      limit: 100,
    },
  });
}

/**
 * Erişilebilir sayfalar arasından doğru Page ID'yi seçer.
 * Öncelik: env ID listede varsa → IG hesabına bağlı sayfa → tek sayfa.
 * Birden fazla aday ve net eşleşme yoksa hata fırlatır (ID uydurulmaz).
 */
export function resolveFacebookPageFromAccounts(
  pages: MetaPageAccount[],
  hints: ResolvePageHints = {}
): ResolvedFacebookPage {
  if (pages.length === 0) {
    throw new Error(
      "Erişilebilir Facebook sayfası yok (/me/accounts boş). pages_show_list iznini kontrol edin."
    );
  }

  const envPage = (hints.envPageId ?? "").trim();
  const envIg = (hints.envIgAccountId ?? "").trim();

  const byEnv = envPage
    ? pages.find((p) => p.id === envPage)
    : undefined;
  if (byEnv) {
    return {
      pageId: byEnv.id,
      page: byEnv,
      envPageId: envPage,
      envMismatch: false,
      reason: "env_page_in_accounts",
    };
  }

  const byIg = envIg
    ? pages.find((p) => p.instagram_business_account?.id === envIg)
    : undefined;
  if (byIg) {
    return {
      pageId: byIg.id,
      page: byIg,
      envPageId: envPage,
      envMismatch: Boolean(envPage) && envPage !== byIg.id,
      reason: "instagram_account_link",
    };
  }

  if (pages.length === 1) {
    const only = pages[0]!;
    return {
      pageId: only.id,
      page: only,
      envPageId: envPage,
      envMismatch: Boolean(envPage) && envPage !== only.id,
      reason: "single_accessible_page",
    };
  }

  const summary = pages
    .map((p) => {
      const ig = p.instagram_business_account;
      return `${p.name}(${p.id}${ig ? `;ig=${ig.id}` : ""})`;
    })
    .join(", ");
  throw new Error(
    `Birden fazla Facebook sayfası var ve otomatik eşleşme bulunamadı. ` +
      `META_PAGE_ID veya META_INSTAGRAM_ACCOUNT_ID ile eşleştirin. Sayfalar: ${summary}`
  );
}

/** Token ile /me/accounts çekip Page ID çözer. */
export async function resolveFacebookPageId(
  accessToken: string,
  hints?: ResolvePageHints
): Promise<ResolvedFacebookPage> {
  const pages = await listAccessibleFacebookPages(accessToken);
  return resolveFacebookPageFromAccounts(pages, {
    envPageId: hints?.envPageId ?? envPageId(),
    envIgAccountId: hints?.envIgAccountId ?? envIgAccountId(),
  });
}

export type ResolvedPageAccess = {
  pageId: string;
  pageAccessToken: string;
  igBusinessAccountId: string | null;
};

/**
 * Messaging / conversations için Page access token.
 * User token ile /me/accounts üzerinden alınır; kalıcı saklanmaz.
 */
export async function resolvePageAccessToken(
  userAccessToken: string,
  hints?: ResolvePageHints
): Promise<ResolvedPageAccess> {
  const resolved = await resolveFacebookPageId(userAccessToken, hints);
  const pageToken = resolved.page.access_token?.trim();
  if (!pageToken) {
    throw new Error(
      "Page access token alınamadı. pages_show_list / pages_messaging izinlerini kontrol edin."
    );
  }
  return {
    pageId: resolved.pageId,
    pageAccessToken: pageToken,
    igBusinessAccountId:
      resolved.page.instagram_business_account?.id?.trim() || null,
  };
}
