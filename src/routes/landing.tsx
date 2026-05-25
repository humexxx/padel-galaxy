import { LandingNav } from "@/components/landing/landing-nav"
import { LandingHero } from "@/components/landing/landing-hero"
import { LandingFeatures } from "@/components/landing/landing-features"
import { LandingHow } from "@/components/landing/landing-how"
import { LandingCta } from "@/components/landing/landing-cta"
import { LandingFooter } from "@/components/landing/landing-footer"

/**
 * Public landing page. Composed of small per-section components that
 * each own their own copy and layout, so adding/removing a section is
 * a one-line change here and the markup stays readable.
 *
 * The wrapper forces the light palette (`data-theme="light"` +
 * `colorScheme: "light"`) regardless of the user's OS preference,
 * mirroring trim-success and allstars-galaxy. The visual treatment
 * (radial spotlights, sticky translucent nav, faux pozo preview)
 * follows the same family of designs.
 */
export function LandingPage() {
  return (
    <div
      className="relative min-h-svh overflow-x-hidden bg-white text-zinc-900 antialiased"
      data-theme="light"
      style={{ colorScheme: "light" }}
    >
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHow />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
