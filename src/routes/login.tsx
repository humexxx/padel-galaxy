import { BrandLogo } from "@/components/brand-logo"
import { LoginForm } from "@/components/login-form"

export function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center md:justify-start">
          <BrandLogo />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-[#0b0820] lg:block">
        <img
          src="/login-bg.svg"
          alt="Padel Galaxy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-10">
          <p className="max-w-md text-2xl font-semibold text-white">
            Tus pozos, organizados.
          </p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Programá, cronometrá y rankeá cada partido sin papel.
          </p>
        </div>
      </div>
    </div>
  )
}
