export const messages = {
  en: {
    metadata: {
      title: 'markerIt — visual feedback for creative projects',
      description:
        'Collect precise feedback on creative work. Pin comments directly to an image and move reviews forward.',
    },
    languageLabel: 'Choose language',
    navigationLabel: 'Main navigation',
    homeLabel: 'markerIt home',
    howItWorksLink: 'How it works',
    benefitsLink: 'Benefits',
    openApp: 'Open the app',
    hero: {
      eyebrow: 'Project reviews without the guesswork',
      titleFirst: 'Every comment',
      titleSecond: 'in the right place.',
      description:
        'Collect feedback directly on your work. Fewer vague messages, more actionable edits.',
      primaryAction: 'Start a review',
      secondaryAction: 'See how it works',
      note: 'Clear feedback for creative teams.',
    },
    preview: {
      label: 'Pinned comment preview',
      project: 'Spring campaign',
      draft: 'Draft · just now',
      status: 'In review',
      artworkTitle: 'NEW COLLECTION',
      artworkLineFirst: 'More room',
      artworkLineSecond: 'to breathe.',
      artworkSubtitle: 'Discover a lighter way',
      artworkCaption: 'CREATIVE 04 / 12',
      reviewer: 'Maya K.',
      commentTime: '· 2 min ago',
      comment: 'Could we move the headline a little higher?',
      peopleReviewing: '3 people reviewing',
      commentsCount: '2 comments',
    },
    process: {
      eyebrow: 'A simple workflow',
      titleFirst: 'From project to',
      titleSecond: 'clear decisions.',
      description: 'Every comment stays connected to the image and conversation it belongs to.',
      steps: [
        {
          title: 'Add a project',
          description: 'Upload an image you want to share with your team or client.',
        },
        {
          title: 'Invite reviewers',
          description: 'Share the project with collaborators or send a guest link.',
        },
        {
          title: 'Get clear feedback',
          description: 'Comments pinned to the image make every change easy to find.',
        },
      ],
    },
    footer: 'Shared reviews that move projects forward.',
  },
  pl: {
    metadata: {
      title: 'markerIt — wizualny feedback do projektów',
      description:
        'Zbieraj precyzyjne uwagi do projektów graficznych. Przypinaj komentarze bezpośrednio do obrazu i sprawniej zamykaj review.',
    },
    languageLabel: 'Wybierz język',
    navigationLabel: 'Nawigacja główna',
    homeLabel: 'markerIt — strona główna',
    howItWorksLink: 'Jak to działa',
    benefitsLink: 'Korzyści',
    openApp: 'Otwórz aplikację',
    hero: {
      eyebrow: 'Review projektów bez zgadywania',
      titleFirst: 'Każda uwaga',
      titleSecond: 'we właściwym miejscu.',
      description:
        'Zbieraj komentarze bezpośrednio na projekcie. Mniej niejasnych wiadomości, więcej konkretnych poprawek.',
      primaryAction: 'Zacznij review',
      secondaryAction: 'Zobacz, jak działa',
      note: 'Przejrzysty feedback dla zespołów kreatywnych.',
    },
    preview: {
      label: 'Podgląd komentarza przypiętego do projektu',
      project: 'Kampania — wiosna',
      draft: 'Wersja robocza · przed chwilą',
      status: 'W trakcie',
      artworkTitle: 'NOWA KOLEKCJA',
      artworkLineFirst: 'Więcej',
      artworkLineSecond: 'przestrzeni.',
      artworkSubtitle: 'Odkryj lekkość na nowo',
      artworkCaption: 'KREACJA 04 / 12',
      reviewer: 'Maja K.',
      commentTime: '· 2 min temu',
      comment: 'Czy możemy przesunąć nagłówek trochę wyżej?',
      peopleReviewing: '3 osoby przeglądają',
      commentsCount: '2 uwagi',
    },
    process: {
      eyebrow: 'Prosty przepływ pracy',
      titleFirst: 'Od projektu do',
      titleSecond: 'jasnych decyzji.',
      description: 'Wszystkie uwagi są przypięte do obrazu i rozmowy, której dotyczą.',
      steps: [
        {
          title: 'Dodaj projekt',
          description: 'Wgraj obraz, który chcesz pokazać zespołowi lub klientowi.',
        },
        {
          title: 'Zaproś do review',
          description: 'Udostępnij projekt współpracownikom albo wyślij link gościom.',
        },
        {
          title: 'Zbieraj konkretne uwagi',
          description: 'Komentarze przypięte do obrazu pomagają od razu znaleźć właściwe miejsce.',
        },
      ],
    },
    footer: 'Wspólne review, które naprawdę posuwa projekt naprzód.',
  },
} as const;

export type Locale = keyof typeof messages;
export type TranslationMessages = (typeof messages)[Locale];

export const locales: readonly Locale[] = ['en', 'pl'];

export function getMessages(locale: Locale): TranslationMessages {
  return messages[locale];
}

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
