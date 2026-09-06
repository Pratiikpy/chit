/**
 * Who you are, on an invoice — kept on this device and nowhere else.
 *
 * chit holds no personal data and has no accounts, and that is the whole legal footing: a
 * non-custodial tool that connects nobody and stores nothing about anybody. But an invoice a
 * bookkeeper will accept needs a name and an address on it, and the small-invoice reliefs
 * that cover most chits ask for exactly that and little else — Germany's §33 UStDV at €250
 * and the UK's VAT Notice 700 §16.6.1 at £250 both want supplier name and address, the date,
 * what the service was, and the total with a rate or an exemption note. No customer details,
 * no invoice number, no VAT identifier.
 *
 * So the fields live in `localStorage` and are read only by the print view. They are never
 * sent to the server, never part of a chit, never signed, and never leave the device. If the
 * browser is cleared they are gone, and nothing else breaks — which is the correct trade for
 * a product whose promise is that it knows nothing about you.
 */

const KEY = 'chit.identity';

export interface Identity {
  /** Trading name, or the person's own name. */
  name: string;
  /** Free-form, one line per line. Street, city, postcode, country — whatever local rules want. */
  address: string;
  /** A VAT or tax identifier, where the freelancer has one and the rules want it shown. */
  taxId: string;
  /**
   * The sentence a small invoice needs instead of a VAT rate — a reverse-charge note, a
   * small-business exemption, or nothing. Free text on purpose: the wording differs by
   * country and by status, and a wizard that guesses it would be worse than a blank field.
   */
  taxNote: string;
  /** Where the money should be seen to have gone, when that is not obvious from the chain. */
  contact: string;
}

export const EMPTY_IDENTITY: Identity = { name: '', address: '', taxId: '', taxNote: '', contact: '' };

/** Everything trimmed, and each field bounded so a print layout cannot be broken by paste. */
function clean(identity: Partial<Identity>): Identity {
  const cap = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  return {
    name: cap(identity.name, 120),
    address: cap(identity.address, 400),
    taxId: cap(identity.taxId, 60),
    taxNote: cap(identity.taxNote, 300),
    contact: cap(identity.contact, 120),
  };
}

export function readIdentity(): Identity {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_IDENTITY };
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? clean(parsed as Partial<Identity>) : { ...EMPTY_IDENTITY };
  } catch {
    // Private mode, blocked storage, or junk under our key. An invoice without a name is
    // still a receipt, so this fails to nothing rather than to an error.
    return { ...EMPTY_IDENTITY };
  }
}

export function writeIdentity(identity: Partial<Identity>): Identity {
  const next = clean(identity);
  try {
    if (Object.values(next).every((v) => v === '')) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage refused; the fields simply do not persist */
  }
  return next;
}

/** True once there is enough to head an invoice with. */
export function hasIdentity(identity: Identity = readIdentity()): boolean {
  return identity.name !== '';
}
