import { NextResponse } from "next/server";
import { createClient } from "@/server/supabase/server";
import {
  buildMetaOAuthAuthorizeUrl,
  createOAuthState,
  getOAuthRedirectUri,
} from "@/features/marketing/services/meta/oauth.service";
import { hasMetaAppCredentials } from "@/features/marketing/services/meta/token.service";

export const runtime = "nodejs";

/**
 * Meta OAuth başlat — kullanıcıyı Facebook login'e yönlendirir.
 */
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!hasMetaAppCredentials()) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/marketing/connections?oauth=error&reason=missing_app",
        request.url
      )
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = getOAuthRedirectUri(origin);
  const state = createOAuthState();
  const authorizeUrl = buildMetaOAuthAuthorizeUrl({ redirectUri, state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });
  return response;
}
