import type { TranslationDictionary } from './en';

/**
 * `requests.*` (033-parser-requests), English: texts shared by the generic requests capability
 * (statuses, API error codes). Request type and feature names come from the `@vaultfolio/requests`
 * registry (`requestTypeLabel`), not from here, so a new type needs no translation key for them.
 * The wizard (`wizard.*`) and the admin tab (`admin.*`) append their own keys. Placeholders use `{{name}}`.
 */
export const requestsEn: TranslationDictionary = {
  status: {
    OPEN: 'Open',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
    REJECTED: 'Rejected',
  },
  errors: {
    UNKNOWN_REQUEST_TYPE: 'This kind of request is not supported.',
    INVALID_LAYOUT: 'The anonymized document is not in a valid format. Please start again.',
    LAYOUT_UNKNOWN_FIELD: 'The anonymized document contains unexpected data. Please start again.',
    LIMIT_EXCEEDED: 'The document is too large to send (at most 3 pages).',
    PERSONAL_DATA_DETECTED:
      'The server found data that looks personal. Mask or remove it and send again.',
    INVALID_RULE_DRAFT: 'The rule markings are not valid. Remove them or skip this step.',
    REQUEST_LIMIT_OPEN: 'You already have three open requests. Please wait until one is handled.',
    REQUEST_LIMIT_DAILY:
      'You have sent the maximum number of requests today. Please try again tomorrow.',
    REQUEST_NOT_FOUND: 'This request does not exist.',
    SAMPLE_DELETED: 'The sample of this request has been deleted.',
    INVALID_REQUEST_UPDATE:
      'The change is not valid. Choose a status or enter a note of up to 2000 characters.',
    forbidden: 'You do not have access to this.',
    payload_too_large: 'The request is too large to send.',
    UNSUPPORTED_MEDIA_TYPE: 'The request could not be sent in this format.',
  },
  requestParser: {
    button: 'Request a parser',
    note: 'Sends an anonymized copy — never real figures.',
  },
  wizard: {
    title: 'Request a parser',
    loading: 'Reading the document on this device…',
    backToImport: 'Back to import',
    back: 'Back',
    cancel: 'Cancel',
    continue: 'Continue',
    steps: {
      consent: 'Consent',
      review: 'Review words',
      rules: 'Mark rules',
      preview: 'Preview & send',
    },
    kinds: {
      BANK_ACCOUNT: 'bank account',
      TAX_ID: 'tax ID',
      SOCIAL_SECURITY: 'social-security number',
      EMAIL: 'e-mail address',
      PHONE: 'phone number',
      POSTCODE_CITY: 'postcode and city',
    },
    consent: {
      factDeviceTitle: 'Stays on your device',
      factDeviceText:
        'Your PDF, its text and all real figures are only read here. They are never sent.',
      factSentTitle: 'Sent after you confirm',
      factSentText:
        'Only a rebuilt copy: layout and labels, with every number replaced by a random one of the same shape and every unknown word masked or kept by you.',
      factWhoTitle: 'Who sees it, how long',
      factWhoText:
        'Administrators, in the portal only (never by e-mail). Deleted 30 days after the request is closed.',
      checksTitle: 'Document checks (on this device)',
      checkReadable: 'Readable text document, {{pages}} page(s).',
      checkNoPersonal: 'No personal data found.',
      checkPersonal:
        'Personal data found ({{kinds}}) — removed automatically, no redaction needed.',
      checkCovered: '{{count}} word(s) hidden under black boxes — masked by default.',
      consentLabel:
        'I understand that an anonymized, rebuilt copy of this document will be sent to the administrators.',
    },
    review: {
      calloutRemoved: 'Personal data was found and removed: {{kinds}}.',
      explain:
        'Numbers are replaced by random values. Known labels stay. Decide for every other word whether to keep it or mask it.',
      legendValue: 'Replaced value',
      legendRemoved: 'Removed (locked)',
      legendUndecided: 'Needs a decision',
      legendMasked: 'Masked',
      legendKept: 'Kept',
      markedTitle: 'Marked words',
      progress: '{{done}} of {{total}} decided',
      keep: 'Keep as label',
      mask: 'Mask',
      removedRow: 'Removed automatically ({{count}})',
      noWords: 'No word needs a decision.',
    },
    rules: {
      optional:
        'Optional: you can mark which lines are which figure. This is a hint for the developer and is never executed.',
      skip: 'Skip markings',
    },
    preview: {
      callout: 'This is exactly what the administrators will receive.',
      summaryTitle: 'Summary',
      pages: 'Pages',
      kept: 'Words kept',
      masked: 'Words masked',
      removed: 'Personal data removed',
      values: 'Values replaced',
      consentGiven: 'Consent given',
      send: 'Send request',
      sending: 'Sending…',
      discard: 'Discard',
      blocked: 'Sending is blocked until every word is decided and no personal data remains.',
    },
    sent: {
      title: 'Request sent',
      text: 'Thank you. An administrator will look at your anonymized sample.',
      feature: 'Feature',
      request: 'Request',
      sentAt: 'Sent',
      keptUntil: 'Kept until',
      keptUntilValue: '30 days after the request is closed',
      duplicate: 'A similar request is already open — it will be handled together.',
    },
    refused: {
      title: 'This document cannot be requested',
      chooseAnother: 'Choose another file',
      IMAGE_ONLY:
        'The file has no text layer (a scan). Use the companion tool to convert it first.',
      PASSWORD_PROTECTED: 'The file is password-protected.',
      UNREADABLE: 'The file could not be read.',
      TOO_MANY_PAGES: 'The document has more than 3 pages.',
      TOO_LARGE: 'The document is too large to send.',
    },
    errorGeneric: 'The request could not be sent. Please try again.',
  },
};
