const projects = [
  { name: 'Kampania — wiosna', workspace: 'Studio Północ', status: 'W toku', count: 4, tone: 'sage', updated: 'Dziś, 10:42' },
  { name: 'Opakowanie produktu', workspace: 'Studio Północ', status: 'W toku', count: 2, tone: 'sand', updated: 'Wczoraj' },
  { name: 'Identyfikacja wizualna', workspace: 'Projekt osobisty', status: 'Zamknięty', count: 8, tone: 'blue', updated: '28 paź' },
];

export default function DashboardPage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="wordmark" href="#">marker<span>It</span></a>
        <div className="workspace-switcher"><span className="workspace-mark">SP</span><span><strong>Studio Północ</strong><small>Workspace</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">PRZESTRZEŃ ROBOCZA</p>
        <nav className="side-nav" aria-label="Menu główne">
          <a className="active" href="#projekty"><span>▦</span> Projekty <b>3</b></a>
          <a href="#shared"><span>⇄</span> Udostępnione</a>
        </nav>
        <div className="sidebar-bottom"><a href="#ustawienia"><span>⚙</span> Ustawienia</a><div className="profile"><span className="profile-avatar">AK</span><span><strong>Anna Kowalska</strong><small>anna@studio.pl</small></span><span className="chevron">···</span></div></div>
      </aside>

      <section className="main-panel" id="projekty">
        <header className="page-top"><div className="breadcrumbs">Workspace <span>/</span> Projekty</div><button className="help-button" aria-label="Pomoc">?</button></header>
        <div className="page-content">
          <div className="heading-row"><div><p className="eyebrow">STUDIO PÓŁNOC · WORKSPACE</p><h1>Twoje projekty</h1><p className="subheading">Miejsce, w którym zbierają się dobre pomysły i konkretny feedback.</p></div><button className="primary-button"><span>＋</span> Nowy projekt</button></div>

          <section className="summary-grid" aria-label="Podsumowanie workspace">
            <article className="summary-card"><span className="summary-icon green">▦</span><div><small>Aktywne projekty</small><strong>3 <em>z 5</em></strong></div><span className="summary-trend">↗</span></article>
            <article className="summary-card"><span className="summary-icon lilac">◉</span><div><small>Otwarte uwagi</small><strong>6 <em>do przejrzenia</em></strong></div><span className="summary-trend">↗</span></article>
            <article className="summary-card"><span className="summary-icon peach">✳</span><div><small>Osoby w workspace</small><strong>4 <em>członków</em></strong></div><span className="summary-trend">↗</span></article>
          </section>

          <div className="section-toolbar"><div><h2>Ostatnie projekty</h2><p>Wróć do miejsca, w którym skończyliście.</p></div><button className="filter-button">Wszystkie <span>⌄</span></button></div>
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-row" key={project.name}>
                <div className={`project-thumb ${project.tone}`}><div className="thumb-shape"/><span>m.</span></div>
                <div className="project-info"><strong>{project.name}</strong><small>{project.workspace}</small></div>
                <span className={`status ${project.status === 'W toku' ? 'in-progress' : 'closed'}`}><i/>{project.status}</span>
                <span className="comment-count">◉ {project.count} uwag</span>
                <span className="updated">{project.updated}</span>
                <button className="more-button" aria-label={`Więcej opcji: ${project.name}`}>···</button>
              </article>
            ))}
          </div>

          <section className="shared-empty" id="shared"><div className="shared-icon">⇄</div><div><strong>Projekty udostępnione Tobie</strong><p>Gdy ktoś zaprosi Cię do review, projekt pojawi się tutaj.</p></div><a href="#shared">Dowiedz się więcej <span>↗</span></a></section>
          <footer className="dashboard-footer"><span>Wszystkie zmiany są zapisane</span><span>markerIt <i>·</i> spokojniejszy feedback</span></footer>
        </div>
      </section>
    </main>
  );
}
