/**
 * German is the reference language: its structure defines the set of translation keys.
 * All other languages must provide exactly the same keys (enforced by TypeScript and tests).
 */
export const de = {
  app: {
    name: 'Kalethra',
    loading: 'Wird geladen …',
    startupErrorTitle: 'Die App konnte nicht gestartet werden',
    startupErrorBody:
      'Beim Öffnen der lokalen Datenbank ist ein Fehler aufgetreten. Bitte starte die App neu.',
    retry: 'Erneut versuchen',
  },
  nav: {
    label: 'Hauptnavigation',
    dashboard: 'Heute',
    training: 'Training',
    nutrition: 'Ernährung',
    health: 'Gesundheit',
    profile: 'Profil',
  },
  common: {
    noValue: 'Kein Wert',
    save: 'Sichern',
  },
  dashboard: {
    greeting: {
      morning: 'Guten Morgen',
      afternoon: 'Guten Tag',
      evening: 'Guten Abend',
    },
    greetingWithName: '{greeting}, {name}',
    todayTitle: 'Heute',
    todayEmpty: 'Für heute sind noch keine Daten erfasst.',
    metrics: {
      steps: 'Schritte',
      energy: 'Kalorien',
      training: 'Training (Min.)',
    },
    weekTitle: 'Diese Woche',
    weekTodayLabel: 'Heute, {date}',
    areasTitle: 'Bereiche',
    areas: {
      training: 'Pläne, Einheiten und Übungen',
      nutrition: 'Mahlzeiten und Nährstoffe',
      health: 'Körperwerte, Schlaf und Erholung',
    },
  },
  training: {
    title: 'Training',
    emptyTitle: 'Noch keine Trainingseinheiten',
    emptyBody:
      'Hier planst und protokollierst du künftig dein Training – vom ersten Workout bis zum Wettkampf.',
    disciplinesTitle: 'Trainingsarten',
    disciplinesFooter:
      'Pläne und Protokolle für diese Trainingsarten folgen in den nächsten Versionen.',
    disciplines: {
      strength: 'Krafttraining',
      endurance: 'Ausdauer und Cardio',
      hyrox: 'HYROX',
      calisthenics: 'Calisthenics',
      mobility: 'Mobility',
    },
  },
  nutrition: {
    title: 'Ernährung',
    emptyTitle: 'Noch keine Mahlzeiten erfasst',
    emptyBody:
      'Hier erfasst du künftig Mahlzeiten und behältst Kalorien und Makronährstoffe im Blick.',
    nutrientsTitle: 'Nährwerte heute',
    nutrients: {
      energy: 'Energie',
      protein: 'Protein',
      carbohydrates: 'Kohlenhydrate',
      fat: 'Fett',
    },
  },
  health: {
    title: 'Gesundheit',
    emptyTitle: 'Noch keine Messwerte',
    emptyBody:
      'Hier siehst du künftig deine Körperwerte, deinen Schlaf und deine Erholung im Verlauf.',
    bodyTitle: 'Körper',
    recoveryTitle: 'Erholung',
    measurements: {
      weight: 'Gewicht',
      bodyFat: 'Körperfett',
      muscleMass: 'Muskelmasse',
      restingHeartRate: 'Ruhepuls',
      sleep: 'Schlaf',
    },
  },
  profile: {
    title: 'Profil',
    localProfile: 'Lokales Profil',
    localProfileHint: 'Deine Daten bleiben auf diesem Gerät.',
    nameLabel: 'Name',
    namePlaceholder: 'Dein Vorname',
    appearanceTitle: 'Darstellung',
    theme: {
      label: 'Erscheinungsbild',
      system: 'System',
      light: 'Hell',
      dark: 'Dunkel',
    },
    languageTitle: 'Sprache',
    language: {
      label: 'App-Sprache',
      system: 'System',
      systemHint: 'Folgt der Gerätesprache (aktuell: {language}).',
    },
    dataTitle: 'Daten',
    cloudSync: 'Cloud-Synchronisierung',
    cloudSyncOff: 'Aus',
    dataFooter:
      'Alle Daten werden lokal auf diesem Gerät gespeichert. Ein optionales Konto mit Synchronisierung folgt in einer späteren Version.',
    aboutTitle: 'Über {appName}',
    version: 'Version',
  },
  languages: {
    de: 'Deutsch',
    en: 'English',
  },
} as const;
