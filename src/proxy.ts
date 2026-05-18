import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth-constants"

const PUBLIC_PATHS = ["/login", "/api/auth/login"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const hasToken = Boolean(token)

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (pathname === "/login" && hasToken) {
      return NextResponse.redirect(new URL("/pozos", request.url))
    }
    return NextResponse.next()
  }

  if (!hasToken) {
    const url = new URL("/login", request.url)
    if (pathname !== "/") url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
}
