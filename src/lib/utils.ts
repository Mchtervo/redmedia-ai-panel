import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Tarih+saati Türkçe yerelleştirme ile biçimlendirir; değer yoksa "—" döner. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—"
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

/** Sadece tarihi (saatsiz) Türkçe yerelleştirme ile biçimlendirir. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—"
  }

  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
    new Date(value)
  )
}
