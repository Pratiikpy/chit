/**
 * Copy in the user's own language.
 *
 * Nimiq Pay tells the Mini App which language its user chose (`getHostLanguage()`, seeded
 * before the page script runs). 68% of Nimiq Pay's users are German, so German is the
 * first translation and the one that matters; the others are listed by the platform and
 * fall back to English until a native speaker has checked them.
 *
 * `t()` takes the English sentence as the key. That keeps the source readable, makes a
 * missing translation harmless (you see English, never a key), and means a sentence can be
 * changed in one place. Placeholders are `{name}`.
 */

import { getHostLanguage } from '@nimiq/mini-app-sdk';

type Dict = Record<string, string>;

const de: Dict = {
  'Paste the deal. Get a receipt.': 'Deal einfügen. Beleg bekommen.',
  'For the clients you already talk to directly. Client pays; you get a receipt proving you were paid for exactly this. Proof of payment, not protection.':
    'Für Kunden, mit denen du schon direkt sprichst. Der Kunde zahlt; du bekommst einen Beleg, dass du genau dafür bezahlt wurdest. Zahlungsnachweis, kein Schutz.',
  'I’m getting paid': 'Ich werde bezahlt',
  'I’m paying': 'Ich zahle',
  'Which way the money goes': 'In welche Richtung das Geld geht',
  'Paste the line from the chat where you agreed it. You sign; whoever pays the link has accepted; the NIM lands in your wallet.':
    'Füge die Zeile aus dem Chat ein, in dem ihr es vereinbart habt. Du unterschreibst; wer den Link bezahlt, hat angenommen; die NIM landen in deiner Wallet.',
  'Paste the line from the chat where you agreed it. You sign; they sign; you pay once they have. The payment carries the proof.':
    'Füge die Zeile aus dem Chat ein, in dem ihr es vereinbart habt. Du unterschreibst; die andere Seite unterschreibt; du zahlst, sobald sie es getan hat. Die Zahlung trägt den Beweis.',
  'The line you already agreed': 'Die Zeile, die ihr vereinbart habt',
  '$40 for 3 thumbnails by Friday': '40 € für 3 Thumbnails bis Freitag',
  'Sign it': 'Unterschreiben',
  'What we understood': 'So haben wir es verstanden',
  'Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.':
    'Gib Betrag und Währung an – „40 €“, „$120“ – damit beide Seiten derselben Zahl zustimmen. Du kannst auch jede Zeile oben antippen und selbst setzen.',
  'Pricing it in NIM…': 'Umrechnung in NIM …',
  'Waiting for your wallet…': 'Warte auf deine Wallet …',
  'chit is not reachable': 'chit ist nicht erreichbar',
  'Try again': 'Noch einmal',
  Bounty: 'Bounty',
  Activity: 'Verlauf',
  'New chit': 'Neuer Chit',
  'Bounty · paid by chit': 'Bounty · bezahlt von chit',
  'Earn {amount} — test chit': '{amount} verdienen – chit testen',
  'Sign it with your answer and the pool pays your wallet in NIM — your first, if it is empty. {n} open now.':
    'Unterschreibe mit deiner Antwort und der Pool zahlt NIM an deine Wallet – deine ersten, falls sie leer ist. {n} gerade offen.',
  'Every bounty is taken for now. The next one opens shortly.': 'Alle Bounties sind gerade vergeben. Die nächste öffnet in Kürze.',
  'The pool is being funded. When it holds a payout, a real chit you can be paid for appears here.': 'Der Pool wird gerade aufgefüllt. Sobald er eine Auszahlung deckt, erscheint hier ein echter Chit, für den du bezahlt wirst.',
  'Earn {amount}': '{amount} verdienen',
  'Your answer': 'Deine Antwort',
  'One sentence, in your own words': 'Ein Satz, in deinen Worten',
  'At least 4 words. No links. Something nobody has said yet.': 'Mindestens 4 Wörter. Keine Links. Etwas, das noch niemand gesagt hat.',
  '{n} words': '{n} Wörter',
  'Sign and get paid': 'Unterschreiben und bezahlt werden',
  'chit uses this to pay each device one bounty per day.': 'chit nutzt das, um jedem Gerät eine Bounty pro Tag zu zahlen.',
  'Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.':
    'Deine Unterschrift ist deine Antwort. Besteht sie die Regeln – für alle gleich, keine Verlosung – zahlt der Pool diesen Betrag an die Wallet, mit der du unterschreibst, und du hältst einen echten Beleg.',
  'The rules and every payout': 'Die Regeln und jede Auszahlung',
  'This deployment has no bounty pool.': 'Diese Installation hat keinen Bounty-Pool.',
  Pool: 'Pool',
  Balance: 'Guthaben',
  unknown: 'unbekannt',
  'Paid today': 'Heute gezahlt',
  of: 'von',
  'Open now': 'Gerade offen',
  Open: 'Offen',
  'The rules': 'Die Regeln',
  'Every payout': 'Jede Auszahlung',
  'None yet.': 'Noch keine.',
  'chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.':
    'chit zahlt seine eigene Bounty aus diesem Pool. Es hält nie das Geld anderer. Vom Gründer finanziert; jede Auszahlung oben steht auf der Chain.',
  'Send this to them': 'Schick das der anderen Seite',
  'They open it, read the same words you signed, and sign with the Nimiq Pay app — the link opens it. No account, no email.':
    'Sie öffnet den Link, liest dieselben Worte, die du unterschrieben hast, und unterschreibt mit der Nimiq Pay App – der Link öffnet sie. Kein Konto, keine E-Mail.',
  'Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.':
    'Noch wurde nichts gezahlt. Du zahlst, sobald unterschrieben wurde – dieser Bildschirm geht von selbst weiter.',
  'Still waiting for their signature. You can close this — it is in your Activity.': 'Warte noch auf die Unterschrift. Du kannst das schließen – es steht in deinem Verlauf.',
  'No one to send it to? Try the demo worker': 'Niemand, dem du es schicken kannst? Probier den Demo-Auftragnehmer',
  'Signing as the demo worker…': 'Unterschreibe als Demo-Auftragnehmer …',
  'Copy the link': 'Link kopieren',
  Copied: 'Kopiert',
  'Copy failed — select the link below': 'Kopieren fehlgeschlagen – markiere den Link unten',
  'Send it': 'Senden',
  'A chit to sign': 'Ein Chit zum Unterschreiben',
  'A quote to pay': 'Ein Angebot zum Bezahlen',
  'If they already have the app: ': 'Falls die App schon installiert ist: ',
  'Open in Nimiq Pay': 'In Nimiq Pay öffnen',
  'Get Nimiq Pay': 'Nimiq Pay holen',
  'Done for now': 'Erst mal fertig',
  'Your quote': 'Dein Angebot',
  'Put this where the client is — the chat, your bio, a message. Paying it is accepting it.': 'Platziere das dort, wo der Kunde ist – im Chat, in der Bio, in einer Nachricht. Bezahlen heißt annehmen.',
  'Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.':
    'Wer zuerst zahlt, ist dein Kunde. Nichts wird irgendwo verwahrt – die Zahlung landet in deiner Wallet, und dieser Bildschirm geht dann weiter.',
  'No payment yet. Leave the link where clients can see it — it is in your Activity.': 'Noch keine Zahlung. Lass den Link dort, wo Kunden ihn sehen – er steht in deinem Verlauf.',
  'A quote for you': 'Ein Angebot für dich',
  'Pay {amount}': '{amount} zahlen',
  'Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.':
    'Mit der Zahlung nimmst du genau diese Worte an. Das Geld geht direkt an die Wallet, die das Angebot unterschrieben hat – nichts wird unterwegs verwahrt.',
  'Not now': 'Jetzt nicht',
  'Someone wants to agree this with you': 'Jemand möchte das mit dir vereinbaren',
  'Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.':
    'Unterschreiben heißt, du stimmst genau diesen Worten zu. Es bewegt kein Geld – gezahlt wird nach deiner Unterschrift, an die Wallet, mit der du unterschreibst.',
  Decline: 'Ablehnen',
  'Declining…': 'Lehne ab …',
  'They declined': 'Abgelehnt',
  'You declined': 'Du hast abgelehnt',
  'They chose not to sign these words. Nothing was paid. Change the line and send a new one.': 'Die andere Seite wollte diese Worte nicht unterschreiben. Nichts wurde gezahlt. Ändere die Zeile und schick eine neue.',
  'You chose not to sign. Nothing was paid, and nothing more will happen with this link.': 'Du hast nicht unterschrieben. Nichts wurde gezahlt, und mit diesem Link passiert nichts mehr.',
  'Send a new one': 'Neuen schicken',
  'Could not load this wallet’s record.': 'Der Verlauf dieser Wallet konnte nicht geladen werden.',
  'First chit from this wallet · {amount} attached': 'Erster Chit von dieser Wallet · {amount} hinterlegt',
  'Paid {n} chits': '{n} Chits bezahlt',
  'usually within {d}': 'meist innerhalb von {d}',
  'none left unpaid': 'keiner unbezahlt geblieben',
  '{n} left unpaid': '{n} unbezahlt geblieben',
  'a minute': 'einer Minute',
  minutes: 'Minuten',
  hours: 'Stunden',
  days: 'Tagen',
  'They signed. Time to pay.': 'Unterschrieben. Zeit zu zahlen.',
  'Goes to': 'Geht an',
  'Waiting for their signature before there is anywhere to send this.': 'Warte auf die Unterschrift, bevor es ein Ziel für die Zahlung gibt.',
  Later: 'Später',
  'No NIM yet?': 'Noch keine NIM?',
  'NIM is the coin this pays in. Nimiq Pay itself cannot buy it; the Nimiq Wallet at wallet.nimiq.com can, by card in most countries, and then you send it to your Nimiq Pay address. Or earn your first NIM here: the bounty pays a real chit for a sentence of feedback.':
    'NIM ist die Münze, in der hier gezahlt wird. Nimiq Pay selbst kann sie nicht kaufen; die Nimiq Wallet auf wallet.nimiq.com kann es, per Karte in den meisten Ländern – dann schickst du sie an deine Nimiq-Pay-Adresse. Oder verdiene deine ersten NIM hier: Die Bounty zahlt einen echten Chit für einen Satz Feedback.',
  'The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.': 'Der Kurs hat sich seit der Unterschrift bewegt. Damit die vereinbarten {amount} voll bleiben, sind es jetzt {nim}.',
  'Sent. Watching the chain…': 'Gesendet. Beobachte die Chain …',
  'Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.': 'Deine Zahlung wurde gesendet. Sie ist noch nicht auf der Chain – ungewöhnlich, aber nicht verloren. Prüf gleich noch einmal.',
  'Check again': 'Noch einmal prüfen',
  'Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.': 'Vom Demo-Auftragnehmer unterschrieben – ein gekennzeichneter Platzhalter, damit du den ganzen Ablauf siehst. Er behält, was du ihm zahlst.',
  'You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.':
    'Du hast unterschrieben. Jetzt kann gezahlt werden – sobald es ankommt, hast du einen Beleg, den jeder prüfen kann, und dieser Bildschirm geht von selbst weiter.',
  'Both parties have signed. Waiting for the payment to land.': 'Beide Seiten haben unterschrieben. Warte auf die Zahlung.',
  'Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.': 'Warte noch auf die Zahlung. Alles in Ordnung – es steht in deinem Verlauf, du kannst jederzeit zurückkommen.',
  'You signed it': 'Du hast unterschrieben',
  'Both signed': 'Beide haben unterschrieben',
  'Check now': 'Jetzt prüfen',
  'Paid on': 'Bezahlt am',
  Block: 'Block',
  Transaction: 'Transaktion',
  'Paid by': 'Bezahlt von',
  'Paid to': 'Bezahlt an',
  'You were paid': 'Du wurdest bezahlt',
  Paid: 'Bezahlt',
  'Settled on chain': 'Auf der Chain abgewickelt',
  'Paid after the deadline': 'Nach der Frist bezahlt',
  'A bounty, paid by chit for your answer: “{answer}”': 'Eine Bounty, von chit bezahlt für deine Antwort: „{answer}“',
  'That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.': 'Das gehört dir. Dieser Beleg ist die Vereinbarung – jeder kann ihn gegen die Chain prüfen, ohne Konto.',
  'This receipt is the agreement. Anyone can check it against the chain, with no account.': 'Dieser Beleg ist die Vereinbarung. Jeder kann ihn gegen die Chain prüfen, ohne Konto.',
  'Open the receipt': 'Beleg öffnen',
  'Same again': 'Noch einmal dasselbe',
  'Print / save as PDF': 'Drucken / als PDF sichern',
  'Start another': 'Neuen starten',
  'Nothing to show': 'Nichts anzuzeigen',
  'No chit has settled with that transaction. Check the link, or the payment may not have landed yet.': 'Mit dieser Transaktion wurde kein Chit abgewickelt. Prüf den Link, oder die Zahlung ist noch nicht angekommen.',
  'Go to chit': 'Zu chit',
  'This is genuine': 'Das ist echt',
  'This does not check out': 'Das stimmt nicht',
  'Signatures and payment match': 'Unterschriften und Zahlung passen zusammen',
  'Verification failed': 'Prüfung fehlgeschlagen',
  'This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.': 'Das ist ein Testnetz-Chit. Die Unterschriften sind echt, aber es floss kein echtes Geld – der Betrag unten ist nicht ausgebbar.',
  For: 'Für',
  Amount: 'Betrag',
  'In NIM': 'In NIM',
  Deliverables: 'Lieferungen',
  Due: 'Fällig',
  passed: 'verstrichen',
  today: 'heute',
  'in about {n} days': 'in etwa {n} Tagen',
  Deadline: 'Frist',
  'Quoted by': 'Angeboten von',
  From: 'Von',
  'quote — paying accepted it': 'Angebot – mit der Zahlung angenommen',
  yes: 'ja',
  no: 'nein',
  'On chain': 'Auf der Chain',
  'not yet': 'noch nicht',
  'Checked in your browser, against the chain': 'In deinem Browser geprüft, gegen die Chain',
  'Digest in the payment': 'Prüfsumme in der Zahlung',
  'matches these words': 'passt zu diesen Worten',
  'does NOT match': 'passt NICHT',
  'not the wallet the words name': 'nicht die Wallet, die die Worte nennen',
  'Amount on chain': 'Betrag auf der Chain',
  Chain: 'Chain',
  'could not be read from your browser just now': 'konnte gerade nicht aus deinem Browser gelesen werden',
  'This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.':
    'Dieser Link trägt die unterschriebenen Worte nicht, deshalb hat chits Server die Zahlung geprüft. Ein Link vom Beleg-Bildschirm trägt sie und wird in deinem Browser geprüft.',
  'Signatures checked by chit’s server.': 'Unterschriften von chits Server geprüft.',
  'Show exactly what was signed': 'Genau zeigen, was unterschrieben wurde',
  'Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.': 'Jede Zeile oben wurde von den beteiligten Wallets unterschrieben und an die Zahlung gebunden. Nichts davon hat chit getippt.',
  'What is chit?': 'Was ist chit?',
  Wallet: 'Wallet',
  'Paid to you': 'An dich gezahlt',
  '{n} chits': '{n} Chits',
  'from {n} payers': 'von {n} Zahlenden',
  Kept: 'Behalten',
  'what a 20% marketplace cut would have been': 'was ein 20 %-Marktplatzanteil gewesen wäre',
  'As a payer': 'Als Zahlender',
  'paid {n}': '{n} bezahlt',
  '{n} awaiting': '{n} ausstehend',
  'Nothing yet. Your first chit will appear here the moment it is signed.': 'Noch nichts. Dein erster Chit erscheint hier, sobald er unterschrieben ist.',
  Declined: 'Abgelehnt',
  Quote: 'Angebot',
  'Signed — unpaid': 'Unterschrieben – unbezahlt',
  'Waiting for signature': 'Wartet auf Unterschrift',
  'Nothing here': 'Hier ist nichts',
  'That link does not point at anything in chit.': 'Dieser Link zeigt auf nichts in chit.',
  'Start a chit': 'Chit starten',
  'Not found': 'Nicht gefunden',
  'Test network — the signatures are real, the money is not.': 'Testnetz – die Unterschriften sind echt, das Geld nicht.',
  'Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.': 'Demo-Modus – Unterschriften hier sind nur Anschauung und werden nicht verifiziert. Öffne es in Nimiq Pay, um echt zu unterschreiben.',
  'Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.': 'Unterschreiben und Zahlen passieren in der Nimiq Pay App. Öffne das dort – Nimiq Pay fragt beim ersten Mal vielleicht nach einer Bestätigung.',
  'Signing and paying happen in the Nimiq Pay app on your phone. Scan the code below with it, or open this link there.': 'Unterschreiben und Zahlen passieren in der Nimiq Pay App auf deinem Handy. Scanne den Code unten damit, oder öffne diesen Link dort.',
  'Your wallet is on the Nimiq test network, but this chit is for real NIM. Switch Nimiq Pay to mainnet and try again.': 'Deine Wallet ist im Nimiq-Testnetz, aber dieser Chit ist für echte NIM. Stelle Nimiq Pay auf Mainnet und versuch es noch einmal.',
  'Your wallet is on Nimiq mainnet, but this is a test-network chit. Switch Nimiq Pay to testnet and try again.': 'Deine Wallet ist im Nimiq-Mainnet, aber das ist ein Testnetz-Chit. Stelle Nimiq Pay auf Testnetz und versuch es noch einmal.',
};

const dictionaries: Record<string, Dict> = { de };

let active: Dict = {};

/** Pick the dictionary once, from the host. Anything unknown is English. */
export function initLanguage(override?: string): string {
  const raw = (override ?? getHostLanguage() ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en').toLowerCase();
  const code = raw.slice(0, 2);
  active = dictionaries[code] ?? {};
  if (typeof document !== 'undefined') document.documentElement.lang = active === de ? 'de' : 'en';
  return active === de ? 'de' : 'en';
}

/** Translate an English sentence, filling `{placeholders}`. Missing translations show English. */
export function t(english: string, vars: Record<string, string | number> = {}): string {
  const template = active[english] ?? english;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}
