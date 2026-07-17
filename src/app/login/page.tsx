import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş Yap — Redmedia AI Panel",
};

export default async function LoginPage() {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

  if (!hasSupabaseEnv) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Redmedia AI Panel
          </h1>
          <p className="mt-4 text-sm text-red-400">
            Supabase ortam değişkenleri eksik. Vercel Environment Variables
            içinde NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY
            tanımlı olmalı (Production).
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Redmedia AI Panel
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Devam etmek için giriş yapın</p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
