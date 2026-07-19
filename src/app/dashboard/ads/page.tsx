import { redirect } from "next/navigation";

/** Eski Ads rotası → AI Marketing Director */
export default function AdsRedirectPage() {
  redirect("/dashboard/marketing");
}
