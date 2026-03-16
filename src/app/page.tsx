import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Compass,
  Heart,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { HomeAuthCta } from "@/components/auth/home-auth-cta";
import { HomeHeroActions } from "@/components/auth/home-hero-actions";
import { getHomepageLeaderboard } from "@/lib/leaderboard";

export const metadata: Metadata = {
  title: "Dagger Helper | Fan-Made Daggerheart Tools",
  description:
    "A fan-made home for Daggerheart character building, community content, homebrew sharing, and campaign tools.",
};

export const dynamic = "force-dynamic";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  cta: string;
};

type CapabilityCard = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const featureCards: FeatureCard[] = [
  {
    icon: BookOpen,
    title: "Character builder",
    description: "Easy to learn, card-friendly, and flexible enough for both core play and custom tables.",
    href: "/characters/create",
    cta: "Start building",
  },
  {
    icon: Users,
    title: "Community builds",
    description: "Browse shared creations, save favourites, and put your own ideas on the shelf.",
    href: "/community",
    cta: "Browse builds",
  },
  {
    icon: Compass,
    title: "Campaign hub",
    description: "Characters, lore, frames, adversaries, and encounters live in one home.",
    href: "/dashboard/campaigns",
    cta: "Open campaign tools",
  },
];

const capabilityCards: CapabilityCard[] = [
  {
    icon: Wand2,
    title: "Fully custom sheets",
    description: "Change how the sheet behaves so it fits your table instead of boxing it in.",
  },
  {
    icon: Sparkles,
    title: "Custom resources",
    description: "Add the resources your homebrew needs instead of settling for the default set.",
  },
  {
    icon: ScrollText,
    title: "Editable defaults",
    description: "Tune baseline values once and carry those choices through the whole campaign.",
  },
  {
    icon: Shield,
    title: "No built-in caps",
    description: "Lift resource limits when your design needs room and let the rules breathe.",
  },
];

function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  return (
    <div
      className={`fade-up ${className}`.trim()}
      style={{ "--fade-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

function EmptyLeaderboard({ message }: { message: string }) {
  return <p className="text-sm text-slate-300">{message}</p>;
}

export default async function Home() {
  const { topLiked, topContributors } = await getHomepageLeaderboard(3);

  return (
    <main className="relative isolate overflow-hidden">
      <div className="landing-aurora pointer-events-none absolute inset-0" />
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-amber-500/8 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-20 pt-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 shadow-[0_0_32px_rgb(245_158_11/0.14)]">
              <Wand2 className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-amber-300/70">
                Dagger Helper
              </p>
              <p className="text-sm text-slate-300">
                Fan-made tools for players, GMs, and homebrew tables.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#community" className="transition hover:text-amber-200">
                Community
              </a>
              <a href="#gm-tools" className="transition hover:text-amber-200">
                GM Tools
              </a>
              <Link href="/characters/create" className="transition hover:text-amber-200">
                Builder
              </Link>
            </nav>
            <HomeAuthCta />
          </div>
        </header>

        <section className="pb-10 pt-12 text-center lg:pb-14 lg:pt-16">
          <Reveal delay={0}>
            <p className="mx-auto mb-5 max-w-3xl text-sm uppercase tracking-[0.35em] text-amber-300/80">
              Community-made Daggerheart tools
            </p>
            <h1 className="mx-auto max-w-5xl text-5xl leading-[0.98] text-balance text-amber-100 sm:text-6xl lg:text-7xl">
              Play the game as written, or make it your own.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              Build characters fast, use the core rules cleanly, and customise sheets,
              resources, and campaign rules when your table wants more freedom.
            </p>
            <div className="mt-8 flex justify-center">
              <HomeHeroActions />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Not official. Just a warmer, more flexible place for people who want to play the game their way.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="panel rounded-[1.75rem] p-6 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
                      <Icon className="h-5 w-5 text-amber-200" />
                    </div>
                    <h2 className="mt-5 text-2xl text-amber-100">{card.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
                    <Link
                      href={card.href}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 transition hover:text-amber-100"
                    >
                      {card.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </Reveal>
        </section>

        <section id="community" className="scroll-mt-20 py-4 lg:py-6">
          <Reveal delay={120}>
            <article className="panel rounded-[2rem] p-5 sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-md text-left">
                  <p className="text-sm uppercase tracking-[0.32em] text-amber-300/75">
                    Community pulse
                  </p>
                  <h2 className="mt-3 text-3xl text-amber-100 sm:text-4xl">
                    A quick look at what fans are making.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    See what people are loving and who is keeping the library full.
                  </p>
                  <Link
                    href="/community"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 transition hover:text-amber-100"
                  >
                    Browse the full library
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-5 text-left">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-300/75">
                      <Heart className="h-4 w-4 text-rose-400" />
                      Top loved
                    </div>
                    <div className="mt-4 space-y-3">
                      {!topLiked.length ? (
                        <EmptyLeaderboard message="No favourites yet." />
                      ) : (
                        topLiked.map((entry, index) => (
                          <Link
                            key={entry.id}
                            href={`/community/adversaries/${entry.id}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 transition hover:border-amber-300/25"
                          >
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.2em] text-amber-300/65">
                                #{index + 1}
                              </p>
                              <p className="truncate text-sm font-semibold text-slate-100">
                                {entry.name}
                              </p>
                              <p className="truncate text-xs text-slate-400">by {entry.creatorName}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-200">
                              {entry.likeCount}
                            </span>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/50 p-5 text-left">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-300/75">
                      <Users className="h-4 w-4 text-amber-300" />
                      Top sharers
                    </div>
                    <div className="mt-4 space-y-3">
                      {!topContributors.length ? (
                        <EmptyLeaderboard message="No public sharers yet." />
                      ) : (
                        topContributors.map((entry, index) => (
                          <div
                            key={entry.userId}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-[0.2em] text-amber-300/65">
                                #{index + 1}
                              </p>
                              <p className="truncate text-sm font-semibold text-slate-100">
                                {entry.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {entry.totalLikes} hearts total
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                              {entry.contributionCount}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        </section>

        <section id="gm-tools" className="scroll-mt-20 py-10 lg:py-14">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <Reveal delay={40}>
              <article className="panel rounded-[2rem] p-7 sm:p-8 text-left">
                <p className="text-sm uppercase tracking-[0.32em] text-amber-300/75">
                  GM tools
                </p>
                <h2 className="mt-4 text-4xl text-amber-100 sm:text-5xl">
                  Full homebrew support that really uncages creativity.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-300">
                  Fully customise the character sheet, add custom resources, change defaults,
                  remove caps, and keep campaign frames, lore, adversaries, and encounters in
                  the same workspace.
                </p>
                <Link
                  href="/dashboard/campaigns"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-200 transition hover:text-amber-100"
                >
                  Open the GM toolkit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            </Reveal>

            <Reveal delay={120}>
              <div className="grid gap-4 sm:grid-cols-2">
                {capabilityCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article
                      key={card.title}
                      className="rounded-[1.75rem] border border-white/10 bg-slate-950/50 p-6 text-left"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10">
                        <Icon className="h-5 w-5 text-amber-200" />
                      </div>
                      <h3 className="mt-5 text-2xl text-amber-100">{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
                    </article>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>
      </div>
    </main>
  );
}
