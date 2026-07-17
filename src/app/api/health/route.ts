import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/api";

type HealthData = {
  ok: true;
  env: {
    NEXT_PUBLIC_SUPABASE_URL: boolean;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
    CHATPLACE_WEBHOOK_SECRET: boolean;
  };
};

/**
 * Production teşhis uç noktası. Değer döndürmez; yalnızca env var'ların
 * tanımlı olup olmadığını (boolean) bildirir.
 */
export async function GET() {
  const body: ApiResponse<HealthData> = {
    success: true,
    data: {
      ok: true,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
        ),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
        ),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(
          process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        ),
        CHATPLACE_WEBHOOK_SECRET: Boolean(
          process.env.CHATPLACE_WEBHOOK_SECRET?.trim()
        ),
      },
    },
  };

  return NextResponse.json(body);
}
