/**
 * French.
 *
 * Addressed as « tu », the same register as the English and German copy: this is one
 * freelancer talking to another about money, not a bank writing to a customer. French
 * punctuation is respected — narrow spaces before `? ! :` and inside « guillemets » — because
 * the alternative reads as a machine translation to anyone who actually reads French.
 *
 * Product names are left alone: chit, Nimiq Pay, NIM. So is « freelance », which is the word
 * the people this is for use about themselves.
 *
 * Keys are the English sentence, so a missing entry shows English rather than a key.
 * `apps/web/test/i18n.test.ts` reads every `t(…)` call in the source and fails if any of
 * them is unanswered here.
 */

import type { Dict } from '../i18n.ts';

const fr: Dict = {
  /* ---- chrome ---- */
  'chit home': 'Accueil chit',
  Activity: 'Activité',
  About: 'À propos',
  'New chit': 'Nouveau chit',
  Bounty: 'Prime',
  Details: 'Détails',
  You: 'Toi',
  Copy: 'Copier',
  Copied: 'Copié',
  Save: 'Enregistrer',
  Cancel: 'Annuler',
  'Try again': 'Réessayer',
  'Start a chit': 'Créer un chit',
  'Start again': 'Recommencer',
  'Not now': 'Pas maintenant',
  Later: 'Plus tard',
  'Done for now': 'C’est bon pour l’instant',

  /* ---- home ---- */
  'Paste the deal. Get a receipt.': 'Colle l’accord. Reçois un justificatif.',
  'For the clients you already talk to directly. They pay; you hold a receipt anyone can check. Proof of payment, not protection.':
    'Pour les clients avec qui tu échanges déjà directement. Ils paient ; tu gardes un justificatif que n’importe qui peut vérifier. Une preuve de paiement, pas une protection.',
  'I’m getting paid': 'C’est moi qu’on paie',
  'I’m paying': 'C’est moi qui paie',
  'Which way the money goes': 'Dans quel sens va l’argent',
  'You sign. Whoever pays this link has accepted it, and the NIM lands in your wallet.':
    'Tu signes. Celui qui paie ce lien l’a accepté, et les NIM arrivent dans ton portefeuille.',
  'You sign, they sign, then you pay. The payment carries the proof.':
    'Tu signes, l’autre signe, puis tu paies. Le paiement porte la preuve.',
  'The line you already agreed': 'La ligne que vous avez déjà convenue',
  '$40 for 3 thumbnails by Friday': '40 € pour 3 miniatures d’ici vendredi',
  'Sign it': 'Signer',
  'What we understood': 'Ce que nous avons compris',
  'Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.':
    'Ajoute un montant et une devise — « 40 € », « $120 », « ₹3500 » — pour que les deux parties soient d’accord sur le même chiffre. Tu peux aussi toucher n’importe quelle ligne ci-dessus pour la définir toi-même.',
  'Pricing it in NIM…': 'Conversion en NIM…',
  'The words read as {a}, but the amount is set in {b}. Both sides sign the words — make sure they agree.':
    'Le texte indique {a}, mais le montant est en {b}. Les deux parties signent le texte : vérifie qu’ils concordent.',
  'The words say {a}, but the amount is set to {b}. Both sides sign the words — fix the sentence, or the number.':
    'Le texte dit {a}, mais le montant est fixé à {b}. Les deux parties signent le texte : corrige la phrase, ou le chiffre.',
  'Waiting for your wallet…': 'En attente de ton portefeuille…',
  'chit is not reachable': 'chit est injoignable',
  'In reply to': 'En réponse à',
  '{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.':
    '{amount} · cela devient un chit distinct, que vous signez tous les deux. Celui du dessus reste intact.',
  'Ask for a change': 'Proposer un changement',
  'Ask for half up front': 'Demander la moitié d’avance',
  'Half up front — {line}': 'Moitié d’avance — {line}',
  'Second half — {line}': 'Seconde moitié — {line}',
  'The other half': 'L’autre moitié',
  'Next step of this job': 'Étape suivante de cette mission',
  'How chit works': 'Comment fonctionne chit',

  /* ---- the editable rows ---- */
  Amount: 'Montant',
  Currency: 'Devise',
  By: 'Pour le',
  'How many': 'Combien',
  'In NIM': 'En NIM',
  'not sure yet': 'pas encore défini',
  today: 'aujourd’hui',
  tomorrow: 'demain',
  '3 days': '3 jours',
  'a week': 'une semaine',
  '2 weeks': '2 semaines',
  '{n} days': '{n} jours',
  '{label}: {value}. Tap to change.': '{label} : {value}. Touche pour modifier.',
  'A whole number, please — this currency has no decimals.': 'Un nombre entier, s’il te plaît : cette devise n’a pas de décimales.',
  'That is not an amount chit can read. Try 40 or 40.50.': 'chit ne sait pas lire ce montant. Essaie 40 ou 40,50.',
  'Set it': 'Valider',

  /* ---- the bounty ---- */
  'Your first NIM · paid by chit': 'Tes premiers NIM · payés par chit',
  'Sign it with your answer and the pool pays your wallet in NIM. {n} open now.':
    'Signe avec ta réponse et la cagnotte paie ton portefeuille en NIM. {n} ouvertes en ce moment.',
  'Earn {amount} — test chit': 'Gagne {amount} — teste chit',
  'Your first NIM': 'Tes premiers NIM',
  'Earn · paid by chit': 'Gagner · payé par chit',
  'Your answer': 'Ta réponse',
  'One sentence, in your own words': 'Une phrase, avec tes mots',
  'At least 4 words. No links. Something nobody has said yet.': 'Au moins 4 mots. Pas de liens. Quelque chose que personne n’a encore dit.',
  '{n} word': '{n} mot',
  '{n} words': '{n} mots',
  'Sign and get paid': 'Signer et être payé',
  'chit uses this to pay each device one bounty per day.': 'chit s’en sert pour payer une prime par appareil et par jour.',
  'Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.':
    'Ta signature est ta réponse. Si elle passe les règles — les mêmes pour tous, sans tirage au sort — la cagnotte verse ce montant au portefeuille avec lequel tu signes, et tu gardes un vrai justificatif.',
  'The rules and every payout': 'Les règles et tous les versements',
  'This deployment has no bounty pool.': 'Cette installation n’a pas de cagnotte.',
  'chit pays real chits for a sentence of feedback. Everything about the pool is public: the address, the balance, the rules, and every payout with its transaction.':
    'chit paie de vrais chits pour une phrase de retour. Tout de la cagnotte est public : l’adresse, le solde, les règles et chaque versement avec sa transaction.',
  Pool: 'Cagnotte',
  Balance: 'Solde',
  unknown: 'inconnu',
  'Paid today': 'Versé aujourd’hui',
  '{n} payout': '{n} versement',
  '{n} payouts': '{n} versements',
  of: 'sur',
  Status: 'État',
  'Being funded — nothing is offered until it can pay': 'En cours d’approvisionnement : rien n’est proposé tant qu’elle ne peut pas payer',
  'Open now': 'Ouvertes',
  '{n} open': '{n} ouvertes',
  '{amount} each': '{amount} chacune',
  'Take one': 'En prendre une',
  'Every bounty is taken for now.': 'Toutes les primes sont prises pour l’instant.',
  'The next one opens shortly.': 'La suivante s’ouvre bientôt.',
  'The rules': 'Les règles',
  'Every payout': 'Tous les versements',
  'None yet.': 'Aucun pour l’instant.',
  'The first payout will appear here with its transaction.': 'Le premier versement apparaîtra ici avec sa transaction.',
  'chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.':
    'chit paie sa propre prime depuis cette cagnotte. Il ne détient jamais l’argent de quelqu’un d’autre. Financée par le fondateur ; chaque versement ci-dessus est sur la chaîne.',

  /* ---- share and quote ---- */
  'Send this to them': 'Envoie-lui ceci',
  'They open it, read the same words you signed, and sign in Nimiq Pay. No account, no email.':
    'La personne l’ouvre, lit exactement les mots que tu as signés, et signe dans Nimiq Pay. Sans compte, sans e-mail.',
  'Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.':
    'Rien n’a encore été payé. Tu paies une fois la signature faite : cet écran avancera tout seul.',
  'Still waiting for their signature. You can close this — it is in your Activity.':
    'Toujours en attente de sa signature. Tu peux fermer : c’est dans ton Activité.',
  'No one to send it to? Try the demo worker': 'Personne à qui l’envoyer ? Essaie le prestataire de démonstration',
  'Signing as the demo worker…': 'Signature par le prestataire de démonstration…',
  'Copy the link': 'Copier le lien',
  'Copy failed — select the link below': 'La copie a échoué : sélectionne le lien ci-dessous',
  'Send it': 'Envoyer',
  'A chit to sign': 'Un chit à signer',
  'A quote to pay': 'Un devis à payer',
  'Open in Nimiq Pay': 'Ouvrir dans Nimiq Pay',
  'Get Nimiq Pay': 'Installer Nimiq Pay',
  'Continue on your phone': 'Continue sur ton téléphone',
  'Signing and paying happen in the Nimiq Pay app. Scan this with your phone’s camera, or open the link there.':
    'La signature et le paiement se font dans l’application Nimiq Pay. Scanne ceci avec l’appareil photo de ton téléphone, ou ouvre le lien là-bas.',
  'Your quote': 'Ton devis',
  'Put this where the client is — the chat, your bio, a message. Paying it is accepting it.':
    'Mets-le là où est le client : la conversation, ta bio, un message. Le payer, c’est l’accepter.',
  'Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.':
    'Le premier qui paie devient ton client. Rien n’est retenu nulle part : le paiement arrive dans ton portefeuille, et cet écran avance à ce moment-là.',
  'No payment yet. Leave the link where clients can see it — it is in your Activity.':
    'Pas encore de paiement. Laisse le lien là où les clients le voient : il est dans ton Activité.',
  'A quote for you': 'Un devis pour toi',
  'Pay {amount} in NIM': 'Payer {amount} en NIM',
  'Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.':
    'Payer, c’est accepter exactement ces mots. L’argent va directement au portefeuille qui a signé le devis : rien n’est retenu en chemin.',
  'This wallet has not been paid through chit before.': 'Ce portefeuille n’a encore jamais été payé via chit.',
  'Paid {n} time': 'Payé {n} fois',
  'Paid {n} times': 'Payé {n} fois',
  'by {n} client': 'par {n} client',
  'by {n} clients': 'par {n} clients',

  /* ---- countersign ---- */
  'Someone wants to agree this with you': 'Quelqu’un veut convenir de ceci avec toi',
  'You would be paid': 'Tu recevrais',
  'Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.':
    'Signer signifie que tu acceptes exactement ces mots. Cela ne déplace aucun argent : le paiement vient après ta signature, vers le portefeuille avec lequel tu signes.',
  Decline: 'Refuser',
  'Declining…': 'Refus en cours…',
  'They declined': 'Refusé',
  'You declined': 'Tu as refusé',
  'They chose not to sign these words. Nothing was paid. Change the line and send a new one.':
    'La personne a choisi de ne pas signer ces mots. Rien n’a été payé. Modifie la ligne et envoies-en une nouvelle.',
  'You chose not to sign. Nothing was paid, and nothing more will happen with this link.':
    'Tu as choisi de ne pas signer. Rien n’a été payé, et il ne se passera plus rien avec ce lien.',
  'Send a new one': 'En envoyer un nouveau',
  'Could not load this wallet’s record.': 'Impossible de charger l’historique de ce portefeuille.',
  'First chit from this wallet · {amount} attached': 'Premier chit de ce portefeuille · {amount} attachés',
  'Paid {n} chit': 'A payé {n} chit',
  'Paid {n} chits': 'A payé {n} chits',
  'usually within {d}': 'en général sous {d}',
  'none left unpaid': 'aucun laissé impayé',
  '{n} left unpaid': '{n} laissés impayés',
  'a minute': 'une minute',
  minutes: 'minutes',
  hours: 'heures',
  days: 'jours',

  /* ---- people ---- */
  From: 'De',
  'Quoted by': 'Devis de',
  'Goes to': 'Va à',
  Wallet: 'Portefeuille',
  'Name this wallet': 'Nommer ce portefeuille',
  Rename: 'Renommer',
  'A name for this wallet, kept on this device': 'Un nom pour ce portefeuille, gardé sur cet appareil',
  'e.g. Acme Studio': 'p. ex. Studio Acme',
  'Only on this device. Never sent anywhere, never shown to anyone else.':
    'Uniquement sur cet appareil. Jamais envoyé nulle part, jamais montré à qui que ce soit.',

  /* ---- pay ---- */
  'They signed. Time to pay.': 'C’est signé. À toi de payer.',
  'Waiting for their signature before there is anywhere to send this.':
    'En attente de sa signature ; d’ici là, il n’y a nulle part où envoyer ceci.',
  'The exact NIM is priced when you tap Pay, so the agreed amount stays whole. It goes straight to their wallet — nothing is held on the way, and a payment cannot be reversed.':
    'Le montant exact en NIM est calculé quand tu touches Payer, pour que la somme convenue reste entière. Elle va directement à son portefeuille : rien n’est retenu en chemin, et un paiement ne peut pas être annulé.',
  'No NIM yet?': 'Pas encore de NIM ?',
  'NIM is the coin this pays in. Nimiq Pay holds it but does not sell it. The Nimiq Wallet at wallet.nimiq.com sells NIM by card or bank transfer in many countries — fees 1–4%, a few dollars minimum, availability depends on where you are — and you then send it to your Nimiq Pay address.':
    'NIM est la monnaie utilisée ici. Nimiq Pay la conserve mais ne la vend pas. Le Nimiq Wallet sur wallet.nimiq.com vend des NIM par carte ou virement dans de nombreux pays — frais de 1 à 4 %, quelques dollars minimum, la disponibilité dépend de ton pays — et tu les envoies ensuite à ton adresse Nimiq Pay.',
  'Or earn your first NIM here: the bounty on the home screen pays a real chit for one sentence of feedback.':
    'Ou gagne tes premiers NIM ici : la prime sur l’écran d’accueil paie un vrai chit pour une phrase de retour.',
  'Turning NIM into money': 'Transformer des NIM en argent',
  'One rule that saves money: ': 'Une règle qui fait économiser : ',
  'send NIM to an exchange, never withdraw NIM from one. Sell it there and withdraw the stablecoin instead — withdrawing NIM itself can cost a large share of a small balance.':
    'envoie des NIM vers une plateforme d’échange, mais n’en retire jamais des NIM. Vends-les là-bas et retire plutôt le stablecoin : retirer des NIM peut coûter une grande part d’un petit solde.',
  'The NIM is in your Nimiq Pay wallet now, and it is yours — nothing is held by chit. To turn it into your own currency, send it to an exchange that lists NIM and sell it there, or use the Nimiq Wallet’s swap into USDC or USDT and cash out from that. Which of these is open to you depends on your country; chit does not sell or swap anything itself.':
    'Les NIM sont maintenant dans ton portefeuille Nimiq Pay et ils sont à toi : chit ne retient rien. Pour les convertir dans ta monnaie, envoie-les vers une plateforme qui liste NIM et vends-les là-bas, ou utilise le swap du Nimiq Wallet vers USDC ou USDT et encaisse à partir de là. Ce qui t’est accessible dépend de ton pays ; chit ne vend ni n’échange rien lui-même.',
  'Many freelancers simply keep it: the next chit you pay a collaborator, or the next tool you buy, can be paid in NIM directly.':
    'Beaucoup de freelances les gardent simplement : le prochain chit que tu paies à un collaborateur, ou le prochain outil que tu achètes, peut être payé directement en NIM.',
  'The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.':
    'Le cours a bougé depuis la signature. Pour que les {amount} convenus restent entiers, cela fait maintenant {nim}.',
  'Sent. Watching the chain…': 'Envoyé. Surveillance de la chaîne…',
  'Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.':
    'Ton paiement est parti. Il n’apparaît pas encore sur la chaîne : c’est inhabituel, mais rien n’est perdu. Revérifie dans un instant.',
  'Check again': 'Revérifier',
  'Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.':
    'Signé par le prestataire de démonstration : un remplaçant clairement identifié pour te montrer tout le parcours. Il garde ce que tu lui paies.',
  'You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.':
    'Tu as signé. Le paiement peut arriver : quand il arrivera, tu auras un justificatif que n’importe qui peut vérifier, et cet écran avancera tout seul.',
  'Both parties have signed. Waiting for the payment to land.': 'Les deux parties ont signé. En attente du paiement.',
  'Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.':
    'Toujours en attente de son paiement. Tout va bien : c’est dans ton Activité, et tu peux revenir quand tu veux.',
  'You signed it': 'Tu l’as signé',
  'Both signed': 'Signé par les deux',
  'You marked it delivered': 'Tu l’as marqué comme livré',
  'They marked it delivered': 'Marqué comme livré',
  'Signed by the wallet being paid, on {when}. It is a record, not a receipt — nothing has been paid because of it.':
    'Signé par le portefeuille qui doit être payé, le {when}. C’est une trace, pas un justificatif : cela n’a rien payé.',
  'Open the delivery': 'Ouvrir la livraison',
  'Say it is delivered': 'Indiquer que c’est livré',
  'A link to the work': 'Un lien vers le travail',
  'https://… (optional)': 'https://… (facultatif)',
  'One line about it': 'Une ligne à ce sujet',
  'One line about it (optional)': 'Une ligne à ce sujet (facultatif)',
  'Mark it delivered': 'Marquer comme livré',
  'Signs one line with your wallet saying you handed the work over. It moves no money and obliges nobody to pay — it is a record, and the other side can see it.':
    'Signe avec ton portefeuille une ligne disant que tu as remis le travail. Cela ne déplace aucun argent et n’oblige personne à payer : c’est une trace, et l’autre partie la voit.',
  'Marked delivered on {when}': 'Marqué comme livré le {when}',
  'Check now': 'Vérifier maintenant',

  /* ---- receipt ---- */
  'Paid on': 'Payé le',
  Block: 'Bloc',
  Transaction: 'Transaction',
  'View on nimiq.watch': 'Voir sur nimiq.watch',
  'Paid by': 'Payé par',
  'Paid to': 'Payé à',
  'You were paid': 'Tu as été payé',
  Paid: 'Payé',
  'Settled on chain': 'Réglé sur la chaîne',
  'Paid after the deadline': 'Payé après l’échéance',
  'A bounty, paid by chit for your answer: “{answer}”': 'Une prime, payée par chit pour ta réponse : « {answer} »',
  'That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.':
    'C’est à toi. Ce justificatif est l’accord : n’importe qui peut le vérifier sur la chaîne, sans aucun compte.',
  'This receipt is the agreement. Anyone can check it against the chain, with no account.':
    'Ce justificatif est l’accord. N’importe qui peut le vérifier sur la chaîne, sans aucun compte.',
  'Open the receipt': 'Ouvrir le justificatif',
  'Same again': 'La même chose',
  'Worth {worth} at the moment it was paid.': 'Valait {worth} au moment du paiement.',
  'Agreed at {agreed}; worth {worth} at the moment it was paid.': 'Convenu à {agreed} ; valait {worth} au moment du paiement.',
  'Rate {rate} {currency} per NIM, from {source}, {when}.': 'Cours : {rate} {currency} par NIM, selon {source}, {when}.',
  Invoice: 'Facture',
  'Your invoice details': 'Tes informations de facturation',
  'Add your details to the invoice': 'Ajoute tes informations à la facture',
  'Printed on the invoice, kept in this browser, and never sent to chit or shown to the other side. Most small invoices need only a name, an address and a line about tax.':
    'Imprimées sur la facture, conservées dans ce navigateur, jamais envoyées à chit ni montrées à l’autre partie. La plupart des petites factures ne demandent qu’un nom, une adresse et une ligne sur la TVA.',
  'Your name or trading name': 'Ton nom ou ta raison sociale',
  Address: 'Adresse',
  'Tax or VAT number, if you have one': 'Numéro de TVA ou SIRET, si tu en as un',
  'Email or website': 'E-mail ou site web',
  'Tax line, if your country needs one': 'Mention fiscale, si ton pays en exige une',
  'e.g. VAT exempt under §19 UStG': 'p. ex. TVA non applicable, art. 293 B du CGI',
  'Save on this device': 'Enregistrer sur cet appareil',
  'Print / save as PDF': 'Imprimer / enregistrer en PDF',
  'Start another': 'En créer un autre',
  Deliverables: 'Livrables',
  Due: 'Échéance',
  passed: 'dépassée',
  'in about {n} days': 'dans environ {n} jours',
  Deadline: 'Date limite',
  'block {n}': 'bloc {n}',
  'Agreed rate': 'Cours convenu',
  'Actually received': 'Réellement reçu',
  'They sent {actual} — more than the {agreed} agreed. All of it is yours.':
    'Il a été envoyé {actual}, soit plus que les {agreed} convenus. Tout est à toi.',
  'They sent {actual}, against {agreed} agreed. The rate moved between signing and paying; chit accepts a small difference so a payment is never stranded.':
    'Il a été envoyé {actual}, contre {agreed} convenus. Le cours a bougé entre la signature et le paiement ; chit accepte un petit écart pour qu’un paiement ne reste jamais bloqué.',
  'Rate taken at': 'Cours relevé au',
  'Chit id': 'Identifiant du chit',

  /* ---- verify ---- */
  'Nothing to show': 'Rien à afficher',
  'No chit has settled with that transaction. Check the link, or the payment may not have landed yet.':
    'Aucun chit n’a été réglé par cette transaction. Vérifie le lien, ou le paiement n’est peut-être pas encore arrivé.',
  'This is genuine': 'C’est authentique',
  'This does not check out': 'Cela ne concorde pas',
  'Verification failed': 'La vérification a échoué',
  'This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.':
    'Ce chit est sur le réseau de test. Les signatures sont réelles, mais aucun argent réel n’a bougé : le montant ci-dessous n’est pas dépensable.',
  'quote — paying accepted it': 'devis — le paiement l’a accepté',
  yes: 'oui',
  no: 'non',
  'On chain': 'Sur la chaîne',
  'not yet': 'pas encore',
  'Checked in your browser, against the chain': 'Vérifié dans ton navigateur, sur la chaîne',
  'The chain disagrees with these words': 'La chaîne contredit ces mots',
  'Checked by chit’s server': 'Vérifié par le serveur de chit',
  'Your browser’s own check': 'La vérification de ton propre navigateur',
  'Digest in the payment': 'Empreinte contenue dans le paiement',
  'matches these words': 'correspond à ces mots',
  'does NOT match': 'ne correspond PAS',
  'not the wallet the words name': 'ce n’est pas le portefeuille que les mots désignent',
  'Amount on chain': 'Montant sur la chaîne',
  Chain: 'Chaîne',
  'could not be read from your browser just now': 'n’a pas pu être lu depuis ton navigateur pour le moment',
  'This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.':
    'Ce lien ne porte pas les mots signés, le paiement a donc été vérifié par le serveur de chit. Un lien issu de l’écran du justificatif les porte et est vérifié dans ton navigateur.',
  'Signatures checked by chit’s server.': 'Signatures vérifiées par le serveur de chit.',
  'Show exactly what was signed': 'Montrer exactement ce qui a été signé',
  'Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.':
    'Chaque ligne ci-dessus a été signée par les portefeuilles concernés et rattachée au paiement. chit n’a rien écrit ici.',
  'What is chit?': 'Qu’est-ce que chit ?',

  /* ---- activity ---- */
  'Paid to you': 'Versé à toi',
  '{n} chit': '{n} chit',
  '{n} chits': '{n} chits',
  'from {n} payer': 'de {n} payeur',
  'from {n} payers': 'de {n} payeurs',
  Kept: 'Gardé',
  'a 20% marketplace cut': 'une commission de plateforme de 20 %',
  'As a payer': 'En tant que payeur',
  'paid {n}': 'a payé {n}',
  '{n} awaiting': '{n} en attente',
  'Waiting to be paid': 'En attente de paiement',
  'since yesterday': 'depuis hier',
  'for {n} days': 'depuis {n} jours',
  Nudge: 'Relancer',
  'Still open: “{line}” — {amount}. Here is the chit: {link}': 'Toujours ouvert : « {line} » — {amount}. Voici le chit : {link}',
  'Nothing yet': 'Rien pour l’instant',
  'Your first chit will appear here the moment it is signed.': 'Ton premier chit apparaîtra ici dès qu’il sera signé.',
  Declined: 'Refusé',
  Quote: 'Devis',
  'Signed — unpaid': 'Signé, impayé',
  'Waiting for signature': 'En attente de signature',

  /* ---- about ---- */
  'What chit is': 'Ce qu’est chit',
  'A receipt for a deal you already made. You paste the one line you agreed in a chat, both wallets sign it with Nimiq Pay, and the payment carries the agreement’s digest. The receipt is the contract, and anyone can check it against the chain.':
    'Un justificatif pour un accord que tu as déjà conclu. Tu colles la ligne convenue dans une conversation, les deux portefeuilles la signent avec Nimiq Pay, et le paiement porte l’empreinte de l’accord. Le justificatif est le contrat, et n’importe qui peut le vérifier sur la chaîne.',
  'What it never does': 'Ce qu’il ne fait jamais',
  'Hold your money. Every payment goes straight from one wallet to the other; there is no balance and no withdrawal.':
    'Détenir ton argent. Chaque paiement va directement d’un portefeuille à l’autre ; il n’y a ni solde ni retrait.',
  'Take a cut. There is no fee. A NIM transaction is free and lands in about a second.':
    'Prendre une commission. Il n’y en a aucune. Une transaction en NIM est gratuite et arrive en une seconde environ.',
  'Protect you. This is proof of payment, not escrow or a dispute service. Use it with clients you already talk to directly.':
    'Te protéger. C’est une preuve de paiement, pas un séquestre ni un service de litiges. Utilise-le avec des clients avec qui tu échanges déjà directement.',
  'Ask for an account. There is no password, no code sent to your phone, no identity check — and so there is nothing to be locked out of. Your wallet is your identity; your record is computed from settled payments and nothing else.':
    'Te demander un compte. Pas de mot de passe, pas de code envoyé sur ton téléphone, pas de vérification d’identité — donc rien dont on puisse t’exclure. Ton portefeuille est ton identité ; ton historique est calculé uniquement à partir des paiements réglés.',
  Reference: 'Référence',
  'Give this to anyone who needs to check the payment.': 'Donne ceci à quiconque doit vérifier le paiement.',
  'Nothing is pending, nothing can be reversed, and nobody is holding it.':
    'Rien n’est en attente, rien ne peut être annulé, et personne ne le détient.',
  'You kept all of it. A 20% marketplace cut would have been {amount}.':
    'Tu as tout gardé. Une commission de plateforme de 20 % aurait représenté {amount}.',
  'chit never asks you to deposit, or to pay a fee to be paid. If anyone asks you to send money first, it is a scam — leave.':
    'chit ne te demande jamais de dépôt, ni de frais pour être payé. Si quelqu’un te demande d’envoyer de l’argent d’abord, c’est une arnaque : pars.',
  'When something goes wrong': 'Quand quelque chose tourne mal',
  'There is no support queue, because there is nothing for support to release. Everything that can go wrong has an answer you can act on yourself:':
    'Il n’y a pas de file d’attente au support, parce qu’il n’y a rien que le support puisse débloquer. Tout ce qui peut mal tourner a une réponse que tu peux appliquer toi-même :',
  'They signed and never paid. Nothing was lost — you were never owed anything until they paid. Their record now says one left unpaid, and anyone they send a chit to will see it.':
    'Signé, puis jamais payé. Rien n’est perdu : rien ne t’était dû tant que le paiement n’avait pas eu lieu. Son historique indique désormais un impayé, et toute personne recevant un chit de sa part le verra.',
  'You paid and the work never came. chit cannot reverse a payment; nobody can. Pay in smaller steps with someone new, and check their record before you sign.':
    'Tu as payé et le travail n’est jamais arrivé. chit ne peut pas annuler un paiement ; personne ne le peut. Avec quelqu’un de nouveau, paie par petites étapes et regarde son historique avant de signer.',
  'The payment is not showing. chit watches the chain itself, not the wallet — reopen the chit and it will catch up. If the transaction is on nimiq.watch, the money has moved.':
    'Le paiement n’apparaît pas. chit surveille la chaîne elle-même, pas le portefeuille : rouvre le chit et il se mettra à jour. Si la transaction est sur nimiq.watch, l’argent est bien parti.',
  'You lost the link. Every chit your wallet signed is in Activity, on any device you connect the same wallet from.':
    'Tu as perdu le lien. Chaque chit signé par ton portefeuille est dans Activité, sur n’importe quel appareil depuis lequel tu connectes ce même portefeuille.',
  'chit disappears. The receipt link carries the signed words, and your browser checks them against a public Nimiq node. It works without us.':
    'chit disparaît. Le lien du justificatif porte les mots signés, et ton navigateur les vérifie auprès d’un nœud Nimiq public. Cela fonctionne sans nous.',
  'How a receipt is checked': 'Comment un justificatif est vérifié',
  'The words are hashed; that hash is the 64-byte memo of the NIM payment. A receipt link carries the words, so your browser recomputes the hash and reads the transaction from a public Nimiq node — no chit server needed.':
    'Les mots sont hachés ; ce hachage est le message de 64 octets du paiement en NIM. Le lien du justificatif porte les mots, donc ton navigateur recalcule le hachage et lit la transaction depuis un nœud Nimiq public — aucun serveur chit nécessaire.',
  'The bounty': 'La prime',
  'chit pays real chits for a sentence of feedback, from a pool funded by the founder. The address, balance, rules and every payout are public.':
    'chit paie de vrais chits pour une phrase de retour, depuis une cagnotte financée par le fondateur. L’adresse, le solde, les règles et chaque versement sont publics.',
  'See the pool': 'Voir la cagnotte',
  'Open source under the MIT licence. Built for the Nimiq Mini Apps Competition, Cycle 2, 2026. Signatures are verified by chit’s server; payments by the Nimiq chain.':
    'Open source sous licence MIT. Créé pour la Nimiq Mini Apps Competition, cycle 2, 2026. Les signatures sont vérifiées par le serveur de chit ; les paiements par la chaîne Nimiq.',
  'Nothing about you is stored until you sign something.': 'Rien n’est enregistré à ton sujet tant que tu ne signes rien.',

  /* ---- the balance hint, before the wallet sheet ---- */
  'Your wallet holds {have}. This needs {need} — {short} more. Top up and try again; nothing has been sent.':
    'Ton portefeuille contient {have}. Il en faut {need} : il manque {short}. Recharge-le et réessaie ; rien n’a été envoyé.',

  /* ---- reviews ---- */
  '{n} out of 5': '{n} sur 5',
  'For: {line}': 'Pour : {line}',
  'What they said': 'Ce qui a été dit',
  'What the other side said': 'Ce qu’a dit l’autre partie',
  'Your rating': 'Ta note',
  'One line, if you want to add one': 'Une ligne, si tu veux en ajouter une',
  'One line, if you want to add one (optional)': 'Une ligne, si tu veux en ajouter une (facultatif)',
  'How did it go?': 'Comment ça s’est passé ?',
  'Sign this review': 'Signer cet avis',
  'Signed by your wallet over this payment, so it cannot be bought, faked or written by anyone else. It goes on their public record and it cannot be taken down — including by us.':
    'Signé par ton portefeuille sur ce paiement : il ne peut donc être ni acheté, ni falsifié, ni écrit par quelqu’un d’autre. Il figure dans son historique public et ne peut pas être retiré, pas même par nous.',
  '{n} review': '{n} avis',
  '{n} reviews': '{n} avis',

  /* ---- the public record ---- */
  Record: 'Historique',
  'Your public record': 'Ton historique public',
  'Everything paid, as a spreadsheet': 'Tout ce qui a été payé, en tableur',
  'Their record': 'Son historique',
  'Nothing here yet': 'Rien ici pour l’instant',
  'No settled work on this wallet': 'Aucun travail réglé sur ce portefeuille',
  'The moment a chit you are part of is paid, it appears here — with the amount, the date, and anything either side said about it. Nothing on this page is written by you.':
    'Dès qu’un chit auquel tu participes est payé, il apparaît ici : avec le montant, la date et tout ce que chaque partie en a dit. Rien sur cette page n’est écrit par toi.',
  'This wallet has not been paid through chit, and has not paid anyone. That is not a bad sign or a good one; it is a wallet with no record yet.':
    'Ce portefeuille n’a pas été payé via chit, et n’a payé personne. Ce n’est ni bon signe ni mauvais signe : c’est un portefeuille sans historique.',
  'Write a chit': 'Écrire un chit',
  'Paid to this wallet': 'Versé à ce portefeuille',
  '{n} job': '{n} mission',
  '{n} jobs': '{n} missions',
  'from {n} client': 'de {n} client',
  'from {n} clients': 'de {n} clients',
  'First paid': 'Premier paiement',
  'As a client': 'En tant que client',
  'Settled work': 'Travaux réglés',
  'Send this to a client': 'Envoie ceci à un client',
  'Share this record': 'Partager cet historique',
  'One link. It opens for anyone, with no account and no app, and every line on it can be checked against the chain.':
    'Un lien. Il s’ouvre pour tout le monde, sans compte ni application, et chaque ligne peut être vérifiée sur la chaîne.',
  'Every figure on this page is computed from payments on the Nimiq chain. Nobody can edit it — not the person it is about, and not chit.':
    'Chaque chiffre de cette page est calculé à partir des paiements sur la chaîne Nimiq. Personne ne peut le modifier : ni la personne concernée, ni chit.',

  'The date on this has passed and it is still unpaid. Nothing is lost and nothing expired — it can still be paid. Send them a nudge, or write a new one at a number that works now.':
    'La date est dépassée et ce n’est toujours pas payé. Rien n’est perdu et rien n’a expiré : cela peut encore être payé. Envoie une relance, ou écris-en un nouveau avec un montant qui convient aujourd’hui.',
  'The date on this has passed. It can still be signed and still be paid; if it no longer fits, write a new one instead of leaving this open.':
    'La date est dépassée. Cela peut encore être signé et payé ; si cela ne convient plus, écris-en un nouveau plutôt que de laisser celui-ci ouvert.',

  /* ---- agreements with no payment ---- */
  'Something changed?': 'Quelque chose a changé ?',
  'What changed': 'Ce qui a changé',
  'e.g. one extra round of edits, same price': 'p. ex. une série de retouches en plus, même prix',
  'Sign the change': 'Signer le changement',
  'Call it off': 'Tout annuler',
  'Called off by agreement — {line}': 'Annulé d’un commun accord — {line}',
  'Change agreed — {line}': 'Changement convenu — {line}',
  'Write what you both agreed and sign it. It moves no money and does not alter the chit above — it is a second signed line pointing at it, so the record shows the change instead of the argument.':
    'Écris ce que vous avez convenu et signe-le. Cela ne déplace aucun argent et ne modifie pas le chit ci-dessus : c’est une deuxième ligne signée qui pointe vers lui, pour que l’historique montre le changement plutôt que la dispute.',
  'Or close it. A chit nobody will pay is worse left open — this records that you both called it off, with both names on it.':
    'Ou ferme-le. Un chit que personne ne paiera est pire s’il reste ouvert : ceci acte que vous l’avez annulé tous les deux, avec vos deux noms.',
  'Open the chit this answers': 'Ouvrir le chit auquel ceci répond',
  'Signed by': 'Signé par',
  'And by': 'Et par',
  'Called off, by both of you': 'Annulé, par vous deux',
  'The change is on the record': 'Le changement est acté',
  'Both of you signed this. Nothing is owed and nothing is open — the original chit stays exactly as it was signed, with this beside it.':
    'Vous l’avez signé tous les deux. Rien n’est dû et rien ne reste ouvert : le chit d’origine reste exactement tel qu’il a été signé, avec ceci à côté.',
  'Both of you signed this. The original chit is untouched; this sits beside it, so what you agreed later is on the record too.':
    'Vous l’avez signé tous les deux. Le chit d’origine reste intact ; ceci se place à côté, pour que ce que vous avez convenu ensuite soit également acté.',
  'Back to the chit': 'Retour au chit',
  'Nothing is being paid here. They open it, read the same words you signed, and sign too.':
    'Rien n’est payé ici. La personne l’ouvre, lit exactement les mots que tu as signés, et signe aussi.',
  'Waiting for them to sign.': 'En attente de sa signature.',
  'Calling this off': 'Annuler ceci',
  'A change to sign': 'Un changement à signer',
  'They want to call it off': 'La personne veut tout annuler',
  'They want to agree a change': 'La personne veut convenir d’un changement',
  'Signing this closes the job for both of you. No money moves, and nothing that was already paid is affected.':
    'Signer clôt la mission pour vous deux. Aucun argent ne bouge, et ce qui a déjà été payé n’est pas affecté.',
  'Signing means you agree to these exact words as well. No money moves, and the chit this answers is not altered.':
    'Signer signifie que toi aussi tu acceptes exactement ces mots. Aucun argent ne bouge, et le chit auquel ceci répond n’est pas modifié.',

  /* ---- what a wallet failure says to a person ---- */
  'You cancelled. Nothing was sent.': 'Tu as annulé. Rien n’a été envoyé.',
  'Your wallet returned a signature chit could not read. Please report this — it is our bug, not yours.':
    'Ton portefeuille a renvoyé une signature que chit n’a pas su lire. Signale-le, s’il te plaît : le bug est de notre côté, pas du tien.',
  'Your wallet reported: {message}': 'Ton portefeuille signale : {message}',
  'Something went wrong. Nothing was signed and nothing was sent.': 'Quelque chose s’est mal passé. Rien n’a été signé ni envoyé.',
  'Your wallet does not hold enough NIM for this. Top it up and try again — nothing was sent.':
    'Ton portefeuille ne contient pas assez de NIM pour cela. Recharge-le et réessaie : rien n’a été envoyé.',
  'Your phone could not reach the network. Nothing was sent — check your connection and try again.':
    'Ton téléphone n’a pas pu joindre le réseau. Rien n’a été envoyé : vérifie ta connexion et réessaie.',
  'Nimiq Pay is still catching up with the chain. Give it a few seconds and try again.':
    'Nimiq Pay est encore en train de se synchroniser avec la chaîne. Laisse-lui quelques secondes et réessaie.',
  'Your wallet is locked. Unlock Nimiq Pay and try again.': 'Ton portefeuille est verrouillé. Déverrouille Nimiq Pay et réessaie.',
  '{step} — Nimiq Pay did not answer. Open the wallet and try again.':
    '{step} — Nimiq Pay n’a pas répondu. Ouvre le portefeuille et réessaie.',
  'Checking sync': 'Vérification de la synchronisation',
  'Sharing your address': 'Partage de ton adresse',
  Signing: 'Signature',
  Paying: 'Paiement',
  'Reading the chain height': 'Lecture de la hauteur de chaîne',

  /* ---- errors ---- */
  'Nothing here': 'Il n’y a rien ici',
  'That link does not point at anything in chit.': 'Ce lien ne pointe vers rien dans chit.',
  'Not found': 'Introuvable',
  'Something broke': 'Quelque chose a cassé',
  'chit hit an error it did not expect. Anything already signed is safe on the server, and anything paid is on chain.':
    'chit a rencontré une erreur inattendue. Tout ce qui est déjà signé est en sécurité sur le serveur, et tout ce qui est payé est sur la chaîne.',
  'Test network — the signatures are real, the money is not.': 'Réseau de test : les signatures sont réelles, l’argent non.',
  'Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.':
    'Mode démonstration : les signatures ici sont pour l’exemple et ne seront pas vérifiées. Ouvre dans Nimiq Pay pour signer pour de vrai.',
  'Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.':
    'La signature et le paiement se font dans l’application Nimiq Pay. Ouvre ceci là-bas : Nimiq Pay peut demander une confirmation la première fois.',
  'Your wallet is on the Nimiq test network, but this chit is for real NIM. Switch Nimiq Pay to mainnet and try again.':
    'Ton portefeuille est sur le réseau de test Nimiq, mais ce chit porte sur de vrais NIM. Bascule Nimiq Pay sur le réseau principal et réessaie.',
  'Your wallet is on Nimiq mainnet, but this is a test-network chit. Switch Nimiq Pay to testnet and try again.':
    'Ton portefeuille est sur le réseau principal Nimiq, mais ce chit est sur le réseau de test. Bascule Nimiq Pay sur le réseau de test et réessaie.',


  /* The board — finding work, and being found. */
  'Board': 'Tableau',
  'We could not read the chain just now, so we cannot say which chits are still open. Try again in a moment.': 'Nous n\'avons pas pu lire la chaîne à l\'instant, donc nous ne pouvons pas dire quels chits sont encore ouverts. Réessaie dans un moment.',
  'logo, translation, video…': 'logo, traduction, vidéo…',
  'Search the board': 'Rechercher dans le tableau',
  'Search': 'Rechercher',
  'Which side of the board': 'Quel côté du tableau',
  'Everything': 'Tout',
  'Work': 'Missions',
  'People': 'Personnes',
  'Best match': 'Plus pertinents',
  'Newest': 'Plus récents',
  'Closing soon': 'Bientôt clos',
  'Highest paid': 'Mieux payés',
  'Order': 'Ordre',
  'New here': 'Nouveau ici',
  'Offer': 'Offre',
  'closing today': 'se termine aujourd\'hui',
  '{n}d left': 'encore {n} j',
  'Work with the money already on it, and people offering theirs. Open one to read the whole agreement before you sign anything.': 'Des missions dont l\'argent est déjà déposé, et des personnes qui proposent le leur. Ouvre-en une pour lire tout l\'accord avant de signer quoi que ce soit.',
  'Nothing matches that.': 'Rien ne correspond.',
  'The board is empty right now.': 'Le tableau est vide pour le moment.',
  'Try a shorter word — or post what you need and let somebody come to you.': 'Essaie un mot plus court — ou publie ce dont tu as besoin et laisse quelqu\'un venir à toi.',
  'Post what you need, or what you can do, and it appears here.': 'Publie ce dont tu as besoin, ou ce que tu sais faire, et cela apparaîtra ici.',
  '{shown} of {total} open': '{shown} sur {total} ouverts',
  'Show more': 'Afficher plus',
  '{n} done': '{n} réalisés',
  '★{rating} · {n} done': '★{rating} · {n} réalisés',


  /* Questions asked in public before anybody commits. */
  'Questions': 'Questions',
  'Asked in public, so the next person does not have to ask again.': 'Posée en public, pour que la personne suivante n\'ait pas à la reposer.',
  'Answer it in one line': 'Réponds en une ligne',
  'Answer': 'Répondre',
  'Not answered yet.': 'Pas encore de réponse.',
  'Your question': 'Ta question',
  'e.g. does this include the source files?': 'p. ex. les fichiers sources sont-ils inclus ?',
  'Ask in public': 'Poser en public',
  'Ask before you sign. Everyone can see the question and the answer — including you, later.': 'Pose ta question avant de signer. Tout le monde voit la question et la réponse — toi compris, plus tard.',


  /* Portfolio pieces: paid for, and shown only with the client agreeing. */
  'Shown as work': 'Montré comme travail',
  'Both of you signed this, so it is on the public record with the payment beside it.': 'Vous l\'avez signé tous les deux, donc c\'est au registre public avec le paiement à côté.',
  'Agree to show it': 'Accepter de le montrer',
  'They would like to show this work': 'Ils aimeraient montrer ce travail',
  'It goes on their public record with what you paid beside it. Nothing is shown unless you agree.': 'Cela ira sur leur page publique, avec ce que tu as payé à côté. Rien n\'est montré sans ton accord.',
  'Link to the work': 'Lien vers le travail',
  'Update the offer': 'Modifier la proposition',
  'Offer it as a piece': 'Le proposer comme réalisation',
  'Show this work': 'Montrer ce travail',
  'Offered. It is not public until they agree.': 'Proposé. Ce n\'est public que lorsqu\'ils acceptent.',
  'Put it on your public record, with the payment beside it as proof somebody paid for it. Your client has to agree first.': 'Mets-le sur ta page publique, avec le paiement à côté comme preuve que quelqu\'un l\'a payé. Ton client doit d\'abord accepter.',
  'Each piece was paid for, and the client agreed to it being shown.': 'Chaque réalisation a été payée, et le client a accepté de la montrer.',
  'Offer a different deal': 'Proposer un autre accord',

  /* ---- full history, on the settled screen ---- */
  'Full history': 'Historique complet',
  Sent: 'Envoyé',
  'A question was asked': 'Une question a été posée',
  'The question was answered': 'On a répondu à la question',
  'Offered as a portfolio piece': 'Proposé comme réalisation',
  'Shown as a portfolio piece': 'Montré comme réalisation',
  Signed: 'Signé',
  'Passed its deadline': 'A dépassé son échéance',
  'A payment arrived that did not match': 'Un paiement est arrivé qui ne correspondait pas',
  'Answered with a new chit': 'Répondu par un nouveau chit',
  'Marked delivered': 'Marqué comme livré',
  Reviewed: 'Avis laissé',
  'Bounty opened': 'Prime ouverte',
  'Bounty answered': 'Prime réclamée',
  'Bounty paid': 'Prime payée',
  'Bounty payout failed': 'Le versement de la prime a échoué',

  /* ---- the rest of the series, on the settled screen ---- */
  'Part of a series': 'Fait partie d\'une série',
  'See what this answers': 'Voir à quoi cela répond',
  'What came after': 'Ce qui est venu après',
};

export default fr;
