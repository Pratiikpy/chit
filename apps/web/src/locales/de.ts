/**
 * German.
 *
 * The one translation that carries real weight: 68% of Nimiq Pay's users are German
 * (`research/verification/`), so for most of the people who will ever open chit this file
 * *is* the product's copy, not a courtesy layer over it.
 *
 * Keys are the English sentence, so a missing entry shows English rather than a key, and a
 * sentence can be changed in one place. `apps/web/test/i18n.test.ts` reads every `t(…)`
 * call in the source and fails if any of them is not answered here.
 */

import type { Dict } from '../i18n.ts';

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
  'The words say {a}, but the amount is set to {b}. Both sides sign the words — fix the sentence, or the number.':
    'Die Worte sagen {a}, der Betrag steht aber auf {b}. Beide Seiten unterschreiben die Worte – korrigiere den Satz oder die Zahl.',
  'Waiting for your wallet…': 'Warte auf deine Wallet …',
  'chit is not reachable': 'chit ist nicht erreichbar',
  'In reply to': 'Antwort auf',
  '{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.':
    '{amount} · daraus wird ein eigener Chit, den ihr beide unterschreibt. Der obige bleibt unberührt.',
  'Ask for a change': 'Änderung vorschlagen',
  'Ask for half up front': 'Die Hälfte im Voraus verlangen',
  'Half up front — {line}': 'Hälfte im Voraus — {line}',
  'Second half — {line}': 'Zweite Hälfte — {line}',
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
  'Worth {worth} at the moment it was paid.': 'Zum Zeitpunkt der Zahlung {worth} wert.',
  'Agreed at {agreed}; worth {worth} at the moment it was paid.': 'Vereinbart mit {agreed}; zum Zeitpunkt der Zahlung {worth} wert.',
  'Rate {rate} {currency} per NIM, from {source}, {when}.': 'Kurs {rate} {currency} pro NIM, von {source}, {when}.',
  Invoice: 'Rechnung',
  'Your invoice details': 'Deine Rechnungsangaben',
  'Add your details to the invoice': 'Deine Angaben auf die Rechnung setzen',
  'Printed on the invoice, kept in this browser, and never sent to chit or shown to the other side. Most small invoices need only a name, an address and a line about tax.':
    'Erscheint auf der Rechnung, bleibt in diesem Browser und wird nie an chit gesendet oder der anderen Seite gezeigt. Die meisten Kleinbetragsrechnungen brauchen nur Name, Adresse und eine Zeile zur Steuer.',
  'Your name or trading name': 'Dein Name oder Firmenname',
  Address: 'Adresse',
  'Tax or VAT number, if you have one': 'Steuer- oder USt-IdNr., falls vorhanden',
  'Email or website': 'E-Mail oder Website',
  'Tax line, if your country needs one': 'Steuerzeile, falls dein Land eine braucht',
  'e.g. VAT exempt under §19 UStG': 'z. B. Kein Ausweis von Umsatzsteuer gemäß § 19 UStG',
  'Save on this device': 'Auf diesem Gerät speichern',
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
  'Waiting to be paid': 'Wartet auf Zahlung',
  'since yesterday': 'seit gestern',
  'for {n} days': 'seit {n} Tagen',
  Nudge: 'Erinnern',
  'Still open: “{line}” — {amount}. Here is the chit: {link}': 'Noch offen: „{line}“ – {amount}. Hier ist der Chit: {link}',
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

  /* ---- the balance hint, before the wallet sheet ---- */
  'Your wallet holds {have}. This needs {need} — {short} more. Top up and try again; nothing has been sent.':
    'Deine Wallet hält {have}. Hier werden {need} gebraucht – {short} fehlen. Lade auf und versuch es noch einmal; es wurde nichts gesendet.',

  /* ---- reviews ---- */
  '{n} out of 5': '{n} von 5',
  'For: {line}': 'Für: {line}',
  'What they said': 'Was gesagt wurde',
  'What the other side said': 'Was die andere Seite sagt',
  'Your rating': 'Deine Bewertung',
  'One line, if you want to add one': 'Eine Zeile, wenn du magst',
  'One line, if you want to add one (optional)': 'Eine Zeile, wenn du magst (optional)',
  'How did it go?': 'Wie lief es?',
  'Sign this review': 'Bewertung unterschreiben',
  'Signed by your wallet over this payment, so it cannot be bought, faked or written by anyone else. It goes on their public record and it cannot be taken down — including by us.':
    'Von deiner Wallet über diese Zahlung unterschrieben – also nicht käuflich, nicht fälschbar und von niemand anderem schreibbar. Sie steht im öffentlichen Verlauf der anderen Seite und lässt sich nicht entfernen, auch nicht von uns.',
  '{n} review': '{n} Bewertung',
  '{n} reviews': '{n} Bewertungen',

  /* ---- the public record ---- */
  Record: 'Verlauf',
  'Your public record': 'Dein öffentlicher Verlauf',
  'Everything paid, as a spreadsheet': 'Alles Bezahlte als Tabelle',
  'Their record': 'Ihr Verlauf',
  'Nothing here yet': 'Noch nichts hier',
  'No settled work on this wallet': 'Keine abgewickelte Arbeit auf dieser Wallet',
  'The moment a chit you are part of is paid, it appears here — with the amount, the date, and anything either side said about it. Nothing on this page is written by you.':
    'Sobald ein Chit, an dem du beteiligt bist, bezahlt wird, steht er hier – mit Betrag, Datum und allem, was beide Seiten dazu gesagt haben. Nichts auf dieser Seite schreibst du selbst.',
  'This wallet has not been paid through chit, and has not paid anyone. That is not a bad sign or a good one; it is a wallet with no record yet.':
    'Diese Wallet wurde über chit weder bezahlt, noch hat sie jemanden bezahlt. Das ist weder ein gutes noch ein schlechtes Zeichen – es ist eine Wallet ohne Verlauf.',
  'Write a chit': 'Einen Chit schreiben',
  'Paid to this wallet': 'An diese Wallet gezahlt',
  '{n} job': '{n} Auftrag',
  '{n} jobs': '{n} Aufträge',
  'from {n} client': 'von {n} Kunden',
  'from {n} clients': 'von {n} Kunden',
  'First paid': 'Erste Zahlung',
  'As a client': 'Als Kunde',
  'Settled work': 'Abgewickelte Arbeit',
  'Send this to a client': 'Schick das einem Kunden',
  'Share this record': 'Diesen Verlauf teilen',
  'One link. It opens for anyone, with no account and no app, and every line on it can be checked against the chain.':
    'Ein Link. Er öffnet sich für jeden, ohne Konto und ohne App, und jede Zeile darin lässt sich gegen die Chain prüfen.',
  'Every figure on this page is computed from payments on the Nimiq chain. Nobody can edit it — not the person it is about, and not chit.':
    'Jede Zahl auf dieser Seite wird aus Zahlungen auf der Nimiq-Chain berechnet. Niemand kann sie ändern – weder die Person, um die es geht, noch chit.',

  'The date on this has passed and it is still unpaid. Nothing is lost and nothing expired — it can still be paid. Send them a nudge, or write a new one at a number that works now.':
    'Das Datum ist verstrichen und es ist weiterhin unbezahlt. Nichts ist verloren, nichts verfallen – es kann immer noch bezahlt werden. Erinnere sie daran, oder schreib einen neuen mit einer Zahl, die jetzt passt.',
  'The date on this has passed. It can still be signed and still be paid; if it no longer fits, write a new one instead of leaving this open.':
    'Das Datum ist verstrichen. Es kann weiterhin unterschrieben und bezahlt werden; wenn es nicht mehr passt, schreib lieber einen neuen, statt diesen offen zu lassen.',

  /* ---- agreements with no payment ---- */
  'Something changed?': 'Hat sich etwas geändert?',
  'What changed': 'Was sich geändert hat',
  'e.g. one extra round of edits, same price': 'z. B. eine zusätzliche Korrekturrunde, gleicher Preis',
  'Sign the change': 'Änderung unterschreiben',
  'Call it off': 'Absagen',
  'Called off by agreement — {line}': 'Einvernehmlich abgesagt — {line}',
  'Change agreed — {line}': 'Änderung vereinbart — {line}',
  'Write what you both agreed and sign it. It moves no money and does not alter the chit above — it is a second signed line pointing at it, so the record shows the change instead of the argument.':
    'Schreib auf, was ihr vereinbart habt, und unterschreib es. Es bewegt kein Geld und ändert den Chit oben nicht – es ist eine zweite unterschriebene Zeile, die darauf zeigt, damit die Änderung im Verlauf steht statt im Streit.',
  'Or close it. A chit nobody will pay is worse left open — this records that you both called it off, with both names on it.':
    'Oder schließ ihn. Ein Chit, den niemand bezahlt, ist offen schlimmer – das hält fest, dass ihr beide abgesagt habt, mit beiden Namen darauf.',
  'Open the chit this answers': 'Den Chit öffnen, auf den das antwortet',
  'Signed by': 'Unterschrieben von',
  'And by': 'Und von',
  'Called off, by both of you': 'Abgesagt, von euch beiden',
  'The change is on the record': 'Die Änderung steht im Verlauf',
  'Both of you signed this. Nothing is owed and nothing is open — the original chit stays exactly as it was signed, with this beside it.':
    'Ihr habt beide unterschrieben. Nichts ist geschuldet und nichts ist offen – der ursprüngliche Chit bleibt genau so, wie er unterschrieben wurde, und das hier steht daneben.',
  'Both of you signed this. The original chit is untouched; this sits beside it, so what you agreed later is on the record too.':
    'Ihr habt beide unterschrieben. Der ursprüngliche Chit bleibt unangetastet; das hier steht daneben, damit auch das später Vereinbarte im Verlauf steht.',
  'Back to the chit': 'Zurück zum Chit',
  'Nothing is being paid here. They open it, read the same words you signed, and sign too.':
    'Hier wird nichts bezahlt. Die andere Seite öffnet es, liest dieselben Worte, die du unterschrieben hast, und unterschreibt ebenfalls.',
  'Waiting for them to sign.': 'Warte auf ihre Unterschrift.',
  'Calling this off': 'Das hier absagen',
  'A change to sign': 'Eine Änderung zum Unterschreiben',
  'They want to call it off': 'Sie wollen absagen',
  'They want to agree a change': 'Sie wollen eine Änderung vereinbaren',
  'Signing this closes the job for both of you. No money moves, and nothing that was already paid is affected.':
    'Damit ist der Auftrag für euch beide geschlossen. Es bewegt sich kein Geld, und bereits Bezahltes bleibt unberührt.',
  'Signing means you agree to these exact words as well. No money moves, and the chit this answers is not altered.':
    'Unterschreiben heißt, dass auch du diesen genauen Worten zustimmst. Es bewegt sich kein Geld, und der Chit, auf den das antwortet, wird nicht verändert.',

  /* ---- what a wallet failure says to a person ---- */
  'You cancelled. Nothing was sent.': 'Du hast abgebrochen. Es wurde nichts gesendet.',
  'Your wallet returned a signature chit could not read. Please report this — it is our bug, not yours.':
    'Deine Wallet hat eine Unterschrift zurückgegeben, die chit nicht lesen konnte. Bitte melde das – das ist unser Fehler, nicht deiner.',
  'Your wallet reported: {message}': 'Deine Wallet meldet: {message}',
  'Something went wrong. Nothing was signed and nothing was sent.': 'Etwas ist schiefgegangen. Es wurde nichts unterschrieben und nichts gesendet.',
  'Your wallet does not hold enough NIM for this. Top it up and try again — nothing was sent.':
    'Deine Wallet hält dafür nicht genug NIM. Lade sie auf und versuch es noch einmal – es wurde nichts gesendet.',
  'Your phone could not reach the network. Nothing was sent — check your connection and try again.':
    'Dein Telefon konnte das Netz nicht erreichen. Es wurde nichts gesendet – prüfe deine Verbindung und versuch es noch einmal.',
  'Nimiq Pay is still catching up with the chain. Give it a few seconds and try again.':
    'Nimiq Pay holt noch mit der Chain auf. Gib ihm ein paar Sekunden und versuch es noch einmal.',
  'Your wallet is locked. Unlock Nimiq Pay and try again.': 'Deine Wallet ist gesperrt. Entsperre Nimiq Pay und versuch es noch einmal.',
  '{step} — Nimiq Pay did not answer. Open the wallet and try again.': '{step} – Nimiq Pay hat nicht geantwortet. Öffne die Wallet und versuch es noch einmal.',
  'Checking sync': 'Synchronisierung prüfen',
  'Sharing your address': 'Adresse teilen',
  Signing: 'Unterschreiben',
  Paying: 'Bezahlen',
  'Reading the chain height': 'Blockhöhe lesen',

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


  /* The board — finding work, and being found. */
  'Board': 'Board',
  'We could not read the chain just now, so we cannot say which chits are still open. Try again in a moment.': 'Wir konnten die Chain gerade nicht lesen und können deshalb nicht sagen, welche Chits noch offen sind. Versuch es gleich noch einmal.',
  'logo, translation, video…': 'Logo, Übersetzung, Video …',
  'Search the board': 'Board durchsuchen',
  'Search': 'Suchen',
  'Which side of the board': 'Welche Seite des Boards',
  'Everything': 'Alles',
  'Work': 'Aufträge',
  'People': 'Leute',
  'Best match': 'Beste Treffer',
  'Newest': 'Neueste',
  'Closing soon': 'Läuft bald ab',
  'Highest paid': 'Höchste Bezahlung',
  'Order': 'Reihenfolge',
  'New here': 'Neu hier',
  'Offer': 'Angebot',
  'closing today': 'läuft heute ab',
  '{n}d left': 'noch {n} T',
  'Work with the money already on it, and people offering theirs. Open one to read the whole agreement before you sign anything.': 'Aufträge, auf denen das Geld schon liegt – und Leute, die ihre Zeit anbieten. Öffne einen, um die ganze Vereinbarung zu lesen, bevor du irgendetwas unterschreibst.',
  'Nothing matches that.': 'Dazu gibt es nichts.',
  'The board is empty right now.': 'Das Board ist gerade leer.',
  'Try a shorter word — or post what you need and let somebody come to you.': 'Versuch ein kürzeres Wort – oder stell ein, was du brauchst, und lass jemanden zu dir kommen.',
  'Post what you need, or what you can do, and it appears here.': 'Stell ein, was du brauchst oder was du kannst – dann steht es hier.',
  '{shown} of {total} open': '{shown} von {total} offen',
  'Show more': 'Mehr anzeigen',
  '{n} done': '{n} erledigt',
  '★{rating} · {n} done': '★{rating} · {n} erledigt',


  /* Questions asked in public before anybody commits. */
  'Questions': 'Fragen',
  'Asked in public, so the next person does not have to ask again.': 'Öffentlich gefragt, damit die Nächste nicht noch einmal fragen muss.',
  'Answer it in one line': 'Antworte in einer Zeile',
  'Answer': 'Antworten',
  'Not answered yet.': 'Noch nicht beantwortet.',
  'Your question': 'Deine Frage',
  'e.g. does this include the source files?': 'z. B. sind die Quelldateien dabei?',
  'Ask in public': 'Öffentlich fragen',
  'Ask before you sign. Everyone can see the question and the answer — including you, later.': 'Frag, bevor du unterschreibst. Frage und Antwort sind für alle sichtbar – auch später für dich.',


  /* Portfolio pieces: paid for, and shown only with the client agreeing. */
  'Shown as work': 'Als Arbeit gezeigt',
  'Both of you signed this, so it is on the public record with the payment beside it.': 'Ihr habt beide unterschrieben, also steht es öffentlich – mit der Zahlung daneben.',
  'Agree to show it': 'Zeigen erlauben',
  'They would like to show this work': 'Sie möchten diese Arbeit zeigen',
  'It goes on their public record with what you paid beside it. Nothing is shown unless you agree.': 'Es kommt auf ihre öffentliche Seite, mit deinem gezahlten Betrag daneben. Ohne dein Ja wird nichts gezeigt.',
  'Link to the work': 'Link zur Arbeit',
  'Update the offer': 'Angebot ändern',
  'Offer it as a piece': 'Als Arbeitsprobe anbieten',
  'Show this work': 'Diese Arbeit zeigen',
  'Offered. It is not public until they agree.': 'Angeboten. Öffentlich wird es erst, wenn sie zustimmen.',
  'Put it on your public record, with the payment beside it as proof somebody paid for it. Your client has to agree first.': 'Stell sie auf deine öffentliche Seite, mit der Zahlung daneben als Beleg, dass jemand dafür bezahlt hat. Dein Kunde muss vorher zustimmen.',
  'Each piece was paid for, and the client agreed to it being shown.': 'Jede Arbeit wurde bezahlt, und der Kunde hat dem Zeigen zugestimmt.',
  'Offer a different deal': 'Ein anderes Angebot machen',
};

export default de;
