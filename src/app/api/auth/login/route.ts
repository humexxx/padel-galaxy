import { NextResponse } from "next/server"
import { SESSION_COOKIE, SESSION_MAX_AGE, signToken, verifyCredentials } from "@/lib/auth"

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }
  const email = (body.email ?? "").trim()
  const password = body.password ?? ""

  if (!email || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 })
  }

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
  }

  const token = signToken(email)
  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
