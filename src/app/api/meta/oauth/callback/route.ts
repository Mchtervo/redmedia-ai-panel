import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  completeMetaOAuth,
  getOAuthRedirectUri,
  verifyOAuthState,
} from "@/features/marketing/services/meta/oauth.service";
import { testAllMetaConnections } from "@/features/marketing/services/meta-connection.service";

export const runtime = "nodejs";

/**
 * Meta OAuth callback — code → long-lived token → DB.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(
        `/dashboard/marketing/connections?oauth=error&reason=${encodeURIComponent(reason)}`,
        request.url
      )
    );

  if (error) {
    return fail(errorDesc || error);
  }

  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cookieStore = await cookies();
  const cookieState = cookieStore.get("meta_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState || !verifyOAuthState(state)) {
    return fail("invalid_state");
  }
  if (!code) {
    return fail("missing_code");
  }

  try {
    const admin = createAdminClient();
    const origin = url.origin;
    await completeMetaOAuth(admin, {
      code,
      redirectUri: getOAuthRedirectUri(origin),
    });
    // Bağlantı sağlık taraması
    await testAllMetaConnections(admin);

    const response = NextResponse.redirect(
      new URL(
        "/dashboard/marketing/connections?oauth=success",
        request.url
      )
    );
    response.cookies.set("meta_oauth_state", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return fail(msg.slice(0, 120));
  }
}
