import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Landmark,
  LineChart,
  Scale,
  Store,
  TrendingUp,
} from "lucide-react";
import TrafficScoutLogo from "@/components/brand/TrafficScoutLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactEmail = "hello@gettrafficscout.com";

const industries = [
  {
    icon: Landmark,
    title: "HOAs & Community Associations",
    body: "Budget planning, vendor benchmarking, and reserve-study support grounded in operational data.",
  },
  {
    icon: Building2,
    title: "Commercial Real Estate",
    body: "Site diligence, trade-area analysis, and leasing support for owners, brokers, and asset managers.",
  },
  {
    icon: Store,
    title: "Small Business",
    body: "Location scoring, demand timing, and competitive context before capital is committed.",
  },
  {
    icon: TrendingUp,
    title: "Investors",
    body: "Underwriting-ready movement and market signals that sharpen portfolio and expansion decisions.",
  },
];

const sampleReports = [
  {
    type: "Market Diligence Brief",
    audience: "Investment committee",
    summary:
      "Comparative corridor analysis with opportunity scores, peak demand windows, and risk flags for capital allocation.",
    pages: "8–12 pages",
  },
  {
    type: "Operations Benchmark Memo",
    audience: "HOA boards & operators",
    summary:
      "Peer benchmarking across cost drivers, service levels, and utilization patterns with prioritized recommendations.",
    pages: "6–10 pages",
  },
  {
    type: "Site Selection Advisory",
    audience: "Operators & franchise growth",
    summary:
      "Ranked candidate locations with traffic estimates, competitive density, and executive recommendation narrative.",
    pages: "10–14 pages",
  },
];

const methodology = [
  {
    step: "01",
    title: "Define the decision",
    body: "We clarify the financial or operational question, success criteria, and constraints before any analysis begins.",
  },
  {
    step: "02",
    title: "Assemble evidence",
    body: "Movement patterns, market context, and peer benchmarks are structured into a consistent analytical frame.",
  },
  {
    step: "03",
    title: "Model & compare",
    body: "Scenarios are scored against decision criteria so trade-offs are explicit, not buried in dashboards.",
  },
  {
    step: "04",
    title: "Recommend & brief",
    body: "Findings are delivered as executive-ready recommendations your board, partners, or investors can act on.",
  },
];

const capabilities = [
  {
    icon: LineChart,
    title: "Data analysis",
    body: "Structured analysis of movement, demand, and operational signals tied to the decision at hand.",
  },
  {
    icon: Scale,
    title: "Benchmarking",
    body: "Peer and market comparisons that place performance and opportunity in credible context.",
  },
  {
    icon: FileText,
    title: "Executive recommendations",
    body: "Clear, board-ready guidance—what to do, why it matters, and what risk remains.",
  },
];

function Reveal({ children, delay = 0, y = 20, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="text-[13px] font-medium tracking-wide text-[#3D4F5F] transition-colors hover:text-[#0B1F33]"
    >
      {children}
    </a>
  );
}

function SectionEyebrow({ children, light = false }) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-[0.28em] ${
        light ? "text-[#8DE0C4]" : "text-[#177F64]"
      }`}
    >
      {children}
    </p>
  );
}

function ConsultationForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    industry: "",
    message: "",
  });
  const [status, setStatus] = useState("idle");

  function update(field) {
    return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus("error");
      return;
    }

    const subject = encodeURIComponent(`Consultation request — ${form.organization || form.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Email: ${form.email}`,
        `Organization: ${form.organization || "—"}`,
        `Industry: ${form.industry || "—"}`,
        "",
        form.message,
      ].join("\n"),
    );

    setStatus("sent");
    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
  }

  if (status === "sent") {
    return (
      <div className="border border-[#177F64]/25 bg-[#F3FAF7] px-8 py-12 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-[#177F64]" />
        <h3 className="mt-4 font-landing-serif text-2xl text-[#0B1F33]">Request prepared</h3>
        <p className="mt-3 text-sm leading-7 text-[#4A5C6A]">
          Your email client should open with your consultation details. If it does not, write us at{" "}
          <a href={`mailto:${contactEmail}`} className="font-medium text-[#177F64] underline-offset-2 hover:underline">
            {contactEmail}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm font-medium text-[#0B1F33] underline-offset-4 hover:underline"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consult-name" className="text-[12px] uppercase tracking-[0.14em] text-[#5A6B78]">
            Full name
          </Label>
          <Input
            id="consult-name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={update("name")}
            required
            className="h-11 rounded-none border-[#D5DCE3] bg-white px-3 font-landing-sans text-[#0B1F33] shadow-none focus-visible:ring-[#177F64]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consult-email" className="text-[12px] uppercase tracking-[0.14em] text-[#5A6B78]">
            Work email
          </Label>
          <Input
            id="consult-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update("email")}
            required
            className="h-11 rounded-none border-[#D5DCE3] bg-white px-3 font-landing-sans text-[#0B1F33] shadow-none focus-visible:ring-[#177F64]"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="consult-org" className="text-[12px] uppercase tracking-[0.14em] text-[#5A6B78]">
            Organization
          </Label>
          <Input
            id="consult-org"
            name="organization"
            autoComplete="organization"
            value={form.organization}
            onChange={update("organization")}
            className="h-11 rounded-none border-[#D5DCE3] bg-white px-3 font-landing-sans text-[#0B1F33] shadow-none focus-visible:ring-[#177F64]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consult-industry" className="text-[12px] uppercase tracking-[0.14em] text-[#5A6B78]">
            Industry focus
          </Label>
          <select
            id="consult-industry"
            name="industry"
            value={form.industry}
            onChange={update("industry")}
            className="flex h-11 w-full rounded-none border border-[#D5DCE3] bg-white px-3 font-landing-sans text-sm text-[#0B1F33] outline-none focus-visible:ring-1 focus-visible:ring-[#177F64]"
          >
            <option value="">Select one</option>
            <option value="HOAs">HOAs & Community Associations</option>
            <option value="Commercial Real Estate">Commercial Real Estate</option>
            <option value="Small Business">Small Business</option>
            <option value="Investors">Investors</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consult-message" className="text-[12px] uppercase tracking-[0.14em] text-[#5A6B78]">
          Decision or challenge
        </Label>
        <Textarea
          id="consult-message"
          name="message"
          rows={5}
          value={form.message}
          onChange={update("message")}
          required
          placeholder="What financial or operational decision are you evaluating?"
          className="rounded-none border-[#D5DCE3] bg-white px-3 py-3 font-landing-sans text-[#0B1F33] shadow-none ring-offset-0 placeholder:text-[#8A97A3] focus-visible:ring-1 focus-visible:ring-[#177F64] focus-visible:ring-offset-0"
        />
      </div>

      {status === "error" ? (
        <p className="text-sm text-red-700">Please provide your name, email, and a brief description of the decision.</p>
      ) : null}

      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-[#6B7C89]">
          Typical response within one business day. No obligation — consultations are exploratory.
        </p>
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-none bg-[#0B1F33] px-8 font-landing-sans text-sm font-medium tracking-wide text-white hover:bg-[#16324A]"
        >
          Request consultation
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#071521_0%,#0B1F33_42%,#12324A_78%,#0E2A28_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(23,127,100,0.18),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:72px_72px]" />

      <motion.svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <motion.path
          d="M-40 620C180 520 320 480 480 500C680 526 820 420 980 360C1120 308 1280 300 1480 240"
          stroke="rgba(141,224,196,0.35)"
          strokeWidth="1.25"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.4, ease: "easeInOut" }}
        />
        <motion.path
          d="M-20 740C220 660 400 640 560 660C760 688 900 600 1060 520C1200 450 1320 430 1500 380"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.8, delay: 0.2, ease: "easeInOut" }}
        />
        <motion.path
          d="M80 180C260 240 400 300 560 280C760 252 900 180 1080 200C1220 216 1320 260 1480 220"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.6, delay: 0.35, ease: "easeInOut" }}
        />
      </motion.svg>

      <div className="absolute inset-y-0 right-0 hidden w-[46%] lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0B1F33_0%,rgba(11,31,51,0.55)_28%,transparent_62%)]" />
        <svg className="h-full w-full opacity-80" viewBox="0 0 640 900" fill="none" preserveAspectRatio="xMidYMid slice">
          <rect x="72" y="140" width="420" height="620" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="72" y1="220" x2="492" y2="220" stroke="rgba(255,255,255,0.1)" />
          <line x1="72" y1="300" x2="492" y2="300" stroke="rgba(255,255,255,0.08)" />
          <line x1="72" y1="380" x2="492" y2="380" stroke="rgba(255,255,255,0.08)" />
          <line x1="72" y1="460" x2="492" y2="460" stroke="rgba(255,255,255,0.08)" />
          <line x1="72" y1="540" x2="492" y2="540" stroke="rgba(255,255,255,0.08)" />
          <line x1="72" y1="620" x2="492" y2="620" stroke="rgba(255,255,255,0.08)" />
          <rect x="108" y="250" width="160" height="10" fill="rgba(141,224,196,0.45)" />
          <rect x="108" y="330" width="240" height="10" fill="rgba(255,255,255,0.18)" />
          <rect x="108" y="410" width="200" height="10" fill="rgba(255,255,255,0.14)" />
          <rect x="108" y="490" width="280" height="10" fill="rgba(141,224,196,0.28)" />
          <rect x="108" y="570" width="120" height="10" fill="rgba(255,255,255,0.16)" />
          <rect x="108" y="650" width="210" height="10" fill="rgba(255,255,255,0.12)" />
          <circle cx="430" cy="255" r="4" fill="rgba(141,224,196,0.8)" />
          <circle cx="430" cy="415" r="4" fill="rgba(255,255,255,0.35)" />
          <circle cx="430" cy="575" r="4" fill="rgba(255,255,255,0.28)" />
        </svg>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F5F7F8] font-landing-sans text-[#0B1F33] antialiased">
      <header className="sticky top-0 z-50 border-b border-[#0B1F33]/08 bg-[#F5F7F8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <a href="#top" aria-label="TrafficScout home">
            <TrafficScoutLogo compact scale={1.25} />
          </a>
          <nav className="hidden items-center gap-8 lg:flex">
            <NavLink href="#capabilities">Capabilities</NavLink>
            <NavLink href="#industries">Industries</NavLink>
            <NavLink href="#reports">Reports</NavLink>
            <NavLink href="#methodology">Methodology</NavLink>
            <NavLink href="#consult">Consult</NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="hidden rounded-none px-4 text-[13px] font-medium text-[#3D4F5F] hover:bg-transparent hover:text-[#0B1F33] lg:inline-flex"
            >
              <RouterLink to="/app">Sign in</RouterLink>
            </Button>
            <Button
              asChild
              className="rounded-none bg-[#0B1F33] px-5 text-[13px] font-medium tracking-wide text-white hover:bg-[#16324A]"
            >
              <a href="#consult">Request consultation</a>
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative min-h-[min(92vh,920px)] overflow-hidden text-white">
          <HeroBackdrop />

          <div className="relative mx-auto flex min-h-[min(92vh,920px)] max-w-6xl flex-col justify-end px-6 pb-20 pt-28 lg:justify-center lg:px-8 lg:pb-28 lg:pt-24">
            <div className="max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <p className="font-landing-serif text-[2.75rem] leading-none tracking-tight text-white sm:text-6xl md:text-7xl">
                  TrafficScout
                </p>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 max-w-xl font-landing-serif text-3xl font-medium leading-[1.15] tracking-tight text-white/95 sm:text-4xl md:text-[2.75rem]"
              >
                Smarter financial and operational decisions, grounded in evidence.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6 max-w-lg text-base leading-8 text-white/70 sm:text-lg"
              >
                AI-powered analysis, benchmarking, and executive-ready recommendations for organizations that cannot afford guesswork.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="mt-10 flex flex-col gap-3 sm:flex-row"
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-none bg-white px-7 text-[13px] font-semibold tracking-wide text-[#0B1F33] hover:bg-[#E8EEF2]"
                >
                  <a href="#consult">
                    Request a consultation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-none border-white/30 bg-transparent px-7 text-[13px] font-medium tracking-wide text-white hover:bg-white/5 hover:text-white"
                >
                  <a href="#methodology">View our methodology</a>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-b border-[#0B1F33]/08 px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <SectionEyebrow>What we deliver</SectionEyebrow>
              <h2 className="mt-4 font-landing-serif text-3xl leading-tight tracking-tight text-[#0B1F33] md:text-5xl">
                Decision support built for boards, operators, and capital allocators.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#4A5C6A]">
                TrafficScout helps organizations see the signal in complex data—then translate it into clear next steps.
              </p>
            </Reveal>

            <div className="mt-16 grid gap-x-12 gap-y-14 md:grid-cols-3">
              {capabilities.map((item, index) => (
                <Reveal key={item.title} delay={index * 0.08}>
                  <div className="border-t border-[#0B1F33]/15 pt-8">
                    <item.icon className="h-5 w-5 text-[#177F64]" strokeWidth={1.5} />
                    <h3 className="mt-5 font-landing-serif text-2xl text-[#0B1F33]">{item.title}</h3>
                    <p className="mt-4 text-[15px] leading-7 text-[#4A5C6A]">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="bg-[#0B1F33] px-6 py-24 text-white lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <SectionEyebrow light>Industries served</SectionEyebrow>
              <h2 className="mt-4 font-landing-serif text-3xl leading-tight tracking-tight md:text-5xl">
                Built for institutions where the cost of a wrong call is high.
              </h2>
              <p className="mt-6 text-lg leading-8 text-white/65">
                We work with organizations that need credible analysis—not another dashboard.
              </p>
            </Reveal>

            <div className="mt-16 grid gap-px bg-white/10 sm:grid-cols-2">
              {industries.map((industry, index) => (
                <Reveal key={industry.title} delay={index * 0.06} className="bg-[#0B1F33]">
                  <div className="h-full bg-[#0F2740] px-8 py-10 transition-colors duration-300 hover:bg-[#12304C]">
                    <industry.icon className="h-5 w-5 text-[#8DE0C4]" strokeWidth={1.5} />
                    <h3 className="mt-6 font-landing-serif text-2xl text-white">{industry.title}</h3>
                    <p className="mt-4 max-w-md text-[15px] leading-7 text-white/60">{industry.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="reports" className="px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <Reveal>
                <SectionEyebrow>Sample reports</SectionEyebrow>
                <h2 className="mt-4 font-landing-serif text-3xl leading-tight tracking-tight text-[#0B1F33] md:text-5xl">
                  Deliverables your leadership team can use in the room.
                </h2>
                <p className="mt-6 text-lg leading-8 text-[#4A5C6A]">
                  Every engagement produces concise, executive-ready materials—not raw exports.
                </p>
              </Reveal>

              <div className="space-y-0 border-t border-[#0B1F33]/12">
                {sampleReports.map((report, index) => (
                  <Reveal key={report.type} delay={index * 0.07}>
                    <article className="grid gap-4 border-b border-[#0B1F33]/12 py-8 sm:grid-cols-[1fr_auto] sm:gap-8">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#177F64]">
                          {report.audience}
                        </p>
                        <h3 className="mt-2 font-landing-serif text-2xl text-[#0B1F33]">{report.type}</h3>
                        <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#4A5C6A]">{report.summary}</p>
                      </div>
                      <div className="sm:pt-8 sm:text-right">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#7A8B98]">{report.pages}</p>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="methodology" className="border-y border-[#0B1F33]/08 bg-white px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto max-w-2xl text-center">
              <SectionEyebrow>Methodology</SectionEyebrow>
              <h2 className="mt-4 font-landing-serif text-3xl leading-tight tracking-tight text-[#0B1F33] md:text-5xl">
                A disciplined path from question to recommendation.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#4A5C6A]">
                Our process is designed for rigor, auditability, and speed—so findings hold up under scrutiny.
              </p>
            </Reveal>

            <div className="mt-16 grid gap-10 md:grid-cols-2 xl:grid-cols-4">
              {methodology.map((item, index) => (
                <Reveal key={item.step} delay={index * 0.07}>
                  <div>
                    <p className="font-landing-serif text-4xl text-[#177F64]/80">{item.step}</p>
                    <h3 className="mt-5 font-landing-serif text-xl text-[#0B1F33]">{item.title}</h3>
                    <p className="mt-3 text-[15px] leading-7 text-[#4A5C6A]">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="consult" className="px-6 py-24 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <Reveal>
              <SectionEyebrow>Consultation</SectionEyebrow>
              <h2 className="mt-4 font-landing-serif text-3xl leading-tight tracking-tight text-[#0B1F33] md:text-5xl">
                Tell us the decision you need to make.
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#4A5C6A]">
                Share the context behind your next financial or operational choice. We will follow up with a focused consultation on fit, scope, and recommended next steps.
              </p>
              <ul className="mt-10 space-y-4 text-[15px] leading-7 text-[#4A5C6A]">
                {[
                  "Confidential exploratory discussion",
                  "Aligned to board and investor standards",
                  "Clear scoping before any engagement begins",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#177F64]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="border border-[#0B1F33]/12 bg-white p-6 sm:p-10">
                <ConsultationForm />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#0B1F33]/10 bg-white px-6 py-14 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <TrafficScoutLogo compact scale={1.2} />
            <p className="mt-5 text-sm leading-7 text-[#4A5C6A]">
              TrafficScout is an AI-powered business analytics firm helping organizations make smarter financial and
              operational decisions through data analysis, benchmarking, and executive-ready recommendations.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-[#5A6B78] sm:grid-cols-3">
            {[
              ["Capabilities", "#capabilities"],
              ["Industries", "#industries"],
              ["Reports", "#reports"],
              ["Methodology", "#methodology"],
              ["Consultation", "#consult"],
              ["Sign in", "/app"],
            ].map(([label, href]) =>
              href.startsWith("/") ? (
                <RouterLink key={label} to={href} className="transition-colors hover:text-[#0B1F33]">
                  {label}
                </RouterLink>
              ) : (
                <a key={label} href={href} className="transition-colors hover:text-[#0B1F33]">
                  {label}
                </a>
              ),
            )}
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-[#0B1F33]/10 pt-8 text-xs text-[#7A8B98] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TrafficScout. All rights reserved.</p>
          <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-[#0B1F33]">
            {contactEmail}
          </a>
        </div>
      </footer>
    </div>
  );
}
