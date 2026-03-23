import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ChartColumnBig,
  CircleDot,
  Compass,
  MapPinned,
  MoveRight,
  Store,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Waves,
} from "lucide-react";
import TrafficScoutLogo from "@/components/brand/TrafficScoutLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const contactEmail = "hello@gettrafficscout.com";
const contactHref = `mailto:${contactEmail}?subject=${encodeURIComponent("TrafficScout inquiry")}`;

const featureCards = [
  {
    icon: Users,
    title: "Foot Traffic Estimates",
    description: "Estimate activity around stores, venues, and commercial properties.",
  },
  {
    icon: TrendingUp,
    title: "Peak Time Trends",
    description: "Understand when movement rises, falls, and where demand concentrates.",
  },
  {
    icon: Compass,
    title: "Competitive Insights",
    description: "Benchmark nearby businesses and identify stronger opportunities.",
  },
  {
    icon: ChartColumnBig,
    title: "Location Scoring",
    description: "Compare candidate sites with a clear, decision-ready scoring model.",
  },
];

const steps = [
  {
    title: "Select a location",
    body: "Search by business, address, neighborhood, or map area.",
  },
  {
    title: "Analyze movement",
    body: "Review estimated traffic volume, peak windows, and surrounding activity.",
  },
  {
    title: "Act with confidence",
    body: "Choose better locations, optimize timing, and support investment decisions.",
  },
];

const useCases = [
  {
    icon: Store,
    title: "Retail",
    bullets: ["Find stronger storefront corridors", "Compare neighboring trade areas", "Prioritize openings with confidence"],
  },
  {
    icon: Building2,
    title: "Real Estate",
    bullets: ["Support leasing conversations with movement data", "Assess risk across candidate properties", "Validate asset positioning"],
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants",
    bullets: ["Time lunch and dinner demand", "Understand weekday versus weekend flow", "Reduce site-selection guesswork"],
  },
  {
    icon: Compass,
    title: "Franchise Growth",
    bullets: ["Standardize territory scoring", "Compare expansion markets faster", "Back every recommendation with evidence"],
  },
];

function Reveal({ children, delay = 0, y = 24, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function NavLink({ href, children }) {
  return (
    <a href={href} className="text-sm font-medium text-slate-600 transition-colors hover:text-[#091E31]">
      {children}
    </a>
  );
}

function SectionHeading({ eyebrow, title, body, align = "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#177F64]">{eyebrow}</p>
      <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-[#091E31]">{title}</h2>
      {body ? <p className="mt-5 text-lg leading-8 text-slate-600">{body}</p> : null}
    </div>
  );
}

function InvertedSectionHeading({ eyebrow, title, body, align = "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#8DE7BF]">{eyebrow}</p>
      <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight text-white">{title}</h2>
      {body ? <p className="mt-5 text-lg leading-8 text-slate-200">{body}</p> : null}
    </div>
  );
}

function HeroVisual() {
  const bars = useMemo(() => [48, 62, 76, 68, 88, 94, 72], []);

  return (
    <div className="relative w-full max-w-[620px] min-w-0">
      <div className="absolute -left-10 top-16 h-40 w-40 rounded-full bg-[#1777F6]/15 blur-3xl" />
      <div className="absolute -right-6 bottom-4 h-44 w-44 rounded-full bg-[#2EC671]/20 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/85 shadow-[0_30px_80px_rgba(9,30,49,0.12)] backdrop-blur"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(23,119,246,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(46,198,113,0.12),transparent_30%)]" />
        <div className="relative border-b border-slate-200/80 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#091E31] sm:text-base">Live territory snapshot</p>
              <p className="truncate text-xs text-slate-500 sm:text-sm">Jersey City retail corridor</p>
            </div>
            <div className="shrink-0 rounded-full bg-[#091E31] px-3 py-1 text-xs font-semibold text-white sm:text-sm">
              Opportunity score 8.7
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(260px,0.92fr)]">
          <div className="min-w-0 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#f4fbf7_100%)] p-4 sm:p-5">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="max-w-full rounded-full bg-white/80 px-3 py-1 text-xs font-semibold leading-5 text-[#177F64] shadow-sm sm:text-sm">
                Predictive location intelligence
              </div>
              <div className="flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs leading-5 text-slate-500 shadow-sm sm:text-sm">
                <CircleDot className="h-3.5 w-3.5 text-[#1777F6]" />
                <span>High-confidence corridor</span>
              </div>
            </div>

            <div className="relative mt-5 aspect-[1.25/1] overflow-hidden rounded-[24px] border border-white/70 bg-[#eaf2ff]">
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[size:44px_44px]" />
              <div className="absolute inset-y-0 left-[36%] w-[18%] rotate-12 bg-white/60 blur-[2px]" />
              <div className="absolute inset-y-0 right-[18%] w-[16%] -rotate-12 bg-white/50 blur-[2px]" />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 360" fill="none">
                <path
                  d="M48 276C116 208 174 194 228 202C278 210 318 162 362 140C399 122 430 122 458 94"
                  stroke="url(#heroRoute)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="8 14"
                />
                <path
                  d="M76 132C126 124 162 138 203 172C238 201 276 218 323 216C371 214 411 198 450 166"
                  stroke="#1777F6"
                  strokeOpacity="0.18"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="heroRoute" x1="48" y1="276" x2="458" y2="94" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#1777F6" />
                    <stop offset="1" stopColor="#2EC671" />
                  </linearGradient>
                </defs>
              </svg>

              {[
                { left: "12%", top: "68%", score: "6.8" },
                { left: "51%", top: "44%", score: "8.7" },
                { left: "79%", top: "25%", score: "7.9" },
              ].map((node, index) => (
                <motion.div
                  key={node.score}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25 + index * 0.16, duration: 0.35 }}
                  className="absolute"
                  style={{ left: node.left, top: node.top }}
                >
                  <div className="absolute -inset-4 rounded-full bg-[#2EC671]/20 blur-xl" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#091E31] text-sm font-semibold text-white shadow-lg sm:h-14 sm:w-14">
                    {node.score}
                  </div>
                </motion.div>
              ))}

              <div className="absolute bottom-4 left-4 right-4 max-w-[280px] rounded-2xl border border-white/70 bg-white/92 px-4 py-2.5 shadow-lg sm:max-w-[300px]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Peak window</p>
                <p className="mt-1 text-base font-bold text-[#091E31] sm:text-lg">12 PM – 2 PM</p>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#091E31] sm:text-base">Traffic trend</p>
                  <p className="text-xs text-slate-500 sm:text-sm">Week over week movement</p>
                </div>
                <div className="max-w-full rounded-full bg-[#2EC671]/15 px-3 py-1 text-xs font-semibold leading-5 text-[#177F64] sm:text-sm">
                  +23% stronger traffic
                </div>
              </div>
              <div className="mt-4 flex h-32 items-end gap-2">
                {bars.map((height, index) => (
                  <motion.div
                    key={height}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: 0.2 + index * 0.08, duration: 0.45, ease: "easeOut" }}
                    className={`w-full rounded-t-2xl ${index > 4 ? "bg-[#2EC671]" : "bg-[#1777F6]/78"}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {[
                ["Daily footfall", "18.4K"],
                ["Conversion zone", "North waterfront"],
                ["Competitive index", "Moderate"],
                ["Decision confidence", "High"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.14em]">
                    {label}
                  </p>
                  <p className="mt-2 text-base font-semibold leading-snug text-[#091E31] sm:text-lg">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.45 }}
        className="absolute -left-4 top-10 hidden rounded-full border border-[#1777F6]/10 bg-white/90 px-4 py-2 text-sm font-semibold text-[#091E31] shadow-lg lg:flex lg:items-center lg:gap-2"
      >
        <Waves className="h-4 w-4 text-[#1777F6]" />
        Predictive location intelligence
      </motion.div>
    </div>
  );
}

export default function Landing() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#091E31]">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[8%] top-[8%] h-72 w-72 rounded-full bg-[#1777F6]/10 blur-3xl" />
        <div className="absolute right-[10%] top-[18%] h-80 w-80 rounded-full bg-[#2EC671]/12 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.2]" fill="none">
          <path
            d="M200 40C280 90 300 150 360 180C420 210 520 214 640 286"
            stroke="url(#pageRouteA)"
            strokeWidth="2"
            strokeDasharray="10 14"
          />
          <path
            d="M1040 120C948 170 910 248 842 272C776 296 690 292 598 346"
            stroke="url(#pageRouteB)"
            strokeWidth="2"
            strokeDasharray="8 12"
          />
          <defs>
            <linearGradient id="pageRouteA" x1="200" y1="40" x2="640" y2="286" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1777F6" />
              <stop offset="1" stopColor="#2EC671" />
            </linearGradient>
            <linearGradient id="pageRouteB" x1="1040" y1="120" x2="598" y2="346" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2EC671" />
              <stop offset="1" stopColor="#1777F6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <header className="sticky top-0 z-50 border-b border-white/70 bg-[rgba(248,250,252,0.72)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <TrafficScoutLogo compact />
          <nav className="hidden items-center gap-8 lg:flex">
            <NavLink href="#features">Features</NavLink>
            <NavLink href="#how-it-works">How It Works</NavLink>
            <NavLink href="#use-cases">Use Cases</NavLink>
            <NavLink href="#pricing">Pricing</NavLink>
            <NavLink href={contactHref}>Contact</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="hidden rounded-full border-slate-300 bg-white/80 px-5 lg:inline-flex">
              <RouterLink to="/app">View Demo</RouterLink>
            </Button>
            <Button asChild className="rounded-full bg-[#177F64] px-5 text-white shadow-[0_16px_32px_rgba(23,127,100,0.24)] hover:bg-[#146b56]">
              <a href="#cta">Get Early Access</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1.02fr_1fr]">
            <Reveal className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1777F6]/15 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                <CircleDot className="h-3.5 w-3.5 text-[#1777F6]" />
                Built for modern retail, real estate, and location-driven teams
              </div>
              <h1 className="mt-8 text-5xl font-bold leading-[1.04] tracking-tight text-[#091E31] md:text-6xl xl:text-7xl">
                See how people move
                <span className="mt-2 block bg-gradient-to-r from-[#1777F6] via-[#177F64] to-[#2EC671] bg-clip-text text-transparent">
                  before you do.
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600 md:text-xl">
                TrafficScout helps you scout high-value locations using real-world foot traffic insights and predictive analytics.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Button asChild size="lg" className="rounded-full bg-[#177F64] px-7 text-white shadow-[0_18px_34px_rgba(23,127,100,0.26)] hover:bg-[#146b56]">
                  <a href="#cta">
                    Get Early Access
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-slate-300 bg-white/90 px-7 text-[#091E31] hover:bg-white">
                  <RouterLink to="/app">
                    View Demo
                    <MoveRight className="h-4 w-4" />
                  </RouterLink>
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ["8.7/10", "Opportunity scoring"],
                  ["12-2 PM", "Peak demand window"],
                  ["23%", "Higher traffic corridor"],
                ].map(([value, label], index) => (
                  <Reveal key={label} delay={0.08 + index * 0.06}>
                    <div className="rounded-[24px] border border-white/70 bg-white/85 p-4 shadow-[0_20px_40px_rgba(9,30,49,0.06)] backdrop-blur">
                      <p className="text-2xl font-bold text-[#091E31]">{value}</p>
                      <p className="mt-1 text-sm text-slate-500">{label}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12} className="lg:justify-self-end">
              <HeroVisual />
            </Reveal>
          </div>
        </section>

        <section className="px-6 lg:px-10">
          <div className="mx-auto max-w-7xl rounded-[28px] border border-white/70 bg-white/85 px-6 py-5 shadow-[0_18px_50px_rgba(9,30,49,0.06)] backdrop-blur">
            <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
              <p className="text-sm font-medium text-slate-500">
                Built for modern retail, real estate, and location-driven teams
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {["Retail Ops", "Leasing Teams", "Growth Strategy", "Expansion", "Site Selection"].map((pill) => (
                  <div
                    key={pill}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600"
                  >
                    {pill}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Location Intelligence"
                title="Scout smarter with location intelligence"
                body="From first-pass market scans to high-stakes site decisions, TrafficScout gives teams a sharper picture of where demand really shows up."
              />
            </Reveal>

            <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 0.06}>
                  <div className="group h-full rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_22px_50px_rgba(9,30,49,0.06)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_rgba(9,30,49,0.10)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1777F6] to-[#2EC671] text-white shadow-lg">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-[#091E31]">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl rounded-[36px] border border-[#091E31]/6 bg-[linear-gradient(135deg,#091E31_0%,#11314c_100%)] px-8 py-16 text-white shadow-[0_34px_90px_rgba(9,30,49,0.18)] lg:px-14">
            <Reveal>
              <InvertedSectionHeading
                eyebrow="How It Works"
                title="From first scout to confident decision"
                body="TrafficScout turns messy location questions into an executive-ready workflow your team can repeat."
                align="left"
              />
            </Reveal>

            <div className="relative mt-16 grid gap-6 lg:grid-cols-3">
              <div className="pointer-events-none absolute left-10 right-10 top-[38px] hidden h-px bg-gradient-to-r from-[#1777F6] via-white/50 to-[#2EC671] lg:block" />
              {steps.map((step, index) => (
                <Reveal key={step.title} delay={index * 0.08} className="relative">
                  <div className="h-full rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/12 text-sm font-semibold text-white">
                        0{index + 1}
                      </div>
                      <div className="h-1 w-12 rounded-full bg-gradient-to-r from-[#1777F6] to-[#2EC671]" />
                    </div>
                    <h3 className="text-2xl font-semibold">{step.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-slate-100/90">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="use-cases" className="px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <Reveal>
              <SectionHeading
                eyebrow="Use Cases"
                title="Made for teams that win on location"
                body="TrafficScout is designed for operators and decision-makers who need credible movement intelligence, not more guesswork."
              />
            </Reveal>

            <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {useCases.map((useCase, index) => (
                <Reveal key={useCase.title} delay={index * 0.05}>
                  <div className="h-full rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_22px_50px_rgba(9,30,49,0.06)]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#091E31] text-white shadow-lg">
                      <useCase.icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-[#091E31]">{useCase.title}</h3>
                    <ul className="mt-5 space-y-3">
                      {useCase.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                          <CircleDot className="mt-1 h-4 w-4 text-[#177F64]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <Reveal>
              <div className="overflow-hidden rounded-[36px] border border-white/70 bg-white p-6 shadow-[0_28px_70px_rgba(9,30,49,0.08)]">
                <div className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f7fbff_48%,#f2fcf6_100%)] p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#091E31]">Insights you can act on immediately</p>
                      <p className="text-xs text-slate-500">Downtown corridor comparison</p>
                    </div>
                    <div className="rounded-full bg-[#177F64]/12 px-3 py-1 text-xs font-semibold text-[#177F64]">Live scenario model</div>
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#091E31]">Zone comparison</p>
                        <MapPinned className="h-4 w-4 text-[#1777F6]" />
                      </div>
                      <div className="mt-5 space-y-4">
                        {[
                          ["North waterfront", "8.7", "Peak window: 12–2 PM"],
                          ["Journal Square", "7.4", "Peak window: 8–10 AM"],
                          ["Downtown station", "8.1", "Peak window: 5–7 PM"],
                        ].map(([name, score, meta]) => (
                          <div key={name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-[#091E31]">{name}</p>
                              <p className="text-xs text-slate-500">{meta}</p>
                            </div>
                            <div className="rounded-full bg-[#091E31] px-3 py-1 text-sm font-semibold text-white">{score}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {["+23% stronger traffic", "Peak window: 12–2 PM", "Opportunity score: 8.7/10"].map((chip) => (
                        <div key={chip} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-[#091E31]">{chip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <SectionHeading
                eyebrow="Product Insights"
                title="Insights you can act on immediately"
                body="Understand movement, compare zones, and surface decision-ready signals your team can use in the same meeting."
                align="left"
              />
              <ul className="mt-10 space-y-4">
                {[
                  "Spot high-opportunity zones",
                  "Understand true peak windows",
                  "Reduce location risk",
                  "Support expansion with data",
                ].map((point) => (
                  <li key={point} className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#177F64]/12 text-[#177F64]">
                      <CircleDot className="h-4 w-4" />
                    </div>
                    <span className="text-base font-medium text-[#091E31]">{point}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-7xl rounded-[36px] border border-white/70 bg-[linear-gradient(135deg,#091E31_0%,#123655_50%,#177F64_140%)] px-8 py-16 text-white shadow-[0_34px_90px_rgba(9,30,49,0.20)]">
            <Reveal>
              <InvertedSectionHeading
                eyebrow="Why Teams Switch"
                title="Scout your next location with confidence"
                body="Join the waitlist and see how TrafficScout turns movement into smarter business decisions."
              />
            </Reveal>

            <div id="cta" className="mx-auto mt-12 max-w-2xl">
              <form className="rounded-[28px] border border-white/10 bg-white/10 p-3 backdrop-blur" onSubmit={(event) => event.preventDefault()}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your work email"
                    className="h-12 rounded-2xl border-white/15 bg-white text-[#091E31] placeholder:text-slate-400"
                  />
                  <Button asChild size="lg" className="h-12 rounded-2xl bg-[#2EC671] px-6 text-[#091E31] hover:bg-[#27b363]">
                    <RouterLink to="/app">Request Access</RouterLink>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="border-t border-slate-200/80 px-6 py-12 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <TrafficScoutLogo />
            <p className="mt-4 text-sm leading-7 text-slate-600">
              TrafficScout helps businesses scout high-value locations with foot traffic intelligence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-5">
            {[
              ["Features", "#features"],
              ["Use Cases", "#use-cases"],
              ["Contact", contactHref],
              ["Privacy", "#"],
              ["Terms", "#"],
            ].map(([label, href]) => (
              <a key={label} href={href} className="transition-colors hover:text-[#091E31]">
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
