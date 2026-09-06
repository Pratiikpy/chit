/**
 * Names for wallets, kept on this device only.
 *
 * chit has no profiles — nothing about a person is editable or stored on the server, by
 * design (PRODUCT_SPEC §8). But a freelancer with three clients cannot tell `NQ20 AP18 …`
 * from `NQ25 X2QV …`, and the trust walk named that as the moment the app stops feeling
 * like a company's product. A name typed here is a private note to yourself: it lives in
 * this browser's localStorage, is never sent anywhere, and never appears on anyone else's
 * screen or receipt.
 */

const KEY = 'chit.labels';

function tight(address: string): string {
  return address.replace(/\s/g, '').toUpperCase();
}

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    // Private mode, blocked storage, or someone else's junk under our key: no labels.
    return {};
  }
}

function writeAll(labels: Record<string, string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(labels));
  } catch {
    // Storage refused. The name simply does not persist — nothing else depends on it.
  }
}

/** The name this device gave a wallet, if any. */
export function labelFor(address: string | null | undefined): string | null {
  if (!address) return null;
  const value = readAll()[tight(address)];
  return value && value.trim().length > 0 ? value : null;
}

/** Name a wallet, or clear the name with an empty string. Trimmed, capped at 40 characters. */
export function setLabel(address: string, name: string): void {
  const labels = readAll();
  const key = tight(address);
  const clean = name.trim().slice(0, 40);
  if (clean) labels[key] = clean;
  else delete labels[key];
  writeAll(labels);
}
