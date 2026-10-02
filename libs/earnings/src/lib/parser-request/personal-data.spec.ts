import { scanDocument, scanLine } from './personal-data.js';

const words = (...texts: string[]) => texts.map((text) => ({ text }));

function taxIdWithCheck(first10: string): string {
  let product = 10;
  for (const char of first10) {
    let sum = (Number(char) + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  const check = 11 - product === 10 ? 0 : 11 - product;
  return first10 + String(check);
}

function ibanWithCheck(country: string, bban: string): string {
  const numeric = (bban + country + '00').replaceAll(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return `${country}${String(98 - remainder).padStart(2, '0')}${bban}`;
}

describe('scanLine', () => {
  describe('bank account (IBAN, mod-97)', () => {
    it('flags a valid IBAN in one word', () => {
      expect(scanLine(words('IBAN:', 'DE89370400440532013000'))).toEqual([
        { kind: 'BANK_ACCOUNT', wordIndexes: [1] },
      ]);
    });

    it('flags a valid IBAN printed in groups across words', () => {
      const hits = scanLine(words('Konto', 'DE89', '3704', '0044', '0532', '0130', '00', 'Summe'));
      expect(hits).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [1, 2, 3, 4, 5, 6] }]);
    });

    it('flags another country', () => {
      expect(scanLine(words('GB82', 'WEST', '1234', '5698', '7654', '32'))).toEqual([
        { kind: 'BANK_ACCOUNT', wordIndexes: [0, 1, 2, 3, 4, 5] },
      ]);
    });

    it('flags generated valid IBANs', () => {
      const iban = ibanWithCheck('DE', '100200304005006007');
      expect(iban).toHaveLength(22);
      expect(scanLine(words(iban))).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [0] }]);
    });

    it('ignores an IBAN-shaped value with invalid check digits', () => {
      expect(scanLine(words('DE89370400440532013001'))).toEqual([]);
      expect(scanLine(words('DE00000000000000000000'))).toEqual([]);
    });
  });

  describe('tax ID (11 digits, MOD 11,10)', () => {
    it('flags the documented example', () => {
      expect(scanLine(words('Steuer-ID', '65929970489'))).toEqual([
        { kind: 'TAX_ID', wordIndexes: [1] },
      ]);
    });

    it('flags a generated valid ID, also in groups', () => {
      const id = taxIdWithCheck('6571339482');
      expect(scanLine(words(id))).toEqual([{ kind: 'TAX_ID', wordIndexes: [0] }]);
      const grouped = words(id.slice(0, 2), id.slice(2, 5), id.slice(5, 8), id.slice(8));
      expect(scanLine(grouped)).toEqual([{ kind: 'TAX_ID', wordIndexes: [0, 1, 2, 3] }]);
    });

    it('ignores a wrong check digit, a leading zero and a failing multiplicity rule', () => {
      const kinds = (id: string) => scanLine(words(id)).map((hit) => hit.kind);
      expect(kinds('65929970488')).toEqual([]);
      expect(kinds(taxIdWithCheck('0571339482'))).not.toContain('TAX_ID');
      // 6,5,7,1,3,3,9,4,8,2 is valid; two repeated digits are not
      expect(kinds(taxIdWithCheck('6571339485'))).not.toContain('TAX_ID');
    });

    it('ignores 11 digits inside a longer amount', () => {
      expect(scanLine(words('1.234.567.890,12'))).toEqual([]);
    });
  });

  describe('social-security number', () => {
    it('flags the documented example, also in groups', () => {
      expect(scanLine(words('SV-Nummer', '15070649C103'))).toEqual([
        { kind: 'SOCIAL_SECURITY', wordIndexes: [1] },
      ]);
      expect(scanLine(words('15', '070649', 'C', '103'))).toEqual([
        { kind: 'SOCIAL_SECURITY', wordIndexes: [0, 1, 2, 3] },
      ]);
    });

    it('ignores a wrong check digit and an impossible birth date', () => {
      expect(scanLine(words('15070649C104'))).toEqual([]);
      expect(scanLine(words('15320649C103'))).toEqual([]);
    });
  });

  describe('e-mail', () => {
    it('flags an address, with surrounding punctuation', () => {
      expect(scanLine(words('Mail:', 'max.muster@example.com,'))).toEqual([
        { kind: 'EMAIL', wordIndexes: [1] },
      ]);
    });

    it('flags an address split around the @', () => {
      expect(scanLine(words('max.muster', '@example.com'))).toEqual([
        { kind: 'EMAIL', wordIndexes: [0, 1] },
      ]);
      expect(scanLine(words('max.muster@', 'example.com'))).toEqual([
        { kind: 'EMAIL', wordIndexes: [0, 1] },
      ]);
    });

    it('ignores an @ without a domain', () => {
      expect(scanLine(words('a@b'))).toEqual([]);
    });
  });

  describe('phone', () => {
    it('flags numbers with prefix and separators', () => {
      expect(scanLine(words('Tel.', '+49', '30', '12345678'))).toEqual([
        { kind: 'PHONE', wordIndexes: [1, 2, 3] },
      ]);
      expect(scanLine(words('0171/1234567'))).toEqual([{ kind: 'PHONE', wordIndexes: [0] }]);
      expect(scanLine(words('(030)', '12345678'))).toEqual([
        { kind: 'PHONE', wordIndexes: [0, 1] },
      ]);
      expect(scanLine(words('030', '12345678'))).toEqual([{ kind: 'PHONE', wordIndexes: [0, 1] }]);
    });

    it('ignores amounts, dates and short numbers', () => {
      expect(scanLine(words('0,00', '01.01.2026', '1.234,56', '0123456'))).toEqual([]);
    });
  });

  describe('postcode and city', () => {
    it('flags a postcode followed by a capitalised word', () => {
      expect(scanLine(words('80331', 'München'))).toEqual([
        { kind: 'POSTCODE_CITY', wordIndexes: [0, 1] },
      ]);
      expect(scanLine(words('Brightline', '20457', 'Hamburg'))).toEqual([
        { kind: 'POSTCODE_CITY', wordIndexes: [1, 2] },
      ]);
    });

    it('ignores labels, amounts and lower-case words after five digits', () => {
      expect(scanLine(words('10000', 'Euro'))).toEqual([]);
      expect(scanLine(words('12345', 'brutto'))).toEqual([]);
      expect(scanLine(words('1234', 'München'))).toEqual([]);
    });
  });

  it('ignores labels and plain amounts', () => {
    expect(scanLine(words('Gesamtbrutto', '5.200,00', 'Lohnsteuer', '918,00'))).toEqual([]);
  });
});

describe('scanDocument', () => {
  it('reports page, line and word indexes of every hit', () => {
    const doc = {
      pages: [
        { lines: [{ words: words('Brutto', '1,00') }, { words: words('a@b.de') }] },
        { lines: [{ words: words('x') }, { words: words('IBAN', 'DE89370400440532013000') }] },
      ],
    };
    expect(scanDocument(doc)).toEqual([
      { kind: 'EMAIL', wordIndexes: [0], page: 0, line: 1 },
      { kind: 'BANK_ACCOUNT', wordIndexes: [1], page: 1, line: 1 },
    ]);
  });

  it('returns nothing for a clean document', () => {
    expect(scanDocument({ pages: [{ lines: [{ words: words('Netto', '3.116,00') }] }] })).toEqual(
      [],
    );
  });
});

describe('lenient scan for recognised text (034)', () => {
  const lenient = { lenient: true };

  it('keeps strict as the default: shape-only values with invalid check digits are not flagged', () => {
    expect(scanLine(words('DE0O37601008500040XXX94478'))).toEqual([]);
    expect(scanLine(words('Steuer-ID', '12345678901'))).toEqual([]);
    expect(
      scanDocument({ pages: [{ lines: [{ words: words('DE00000000000000000000') }] }] }),
    ).toEqual([]);
  });

  describe('IBAN', () => {
    it('flags a German IBAN shape with invalid check digits and look-alike letters', () => {
      expect(scanLine(words('IBAN', 'DE0O376010085000400944'), lenient)).toEqual([
        { kind: 'BANK_ACCOUNT', wordIndexes: [1] },
      ]);
    });

    it('flags it printed in groups and whitespace-tolerant', () => {
      expect(
        scanLine(words('DE0O3', '7601', '0085', '0004', '0O94', '45', 'Summe'), lenient),
      ).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [0, 1, 2, 3, 4, 5] }]);
    });

    it('reports a valid IBAN once, not twice', () => {
      const iban = ibanWithCheck('DE', '100200304005006007');
      expect(scanLine(words(iban), lenient)).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [0] }]);
    });

    it('flags a German IBAN whose digits were misread as arbitrary letters', () => {
      expect(
        scanLine(
          words('Konto', 'DE0O3', '7601', '0085', '0004', '0XXX', 'XX', '94478', '9.999,99'),
          lenient,
        ),
      ).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [1, 2, 3, 4, 5, 6, 7] }]);
    });

    it('does not swallow the label after the IBAN', () => {
      expect(
        scanLine(words('DE89', '3704', '0044', '0532', '0130', '00', 'Summe', 'Betrag'), lenient),
      ).toEqual([{ kind: 'BANK_ACCOUNT', wordIndexes: [0, 1, 2, 3, 4, 5] }]);
    });

    it('does not flag the wrong length or words without digits', () => {
      expect(scanLine(words('DE0O37601008500040'), lenient)).toEqual([]);
      expect(scanLine(words('DEOOSOOOOOOOOOOOOOOOOO'), lenient)).toEqual([]);
    });
  });

  describe('tax ID', () => {
    it('flags 11 digit-like characters with an invalid check digit, also in groups', () => {
      expect(scanLine(words('Steuer-ID', '12345678901'), lenient)).toEqual([
        { kind: 'TAX_ID', wordIndexes: [1] },
      ]);
      expect(scanLine(words('Steuer-ID', '12', '345', '678', '9O1'), lenient)).toEqual([
        { kind: 'TAX_ID', wordIndexes: [1, 2, 3, 4] },
      ]);
      expect(scanLine(words('l2345S78901'), lenient)).toEqual([
        { kind: 'TAX_ID', wordIndexes: [0] },
      ]);
    });

    it('does not flag a leading zero, decimal separators or shorter runs', () => {
      expect(scanLine(words('02345678901'), lenient).filter((h) => h.kind === 'TAX_ID')).toEqual(
        [],
      );
      expect(scanLine(words('1.234.567,89'), lenient)).toEqual([]);
      expect(scanLine(words('Summe', '12345678901,50'), lenient)).toEqual([]);
      expect(scanLine(words('1234567890'), lenient)).toEqual([]);
    });
  });

  describe('social-security number', () => {
    it('flags the shape without a valid check digit and with look-alike digits', () => {
      expect(scanLine(words('Versicherungsnummer', '12', '345678', 'A', '901'), lenient)).toEqual([
        { kind: 'SOCIAL_SECURITY', wordIndexes: [1, 2, 3, 4] },
      ]);
      expect(scanLine(words('12O3S6781901'), lenient)).toEqual([]);
      expect(scanLine(words('12O3S678A901'), lenient)).toEqual([
        { kind: 'SOCIAL_SECURITY', wordIndexes: [0] },
      ]);
    });
  });

  it('leaves the other detectors unchanged', () => {
    const sample = words('mail@example.com', '0170', '1234567', '10115', 'Berlin');
    expect(scanLine(sample, lenient)).toEqual(scanLine(sample));
  });
});
