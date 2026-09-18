import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMicros(
  micros: string | number | null | undefined,
  currency = "USD"
): string {
  if (micros === null || micros === undefined || micros === "") {
    return "$0"
  }
  const numeric = typeof micros === "string" ? Number(micros) : micros
  if (isNaN(numeric)) return "$0"
  const dollars = numeric / 1_000_000

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: dollars >= 1000 ? 0 : 2,
  }).format(dollars)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d)
}

export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return "—"
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`
  return formatDate(d)
}
