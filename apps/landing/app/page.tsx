'use client';

import { getMessages, isLocale, type Locale } from '@markerit/i18n';
import { Avatar, AvatarFallback } from '@markerit/ui/components/avatar';
import { Badge } from '@markerit/ui/components/badge';
import { Button } from '@markerit/ui/components/button';
import { Card, CardContent, CardFooter, CardHeader } from '@markerit/ui/components/card';
import { ThemeToggle } from '@markerit/ui';
import { useEffect, useState } from 'react';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>('pl');
  const [hydrated, setHydrated] = useState(false);
  const copy = getMessages(locale);

  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem('markerit-locale');
      if (savedLocale && isLocale(savedLocale)) setLocale(savedLocale);
    } catch {
      // Keep the default Polish locale when browser storage is unavailable.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const description = document.querySelector('meta[name="description"]');
    document.documentElement.lang = locale;
    document.title = copy.metadata.title;
    description?.setAttribute('content', copy.metadata.description);
    if (hydrated) {
      try {
        window.localStorage.setItem('markerit-locale', locale);
      } catch {
        // Language switching still works for the current page without storage.
      }
    }
  }, [copy.metadata.description, copy.metadata.title, hydrated, locale]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header id="home" className="border-b border-border/60">
        <div className="mx-auto flex min-h-[68px] max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 py-3 sm:px-8 lg:min-h-[76px] lg:px-10">
          <a href="#home" aria-label={copy.homeLabel} className="flex w-fit items-center text-[1.35rem] font-extrabold tracking-[-0.09em]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 size-[22px] text-primary" fill="none">
              <path d="M19.5 11.25a7.25 7.25 0 0 1-7.25 7.25c-1.2 0-2.3-.3-3.3-.8L4.5 19l1.1-4.1a7.25 7.25 0 1 1 13.9-3.65Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12.25" cy="11.25" r="1.6" fill="currentColor" />
            </svg>
            marker<span className="text-primary">It</span>
          </a>
          <nav aria-label={copy.navigationLabel} className="order-3 flex w-full justify-center gap-6 pb-1 text-xs text-muted-foreground sm:order-none sm:w-auto sm:flex-1 sm:pb-0 sm:gap-8 sm:text-sm">
            <a className="transition-colors hover:text-foreground" href="#how-it-works">{copy.howItWorksLink}</a>
            <a className="transition-colors hover:text-foreground" href="#example">{copy.benefitsLink}</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle switchToDarkLabel={copy.theme.switchToDark} switchToLightLabel={copy.theme.switchToLight} />
            <div role="group" aria-label={copy.languageLabel} className="flex items-center rounded-lg border border-border p-0.5">
              {(['en', 'pl'] as const).map((option) => (
                <Button key={option} type="button" size="sm" variant={locale === option ? 'secondary' : 'ghost'} className="h-7 min-w-8 px-2 text-xs" aria-pressed={locale === option} onClick={() => setLocale(option)}>
                  {option.toUpperCase()}
                </Button>
              ))}
            </div>
            <Button nativeButton={false} size="sm" className="gap-1.5 px-2.5 sm:px-3" render={<a href={appUrl} aria-label={copy.openApp} />}>
              <span className="hidden min-[390px]:inline">{copy.openApp}</span><span aria-hidden="true">↗</span>
            </Button>
          </div>
        </div>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-8 sm:py-16 lg:min-h-[660px] lg:grid-cols-[.88fr_1.12fr] lg:gap-16 lg:px-10 lg:py-20">
        <div className="relative z-10">
          <h1 id="hero-title" className="max-w-xl text-[2.8rem] font-medium leading-[1.02] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
            {copy.hero.titleFirst}<br /><span className="text-primary">{copy.hero.titleSecond}</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">{copy.hero.description}</p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Button nativeButton={false} size="lg" className="gap-3 rounded-md px-5 shadow-none" render={<a href={appUrl} />}>{copy.hero.primaryAction}<span aria-hidden="true">↗</span></Button>
            <a className="inline-flex items-center gap-2 text-sm font-semibold hover:text-primary" href="#how-it-works">
              {copy.hero.secondaryAction}<span aria-hidden="true" className="text-base text-primary">↓</span>
            </a>
          </div>
        </div>

        <Card id="example" aria-label={copy.preview.label} className="relative mx-auto w-full max-w-xl gap-0 overflow-visible rounded-none border-0 bg-transparent p-0 shadow-none before:absolute before:-inset-3 before:-z-10 before:border before:border-border/70 before:content-[''] sm:before:-inset-5">
          <CardHeader className="flex min-h-12 flex-row items-start justify-between gap-2 p-0 pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><span aria-hidden="true">▧</span></span>
              <div className="min-w-0"><strong className="block truncate text-xs">{copy.preview.project}</strong><small className="mt-0.5 block text-[10px] text-muted-foreground">{copy.preview.draft}</small></div>
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1.5 rounded-full px-2.5 text-[10px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />{copy.preview.status}
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div aria-label={copy.preview.artworkTitle} className="relative h-[clamp(245px,72vw,336px)] overflow-hidden bg-[#e5e6d7] dark:bg-[#252b24]">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49.8%,rgba(40,50,35,.1)_50%,transparent_50.2%),linear-gradient(0deg,transparent_49.8%,rgba(40,50,35,.1)_50%,transparent_50.2%)] bg-[length:36px_36px] opacity-50" />
              <div className="absolute inset-y-0 right-0 w-[42%] bg-[#c8d0b5] dark:bg-[#414b38]" />
              <div className="absolute right-[7%] top-[13%] h-[72%] w-[31%] rotate-3 border border-foreground/20 bg-[#eeeede] shadow-[10px_12px_0_rgba(50,60,40,.12)] dark:bg-[#d8ddc5]">
                <div className="absolute inset-x-[12%] top-[13%] h-[42%] bg-[linear-gradient(145deg,#a0a982_0%,#d7d9b8_46%,#788064_47%,#545c4a_100%)]" />
                <div className="absolute inset-x-[12%] top-[63%] h-px bg-foreground/40" />
                <span className="absolute left-[12%] top-[70%] h-px w-[38%] bg-foreground/50" />
                <span className="absolute left-[12%] top-[77%] text-[6px] uppercase tracking-[0.12em] text-foreground">SP / 01</span>
              </div>
              <div className="absolute left-5 top-10 z-10 text-[#30382d] sm:left-8 sm:top-14 dark:text-[#e8eadc]">
                <small className="block text-[8px] uppercase tracking-[0.16em]">{copy.preview.artworkTitle}</small>
                <strong className="mt-3 block text-3xl font-medium leading-none tracking-tight sm:text-4xl">{copy.preview.artworkLineFirst}<br />{copy.preview.artworkLineSecond}</strong>
                <span className="mt-3 block max-w-28 text-[9px] leading-relaxed">{copy.preview.artworkSubtitle}</span>
              </div>
              <span className="absolute left-[59%] top-[29%] grid size-7 place-items-center rounded-full border-2 border-background bg-foreground text-xs font-bold text-background shadow-sm">1</span>
              <span className="absolute bottom-[23%] right-[13%] grid size-7 place-items-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-sm">2</span>
              <span className="absolute bottom-3.5 left-3.5 text-[8px] uppercase tracking-widest text-foreground/70">{copy.preview.artworkCaption}</span>
            </div>
            <div className="flex items-center gap-2.5 px-1 py-3">
              <Avatar className="size-7"><AvatarFallback className="bg-amber-100 text-[9px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-100">MK</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[10px]"><strong>{copy.preview.reviewer}</strong><span className="text-muted-foreground">{copy.preview.commentTime}</span></div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{copy.preview.comment}</p>
              </div>
              <Badge variant="secondary" className="grid size-5 shrink-0 place-items-center rounded-full p-0 text-[9px]">1</Badge>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-border px-1 pt-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" />{copy.preview.peopleReviewing}</span>
            <span>{copy.preview.commentsCount}</span>
          </CardFooter>
        </Card>
      </section>

      <section id="how-it-works" aria-labelledby="process-title" className="grid gap-8 border-y border-border/60 bg-muted/30 px-4 py-14 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:gap-16 lg:px-[max(calc((100vw-1080px)/2),3rem)] lg:py-20">
        <div id="benefits">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">{copy.process.eyebrow}</p>
          <h2 id="process-title" className="text-4xl font-medium leading-tight tracking-tight sm:text-5xl">{copy.process.titleFirst}<br /><span className="text-primary">{copy.process.titleSecond}</span></h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">{copy.process.description}</p>
        </div>
        <div className="grid gap-0 border-y border-border/70 sm:grid-cols-3">
          {copy.process.steps.map((step, index) => (
            <article className="min-h-36 border-b border-border/70 py-5 last:border-0 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-0 lg:min-h-40 lg:py-4" key={step.title}>
              <span className="text-xs font-semibold tabular-nums text-primary">0{index + 1}<span className="ml-2 text-muted-foreground">/ 03</span></span>
              <h3 className="mt-5 text-sm font-bold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex min-h-24 max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-6 text-[10px] text-muted-foreground sm:px-8 lg:px-12">
        <a href="#home" aria-label={copy.homeLabel} className="text-xl font-extrabold tracking-[-0.08em] text-foreground">marker<span className="text-primary">It</span></a>
        <span>© 2026 markerIt</span>
      </footer>
    </main>
  );
}
