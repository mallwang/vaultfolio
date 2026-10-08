import type { TranslationDictionary } from './en';

/** `feedback.*` (044-user-feedback), Deutsch: Header-Button, Dialog, Fehler, Toast. */
export const feedbackDe: TranslationDictionary = {
  button: 'Feedback senden',
  dialog: {
    title: 'Feedback an die Admins',
    note: 'Bitte keine Passwörter oder Kontodaten angeben.',
    category: 'Kategorie',
    subject: 'Betreff',
    message: 'Nachricht',
    counter: '{{count}} / {{max}}',
    send: 'Senden',
    sending: 'Wird gesendet …',
    cancel: 'Abbrechen',
    errors: {
      subjectRequired: 'Bitte einen Betreff eingeben.',
      messageRequired: 'Bitte eine Nachricht eingeben.',
    },
  },
  categories: {
    feature: 'Feature-Wunsch',
    problem: 'Problem',
    other: 'Sonstiges',
  },
  confirm: {
    title: 'Eingaben verwerfen?',
    text: 'Du kannst den Text als Entwurf in diesem Browser speichern und später weiterschreiben oder senden – oder endgültig löschen.',
    keep: 'Weiterschreiben',
    keepDraft: 'Entwurf speichern und schließen',
    discard: 'Verwerfen',
  },
  quota: {
    label: 'Noch {{remaining}} von {{limit}} Feedbacks in 24 h',
    labelReset: 'Noch {{remaining}} von {{limit}} · nächster Slot {{time}}',
  },
  errors: {
    deliveryFailed:
      'Senden fehlgeschlagen. Versuche es erneut oder speichere deinen Text als Entwurf und sende ihn später.',
    unavailable:
      'Feedback ist derzeit nicht verfügbar. Versuche es erneut oder speichere deinen Text als Entwurf und sende ihn später.',
    network:
      'Der Server ist nicht erreichbar. Versuche es erneut oder speichere deinen Text als Entwurf und sende ihn später.',
    botProtection:
      'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte wiederhole sie und sende erneut oder speichere deinen Text als Entwurf und sende ihn später.',
    limitReached: 'Tageslimit erreicht. Der nächste Slot wird um {{time}} frei.',
    limitReachedNoTime: 'Tageslimit erreicht. Bitte versuche es später erneut.',
  },
  toast: {
    success:
      'Danke! Dein Feedback wurde an die Admins gesendet. Noch {{remaining}} von {{limit}} übrig.',
  },
};
