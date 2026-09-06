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
 * changed in one place. Placeholders are `{name}`. Plurals are two keys — `'{n} chit'` and
 * `'{n} chits'` — chosen by the caller, because German and English agree on one-versus-many
 * and a rules engine would be more code than the sentences it serves.
 */

import { getHostLanguage } from '@nimiq/mini-app-sdk';

type Dict = Record<string, string>;

const de: Dict = {
  /* ---- chrome ---- */
  'chit home': 'chit Startseite',
  Activity: 'Verlauf',
  About: 'Über chit',
  'New chit': 'Neuer Chit',
  Bounty: 'Bounty',
  Details: 'Details',
  You: 'Du',
  Copy: 'Kopieren',
  Copied: 'Kopiert',
  Save: 'Speichern',
  Cancel: 'Abbrechen',
  'Try again': 'Noch einmal',
  'Start a chit': 'Chit starten',
  'Start again': 'Von vorn',
  'Not now': 'Jetzt nicht',
  Later: 'Später',
  'Done for now': 'Erst mal fertig',

  /* ---- home ---- */
  'Paste the deal. Get a receipt.': 'Deal einfügen. Beleg bekommen.',
  'For the clients you already talk to directly. They pay; you hold a receipt anyone can check. Proof of payment, not protection.':
    'Für Kunden, mit denen du schon direkt sprichst. Sie zahlen; du hältst einen Beleg, den jeder prüfen kann. Zahlungsnachweis, kein Schutz.',
  'I’m getting paid': 'Ich werde bezahlt',
  'I’m paying': 'Ich zahle',
  'Which way the money goes': 'In welche Richtung das Geld geht',
  'You sign. Whoever pays this link has accepted it, and the NIM lands in your wallet.': 'Du unterschreibst. Wer den Link bezahlt, hat angenommen – die NIM landen in deiner Wallet.',
  'You sign, they sign, then you pay. The payment carries the proof.': 'Du unterschreibst, die andere Seite unterschreibt, dann zahlst du. Die Zahlung trägt den Beweis.',
  'The line you already agreed': 'Die Zeile, die ihr vereinbart habt',
  '$40 for 3 thumbnails by Friday': '40 € für 3 Thumbnails bis Freitag',
  'Sign it': 'Unterschreiben',
  'What we understood': 'So haben wir es verstanden',
  'Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.':
    'Gib Betrag und Währung an – „40 €“, „$120“ – damit beide Seiten derselben Zahl zustimmen. Du kannst auch jede Zeile oben antippen und selbst setzen.',
  'Pricing it in NIM…': 'Umrechnung in NIM …',
  'The words read as {a}, but the amount is set in {b}. Both sides sign the words — make sure they agree.':
    'Die Worte lesen sich als {a}, der Betrag steht aber in {b}. Beide Seiten unterschreiben die Worte – achte darauf, dass sie zusammenpassen.',
  'Waiting for your wallet…': 'Warte auf deine Wallet …',
  'chit is not reachable': 'chit ist nicht erreichbar',
  'In reply to': 'Antwort auf',
  '{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.':
    '{amount} · daraus wird ein eigener Chit, den ihr beide unterschreibt. Der obige bleibt unberührt.',
  'Ask for a change': 'Änderung vorschlagen',
  'Ask for half up front': 'Die Hälfte im Voraus verlangen',
  'Half up front — {line}': 'Hälfte im Voraus – {line}',
  'On delivery — {line}': 'Bei Lieferung – {line}',
  'The other half': 'Die andere Hälfte',
  'Next step of this job': 'Nächster Schritt dieses Auftrags',
  'How chit works': 'So funktioniert chit',

  /* ---- the editable rows ---- */
  Amount: 'Betrag',
  Currency: 'Währung',
  By: 'Bis',
  'How many': 'Wie viele',
  'In NIM': 'In NIM',
  'not sure yet': 'noch unklar',
  today: 'heute',
  tomorrow: 'morgen',
  '3 days': '3 Tage',
  'a week': 'eine Woche',
  '2 weeks': '2 Wochen',
  '{n} days': '{n} Tage',
  '{label}: {value}. Tap to change.': '{label}: {value}. Antippen zum Ändern.',
  'A whole number, please — this currency has no decimals.': 'Bitte eine ganze Zahl – diese Währung hat keine Nachkommastellen.',
  'That is not an amount chit can read. Try 40 or 40.50.': 'Das ist kein Betrag, den chit lesen kann. Versuch 40 oder 40,50.',
  'Set it': 'Übernehmen',

  /* ---- the bounty ---- */
  'Your first NIM · paid by chit': 'Deine ersten NIM · bezahlt von chit',
  'Sign it with your answer and the pool pays your wallet in NIM. {n} open now.': 'Unterschreibe mit deiner Antwort und der Pool zahlt NIM an deine Wallet. {n} gerade offen.',
  'Earn {amount} — test chit': '{amount} verdienen – chit testen',
  'Your first NIM': 'Deine ersten NIM',
  'Earn · paid by chit': 'Verdienen · bezahlt von chit',
  'Your answer': 'Deine Antwort',
  'One sentence, in your own words': 'Ein Satz, in deinen Worten',
  'At least 4 words. No links. Something nobody has said yet.': 'Mindestens 4 Wörter. Keine Links. Etwas, das noch niemand gesagt hat.',
  '{n} word': '{n} Wort',
  '{n} words': '{n} Wörter',
  'Sign and get paid': 'Unterschreiben und bezahlt werden',
  'chit uses this to pay each device one bounty per day.': 'chit nutzt das, um jedem Gerät eine Bounty pro Tag zu zahlen.',
  'Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.':
    'Deine Unterschrift ist deine Antwort. Besteht sie die Regeln – für alle gleich, keine Verlosung – zahlt der Pool diesen Betrag an die Wallet, mit der du unterschreibst, und du hältst einen echten Beleg.',
  'The rules and every payout': 'Die Regeln und jede Auszahlung',
  'This deployment has no bounty pool.': 'Diese Installation hat keinen Bounty-Pool.',
  'chit pays real chits for a sentence of feedback. Everything about the pool is public: the address, the balance, the rules, and every payout with its transaction.':
    'chit bezahlt echte Chits für einen Satz Feedback. Alles am Pool ist öffentlich: die Adresse, das Guthaben, die Regeln und jede Auszahlung mit ihrer Transaktion.',
  Pool: 'Pool',
  Balance: 'Guthaben',
  unknown: 'unbekannt',
  'Paid today': 'Heute gezahlt',
  '{n} payout': '{n} Auszahlung',
  '{n} payouts': '{n} Auszahlungen',
  of: 'von',
  Status: 'Status',
  'Being funded — nothing is offered until it can pay': 'Wird aufgefüllt – nichts wird angeboten, bis er zahlen kann',
  'Open now': 'Gerade offen',
  '{n} open': '{n} offen',
  '{amount} each': 'je {amount}',
  'Take one': 'Eine nehmen',
  'Every bounty is taken for now.': 'Alle Bounties sind gerade vergeben.',
  'The next one opens shortly.': 'Die nächste öffnet in Kürze.',
  'The rules': 'Die Regeln',
  'Every payout': 'Jede Auszahlung',
  'None yet.': 'Noch keine.',
  'The first payout will appear here with its transaction.': 'Die erste Auszahlung erscheint hier mit ihrer Transaktion.',
  'chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.':
    'chit zahlt seine eigene Bounty aus diesem Pool. Es hält nie das Geld anderer. Vom Gründer finanziert; jede Auszahlung oben steht auf der Chain.',

  /* ---- share and quote ---- */
  'Send this to them': 'Schick das der anderen Seite',
  'They open it, read the same words you signed, and sign in Nimiq Pay. No account, no email.': 'Sie öffnet den Link, liest dieselben Worte, die du unterschrieben hast, und unterschreibt in Nimiq Pay. Kein Konto, keine E-Mail.',
  'Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.':
    'Noch wurde nichts gezahlt. Du zahlst, sobald unterschrieben wurde – dieser Bildschirm geht von selbst weiter.',
  'Still waiting for their signature. You can close this — it is in your Activity.': 'Warte noch auf die Unterschrift. Du kannst das schließen – es steht in deinem Verlauf.',
  'No one to send it to? Try the demo worker': 'Niemand, dem du es schicken kannst? Probier den Demo-Auftragnehmer',
  'Signing as the demo worker…': 'Unterschreibe als Demo-Auftragnehmer …',
  'Copy the link': 'Link kopieren',
  'Copy failed — select the link below': 'Kopieren fehlgeschlagen – markiere den Link unten',
  'Send it': 'Senden',
  'A chit to sign': 'Ein Chit zum Unterschreiben',
  'A quote to pay': 'Ein Angebot zum Bezahlen',
  'Open in Nimiq Pay': 'In Nimiq Pay öffnen',
  'Get Nimiq Pay': 'Nimiq Pay holen',
  'Continue on your phone': 'Auf dem Handy weitermachen',
  'Signing and paying happen in the Nimiq Pay app. Scan this with your phone’s camera, or open the link there.':
    'Unterschreiben und Zahlen passieren in der Nimiq Pay App. Scanne das mit der Kamera deines Handys, oder öffne den Link dort.',
  'Your quote': 'Dein Angebot',
  'Put this where the client is — the chat, your bio, a message. Paying it is accepting it.': 'Platziere das dort, wo der Kunde ist – im Chat, in der Bio, in einer Nachricht. Bezahlen heißt annehmen.',
  'Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.':
    'Wer zuerst zahlt, ist dein Kunde. Nichts wird irgendwo verwahrt – die Zahlung landet in deiner Wallet, und dieser Bildschirm geht dann weiter.',
  'No payment yet. Leave the link where clients can see it — it is in your Activity.': 'Noch keine Zahlung. Lass den Link dort, wo Kunden ihn sehen – er steht in deinem Verlauf.',
  'A quote for you': 'Ein Angebot für dich',
  'Pay {amount} in NIM': '{amount} in NIM zahlen',
  'Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.':
    'Mit der Zahlung nimmst du genau diese Worte an. Das Geld geht direkt an die Wallet, die das Angebot unterschrieben hat – nichts wird unterwegs verwahrt.',
  'This wallet has not been paid through chit before.': 'Diese Wallet wurde über chit noch nie bezahlt.',
  'Paid {n} time': '{n}-mal bezahlt worden',
  'Paid {n} times': '{n}-mal bezahlt worden',
  'by {n} client': 'von {n} Kunden',
  'by {n} clients': 'von {n} Kunden',

  /* ---- countersign ---- */
  'Someone wants to agree this with you': 'Jemand möchte das mit dir vereinbaren',
  'You would be paid': 'Du würdest bekommen',
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
  'Paid {n} chit': '{n} Chit bezahlt',
  'Paid {n} chits': '{n} Chits bezahlt',
  'usually within {d}': 'meist innerhalb von {d}',
  'none left unpaid': 'keiner unbezahlt geblieben',
  '{n} left unpaid': '{n} unbezahlt geblieben',
  'a minute': 'einer Minute',
  minutes: 'Minuten',
  hours: 'Stunden',
  days: 'Tagen',

  /* ---- people ---- */
  From: 'Von',
  'Quoted by': 'Angeboten von',
  'Goes to': 'Geht an',
  Wallet: 'Wallet',
  'Name this wallet': 'Wallet benennen',
  Rename: 'Umbenennen',
  'A name for this wallet, kept on this device': 'Ein Name für diese Wallet, nur auf diesem Gerät',
  'e.g. Acme Studio': 'z. B. Acme Studio',
  'Only on this device. Never sent anywhere, never shown to anyone else.': 'Nur auf diesem Gerät. Wird nirgendwohin gesendet und niemandem sonst gezeigt.',

  /* ---- pay ---- */
  'They signed. Time to pay.': 'Unterschrieben. Zeit zu zahlen.',
  'Waiting for their signature before there is anywhere to send this.': 'Warte auf die Unterschrift, bevor es ein Ziel für die Zahlung gibt.',
  'The exact NIM is priced when you tap Pay, so the agreed amount stays whole. It goes straight to their wallet — nothing is held on the way, and a payment cannot be reversed.':
    'Die genauen NIM werden beim Tippen auf Zahlen berechnet, damit der vereinbarte Betrag voll bleibt. Es geht direkt an die andere Wallet – nichts wird unterwegs verwahrt, und eine Zahlung lässt sich nicht rückgängig machen.',
  'No NIM yet?': 'Noch keine NIM?',
  'NIM is the coin this pays in. Nimiq Pay holds it but does not sell it. The Nimiq Wallet at wallet.nimiq.com sells NIM by card or bank transfer in many countries — fees 1–4%, a few dollars minimum, availability depends on where you are — and you then send it to your Nimiq Pay address.':
    'NIM ist die Münze, in der hier gezahlt wird. Nimiq Pay verwahrt sie, verkauft sie aber nicht. Die Nimiq Wallet auf wallet.nimiq.com verkauft NIM per Karte oder Überweisung in vielen Ländern – Gebühren 1–4 %, ein paar Dollar Mindestbetrag, Verfügbarkeit je nach Land – und dann schickst du sie an deine Nimiq-Pay-Adresse.',
  'Or earn your first NIM here: the bounty on the home screen pays a real chit for one sentence of feedback.': 'Oder verdiene deine ersten NIM hier: Die Bounty auf der Startseite zahlt einen echten Chit für einen Satz Feedback.',
  'Turning NIM into money': 'Aus NIM Geld machen',
  'One rule that saves money: ': 'Eine Regel, die Geld spart: ',
  'send NIM to an exchange, never withdraw NIM from one. Sell it there and withdraw the stablecoin instead — withdrawing NIM itself can cost a large share of a small balance.':
    'Schick NIM an eine Börse, hol aber nie NIM von einer ab. Verkauf sie dort und hebe stattdessen den Stablecoin ab – NIM selbst abzuheben kann einen großen Teil eines kleinen Guthabens kosten.',
  'The NIM is in your Nimiq Pay wallet now, and it is yours — nothing is held by chit. To turn it into your own currency, send it to an exchange that lists NIM and sell it there, or use the Nimiq Wallet’s swap into USDC or USDT and cash out from that. Which of these is open to you depends on your country; chit does not sell or swap anything itself.':
    'Die NIM sind jetzt in deiner Nimiq-Pay-Wallet und gehören dir – chit verwahrt nichts. Um sie in deine Währung zu tauschen, schick sie an eine Börse, die NIM listet, und verkaufe sie dort, oder nutze den Swap der Nimiq Wallet in USDC oder USDT und zahle von dort aus. Was davon für dich offen ist, hängt von deinem Land ab; chit selbst verkauft oder tauscht nichts.',
  'Many freelancers simply keep it: the next chit you pay a collaborator, or the next tool you buy, can be paid in NIM directly.': 'Viele Freelancer behalten sie einfach: Den nächsten Chit an eine Kollegin oder das nächste Tool kannst du direkt in NIM zahlen.',
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
  'You marked it delivered': 'Du hast es als geliefert markiert',
  'They marked it delivered': 'Als geliefert markiert',
  'Signed by the wallet being paid, on {when}. It is a record, not a receipt — nothing has been paid because of it.':
    'Unterschrieben von der Wallet, die bezahlt wird, am {when}. Das ist ein Nachweis, kein Beleg – dadurch wurde nichts gezahlt.',
  'Open the delivery': 'Die Lieferung öffnen',
  'Say it is delivered': 'Als geliefert melden',
  'A link to the work': 'Ein Link zur Arbeit',
  'https://… (optional)': 'https://… (optional)',
  'One line about it': 'Ein Satz dazu',
  'One line about it (optional)': 'Ein Satz dazu (optional)',
  'Mark it delivered': 'Als geliefert markieren',
  'Signs one line with your wallet saying you handed the work over. It moves no money and obliges nobody to pay — it is a record, and the other side can see it.':
    'Unterschreibt mit deiner Wallet eine Zeile, dass du die Arbeit übergeben hast. Es bewegt kein Geld und verpflichtet niemanden zu zahlen – es ist ein Nachweis, und die andere Seite sieht ihn.',
  'Marked delivered on {when}': 'Als geliefert markiert am {when}',
  'Check now': 'Jetzt prüfen',

  /* ---- receipt ---- */
  'Paid on': 'Bezahlt am',
  Block: 'Block',
  Transaction: 'Transaktion',
  'View on nimiq.watch': 'Auf nimiq.watch ansehen',
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
  Deliverables: 'Lieferungen',
  Due: 'Fällig',
  passed: 'verstrichen',
  'in about {n} days': 'in etwa {n} Tagen',
  Deadline: 'Frist',
  'block {n}': 'Block {n}',
  'Agreed rate': 'Vereinbarter Kurs',
  'Actually received': 'Tatsächlich erhalten',
  'They sent {actual} — more than the {agreed} agreed. All of it is yours.': 'Es wurden {actual} gesendet – mehr als die vereinbarten {agreed}. Alles davon gehört dir.',
  'They sent {actual}, against {agreed} agreed. The rate moved between signing and paying; chit accepts a small difference so a payment is never stranded.':
    'Es wurden {actual} gesendet, vereinbart waren {agreed}. Der Kurs hat sich zwischen Unterschrift und Zahlung bewegt; chit akzeptiert eine kleine Abweichung, damit eine Zahlung nie hängen bleibt.',
  'Rate taken at': 'Kurs genommen bei',
  'Chit id': 'Chit-ID',

  /* ---- verify ---- */
  'Nothing to show': 'Nichts anzuzeigen',
  'No chit has settled with that transaction. Check the link, or the payment may not have landed yet.': 'Mit dieser Transaktion wurde kein Chit abgewickelt. Prüf den Link, oder die Zahlung ist noch nicht angekommen.',
  'This is genuine': 'Das ist echt',
  'This does not check out': 'Das stimmt nicht',
  'Verification failed': 'Prüfung fehlgeschlagen',
  'This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.': 'Das ist ein Testnetz-Chit. Die Unterschriften sind echt, aber es floss kein echtes Geld – der Betrag unten ist nicht ausgebbar.',
  'quote — paying accepted it': 'Angebot – mit der Zahlung angenommen',
  yes: 'ja',
  no: 'nein',
  'On chain': 'Auf der Chain',
  'not yet': 'noch nicht',
  'Checked in your browser, against the chain': 'In deinem Browser geprüft, gegen die Chain',
  'The chain disagrees with these words': 'Die Chain widerspricht diesen Worten',
  'Checked by chit’s server': 'Von chits Server geprüft',
  'Your browser’s own check': 'Die eigene Prüfung deines Browsers',
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

  /* ---- activity ---- */
  'Paid to you': 'An dich gezahlt',
  '{n} chit': '{n} Chit',
  '{n} chits': '{n} Chits',
  'from {n} payer': 'von {n} Zahlenden',
  'from {n} payers': 'von {n} Zahlenden',
  Kept: 'Behalten',
  'a 20% marketplace cut': 'ein 20 %-Marktplatzanteil',
  'As a payer': 'Als Zahlender',
  'paid {n}': '{n} bezahlt',
  '{n} awaiting': '{n} ausstehend',
  'Nothing yet': 'Noch nichts',
  'Your first chit will appear here the moment it is signed.': 'Dein erster Chit erscheint hier, sobald er unterschrieben ist.',
  Declined: 'Abgelehnt',
  Quote: 'Angebot',
  'Signed — unpaid': 'Unterschrieben – unbezahlt',
  'Waiting for signature': 'Wartet auf Unterschrift',

  /* ---- about ---- */
  'What chit is': 'Was chit ist',
  'A receipt for a deal you already made. You paste the one line you agreed in a chat, both wallets sign it with Nimiq Pay, and the payment carries the agreement’s digest. The receipt is the contract, and anyone can check it against the chain.':
    'Ein Beleg für einen Deal, den du schon gemacht hast. Du fügst die eine Zeile ein, die ihr im Chat vereinbart habt, beide Wallets unterschreiben sie mit Nimiq Pay, und die Zahlung trägt die Prüfsumme der Vereinbarung. Der Beleg ist der Vertrag, und jeder kann ihn gegen die Chain prüfen.',
  'What it never does': 'Was es nie tut',
  'Hold your money. Every payment goes straight from one wallet to the other; there is no balance and no withdrawal.': 'Dein Geld verwahren. Jede Zahlung geht direkt von einer Wallet zur anderen; es gibt kein Guthaben und keine Auszahlung.',
  'Take a cut. There is no fee. A NIM transaction is free and lands in about a second.': 'Einen Anteil nehmen. Es gibt keine Gebühr. Eine NIM-Transaktion ist kostenlos und kommt in etwa einer Sekunde an.',
  'Protect you. This is proof of payment, not escrow or a dispute service. Use it with clients you already talk to directly.': 'Dich schützen. Das ist ein Zahlungsnachweis, kein Treuhandservice und keine Streitschlichtung. Nutze es mit Kunden, mit denen du schon direkt sprichst.',
  'Ask for an account. There is no password, no code sent to your phone, no identity check — and so there is nothing to be locked out of. Your wallet is your identity; your record is computed from settled payments and nothing else.':
    'Nach einem Konto fragen. Es gibt kein Passwort, keinen Code aufs Handy, keine Identitätsprüfung – und damit nichts, wovon du ausgesperrt werden kannst. Deine Wallet ist deine Identität; dein Verlauf wird nur aus abgewickelten Zahlungen berechnet.',
  Reference: 'Referenz',
  'Give this to anyone who needs to check the payment.': 'Gib das jedem, der die Zahlung prüfen muss.',
  'Nothing is pending, nothing can be reversed, and nobody is holding it.': 'Nichts ist ausstehend, nichts lässt sich rückgängig machen, und niemand verwahrt es.',
  'You kept all of it. A 20% marketplace cut would have been {amount}.': 'Du hast alles behalten. Ein 20-%-Marktplatzanteil wären {amount} gewesen.',
  'chit never asks you to deposit, or to pay a fee to be paid. If anyone asks you to send money first, it is a scam — leave.':
    'chit verlangt nie eine Einzahlung oder eine Gebühr, damit du bezahlt wirst. Wenn jemand verlangt, dass du zuerst Geld schickst, ist es Betrug – geh weg.',
  'When something goes wrong': 'Wenn etwas schiefgeht',
  'There is no support queue, because there is nothing for support to release. Everything that can go wrong has an answer you can act on yourself:':
    'Es gibt keine Support-Warteschlange, weil es nichts gibt, was ein Support freigeben könnte. Auf alles, was schiefgehen kann, gibt es eine Antwort, die du selbst umsetzen kannst:',
  'They signed and never paid. Nothing was lost — you were never owed anything until they paid. Their record now says one left unpaid, and anyone they send a chit to will see it.':
    'Unterschrieben, aber nie gezahlt. Nichts ist verloren – dir stand nichts zu, bevor gezahlt wurde. Im Verlauf dieser Wallet steht jetzt „einer unbezahlt geblieben“, und jeder, der von ihr einen Chit bekommt, sieht das.',
  'You paid and the work never came. chit cannot reverse a payment; nobody can. Pay in smaller steps with someone new, and check their record before you sign.':
    'Du hast gezahlt und die Arbeit kam nie. chit kann eine Zahlung nicht rückgängig machen – niemand kann das. Zahle bei neuen Leuten in kleineren Schritten und sieh dir vorher ihren Verlauf an.',
  'The payment is not showing. chit watches the chain itself, not the wallet — reopen the chit and it will catch up. If the transaction is on nimiq.watch, the money has moved.':
    'Die Zahlung erscheint nicht. chit beobachtet die Chain selbst, nicht die Wallet – öffne den Chit erneut, dann holt er auf. Steht die Transaktion auf nimiq.watch, ist das Geld unterwegs.',
  'You lost the link. Every chit your wallet signed is in Activity, on any device you connect the same wallet from.':
    'Du hast den Link verloren. Jeder Chit, den deine Wallet unterschrieben hat, steht im Verlauf – auf jedem Gerät, auf dem du dieselbe Wallet verbindest.',
  'chit disappears. The receipt link carries the signed words, and your browser checks them against a public Nimiq node. It works without us.':
    'chit verschwindet. Der Beleg-Link trägt die unterschriebenen Worte, und dein Browser prüft sie gegen einen öffentlichen Nimiq-Knoten. Das funktioniert ohne uns.',
  'How a receipt is checked': 'Wie ein Beleg geprüft wird',
  'The words are hashed; that hash is the 64-byte memo of the NIM payment. A receipt link carries the words, so your browser recomputes the hash and reads the transaction from a public Nimiq node — no chit server needed.':
    'Die Worte werden gehasht; dieser Hash ist die 64-Byte-Nachricht der NIM-Zahlung. Ein Beleg-Link trägt die Worte, also berechnet dein Browser den Hash neu und liest die Transaktion von einem öffentlichen Nimiq-Knoten – ganz ohne chit-Server.',
  'The bounty': 'Die Bounty',
  'chit pays real chits for a sentence of feedback, from a pool funded by the founder. The address, balance, rules and every payout are public.': 'chit bezahlt echte Chits für einen Satz Feedback, aus einem vom Gründer finanzierten Pool. Adresse, Guthaben, Regeln und jede Auszahlung sind öffentlich.',
  'See the pool': 'Den Pool ansehen',
  'Open source under the MIT licence. Built for the Nimiq Mini Apps Competition, Cycle 2, 2026. Signatures are verified by chit’s server; payments by the Nimiq chain.':
    'Open Source unter MIT-Lizenz. Gebaut für die Nimiq Mini Apps Competition, Cycle 2, 2026. Unterschriften prüft chits Server; Zahlungen prüft die Nimiq-Chain.',
  'Nothing about you is stored until you sign something.': 'Nichts über dich wird gespeichert, bis du etwas unterschreibst.',

  /* ---- errors ---- */
  'Nothing here': 'Hier ist nichts',
  'That link does not point at anything in chit.': 'Dieser Link zeigt auf nichts in chit.',
  'Not found': 'Nicht gefunden',
  'Something broke': 'Etwas ist kaputtgegangen',
  'chit hit an error it did not expect. Anything already signed is safe on the server, and anything paid is on chain.': 'chit ist auf einen unerwarteten Fehler gestoßen. Alles bereits Unterschriebene ist sicher auf dem Server, alles Bezahlte auf der Chain.',
  'Test network — the signatures are real, the money is not.': 'Testnetz – die Unterschriften sind echt, das Geld nicht.',
  'Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.': 'Demo-Modus – Unterschriften hier sind nur Anschauung und werden nicht verifiziert. Öffne es in Nimiq Pay, um echt zu unterschreiben.',
  'Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.': 'Unterschreiben und Zahlen passieren in der Nimiq Pay App. Öffne das dort – Nimiq Pay fragt beim ersten Mal vielleicht nach einer Bestätigung.',
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

/** Every English key with a German sentence — exported so a test can prove coverage. */
export function translatedKeys(): string[] {
  return Object.keys(de);
}
