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
      <header id="home" className="border-b border-border/70">
        <div className="mx-auto grid min-h-16 max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:px-8 lg:min-h-20 lg:px-12">
          <a href="#home" aria-label={copy.homeLabel} className="w-fit text-2xl font-extrabold tracking-[-0.08em]">
            marker<span className="text-primary">It</span>
          </a>
          <nav aria-label={copy.navigationLabel} className="col-span-2 row-start-2 flex justify-center gap-6 text-xs text-muted-foreground sm:col-span-1 sm:col-start-2 sm:row-auto sm:gap-8 sm:text-sm">
            <a className="transition-colors hover:text-foreground" href="#how-it-works">{copy.howItWorksLink}</a>
            <a className="transition-colors hover:text-foreground" href="#benefits">{copy.benefitsLink}</a>
          </nav>
          <div className="flex items-center justify-self-end gap-1.5 sm:gap-2">
            <ThemeToggle switchToDarkLabel={copy.theme.switchToDark} switchToLightLabel={copy.theme.switchToLight} />
            <div role="group" aria-label={copy.languageLabel} className="flex items-center rounded-lg border border-border p-0.5">
              {(['en', 'pl'] as const).map((option) => (
                <Button key={option} type="button" size="sm" variant={locale === option ? 'secondary' : 'ghost'} className="h-7 min-w-8 px-2 text-xs" aria-pressed={locale === option} onClick={() => setLocale(option)}>
                  {option.toUpperCase()}
                </Button>
              ))}
            </div>
            <Button size="sm" className="gap-1.5 px-2.5 sm:px-3" render={<a href={appUrl} aria-label={copy.openApp} />}>
              <span className="hidden min-[390px]:inline">{copy.openApp}</span><span aria-hidden="true">↗</span>
            </Button>
          </div>
        </div>
      </header>

      <section aria-labelledby="hero-title" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:min-h-[640px] lg:grid-cols-2 lg:gap-14 lg:px-12 lg:py-20">
        <div>
          <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
            <span className="size-2 rounded-full bg-primary ring-4 ring-primary/15" />{copy.hero.eyebrow}
          </p>
          <h1 id="hero-title" className="mt-5 max-w-xl text-5xl font-medium leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
            {copy.hero.titleFirst}<br /><span className="text-primary">{copy.hero.titleSecond}</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">{copy.hero.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <Button size="lg" className="gap-3 px-5" render={<a href={appUrl} />}>{copy.hero.primaryAction}<span aria-hidden="true">→</span></Button>
            <a className="inline-flex items-center gap-2 text-sm font-semibold hover:text-primary" href="#how-it-works">
              {copy.hero.secondaryAction}<span aria-hidden="true" className="text-base text-primary">↓</span>
            </a>
          </div>
          <p className="mt-7 text-xs text-muted-foreground">{copy.hero.note}</p>
        </div>

        <Card aria-label={copy.preview.label} className="mx-auto w-full max-w-xl gap-0 overflow-hidden rounded-xl p-3 shadow-xl shadow-foreground/5 sm:p-4 lg:rotate-1">
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
            <div aria-label={copy.preview.artworkTitle} className="relative h-[clamp(245px,72vw,336px)] overflow-hidden rounded-md bg-[linear-gradient(145deg,#dce7d5_0%,#edf0df_43%,#d5dfc9_100%)] dark:bg-[linear-gradient(145deg,#29352b_0%,#252d25_43%,#1b241d_100%)]">
              <div className="absolute inset-0 bg-[linear-gradient(35deg,transparent_47%,rgba(255,255,255,.38)_48%,transparent_49%),linear-gradient(120deg,transparent_61%,rgba(102,133,88,.13)_62%,transparent_63%)] dark:opacity-25" />
              <div className="absolute -right-20 top-8 size-60 rounded-full border border-foreground/15 sm:-right-7 sm:size-[275px]" />
              <div className="absolute -right-12 top-14 size-44 rounded-full border border-foreground/15 sm:right-1 sm:top-16 sm:size-[207px]" />
              <div className="absolute right-1 top-12 size-32 rounded-full bg-[radial-gradient(circle_at_35%_34%,#faf6dc,#c7d1a5_74%)] shadow-xl dark:bg-[radial-gradient(circle_at_35%_34%,#e4e9c5,#82916b_74%)] sm:right-7 sm:size-[151px]" />
              <div className="absolute left-5 top-16 z-10 text-foreground sm:left-8 sm:top-20">
                <small className="block text-[8px] uppercase tracking-[0.16em]">{copy.preview.artworkTitle}</small>
                <strong className="mt-3 block text-3xl font-medium leading-none tracking-tight sm:text-4xl">{copy.preview.artworkLineFirst}<br />{copy.preview.artworkLineSecond}</strong>
                <span className="mt-3 block text-[9px]">{copy.preview.artworkSubtitle}</span>
              </div>
              <span className="absolute right-[28%] top-[34%] grid size-7 rotate-[-45deg] place-items-center rounded-full rounded-bl-sm bg-foreground text-xs font-bold text-background shadow-md"><span className="rotate-45">1</span></span>
              <span className="absolute bottom-[22%] right-[13%] grid size-7 rotate-[-45deg] place-items-center rounded-full rounded-bl-sm bg-primary text-xs font-bold text-primary-foreground shadow-md"><span className="rotate-45">2</span></span>
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

      <section id="how-it-works" aria-labelledby="process-title" className="grid gap-8 bg-muted/50 px-4 py-14 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:gap-16 lg:px-[max(calc((100vw-1160px)/2),3rem)] lg:py-20">
        <div id="benefits">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">{copy.process.eyebrow}</p>
          <h2 id="process-title" className="text-4xl font-medium leading-tight tracking-tight sm:text-5xl">{copy.process.titleFirst}<br /><span className="text-primary">{copy.process.titleSecond}</span></h2>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">{copy.process.description}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {copy.process.steps.map((step, index) => (
            <Card className="min-h-36 gap-0 rounded-xl bg-background p-5 shadow-none sm:p-4 lg:min-h-40 lg:p-5" key={step.title}>
              <span className="text-xs font-bold tracking-widest text-primary">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-5 text-sm font-bold">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex min-h-24 max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-6 text-[10px] text-muted-foreground sm:px-8 lg:px-12">
        <a href="#home" aria-label={copy.homeLabel} className="text-xl font-extrabold tracking-[-0.08em] text-foreground">marker<span className="text-primary">It</span></a>
        <span className="order-3 w-full sm:order-none sm:w-auto">{copy.footer}</span>
        <span>© 2026 markerIt</span>
      </footer>
    </main>
  );
}
