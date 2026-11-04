'use client';

import { getMessages, isLocale, type Locale } from '@markerit/i18n';
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

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
  }

  return (
    <main>
      <header className="topbar" id="home">
        <a className="wordmark" href="#home" aria-label={copy.homeLabel}>
          marker<span>It</span>
        </a>
        <nav aria-label={copy.navigationLabel}>
          <a href="#how-it-works">{copy.howItWorksLink}</a>
          <a href="#benefits">{copy.benefitsLink}</a>
        </nav>
        <div className="header-actions">
          <div className="language-switch" role="group" aria-label={copy.languageLabel}>
            <button
              type="button"
              aria-pressed={locale === 'en'}
              onClick={() => changeLocale('en')}
            >
              EN
            </button>
            <button
              type="button"
              aria-pressed={locale === 'pl'}
              onClick={() => changeLocale('pl')}
            >
              PL
            </button>
          </div>
          <a className="button button-small" href={appUrl} aria-label={copy.openApp}>
            <span className="button-label">{copy.openApp}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" />{copy.hero.eyebrow}</p>
          <h1 id="hero-title">
            {copy.hero.titleFirst}<br /><span>{copy.hero.titleSecond}</span>
          </h1>
          <p className="hero-description">{copy.hero.description}</p>
          <div className="hero-actions">
            <a className="button" href={appUrl}>
              {copy.hero.primaryAction} <span aria-hidden="true">→</span>
            </a>
            <a className="text-link" href="#how-it-works">
              {copy.hero.secondaryAction} <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-note">{copy.hero.note}</p>
        </div>

        <article className="review-card" aria-label={copy.preview.label}>
          <div className="card-topline">
            <div className="file-label">
              <span className="file-icon" aria-hidden="true">▧</span>
              <div>
                <strong>{copy.preview.project}</strong>
                <small>{copy.preview.draft}</small>
              </div>
            </div>
            <span className="review-status"><i />{copy.preview.status}</span>
          </div>
          <div className="artboard" aria-label={copy.preview.artworkTitle}>
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sun" />
            <div className="art-copy">
              <small>{copy.preview.artworkTitle}</small>
              <strong>{copy.preview.artworkLineFirst}<br />{copy.preview.artworkLineSecond}</strong>
              <span>{copy.preview.artworkSubtitle}</span>
            </div>
            <div className="pin pin-one"><span>1</span></div>
            <div className="pin pin-two"><span>2</span></div>
            <div className="art-caption">{copy.preview.artworkCaption}</div>
          </div>
          <div className="comment-preview">
            <div className="avatar" aria-hidden="true">MK</div>
            <div>
              <div className="comment-meta">
                <strong>{copy.preview.reviewer}</strong><span>{copy.preview.commentTime}</span>
              </div>
              <p>{copy.preview.comment}</p>
            </div>
            <span className="comment-pin">1</span>
          </div>
          <div className="card-footer">
            <span><i className="online-dot" />{copy.preview.peopleReviewing}</span>
            <span>{copy.preview.commentsCount}</span>
          </div>
        </article>
      </section>

      <section className="steps-section" id="how-it-works" aria-labelledby="process-title">
        <div className="section-heading" id="benefits">
          <p className="eyebrow">{copy.process.eyebrow}</p>
          <h2 id="process-title">
            {copy.process.titleFirst}<br /><span>{copy.process.titleSecond}</span>
          </h2>
          <p>{copy.process.description}</p>
        </div>
        <div className="steps-grid">
          {copy.process.steps.map((step, index) => (
            <article className="step-card" key={step.title}>
              <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <a className="wordmark" href="#home" aria-label={copy.homeLabel}>
          marker<span>It</span>
        </a>
        <span>{copy.footer}</span>
        <span>© 2026 markerIt</span>
      </footer>
    </main>
  );
}
