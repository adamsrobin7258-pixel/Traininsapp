import type { TranslationSchema } from '../types';

export const en: TranslationSchema = {
  app: {
    name: 'Kalethra',
    loading: 'Loading …',
    startupErrorTitle: 'The app could not be started',
    startupErrorBody:
      'Something went wrong while opening the local database. Please restart the app.',
    startupErrorKey:
      'The key for your encrypted data is not available on this device. Your data has not been changed.',
    startupErrorMigration:
      'The local database could not be updated. The change was fully rolled back and your data is unchanged.',
    retry: 'Try again',
  },
  nav: {
    label: 'Main navigation',
    dashboard: 'Today',
    training: 'Training',
    nutrition: 'Nutrition',
    health: 'Health',
    profile: 'Profile',
  },
  common: {
    noValue: 'No value',
    save: 'Save',
  },
  dashboard: {
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
    },
    greetingWithName: '{greeting}, {name}',
    todayTitle: 'Today',
    todayEmpty: 'Nothing has been logged for today yet.',
    metrics: {
      steps: 'Steps',
      energy: 'Calories',
      training: 'Training (min)',
    },
    weekTitle: 'This week',
    weekTodayLabel: 'Today, {date}',
    areasTitle: 'Areas',
    areas: {
      training: 'Plans, sessions and exercises',
      nutrition: 'Meals and nutrients',
      health: 'Body metrics, sleep and recovery',
    },
  },
  training: {
    title: 'Training',
    emptyTitle: 'No workouts yet',
    emptyBody:
      'This is where you will plan and log your training – from your first workout to race day.',
    disciplinesTitle: 'Disciplines',
    disciplinesFooter: 'Plans and logs for these disciplines will follow in upcoming versions.',
    disciplines: {
      strength: 'Strength training',
      endurance: 'Endurance and cardio',
      hyrox: 'HYROX',
      calisthenics: 'Calisthenics',
      mobility: 'Mobility',
    },
  },
  nutrition: {
    title: 'Nutrition',
    emptyTitle: 'No meals logged yet',
    emptyBody: 'This is where you will log meals and keep track of calories and macronutrients.',
    nutrientsTitle: 'Nutrients today',
    nutrients: {
      energy: 'Energy',
      protein: 'Protein',
      carbohydrates: 'Carbohydrates',
      fat: 'Fat',
    },
  },
  health: {
    title: 'Health',
    emptyTitle: 'No measurements yet',
    emptyBody: 'This is where you will follow your body metrics, sleep and recovery over time.',
    bodyTitle: 'Body',
    recoveryTitle: 'Recovery',
    measurements: {
      weight: 'Weight',
      bodyFat: 'Body fat',
      muscleMass: 'Muscle mass',
      restingHeartRate: 'Resting heart rate',
      sleep: 'Sleep',
    },
  },
  profile: {
    title: 'Profile',
    localProfile: 'Local profile',
    localProfileHint: 'Your data stays on this device.',
    nameLabel: 'Name',
    namePlaceholder: 'Your first name',
    appearanceTitle: 'Display',
    theme: {
      label: 'Appearance',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
    },
    languageTitle: 'Language',
    language: {
      label: 'App language',
      system: 'System',
      systemHint: 'Follows your device language (currently: {language}).',
    },
    cloudSync: 'Cloud sync',
    cloudSyncOff: 'Off',
    privacy: {
      title: 'Privacy & security',
      location: 'Storage',
      locationValue: 'This device only',
      encryption: 'Encryption',
      encryptionOn: 'On',
      encryptionOff: 'Off',
      footerEncrypted:
        'Your data is encrypted and stored only on this device. Kalethra does not send data to third parties.',
      footerDevelopment:
        'Browser development mode: data is stored unencrypted in the browser. The Android and iOS apps always encrypt.',
      runCheck: 'Check storage',
      running: 'Checking …',
      checkFailed: 'The check could not be run.',
      lastRun: 'Value from {date} found',
      developmentMode: 'Browser development mode',
      checks: {
        encryption: 'Encrypted database',
        writeRead: 'Write and read',
        restart: 'Kept after restart',
        rollback: 'Rollback on errors',
        schema: 'Database version',
      },
      status: {
        pass: 'Passed',
        fail: 'Failed',
        pending: 'Check after restart',
      },
    },
    aboutTitle: 'About {appName}',
    version: 'Version',
  },
  languages: {
    de: 'Deutsch',
    en: 'English',
  },
};
