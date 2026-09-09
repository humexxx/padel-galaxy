import { Link } from "react-router"

import type { NavItem } from "@/hooks/use-nav-items"
import { cn } from "@/lib/utils"

/**
 * The phone's primary navigation: an iOS-style tab bar pinned to the bottom
 * edge, translucent over the content, clear of the home indicator. Icons
 * over 10 px labels, the active tab tinted. Hidden from `sm` up, where the
 * header carries the same destinations as text links.
 */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:hidden"
    >
      <ul className="flex h-[3.25rem] items-stretch">
        {items.map((item) => (
          <li key={item.to} className="min-w-0 flex-1">
            <Link
              to={item.to}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                item.active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="relative">
                <item.icon
                  className="size-6"
                  strokeWidth={item.active ? 2.25 : 1.75}
                />
                {item.count !== undefined && (
                  <span className="absolute -top-1 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                    {item.count}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
