const steps = [
  {
    number: '01',
    title: 'Dodaj projekt',
    description: 'Wgraj obraz, który chcesz pokazać zespołowi lub klientowi.',
  },
  {
    number: '02',
    title: 'Zaproś do review',
    description: 'Udostępnij projekt współpracownikom albo wyślij link gościom.',
  },
  {
    number: '03',
    title: 'Zbieraj konkretne uwagi',
    description: 'Komentarze przypięte do obrazu pomagają od razu znaleźć właściwe miejsce.',
  },
];
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#home" aria-label="markerIt — strona główna">
          marker<span>It</span>
        </a>
        <nav aria-label="Nawigacja główna">
          <a href="#jak-dziala">Jak to działa</a>
          <a href="#korzysci">Korzyści</a>
        </nav>
        <a className="button button-small" href={appUrl}>
          Otwórz aplikację <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> Review projektów bez zgadywania</p>
          <h1>Każda uwaga<br />we <span>właściwym miejscu.</span></h1>
          <p className="hero-description">
            Zbieraj komentarze bezpośrednio na projekcie. Mniej niejasnych wiadomości,
            więcej konkretnych poprawek.
          </p>
          <div className="hero-actions">
            <a className="button" href={appUrl}>
              Zacznij review <span aria-hidden="true">→</span>
            </a>
            <a className="text-link" href="#jak-dziala">Zobacz, jak działa <span aria-hidden="true">↓</span></a>
          </div>
          <p className="hero-note">Przejrzysty feedback dla zespołów kreatywnych.</p>
        </div>

        <div className="review-card" aria-label="Podgląd komentarza przypiętego do projektu">
          <div className="card-topline">
            <div className="file-label"><span className="file-icon">▧</span><div><strong>Kampania — wiosna</strong><small>Wersja robocza · przed chwilą</small></div></div>
            <span className="review-status"><i /> W toku</span>
          </div>
          <div className="artboard">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sun" />
            <div className="art-copy"><small>NOWA KOLEKCJA</small><strong>Więcej<br />przestrzeni.</strong><span>Odkryj lekkość na nowo</span></div>
            <div className="pin pin-one"><span>1</span></div>
            <div className="pin pin-two"><span>2</span></div>
            <div className="art-caption">KREACJA 04 / 12</div>
          </div>
          <div className="comment-preview">
            <div className="avatar">MK</div>
            <div><div className="comment-meta"><strong>Maja K.</strong><span>· 2 min temu</span></div><p>Czy możemy przesunąć nagłówek trochę wyżej?</p></div>
            <span className="comment-pin">1</span>
          </div>
          <div className="card-footer"><span><i className="online-dot" /> 3 osoby przeglądają</span><span>2 uwagi</span></div>
        </div>
      </section>

      <section className="steps-section" id="jak-dziala">
        <div className="section-heading" id="korzysci">
          <p className="eyebrow">Prosty przepływ pracy</p>
          <h2>Od projektu do<br /><span>jasnych decyzji.</span></h2>
          <p>Wszystkie uwagi są przypięte do obrazu i rozmowy, której dotyczą.</p>
        </div>
        <div className="steps-grid">
          {steps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer"><a className="wordmark" href="#home">marker<span>It</span></a><span>Wspólne review, które naprawdę posuwa projekt naprzód.</span><span>© 2026 markerIt</span></footer>
    </main>
  );
}
