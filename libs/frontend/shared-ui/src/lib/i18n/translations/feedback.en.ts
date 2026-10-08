import type { TranslationDictionary } from './en';

/** `feedback.*` (044-user-feedback), English: header button, dialog, errors, toast. */
export const feedbackEn: TranslationDictionary = {
  button: 'Send feedback',
  dialog: {
    title: 'Feedback to the admins',
    note: 'Please do not include passwords or account data.',
    category: 'Category',
    subject: 'Subject',
    message: 'Message',
    counter: '{{count}} / {{max}}',
    send: 'Send',
    sending: 'Sending…',
    cancel: 'Cancel',
    errors: {
      subjectRequired: 'Please enter a subject.',
      messageRequired: 'Please enter a message.',
    },
  },
  categories: {
    feature: 'Feature request',
    problem: 'Problem',
    other: 'Other',
  },
  confirm: {
    title: 'Discard your input?',
    text: 'You can save your text as a draft in this browser to continue or send later, or delete it permanently.',
    keep: 'Keep writing',
    keepDraft: 'Save draft and close',
    discard: 'Discard',
  },
  quota: {
    label: '{{remaining}} of {{limit}} feedbacks left in 24 h',
    labelReset: '{{remaining}} of {{limit}} left · next slot {{time}}',
  },
  errors: {
    deliveryFailed:
      'Sending failed. Please try again, or save your text as a draft and send it later.',
    unavailable:
      'Feedback is currently unavailable. Please try again, or save your text as a draft and send it later.',
    network:
      'The server could not be reached. Please try again, or save your text as a draft and send it later.',
    botProtection:
      'The security check failed. Please complete it again and retry, or save your text as a draft and send it later.',
    limitReached: 'Daily limit reached. The next slot is free at {{time}}.',
    limitReachedNoTime: 'Daily limit reached. Please try again later.',
  },
  toast: {
    success: 'Thank you! Your feedback was sent to the admins. {{remaining}} of {{limit}} left.',
  },
};
