/**
 * Spanish.
 *
 * Written in neutral Spanish and addressed as «tú», the same register as the English and
 * German copy: this is one freelancer talking to another about money, not a bank writing to
 * a customer. Where a term differs across regions the widely-understood one wins — «billetera»
 * over «cartera» or «monedero», because the whole Spanish-speaking crypto world says
 * «billetera» and a freelancer in Bogotá and one in Madrid both read it without stopping.
 *
 * Product names are left alone: chit, Nimiq Pay, NIM.
 *
 * Keys are the English sentence, so a missing entry shows English rather than a key.
 * `apps/web/test/i18n.test.ts` reads every `t(…)` call in the source and fails if any of
 * them is unanswered here.
 */

import type { Dict } from '../i18n.ts';

const es: Dict = {
  /* ---- chrome ---- */
  'chit home': 'Inicio de chit',
  Activity: 'Actividad',
  About: 'Qué es chit',
  'New chit': 'Nuevo chit',
  Bounty: 'Recompensa',
  Details: 'Detalles',
  You: 'Tú',
  Copy: 'Copiar',
  Copied: 'Copiado',
  Save: 'Guardar',
  Cancel: 'Cancelar',
  'Try again': 'Reintentar',
  'Start a chit': 'Crear un chit',
  'Start again': 'Empezar de nuevo',
  'Not now': 'Ahora no',
  Later: 'Más tarde',
  'Done for now': 'Listo por ahora',

  /* ---- home ---- */
  'Paste the deal. Get a receipt.': 'Pega el trato. Recibe un comprobante.',
  'For the clients you already talk to directly. They pay; you hold a receipt anyone can check. Proof of payment, not protection.':
    'Para los clientes con los que ya hablas directamente. Ellos pagan; tú te quedas con un comprobante que cualquiera puede verificar. Prueba de pago, no protección.',
  'I’m getting paid': 'A mí me pagan',
  'I’m paying': 'Yo pago',
  'Which way the money goes': 'Hacia dónde va el dinero',
  'You sign. Whoever pays this link has accepted it, and the NIM lands in your wallet.':
    'Tú firmas. Quien pague este enlace lo ha aceptado, y los NIM llegan a tu billetera.',
  'You sign, they sign, then you pay. The payment carries the proof.':
    'Tú firmas, la otra parte firma, y luego pagas. El pago lleva la prueba consigo.',
  'The line you already agreed': 'La línea que ya acordaron',
  '$40 for 3 thumbnails by Friday': '$40 por 3 miniaturas para el viernes',
  'Sign it': 'Firmar',
  'What we understood': 'Así lo entendimos',
  'Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.':
    'Añade un importe y una moneda — «$40», «€120», «₹3500» — para que ambas partes acuerden la misma cifra. También puedes tocar cualquier línea de arriba y fijarla tú.',
  'Pricing it in NIM…': 'Calculando en NIM…',
  'The words read as {a}, but the amount is set in {b}. Both sides sign the words — make sure they agree.':
    'El texto dice {a}, pero el importe está en {b}. Ambas partes firman el texto: asegúrate de que coincidan.',
  'The words say {a}, but the amount is set to {b}. Both sides sign the words — fix the sentence, or the number.':
    'El texto dice {a}, pero el importe está en {b}. Ambas partes firman el texto: corrige la frase o la cifra.',
  'Waiting for your wallet…': 'Esperando a tu billetera…',
  'chit is not reachable': 'No se puede conectar con chit',
  'In reply to': 'En respuesta a',
  '{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.':
    '{amount} · esto se convierte en un chit aparte que firman los dos. El de arriba no se toca.',
  'Ask for a change': 'Proponer un cambio',
  'Ask for half up front': 'Pedir la mitad por adelantado',
  'Half up front — {line}': 'Mitad por adelantado — {line}',
  'Second half — {line}': 'Segunda mitad — {line}',
  'The other half': 'La otra mitad',
  'Next step of this job': 'Siguiente paso de este trabajo',
  'How chit works': 'Cómo funciona chit',

  /* ---- the editable rows ---- */
  Amount: 'Importe',
  Currency: 'Moneda',
  By: 'Para el',
  'How many': 'Cuántos',
  'In NIM': 'En NIM',
  'not sure yet': 'aún sin definir',
  today: 'hoy',
  tomorrow: 'mañana',
  '3 days': '3 días',
  'a week': 'una semana',
  '2 weeks': '2 semanas',
  '{n} days': '{n} días',
  '{label}: {value}. Tap to change.': '{label}: {value}. Toca para cambiarlo.',
  'A whole number, please — this currency has no decimals.': 'Un número entero, por favor: esta moneda no tiene decimales.',
  'That is not an amount chit can read. Try 40 or 40.50.': 'chit no puede leer ese importe. Prueba con 40 o 40,50.',
  'Set it': 'Fijar',

  /* ---- the bounty ---- */
  'Your first NIM · paid by chit': 'Tus primeros NIM · los paga chit',
  'Sign it with your answer and the pool pays your wallet in NIM. {n} open now.':
    'Firma con tu respuesta y el fondo paga NIM a tu billetera. {n} abiertas ahora.',
  'Earn {amount} — test chit': 'Gana {amount} — prueba chit',
  'Your first NIM': 'Tus primeros NIM',
  'Earn · paid by chit': 'Gana · lo paga chit',
  'Your answer': 'Tu respuesta',
  'One sentence, in your own words': 'Una frase, con tus palabras',
  'At least 4 words. No links. Something nobody has said yet.': 'Al menos 4 palabras. Sin enlaces. Algo que nadie haya dicho aún.',
  '{n} word': '{n} palabra',
  '{n} words': '{n} palabras',
  'Sign and get paid': 'Firmar y cobrar',
  'chit uses this to pay each device one bounty per day.': 'chit lo usa para pagar una recompensa por dispositivo y día.',
  'Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.':
    'Tu firma es tu respuesta. Si cumple las reglas —las mismas para todos, sin sorteo— el fondo paga este importe a la billetera con la que firmes, y te quedas con un comprobante real.',
  'The rules and every payout': 'Las reglas y todos los pagos',
  'This deployment has no bounty pool.': 'Esta instalación no tiene fondo de recompensas.',
  'chit pays real chits for a sentence of feedback. Everything about the pool is public: the address, the balance, the rules, and every payout with its transaction.':
    'chit paga chits reales por una frase de opinión. Todo sobre el fondo es público: la dirección, el saldo, las reglas y cada pago con su transacción.',
  Pool: 'Fondo',
  Balance: 'Saldo',
  unknown: 'desconocido',
  'Paid today': 'Pagado hoy',
  '{n} payout': '{n} pago',
  '{n} payouts': '{n} pagos',
  of: 'de',
  Status: 'Estado',
  'Being funded — nothing is offered until it can pay': 'En financiación: no se ofrece nada hasta que pueda pagar',
  'Open now': 'Abiertas ahora',
  '{n} open': '{n} abiertas',
  '{amount} each': '{amount} cada una',
  'Take one': 'Tomar una',
  'Every bounty is taken for now.': 'Por ahora todas las recompensas están tomadas.',
  'The next one opens shortly.': 'La siguiente se abre en breve.',
  'The rules': 'Las reglas',
  'Every payout': 'Todos los pagos',
  'None yet.': 'Todavía ninguno.',
  'The first payout will appear here with its transaction.': 'El primer pago aparecerá aquí con su transacción.',
  'chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.':
    'chit paga su propia recompensa desde este fondo. Nunca custodia el dinero de nadie más. Lo financia el fundador; cada pago de arriba está en la cadena.',

  /* ---- share and quote ---- */
  'Send this to them': 'Envíaselo',
  'They open it, read the same words you signed, and sign in Nimiq Pay. No account, no email.':
    'Lo abren, leen las mismas palabras que firmaste y firman en Nimiq Pay. Sin cuenta y sin correo.',
  'Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.':
    'Todavía no se ha pagado nada. Pagas cuando hayan firmado: esta pantalla avanza sola.',
  'Still waiting for their signature. You can close this — it is in your Activity.':
    'Seguimos esperando su firma. Puedes cerrar esto: está en tu Actividad.',
  'No one to send it to? Try the demo worker': '¿Nadie a quien enviárselo? Prueba con el profesional de demostración',
  'Signing as the demo worker…': 'Firmando como el profesional de demostración…',
  'Copy the link': 'Copiar el enlace',
  'Copy failed — select the link below': 'No se pudo copiar: selecciona el enlace de abajo',
  'Send it': 'Enviar',
  'A chit to sign': 'Un chit para firmar',
  'A quote to pay': 'Un presupuesto para pagar',
  'Open in Nimiq Pay': 'Abrir en Nimiq Pay',
  'Get Nimiq Pay': 'Instalar Nimiq Pay',
  'Continue on your phone': 'Sigue en tu teléfono',
  'Signing and paying happen in the Nimiq Pay app. Scan this with your phone’s camera, or open the link there.':
    'Firmar y pagar ocurren en la app Nimiq Pay. Escanea esto con la cámara de tu teléfono, o abre el enlace allí.',
  'Your quote': 'Tu presupuesto',
  'Put this where the client is — the chat, your bio, a message. Paying it is accepting it.':
    'Ponlo donde esté el cliente: el chat, tu biografía, un mensaje. Pagarlo es aceptarlo.',
  'Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.':
    'Quien pague primero es tu cliente. No se custodia nada en ninguna parte: el pago llega a tu billetera y esta pantalla avanza cuando lo haga.',
  'No payment yet. Leave the link where clients can see it — it is in your Activity.':
    'Aún no hay pago. Deja el enlace donde los clientes lo vean: está en tu Actividad.',
  'A quote for you': 'Un presupuesto para ti',
  'Pay {amount} in NIM': 'Pagar {amount} en NIM',
  'Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.':
    'Pagarlo acepta exactamente estas palabras. El dinero va directo a la billetera que firmó el presupuesto: no se custodia nada por el camino.',
  'This wallet has not been paid through chit before.': 'A esta billetera nunca le han pagado por chit.',
  'Paid {n} time': 'Le han pagado {n} vez',
  'Paid {n} times': 'Le han pagado {n} veces',
  'by {n} client': 'de {n} cliente',
  'by {n} clients': 'de {n} clientes',

  /* ---- countersign ---- */
  'Someone wants to agree this with you': 'Alguien quiere acordar esto contigo',
  'You would be paid': 'Cobrarías',
  'Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.':
    'Firmar significa que aceptas exactamente estas palabras. No mueve dinero: te pagan después de que firmes, y el pago va a la billetera con la que firmes.',
  Decline: 'Rechazar',
  'Declining…': 'Rechazando…',
  'They declined': 'Lo rechazaron',
  'You declined': 'Lo rechazaste',
  'They chose not to sign these words. Nothing was paid. Change the line and send a new one.':
    'Decidieron no firmar estas palabras. No se pagó nada. Cambia la línea y envía otra.',
  'You chose not to sign. Nothing was paid, and nothing more will happen with this link.':
    'Decidiste no firmar. No se pagó nada y con este enlace ya no ocurrirá nada más.',
  'Send a new one': 'Enviar otro',
  'Could not load this wallet’s record.': 'No se pudo cargar el historial de esta billetera.',
  'First chit from this wallet · {amount} attached': 'Primer chit de esta billetera · {amount} adjuntos',
  'Paid {n} chit': 'Ha pagado {n} chit',
  'Paid {n} chits': 'Ha pagado {n} chits',
  'usually within {d}': 'normalmente en {d}',
  'none left unpaid': 'ninguno quedó sin pagar',
  '{n} left unpaid': '{n} quedaron sin pagar',
  'a minute': 'un minuto',
  minutes: 'minutos',
  hours: 'horas',
  days: 'días',

  /* ---- people ---- */
  From: 'De',
  'Quoted by': 'Presupuestado por',
  'Goes to': 'Va a',
  Wallet: 'Billetera',
  'Name this wallet': 'Ponle nombre a esta billetera',
  Rename: 'Cambiar el nombre',
  'A name for this wallet, kept on this device': 'Un nombre para esta billetera, guardado en este dispositivo',
  'e.g. Acme Studio': 'p. ej. Estudio Acme',
  'Only on this device. Never sent anywhere, never shown to anyone else.':
    'Solo en este dispositivo. Nunca se envía a ninguna parte ni se le muestra a nadie más.',

  /* ---- pay ---- */
  'They signed. Time to pay.': 'Ya firmaron. Toca pagar.',
  'Waiting for their signature before there is anywhere to send this.':
    'Esperando su firma; hasta entonces no hay adónde enviar esto.',
  'The exact NIM is priced when you tap Pay, so the agreed amount stays whole. It goes straight to their wallet — nothing is held on the way, and a payment cannot be reversed.':
    'Los NIM exactos se calculan al tocar Pagar, para que el importe acordado quede íntegro. Va directo a su billetera: no se custodia nada por el camino, y un pago no se puede revertir.',
  'No NIM yet?': '¿Todavía sin NIM?',
  'NIM is the coin this pays in. Nimiq Pay holds it but does not sell it. The Nimiq Wallet at wallet.nimiq.com sells NIM by card or bank transfer in many countries — fees 1–4%, a few dollars minimum, availability depends on where you are — and you then send it to your Nimiq Pay address.':
    'NIM es la moneda con la que se paga aquí. Nimiq Pay la guarda pero no la vende. La Nimiq Wallet en wallet.nimiq.com vende NIM con tarjeta o transferencia en muchos países —comisiones del 1 al 4 %, unos pocos dólares de mínimo, la disponibilidad depende de dónde estés— y desde ahí los envías a tu dirección de Nimiq Pay.',
  'Or earn your first NIM here: the bounty on the home screen pays a real chit for one sentence of feedback.':
    'O gana tus primeros NIM aquí: la recompensa de la pantalla de inicio paga un chit real por una frase de opinión.',
  'Turning NIM into money': 'Convertir NIM en dinero',
  'One rule that saves money: ': 'Una regla que ahorra dinero: ',
  'send NIM to an exchange, never withdraw NIM from one. Sell it there and withdraw the stablecoin instead — withdrawing NIM itself can cost a large share of a small balance.':
    'envía NIM a un exchange, pero nunca retires NIM desde uno. Véndelos allí y retira la stablecoin: retirar NIM puede costarte buena parte de un saldo pequeño.',
  'The NIM is in your Nimiq Pay wallet now, and it is yours — nothing is held by chit. To turn it into your own currency, send it to an exchange that lists NIM and sell it there, or use the Nimiq Wallet’s swap into USDC or USDT and cash out from that. Which of these is open to you depends on your country; chit does not sell or swap anything itself.':
    'Los NIM ya están en tu billetera de Nimiq Pay y son tuyos: chit no custodia nada. Para pasarlos a tu moneda, envíalos a un exchange que liste NIM y véndelos allí, o usa el swap de la Nimiq Wallet a USDC o USDT y cobra desde ahí. Cuál de estas opciones tienes disponible depende de tu país; chit no vende ni intercambia nada.',
  'Many freelancers simply keep it: the next chit you pay a collaborator, or the next tool you buy, can be paid in NIM directly.':
    'Muchos freelancers simplemente los conservan: el próximo chit que le pagues a un colaborador, o la próxima herramienta que compres, puede pagarse en NIM directamente.',
  'The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.':
    'El cambio se movió desde la firma. Para que los {amount} acordados queden íntegros, ahora son {nim}.',
  'Sent. Watching the chain…': 'Enviado. Observando la cadena…',
  'Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.':
    'Tu pago se envió. Todavía no aparece en la cadena: es raro, pero no está perdido. Vuelve a comprobarlo en un momento.',
  'Check again': 'Comprobar otra vez',
  'Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.':
    'Firmado por el profesional de demostración: un sustituto etiquetado para que veas todo el flujo. Se queda con lo que le pagues.',
  'You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.':
    'Ya firmaste. Ahora pueden pagar: cuando llegue tendrás un comprobante que cualquiera puede verificar, y esta pantalla avanzará sola.',
  'Both parties have signed. Waiting for the payment to land.': 'Ambas partes han firmado. Esperando a que llegue el pago.',
  'Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.':
    'Seguimos esperando su pago. No pasa nada: está en tu Actividad y puedes volver cuando quieras.',
  'You signed it': 'Lo firmaste',
  'Both signed': 'Firmado por ambos',
  'You marked it delivered': 'Lo marcaste como entregado',
  'They marked it delivered': 'Lo marcaron como entregado',
  'Signed by the wallet being paid, on {when}. It is a record, not a receipt — nothing has been paid because of it.':
    'Firmado por la billetera que va a cobrar, el {when}. Es un registro, no un comprobante: por sí solo no ha pagado nada.',
  'Open the delivery': 'Abrir la entrega',
  'Say it is delivered': 'Marcar como entregado',
  'A link to the work': 'Un enlace al trabajo',
  'https://… (optional)': 'https://… (opcional)',
  'One line about it': 'Una línea sobre ello',
  'One line about it (optional)': 'Una línea sobre ello (opcional)',
  'Mark it delivered': 'Marcar como entregado',
  'Signs one line with your wallet saying you handed the work over. It moves no money and obliges nobody to pay — it is a record, and the other side can see it.':
    'Firma con tu billetera una línea que dice que entregaste el trabajo. No mueve dinero ni obliga a nadie a pagar: es un registro, y la otra parte lo ve.',
  'Marked delivered on {when}': 'Marcado como entregado el {when}',
  'Check now': 'Comprobar ahora',

  /* ---- receipt ---- */
  'Paid on': 'Pagado el',
  Block: 'Bloque',
  Transaction: 'Transacción',
  'View on nimiq.watch': 'Ver en nimiq.watch',
  'Paid by': 'Pagado por',
  'Paid to': 'Pagado a',
  'You were paid': 'Te han pagado',
  Paid: 'Pagado',
  'Settled on chain': 'Liquidado en la cadena',
  'Paid after the deadline': 'Pagado después de la fecha',
  'A bounty, paid by chit for your answer: “{answer}”': 'Una recompensa, pagada por chit por tu respuesta: «{answer}»',
  'That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.':
    'Eso es tuyo. Este comprobante es el acuerdo: cualquiera puede verificarlo contra la cadena, sin ninguna cuenta.',
  'This receipt is the agreement. Anyone can check it against the chain, with no account.':
    'Este comprobante es el acuerdo. Cualquiera puede verificarlo contra la cadena, sin ninguna cuenta.',
  'Open the receipt': 'Abrir el comprobante',
  'Same again': 'Otro igual',
  'Worth {worth} at the moment it was paid.': 'Valía {worth} en el momento del pago.',
  'Agreed at {agreed}; worth {worth} at the moment it was paid.': 'Acordado en {agreed}; valía {worth} en el momento del pago.',
  'Rate {rate} {currency} per NIM, from {source}, {when}.': 'Cambio: {rate} {currency} por NIM, según {source}, {when}.',
  Invoice: 'Factura',
  'Your invoice details': 'Tus datos de facturación',
  'Add your details to the invoice': 'Añade tus datos a la factura',
  'Printed on the invoice, kept in this browser, and never sent to chit or shown to the other side. Most small invoices need only a name, an address and a line about tax.':
    'Se imprimen en la factura, se guardan en este navegador y nunca se envían a chit ni se le muestran a la otra parte. La mayoría de las facturas pequeñas solo necesitan un nombre, una dirección y una línea sobre impuestos.',
  'Your name or trading name': 'Tu nombre o nombre comercial',
  Address: 'Dirección',
  'Tax or VAT number, if you have one': 'NIF o número de IVA, si tienes',
  'Email or website': 'Correo o sitio web',
  'Tax line, if your country needs one': 'Línea fiscal, si tu país la exige',
  'e.g. VAT exempt under §19 UStG': 'p. ej. Operación exenta de IVA',
  'Save on this device': 'Guardar en este dispositivo',
  'Start another': 'Crear otro',
  Deliverables: 'Entregables',
  Due: 'Vence',
  passed: 'ya pasó',
  'in about {n} days': 'en unos {n} días',
  Deadline: 'Fecha límite',
  'block {n}': 'bloque {n}',
  'Agreed rate': 'Cambio acordado',
  'Actually received': 'Recibido realmente',
  'They sent {actual} — more than the {agreed} agreed. All of it is yours.':
    'Enviaron {actual}, más de los {agreed} acordados. Todo es tuyo.',
  'They sent {actual}, against {agreed} agreed. The rate moved between signing and paying; chit accepts a small difference so a payment is never stranded.':
    'Enviaron {actual}, frente a los {agreed} acordados. El cambio se movió entre la firma y el pago; chit acepta una pequeña diferencia para que ningún pago quede varado.',
  'Rate taken at': 'Cambio tomado en',
  'Chit id': 'ID del chit',

  /* ---- verify ---- */
  'Nothing to show': 'Nada que mostrar',
  'No chit has settled with that transaction. Check the link, or the payment may not have landed yet.':
    'Ningún chit se ha liquidado con esa transacción. Revisa el enlace, o puede que el pago aún no haya llegado.',
  'This is genuine': 'Esto es auténtico',
  'This does not check out': 'Esto no cuadra',
  'Verification failed': 'La verificación falló',
  'This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.':
    'Este chit es de la red de pruebas. Las firmas son reales, pero no se movió dinero real: el importe de abajo no se puede gastar.',
  'quote — paying accepted it': 'presupuesto: pagarlo lo aceptó',
  yes: 'sí',
  no: 'no',
  'On chain': 'En la cadena',
  'not yet': 'todavía no',
  'Checked in your browser, against the chain': 'Verificado en tu navegador, contra la cadena',
  'The chain disagrees with these words': 'La cadena contradice estas palabras',
  'Checked by chit’s server': 'Verificado por el servidor de chit',
  'Your browser’s own check': 'La verificación de tu propio navegador',
  'Digest in the payment': 'Resumen incluido en el pago',
  'matches these words': 'coincide con estas palabras',
  'does NOT match': 'NO coincide',
  'not the wallet the words name': 'no es la billetera que nombran las palabras',
  'Amount on chain': 'Importe en la cadena',
  Chain: 'Cadena',
  'could not be read from your browser just now': 'no se pudo leer desde tu navegador en este momento',
  'This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.':
    'Este enlace no lleva las palabras firmadas, así que el pago lo verificó el servidor de chit. Un enlace de la pantalla del comprobante sí las lleva y se verifica en tu navegador.',
  'Signatures checked by chit’s server.': 'Firmas verificadas por el servidor de chit.',
  'Show exactly what was signed': 'Mostrar exactamente qué se firmó',
  'Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.':
    'Cada línea de arriba fue firmada por las billeteras implicadas y anclada al pago. chit no escribió nada de esto.',
  'What is chit?': '¿Qué es chit?',

  /* ---- activity ---- */
  'Paid to you': 'Pagado a ti',
  '{n} chit': '{n} chit',
  '{n} chits': '{n} chits',
  'from {n} payer': 'de {n} pagador',
  'from {n} payers': 'de {n} pagadores',
  Kept: 'Te quedaste con',
  'a 20% marketplace cut': 'una comisión de plataforma del 20 %',
  'As a payer': 'Como pagador',
  'paid {n}': 'ha pagado {n}',
  '{n} awaiting': '{n} pendientes',
  'Waiting to be paid': 'Esperando cobro',
  'since yesterday': 'desde ayer',
  'for {n} days': 'desde hace {n} días',
  Nudge: 'Recordar',
  'Still open: “{line}” — {amount}. Here is the chit: {link}': 'Sigue abierto: «{line}» — {amount}. Aquí está el chit: {link}',
  'Nothing yet': 'Todavía nada',
  'Your first chit will appear here the moment it is signed.': 'Tu primer chit aparecerá aquí en cuanto se firme.',
  Declined: 'Rechazado',
  Quote: 'Presupuesto',
  'Signed — unpaid': 'Firmado, sin pagar',
  'Waiting for signature': 'Esperando firma',

  /* ---- about ---- */
  'What chit is': 'Qué es chit',
  'A receipt for a deal you already made. You paste the one line you agreed in a chat, both wallets sign it with Nimiq Pay, and the payment carries the agreement’s digest. The receipt is the contract, and anyone can check it against the chain.':
    'Un comprobante de un trato que ya cerraste. Pegas la única línea que acordaron en un chat, ambas billeteras la firman con Nimiq Pay, y el pago lleva el resumen del acuerdo. El comprobante es el contrato, y cualquiera puede verificarlo contra la cadena.',
  'What it never does': 'Lo que nunca hace',
  'Hold your money. Every payment goes straight from one wallet to the other; there is no balance and no withdrawal.':
    'Custodiar tu dinero. Cada pago va directo de una billetera a otra; no hay saldo ni retiradas.',
  'Take a cut. There is no fee. A NIM transaction is free and lands in about a second.':
    'Llevarse una comisión. No hay ninguna. Una transacción en NIM es gratis y llega en aproximadamente un segundo.',
  'Protect you. This is proof of payment, not escrow or a dispute service. Use it with clients you already talk to directly.':
    'Protegerte. Esto es una prueba de pago, no un depósito en garantía ni un servicio de disputas. Úsalo con clientes con los que ya hablas directamente.',
  'Ask for an account. There is no password, no code sent to your phone, no identity check — and so there is nothing to be locked out of. Your wallet is your identity; your record is computed from settled payments and nothing else.':
    'Pedirte una cuenta. No hay contraseña, ni código al teléfono, ni verificación de identidad, así que no hay nada de lo que puedan dejarte fuera. Tu billetera es tu identidad; tu historial se calcula solo a partir de pagos liquidados.',
  Reference: 'Referencia',
  'Give this to anyone who needs to check the payment.': 'Dáselo a quien necesite verificar el pago.',
  'Nothing is pending, nothing can be reversed, and nobody is holding it.':
    'No hay nada pendiente, nada se puede revertir y nadie lo custodia.',
  'You kept all of it. A 20% marketplace cut would have been {amount}.':
    'Te quedaste con todo. Una comisión de plataforma del 20 % habrían sido {amount}.',
  'chit never asks you to deposit, or to pay a fee to be paid. If anyone asks you to send money first, it is a scam — leave.':
    'chit nunca te pide un depósito ni una comisión para cobrar. Si alguien te pide que envíes dinero primero, es una estafa: vete.',
  'When something goes wrong': 'Cuando algo sale mal',
  'There is no support queue, because there is nothing for support to release. Everything that can go wrong has an answer you can act on yourself:':
    'No hay una cola de soporte, porque no hay nada que el soporte pueda liberar. Todo lo que puede salir mal tiene una respuesta que puedes aplicar tú:',
  'They signed and never paid. Nothing was lost — you were never owed anything until they paid. Their record now says one left unpaid, and anyone they send a chit to will see it.':
    'Firmaron y nunca pagaron. No se perdió nada: no se te debía nada hasta que pagaran. Su historial ahora dice que dejaron uno sin pagar, y todo el que reciba un chit suyo lo verá.',
  'You paid and the work never came. chit cannot reverse a payment; nobody can. Pay in smaller steps with someone new, and check their record before you sign.':
    'Pagaste y el trabajo nunca llegó. chit no puede revertir un pago; nadie puede. Con alguien nuevo, paga en pasos más pequeños y mira su historial antes de firmar.',
  'The payment is not showing. chit watches the chain itself, not the wallet — reopen the chit and it will catch up. If the transaction is on nimiq.watch, the money has moved.':
    'El pago no aparece. chit observa la cadena, no la billetera: vuelve a abrir el chit y se pondrá al día. Si la transacción está en nimiq.watch, el dinero ya se movió.',
  'You lost the link. Every chit your wallet signed is in Activity, on any device you connect the same wallet from.':
    'Perdiste el enlace. Todos los chits que firmó tu billetera están en Actividad, en cualquier dispositivo desde el que conectes esa misma billetera.',
  'chit disappears. The receipt link carries the signed words, and your browser checks them against a public Nimiq node. It works without us.':
    'chit desaparece. El enlace del comprobante lleva las palabras firmadas y tu navegador las verifica contra un nodo público de Nimiq. Funciona sin nosotros.',
  'How a receipt is checked': 'Cómo se verifica un comprobante',
  'The words are hashed; that hash is the 64-byte memo of the NIM payment. A receipt link carries the words, so your browser recomputes the hash and reads the transaction from a public Nimiq node — no chit server needed.':
    'Se calcula el hash de las palabras; ese hash es el mensaje de 64 bytes del pago en NIM. El enlace del comprobante lleva las palabras, así que tu navegador recalcula el hash y lee la transacción de un nodo público de Nimiq, sin ningún servidor de chit.',
  'The bounty': 'La recompensa',
  'chit pays real chits for a sentence of feedback, from a pool funded by the founder. The address, balance, rules and every payout are public.':
    'chit paga chits reales por una frase de opinión, desde un fondo financiado por el fundador. La dirección, el saldo, las reglas y cada pago son públicos.',
  'See the pool': 'Ver el fondo',
  'Open source under the MIT licence. Built for the Nimiq Mini Apps Competition, Cycle 2, 2026. Signatures are verified by chit’s server; payments by the Nimiq chain.':
    'Código abierto con licencia MIT. Creado para la Nimiq Mini Apps Competition, ciclo 2, 2026. Las firmas las verifica el servidor de chit; los pagos, la cadena de Nimiq.',
  'Nothing about you is stored until you sign something.': 'No se guarda nada sobre ti hasta que firmes algo.',

  /* ---- the balance hint, before the wallet sheet ---- */
  'Your wallet holds {have}. This needs {need} — {short} more. Top up and try again; nothing has been sent.':
    'Tu billetera tiene {have}. Esto necesita {need}: faltan {short}. Recárgala y vuelve a intentarlo; no se ha enviado nada.',

  /* ---- reviews ---- */
  '{n} out of 5': '{n} de 5',
  'For: {line}': 'Por: {line}',
  'What they said': 'Lo que dijeron',
  'What the other side said': 'Lo que dijo la otra parte',
  'Your rating': 'Tu valoración',
  'One line, if you want to add one': 'Una línea, si quieres añadirla',
  'One line, if you want to add one (optional)': 'Una línea, si quieres añadirla (opcional)',
  'How did it go?': '¿Qué tal fue?',
  'Sign this review': 'Firmar esta reseña',
  'Signed by your wallet over this payment, so it cannot be bought, faked or written by anyone else. It goes on their public record and it cannot be taken down — including by us.':
    'Firmada por tu billetera sobre este pago, así que no se puede comprar, falsificar ni escribir por nadie más. Va a su historial público y no se puede retirar, tampoco por nosotros.',
  '{n} review': '{n} reseña',
  '{n} reviews': '{n} reseñas',

  /* ---- the public record ---- */
  Record: 'Historial',
  'Your public record': 'Tu historial público',
  'Everything paid, as a spreadsheet': 'Todo lo cobrado, en una hoja de cálculo',
  'Their record': 'Su historial',
  'Nothing here yet': 'Aquí todavía no hay nada',
  'No settled work on this wallet': 'No hay trabajo liquidado en esta billetera',
  'The moment a chit you are part of is paid, it appears here — with the amount, the date, and anything either side said about it. Nothing on this page is written by you.':
    'En cuanto se pague un chit del que formes parte, aparecerá aquí: con el importe, la fecha y lo que cada parte haya dicho al respecto. Nada de esta página lo escribes tú.',
  'This wallet has not been paid through chit, and has not paid anyone. That is not a bad sign or a good one; it is a wallet with no record yet.':
    'A esta billetera no le han pagado por chit, y tampoco ha pagado a nadie. No es buena ni mala señal: es una billetera sin historial todavía.',
  'Write a chit': 'Escribir un chit',
  'Paid to this wallet': 'Pagado a esta billetera',
  '{n} job': '{n} trabajo',
  '{n} jobs': '{n} trabajos',
  'from {n} client': 'de {n} cliente',
  'from {n} clients': 'de {n} clientes',
  'First paid': 'Primer cobro',
  'As a client': 'Como cliente',
  'Settled work': 'Trabajo liquidado',
  'Send this to a client': 'Envíale esto a un cliente',
  'Share this record': 'Compartir este historial',
  'One link. It opens for anyone, with no account and no app, and every line on it can be checked against the chain.':
    'Un enlace. Se abre para cualquiera, sin cuenta y sin app, y cada línea se puede verificar contra la cadena.',
  'Every figure on this page is computed from payments on the Nimiq chain. Nobody can edit it — not the person it is about, and not chit.':
    'Cada cifra de esta página se calcula a partir de pagos en la cadena de Nimiq. Nadie puede editarla: ni la persona de la que habla, ni chit.',

  'The date on this has passed and it is still unpaid. Nothing is lost and nothing expired — it can still be paid. Send them a nudge, or write a new one at a number that works now.':
    'La fecha ya pasó y sigue sin pagarse. No se ha perdido nada ni ha caducado nada: todavía se puede pagar. Mándales un recordatorio, o escribe otro con una cifra que funcione ahora.',
  'The date on this has passed. It can still be signed and still be paid; if it no longer fits, write a new one instead of leaving this open.':
    'La fecha ya pasó. Todavía se puede firmar y pagar; si ya no encaja, escribe otro en lugar de dejar este abierto.',

  /* ---- agreements with no payment ---- */
  'Something changed?': '¿Cambió algo?',
  'What changed': 'Qué cambió',
  'e.g. one extra round of edits, same price': 'p. ej. una ronda extra de correcciones, mismo precio',
  'Sign the change': 'Firmar el cambio',
  'Call it off': 'Cancelarlo',
  'Called off by agreement — {line}': 'Cancelado de mutuo acuerdo — {line}',
  'Change agreed — {line}': 'Cambio acordado — {line}',
  'Write what you both agreed and sign it. It moves no money and does not alter the chit above — it is a second signed line pointing at it, so the record shows the change instead of the argument.':
    'Escribe lo que acordaron y fírmalo. No mueve dinero ni altera el chit de arriba: es una segunda línea firmada que apunta a él, para que el historial muestre el cambio en vez de la discusión.',
  'Or close it. A chit nobody will pay is worse left open — this records that you both called it off, with both names on it.':
    'O ciérralo. Un chit que nadie va a pagar es peor si queda abierto: esto deja constancia de que lo cancelaron los dos, con ambos nombres.',
  'Open the chit this answers': 'Abrir el chit al que responde',
  'Signed by': 'Firmado por',
  'And by': 'Y por',
  'Called off, by both of you': 'Cancelado, por los dos',
  'The change is on the record': 'El cambio queda registrado',
  'Both of you signed this. Nothing is owed and nothing is open — the original chit stays exactly as it was signed, with this beside it.':
    'Los dos lo firmaron. No se debe nada y no queda nada abierto: el chit original permanece exactamente como se firmó, con esto al lado.',
  'Both of you signed this. The original chit is untouched; this sits beside it, so what you agreed later is on the record too.':
    'Los dos lo firmaron. El chit original queda intacto; esto se coloca junto a él, para que lo acordado después también conste.',
  'Back to the chit': 'Volver al chit',
  'Nothing is being paid here. They open it, read the same words you signed, and sign too.':
    'Aquí no se paga nada. Lo abren, leen las mismas palabras que firmaste y firman también.',
  'Waiting for them to sign.': 'Esperando a que firmen.',
  'Calling this off': 'Cancelar esto',
  'A change to sign': 'Un cambio para firmar',
  'They want to call it off': 'Quieren cancelarlo',
  'They want to agree a change': 'Quieren acordar un cambio',
  'Signing this closes the job for both of you. No money moves, and nothing that was already paid is affected.':
    'Firmar esto cierra el trabajo para los dos. No se mueve dinero, y lo que ya se pagó no se ve afectado.',
  'Signing means you agree to these exact words as well. No money moves, and the chit this answers is not altered.':
    'Firmar significa que tú también aceptas exactamente estas palabras. No se mueve dinero, y el chit al que responde no se altera.',

  /* ---- what a wallet failure says to a person ---- */
  'You cancelled. Nothing was sent.': 'Cancelaste. No se envió nada.',
  'Your wallet returned a signature chit could not read. Please report this — it is our bug, not yours.':
    'Tu billetera devolvió una firma que chit no pudo leer. Repórtalo, por favor: el fallo es nuestro, no tuyo.',
  'Your wallet reported: {message}': 'Tu billetera informa: {message}',
  'Something went wrong. Nothing was signed and nothing was sent.': 'Algo salió mal. No se firmó ni se envió nada.',
  'Your wallet does not hold enough NIM for this. Top it up and try again — nothing was sent.':
    'Tu billetera no tiene suficientes NIM para esto. Recárgala y vuelve a intentarlo: no se envió nada.',
  'Your phone could not reach the network. Nothing was sent — check your connection and try again.':
    'Tu teléfono no pudo conectarse a la red. No se envió nada: revisa tu conexión y vuelve a intentarlo.',
  'Nimiq Pay is still catching up with the chain. Give it a few seconds and try again.':
    'Nimiq Pay todavía se está poniendo al día con la cadena. Dale unos segundos y vuelve a intentarlo.',
  'Your wallet is locked. Unlock Nimiq Pay and try again.': 'Tu billetera está bloqueada. Desbloquea Nimiq Pay y vuelve a intentarlo.',
  '{step} — Nimiq Pay did not answer. Open the wallet and try again.':
    '{step}: Nimiq Pay no respondió. Abre la billetera y vuelve a intentarlo.',
  'Checking sync': 'Comprobando la sincronización',
  'Sharing your address': 'Compartiendo tu dirección',
  Signing: 'Firmando',
  Paying: 'Pagando',
  'Reading the chain height': 'Leyendo la altura de la cadena',

  /* ---- errors ---- */
  'Nothing here': 'Aquí no hay nada',
  'That link does not point at anything in chit.': 'Ese enlace no apunta a nada dentro de chit.',
  'Not found': 'No encontrado',
  'Something broke': 'Algo se rompió',
  'chit hit an error it did not expect. Anything already signed is safe on the server, and anything paid is on chain.':
    'chit encontró un error inesperado. Todo lo ya firmado está a salvo en el servidor, y todo lo pagado está en la cadena.',
  'Test network — the signatures are real, the money is not.': 'Red de pruebas: las firmas son reales, el dinero no.',
  'Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.':
    'Modo demostración: las firmas de aquí son de muestra y no se verificarán. Ábrelo en Nimiq Pay para firmar de verdad.',
  'Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.':
    'Firmar y pagar ocurren en la app Nimiq Pay. Ábrelo allí: puede que Nimiq Pay te pida confirmación la primera vez.',
  'Your wallet is on the Nimiq test network, but this chit is for real NIM. Switch Nimiq Pay to mainnet and try again.':
    'Tu billetera está en la red de pruebas de Nimiq, pero este chit es de NIM reales. Cambia Nimiq Pay a la red principal y vuelve a intentarlo.',
  'Your wallet is on Nimiq mainnet, but this is a test-network chit. Switch Nimiq Pay to testnet and try again.':
    'Tu billetera está en la red principal de Nimiq, pero este chit es de la red de pruebas. Cambia Nimiq Pay a la red de pruebas y vuelve a intentarlo.',


  /* The board — finding work, and being found. */
  'Board': 'Tablón',
  'We could not read the chain just now, so we cannot say which chits are still open. Try again in a moment.': 'No hemos podido leer la cadena ahora mismo, así que no podemos decir qué chits siguen abiertos. Inténtalo dentro de un momento.',
  'logo, translation, video…': 'logo, traducción, vídeo…',
  'Search the board': 'Buscar en el tablón',
  'Search': 'Buscar',
  'Which side of the board': 'Qué lado del tablón',
  'Everything': 'Todo',
  'Work': 'Trabajos',
  'People': 'Personas',
  'Best match': 'Mejor coincidencia',
  'Newest': 'Más recientes',
  'Closing soon': 'Cierra pronto',
  'Highest paid': 'Mejor pagados',
  'Order': 'Orden',
  'New here': 'Nuevo aquí',
  'Offer': 'Oferta',
  'closing today': 'cierra hoy',
  '{n}d left': 'quedan {n} d',
  'Work with the money already on it, and people offering theirs. Open one to read the whole agreement before you sign anything.': 'Trabajos con el dinero ya puesto, y personas que ofrecen el suyo. Abre uno para leer el acuerdo completo antes de firmar nada.',
  'Nothing matches that.': 'No hay nada que coincida.',
  'The board is empty right now.': 'El tablón está vacío ahora mismo.',
  'Try a shorter word — or post what you need and let somebody come to you.': 'Prueba con una palabra más corta, o publica lo que necesitas y deja que alguien venga a ti.',
  'Post what you need, or what you can do, and it appears here.': 'Publica lo que necesitas, o lo que sabes hacer, y aparecerá aquí.',
  '{shown} of {total} open': '{shown} de {total} abiertos',
  'Show more': 'Mostrar más',
  '{n} done': '{n} hechos',
  '★{rating} · {n} done': '★{rating} · {n} hechos',


  /* Questions asked in public before anybody commits. */
  'Questions': 'Preguntas',
  'Asked in public, so the next person does not have to ask again.': 'Preguntado en público, para que la siguiente persona no tenga que preguntarlo otra vez.',
  'Answer it in one line': 'Responde en una línea',
  'Answer': 'Responder',
  'Not answered yet.': 'Todavía sin responder.',
  'Your question': 'Tu pregunta',
  'e.g. does this include the source files?': 'p. ej. ¿incluye los archivos originales?',
  'Ask in public': 'Preguntar en público',
  'Ask before you sign. Everyone can see the question and the answer — including you, later.': 'Pregunta antes de firmar. Todo el mundo ve la pregunta y la respuesta, tú incluido más adelante.',


  /* Portfolio pieces: paid for, and shown only with the client agreeing. */
  'Shown as work': 'Mostrado como trabajo',
  'Both of you signed this, so it is on the public record with the payment beside it.': 'Lo firmasteis los dos, así que está en el registro público con el pago al lado.',
  'Agree to show it': 'Aceptar que se muestre',
  'They would like to show this work': 'Quieren mostrar este trabajo',
  'It goes on their public record with what you paid beside it. Nothing is shown unless you agree.': 'Va a su registro público con lo que pagaste al lado. No se muestra nada sin tu permiso.',
  'Link to the work': 'Enlace al trabajo',
  'Update the offer': 'Actualizar la propuesta',
  'Offer it as a piece': 'Ofrecerlo como muestra',
  'Show this work': 'Mostrar este trabajo',
  'Offered. It is not public until they agree.': 'Propuesto. No es público hasta que acepten.',
  'Put it on your public record, with the payment beside it as proof somebody paid for it. Your client has to agree first.': 'Ponlo en tu registro público, con el pago al lado como prueba de que alguien pagó por ello. Tu cliente tiene que aceptar antes.',
  'Each piece was paid for, and the client agreed to it being shown.': 'Cada muestra fue pagada, y el cliente aceptó que se mostrara.',
  'Offer a different deal': 'Proponer otro trato',

  /* ---- full history, on the settled screen ---- */
  'Full history': 'Historial completo',
  Sent: 'Enviado',
  'A question was asked': 'Se hizo una pregunta',
  'The question was answered': 'Se respondió la pregunta',
  'Offered as a portfolio piece': 'Ofrecido como muestra',
  'Shown as a portfolio piece': 'Mostrado como muestra',
  Signed: 'Firmado',
  'Passed its deadline': 'Pasó la fecha límite',
  'A payment arrived that did not match': 'Llegó un pago que no coincidía',
  'Answered with a new chit': 'Respondido con un nuevo chit',
  'Marked delivered': 'Marcado como entregado',
  Reviewed: 'Reseñado',
  'Bounty opened': 'Recompensa abierta',
  'Bounty answered': 'Recompensa respondida',
  'Bounty paid': 'Recompensa pagada',
  'Bounty payout failed': 'El pago de la recompensa falló',

  /* ---- the rest of the series, on the settled screen ---- */
  'Part of a series': 'Parte de una serie',
  'See what this answers': 'Ver a qué responde esto',
  'What came after': 'Lo que vino después',

  /* ---- ask for changes, before deciding whether to pay ---- */
  'Not quite right?': '¿No quedó del todo bien?',
  'What needs to change': 'Qué hay que cambiar',
  'e.g. can you make the logo bigger?': 'p. ej. ¿puedes hacer el logo más grande?',
  'Ask for changes': 'Pedir cambios',
  'Sent — it is signed and on the record, and they will see it.': 'Enviado — está firmado y en el registro, y lo verán.',
  'Revision requested — {line}': 'Revisión solicitada — {line}',
  '{n} revision requested so far': '{n} revisión solicitada hasta ahora',
  '{n} revisions requested so far': '{n} revisiones solicitadas hasta ahora',
  'That is a real amount of extra work. A paid round is a fair way to ask for one.': 'Eso es bastante trabajo extra. Una ronda pagada es una forma justa de pedirla.',
  'Propose a paid revision': 'Proponer una revisión pagada',
  'Additional revision beyond what was agreed': 'Revisión adicional más allá de lo acordado',

  /* ---- a real PDF, since window.print() does not work inside the WebView ---- */
  'Download PDF': 'Descargar PDF',
  'Preparing the PDF…': 'Preparando el PDF…',
  'Could not build the PDF. Nothing was sent anywhere — try again.': 'No se pudo generar el PDF. No se envió nada — inténtalo de nuevo.',
  'Could not save the PDF. Nothing was sent anywhere — try again.': 'No se pudo guardar el PDF. No se envió nada — inténtalo de nuevo.',
  'Settled in NIM on the Nimiq blockchain. Anyone can verify this transaction against the reference above, with no account.': 'Liquidado en NIM en la cadena de bloques de Nimiq. Cualquiera puede verificar esta transacción con la referencia de arriba, sin cuenta.',
  'Settled in NIM on the Nimiq blockchain. This document was generated on your device; chit never saw the details above the line.': 'Liquidado en NIM en la cadena de bloques de Nimiq. Este documento se generó en tu dispositivo; chit nunca vio los datos de arriba.',

  /* ---- the weighted rating, next to the plain average ---- */
  'Weighted for recency and job size: {rating}': 'Ponderado por antigüedad y tamaño del trabajo: {rating}',
  'The average above treats every review the same, however old or however small the job. This one leans toward recent reviews and toward larger jobs — the same signed reviews, weighted rather than replaced.': 'El promedio de arriba trata cada reseña por igual, sin importar su antigüedad ni el tamaño del trabajo. Este número se inclina hacia las reseñas recientes y los trabajos más grandes — las mismas reseñas firmadas, ponderadas en lugar de sustituidas.',
};

export default es;
