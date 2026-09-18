"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react"

export interface TablePaginationProps {
  totalItems: number
  currentPage: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
}

export function TablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "items",
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startRange = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRange = Math.min(currentPage * pageSize, totalItems)

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 bg-background text-xs text-muted-foreground ${className ?? ""}`}
    >
      {/* Left: Page Size Selector & Range Indicator */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value))
            onPageChange(1)
          }}
          aria-label="Rows per page"
          className="h-7 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground outline-hidden cursor-pointer"
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <span className="text-[11px] text-muted-foreground ml-2 tabular-nums">
          Showing <strong className="text-foreground font-medium">{startRange}–{endRange}</strong> of{" "}
          <strong className="text-foreground font-medium">{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(1)}
          className="h-7 px-2 text-xs font-medium cursor-pointer"
          title="First Page"
        >
          <ChevronsLeftIcon className="size-3.5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="h-7 px-2.5 text-xs font-medium gap-1 cursor-pointer"
        >
          <ChevronLeftIcon className="size-3.5" />
          <span>Prev</span>
        </Button>

        <div className="flex items-center px-2 text-xs font-medium text-foreground tabular-nums">
          <span>
            {currentPage} / {totalPages}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="h-7 px-2.5 text-xs font-medium gap-1 cursor-pointer"
        >
          <span>Next</span>
          <ChevronRightIcon className="size-3.5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="h-7 px-2 text-xs font-medium cursor-pointer"
          title="Last Page"
        >
          <ChevronsRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
