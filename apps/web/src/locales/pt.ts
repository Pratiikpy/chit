/**
 * Portuguese.
 *
 * Written in Brazilian Portuguese and addressed as «você», the same register as the English
 * and German copy: one freelancer talking to another about money, not a bank writing to a
 * customer. Brazil is the deliberate choice rather than a compromise between the two
 * standards — it is by far the larger freelance market, the one where a feeless rail against
 * a 20% platform cut is worth the most, and a half-and-half register would read badly in both
 * countries. A Portuguese reader understands every sentence here.
 *
 * Product names are left alone: chit, Nimiq Pay, NIM.
 *
 * Keys are the English sentence, so a missing entry shows English rather than a key.
 * `apps/web/test/i18n.test.ts` reads every `t(…)` call in the source and fails if any of
 * them is unanswered here.
 */

import type { Dict } from '../i18n.ts';

const pt: Dict = {
  /* ---- chrome ---- */
  'chit home': 'Início do chit',
  Activity: 'Atividade',
  About: 'Sobre',
  'New chit': 'Novo chit',
  Bounty: 'Recompensa',
  Details: 'Detalhes',
  You: 'Você',
  Copy: 'Copiar',
  Copied: 'Copiado',
  Save: 'Salvar',
  Cancel: 'Cancelar',
  'Try again': 'Tentar de novo',
  'Start a chit': 'Criar um chit',
  'Start again': 'Começar de novo',
  'Not now': 'Agora não',
  Later: 'Depois',
  'Done for now': 'Por enquanto é isso',

  /* ---- home ---- */
  'Paste the deal. Get a receipt.': 'Cole o combinado. Receba um comprovante.',
  'For the clients you already talk to directly. They pay; you hold a receipt anyone can check. Proof of payment, not protection.':
    'Para os clientes com quem você já fala direto. Eles pagam; você fica com um comprovante que qualquer um pode conferir. Prova de pagamento, não proteção.',
  'I’m getting paid': 'Eu vou receber',
  'I’m paying': 'Eu vou pagar',
  'Which way the money goes': 'Para que lado vai o dinheiro',
  'You sign. Whoever pays this link has accepted it, and the NIM lands in your wallet.':
    'Você assina. Quem pagar este link aceitou, e os NIM caem na sua carteira.',
  'You sign, they sign, then you pay. The payment carries the proof.':
    'Você assina, a outra parte assina, e então você paga. O pagamento carrega a prova.',
  'The line you already agreed': 'A linha que vocês já combinaram',
  '$40 for 3 thumbnails by Friday': 'R$200 por 3 thumbnails até sexta',
  'Sign it': 'Assinar',
  'What we understood': 'Foi assim que entendemos',
  'Add an amount and a currency — "$40", "€120", "₹3500" — so both sides are agreeing to the same number. You can also tap any line above to set it yourself.':
    'Coloque um valor e uma moeda — «R$200», «$40», «€120» — para que os dois lados concordem com o mesmo número. Você também pode tocar em qualquer linha acima e definir você mesmo.',
  'Pricing it in NIM…': 'Convertendo para NIM…',
  'The words read as {a}, but the amount is set in {b}. Both sides sign the words — make sure they agree.':
    'O texto diz {a}, mas o valor está em {b}. Os dois lados assinam o texto — confira se batem.',
  'Waiting for your wallet…': 'Esperando a sua carteira…',
  'chit is not reachable': 'Não dá para acessar o chit',
  'In reply to': 'Em resposta a',
  '{amount} · this becomes a separate chit, and both of you sign it. The one above is untouched.':
    '{amount} · isso vira um chit à parte, que vocês dois assinam. O de cima fica intacto.',
  'Ask for a change': 'Propor uma mudança',
  'Ask for half up front': 'Pedir metade adiantado',
  'Half up front — {line}': 'Metade adiantado — {line}',
  'On delivery — {line}': 'Na entrega — {line}',
  'The other half': 'A outra metade',
  'Next step of this job': 'Próxima etapa deste trabalho',
  'How chit works': 'Como o chit funciona',

  /* ---- the editable rows ---- */
  Amount: 'Valor',
  Currency: 'Moeda',
  By: 'Até',
  'How many': 'Quantos',
  'In NIM': 'Em NIM',
  'not sure yet': 'ainda indefinido',
  today: 'hoje',
  tomorrow: 'amanhã',
  '3 days': '3 dias',
  'a week': 'uma semana',
  '2 weeks': '2 semanas',
  '{n} days': '{n} dias',
  '{label}: {value}. Tap to change.': '{label}: {value}. Toque para mudar.',
  'A whole number, please — this currency has no decimals.': 'Um número inteiro, por favor: esta moeda não tem centavos.',
  'That is not an amount chit can read. Try 40 or 40.50.': 'O chit não consegue ler esse valor. Tente 40 ou 40,50.',
  'Set it': 'Definir',

  /* ---- the bounty ---- */
  'Your first NIM · paid by chit': 'Seus primeiros NIM · pagos pelo chit',
  'Sign it with your answer and the pool pays your wallet in NIM. {n} open now.':
    'Assine com a sua resposta e o fundo paga a sua carteira em NIM. {n} abertas agora.',
  'Earn {amount} — test chit': 'Ganhe {amount} — teste o chit',
  'Your first NIM': 'Seus primeiros NIM',
  'Earn · paid by chit': 'Ganhe · pago pelo chit',
  'Your answer': 'Sua resposta',
  'One sentence, in your own words': 'Uma frase, com as suas palavras',
  'At least 4 words. No links. Something nobody has said yet.': 'Pelo menos 4 palavras. Sem links. Algo que ninguém disse ainda.',
  '{n} word': '{n} palavra',
  '{n} words': '{n} palavras',
  'Sign and get paid': 'Assinar e receber',
  'chit uses this to pay each device one bounty per day.': 'O chit usa isso para pagar uma recompensa por aparelho por dia.',
  'Signing is your answer. If it passes the rules — the same for everyone, no draw — the pool pays this amount to the wallet you sign with, and you hold a real receipt.':
    'Sua assinatura é a sua resposta. Se ela passar nas regras — iguais para todo mundo, sem sorteio — o fundo paga este valor para a carteira com que você assinar, e você fica com um comprovante de verdade.',
  'The rules and every payout': 'As regras e todos os pagamentos',
  'This deployment has no bounty pool.': 'Esta instalação não tem fundo de recompensas.',
  'chit pays real chits for a sentence of feedback. Everything about the pool is public: the address, the balance, the rules, and every payout with its transaction.':
    'O chit paga chits de verdade por uma frase de opinião. Tudo sobre o fundo é público: o endereço, o saldo, as regras e cada pagamento com sua transação.',
  Pool: 'Fundo',
  Balance: 'Saldo',
  unknown: 'desconhecido',
  'Paid today': 'Pago hoje',
  '{n} payout': '{n} pagamento',
  '{n} payouts': '{n} pagamentos',
  of: 'de',
  Status: 'Situação',
  'Being funded — nothing is offered until it can pay': 'Sendo abastecido: nada é oferecido enquanto não puder pagar',
  'Open now': 'Abertas agora',
  '{n} open': '{n} abertas',
  '{amount} each': '{amount} cada',
  'Take one': 'Pegar uma',
  'Every bounty is taken for now.': 'Por enquanto todas as recompensas estão pegas.',
  'The next one opens shortly.': 'A próxima abre em breve.',
  'The rules': 'As regras',
  'Every payout': 'Todos os pagamentos',
  'None yet.': 'Nenhum ainda.',
  'The first payout will appear here with its transaction.': 'O primeiro pagamento vai aparecer aqui com a sua transação.',
  'chit pays its own bounty from this pool. It never holds anyone else’s money. Funded by the founder; every payout above is on chain.':
    'O chit paga a própria recompensa a partir deste fundo. Ele nunca guarda o dinheiro de ninguém. Abastecido pelo fundador; cada pagamento acima está na blockchain.',

  /* ---- share and quote ---- */
  'Send this to them': 'Mande isto para a outra pessoa',
  'They open it, read the same words you signed, and sign in Nimiq Pay. No account, no email.':
    'Ela abre, lê exatamente as palavras que você assinou e assina no Nimiq Pay. Sem conta e sem e-mail.',
  'Nothing has been paid yet. You pay once they have signed — this screen will move on by itself.':
    'Ainda não foi pago nada. Você paga depois que a outra parte assinar: esta tela avança sozinha.',
  'Still waiting for their signature. You can close this — it is in your Activity.':
    'Ainda esperando a assinatura. Pode fechar: está na sua Atividade.',
  'No one to send it to? Try the demo worker': 'Ninguém para mandar? Teste com o profissional de demonstração',
  'Signing as the demo worker…': 'Assinando como o profissional de demonstração…',
  'Copy the link': 'Copiar o link',
  'Copy failed — select the link below': 'Não deu para copiar: selecione o link abaixo',
  'Send it': 'Enviar',
  'A chit to sign': 'Um chit para assinar',
  'A quote to pay': 'Um orçamento para pagar',
  'Open in Nimiq Pay': 'Abrir no Nimiq Pay',
  'Get Nimiq Pay': 'Instalar o Nimiq Pay',
  'Continue on your phone': 'Continue no celular',
  'Signing and paying happen in the Nimiq Pay app. Scan this with your phone’s camera, or open the link there.':
    'Assinar e pagar acontecem no app Nimiq Pay. Escaneie isto com a câmera do celular, ou abra o link por lá.',
  'Your quote': 'Seu orçamento',
  'Put this where the client is — the chat, your bio, a message. Paying it is accepting it.':
    'Coloque onde o cliente está: a conversa, a sua bio, uma mensagem. Pagar é aceitar.',
  'Whoever pays this first is your client. Nothing is held anywhere — the payment lands in your wallet, and this screen moves on when it does.':
    'Quem pagar primeiro é o seu cliente. Nada fica retido em lugar nenhum: o pagamento cai na sua carteira, e esta tela avança quando isso acontecer.',
  'No payment yet. Leave the link where clients can see it — it is in your Activity.':
    'Ainda sem pagamento. Deixe o link onde os clientes vejam: ele está na sua Atividade.',
  'A quote for you': 'Um orçamento para você',
  'Pay {amount} in NIM': 'Pagar {amount} em NIM',
  'Paying this accepts these exact words. The money goes straight to the wallet that signed the quote — nothing is held on the way.':
    'Pagar aceita exatamente estas palavras. O dinheiro vai direto para a carteira que assinou o orçamento: nada fica retido no caminho.',
  'This wallet has not been paid through chit before.': 'Esta carteira nunca recebeu pelo chit.',
  'Paid {n} time': 'Recebeu {n} vez',
  'Paid {n} times': 'Recebeu {n} vezes',
  'by {n} client': 'de {n} cliente',
  'by {n} clients': 'de {n} clientes',

  /* ---- countersign ---- */
  'Someone wants to agree this with you': 'Alguém quer combinar isto com você',
  'You would be paid': 'Você receberia',
  'Signing means you agree to these exact words. It does not move any money — they pay after you sign, and the payment goes to the wallet you sign with.':
    'Assinar quer dizer que você concorda com exatamente estas palavras. Não move dinheiro nenhum: o pagamento vem depois da sua assinatura, para a carteira com que você assinar.',
  Decline: 'Recusar',
  'Declining…': 'Recusando…',
  'They declined': 'Foi recusado',
  'You declined': 'Você recusou',
  'They chose not to sign these words. Nothing was paid. Change the line and send a new one.':
    'A outra parte preferiu não assinar estas palavras. Nada foi pago. Mude a linha e mande outra.',
  'You chose not to sign. Nothing was paid, and nothing more will happen with this link.':
    'Você preferiu não assinar. Nada foi pago, e nada mais vai acontecer com este link.',
  'Send a new one': 'Mandar outro',
  'Could not load this wallet’s record.': 'Não deu para carregar o histórico desta carteira.',
  'First chit from this wallet · {amount} attached': 'Primeiro chit desta carteira · {amount} anexados',
  'Paid {n} chit': 'Pagou {n} chit',
  'Paid {n} chits': 'Pagou {n} chits',
  'usually within {d}': 'em geral em {d}',
  'none left unpaid': 'nenhum ficou sem pagar',
  '{n} left unpaid': '{n} ficaram sem pagar',
  'a minute': 'um minuto',
  minutes: 'minutos',
  hours: 'horas',
  days: 'dias',

  /* ---- people ---- */
  From: 'De',
  'Quoted by': 'Orçado por',
  'Goes to': 'Vai para',
  Wallet: 'Carteira',
  'Name this wallet': 'Dar um nome a esta carteira',
  Rename: 'Renomear',
  'A name for this wallet, kept on this device': 'Um nome para esta carteira, guardado neste aparelho',
  'e.g. Acme Studio': 'ex.: Estúdio Acme',
  'Only on this device. Never sent anywhere, never shown to anyone else.':
    'Só neste aparelho. Nunca é enviado para lugar nenhum nem mostrado a mais ninguém.',

  /* ---- pay ---- */
  'They signed. Time to pay.': 'Assinaram. Hora de pagar.',
  'Waiting for their signature before there is anywhere to send this.':
    'Esperando a assinatura; até lá não há para onde mandar isto.',
  'The exact NIM is priced when you tap Pay, so the agreed amount stays whole. It goes straight to their wallet — nothing is held on the way, and a payment cannot be reversed.':
    'O valor exato em NIM é calculado quando você toca em Pagar, para o valor combinado ficar inteiro. Vai direto para a carteira da outra parte: nada fica retido no caminho, e um pagamento não pode ser desfeito.',
  'No NIM yet?': 'Ainda sem NIM?',
  'NIM is the coin this pays in. Nimiq Pay holds it but does not sell it. The Nimiq Wallet at wallet.nimiq.com sells NIM by card or bank transfer in many countries — fees 1–4%, a few dollars minimum, availability depends on where you are — and you then send it to your Nimiq Pay address.':
    'NIM é a moeda usada aqui. O Nimiq Pay guarda, mas não vende. A Nimiq Wallet em wallet.nimiq.com vende NIM por cartão ou transferência em vários países — taxas de 1 a 4 %, mínimo de alguns dólares, a disponibilidade depende de onde você está — e daí você envia para o seu endereço do Nimiq Pay.',
  'Or earn your first NIM here: the bounty on the home screen pays a real chit for one sentence of feedback.':
    'Ou ganhe seus primeiros NIM aqui: a recompensa na tela inicial paga um chit de verdade por uma frase de opinião.',
  'Turning NIM into money': 'Transformar NIM em dinheiro',
  'One rule that saves money: ': 'Uma regra que economiza dinheiro: ',
  'send NIM to an exchange, never withdraw NIM from one. Sell it there and withdraw the stablecoin instead — withdrawing NIM itself can cost a large share of a small balance.':
    'mande NIM para uma corretora, mas nunca saque NIM de uma. Venda lá e saque a stablecoin: sacar NIM pode custar boa parte de um saldo pequeno.',
  'The NIM is in your Nimiq Pay wallet now, and it is yours — nothing is held by chit. To turn it into your own currency, send it to an exchange that lists NIM and sell it there, or use the Nimiq Wallet’s swap into USDC or USDT and cash out from that. Which of these is open to you depends on your country; chit does not sell or swap anything itself.':
    'Os NIM já estão na sua carteira do Nimiq Pay e são seus: o chit não guarda nada. Para virar a sua moeda, mande para uma corretora que liste NIM e venda lá, ou use o swap da Nimiq Wallet para USDC ou USDT e saque a partir disso. O que está disponível para você depende do seu país; o chit não vende nem troca nada.',
  'Many freelancers simply keep it: the next chit you pay a collaborator, or the next tool you buy, can be paid in NIM directly.':
    'Muitos freelancers simplesmente guardam: o próximo chit que você pagar a um parceiro, ou a próxima ferramenta que comprar, pode ser pago em NIM direto.',
  'The rate moved since this was signed. Keeping the agreed {amount} whole is now {nim}.':
    'A cotação mudou desde a assinatura. Para os {amount} combinados ficarem inteiros, agora são {nim}.',
  'Sent. Watching the chain…': 'Enviado. Observando a blockchain…',
  'Your payment was sent. It has not appeared on chain yet — that is unusual but not lost. Check again in a moment.':
    'Seu pagamento foi enviado. Ainda não apareceu na blockchain: é incomum, mas não está perdido. Confira de novo daqui a pouco.',
  'Check again': 'Conferir de novo',
  'Signed by the demo worker — a labelled stand-in so you can see the whole flow. It keeps whatever you pay it.':
    'Assinado pelo profissional de demonstração: um substituto identificado para você ver o fluxo inteiro. Ele fica com o que você pagar.',
  'You signed. They can pay now — when it lands you will have a receipt anyone can check, and this screen will move on by itself.':
    'Você assinou. Já podem pagar: quando cair, você terá um comprovante que qualquer um pode conferir, e esta tela avança sozinha.',
  'Both parties have signed. Waiting for the payment to land.': 'Os dois lados assinaram. Esperando o pagamento cair.',
  'Still waiting on their payment. Nothing is wrong — it is in your Activity, and you can come back any time.':
    'Ainda esperando o pagamento. Está tudo certo: ele está na sua Atividade e você pode voltar quando quiser.',
  'You signed it': 'Você assinou',
  'Both signed': 'Os dois assinaram',
  'You marked it delivered': 'Você marcou como entregue',
  'They marked it delivered': 'Foi marcado como entregue',
  'Signed by the wallet being paid, on {when}. It is a record, not a receipt — nothing has been paid because of it.':
    'Assinado pela carteira que vai receber, em {when}. É um registro, não um comprovante: por si só não pagou nada.',
  'Open the delivery': 'Abrir a entrega',
  'Say it is delivered': 'Marcar como entregue',
  'A link to the work': 'Um link para o trabalho',
  'https://… (optional)': 'https://… (opcional)',
  'One line about it': 'Uma linha sobre isso',
  'One line about it (optional)': 'Uma linha sobre isso (opcional)',
  'Mark it delivered': 'Marcar como entregue',
  'Signs one line with your wallet saying you handed the work over. It moves no money and obliges nobody to pay — it is a record, and the other side can see it.':
    'Assina com a sua carteira uma linha dizendo que você entregou o trabalho. Não move dinheiro nem obriga ninguém a pagar: é um registro, e a outra parte vê.',
  'Marked delivered on {when}': 'Marcado como entregue em {when}',
  'Check now': 'Conferir agora',

  /* ---- receipt ---- */
  'Paid on': 'Pago em',
  Block: 'Bloco',
  Transaction: 'Transação',
  'View on nimiq.watch': 'Ver no nimiq.watch',
  'Paid by': 'Pago por',
  'Paid to': 'Pago para',
  'You were paid': 'Você recebeu',
  Paid: 'Pago',
  'Settled on chain': 'Liquidado na blockchain',
  'Paid after the deadline': 'Pago depois do prazo',
  'A bounty, paid by chit for your answer: “{answer}”': 'Uma recompensa, paga pelo chit pela sua resposta: «{answer}»',
  'That is yours. This receipt is the agreement — anyone can check it against the chain, with no account.':
    'Isso é seu. Este comprovante é o acordo: qualquer um pode conferir na blockchain, sem conta nenhuma.',
  'This receipt is the agreement. Anyone can check it against the chain, with no account.':
    'Este comprovante é o acordo. Qualquer um pode conferir na blockchain, sem conta nenhuma.',
  'Open the receipt': 'Abrir o comprovante',
  'Same again': 'Outro igual',
  'Worth {worth} at the moment it was paid.': 'Valia {worth} no momento do pagamento.',
  'Agreed at {agreed}; worth {worth} at the moment it was paid.': 'Combinado em {agreed}; valia {worth} no momento do pagamento.',
  'Rate {rate} {currency} per NIM, from {source}, {when}.': 'Cotação: {rate} {currency} por NIM, segundo {source}, {when}.',
  Invoice: 'Nota',
  'Your invoice details': 'Seus dados de faturamento',
  'Add your details to the invoice': 'Coloque seus dados na nota',
  'Printed on the invoice, kept in this browser, and never sent to chit or shown to the other side. Most small invoices need only a name, an address and a line about tax.':
    'Aparecem na nota, ficam guardados neste navegador e nunca são enviados ao chit nem mostrados à outra parte. A maioria das notas pequenas só precisa de nome, endereço e uma linha sobre impostos.',
  'Your name or trading name': 'Seu nome ou nome da empresa',
  Address: 'Endereço',
  'Tax or VAT number, if you have one': 'CPF ou CNPJ, se tiver',
  'Email or website': 'E-mail ou site',
  'Tax line, if your country needs one': 'Linha fiscal, se o seu país exigir',
  'e.g. VAT exempt under §19 UStG': 'ex.: Optante pelo Simples Nacional',
  'Save on this device': 'Salvar neste aparelho',
  'Print / save as PDF': 'Imprimir / salvar em PDF',
  'Start another': 'Criar outro',
  Deliverables: 'Entregas',
  Due: 'Prazo',
  passed: 'já passou',
  'in about {n} days': 'em cerca de {n} dias',
  Deadline: 'Data limite',
  'block {n}': 'bloco {n}',
  'Agreed rate': 'Cotação combinada',
  'Actually received': 'Recebido de fato',
  'They sent {actual} — more than the {agreed} agreed. All of it is yours.':
    'Mandaram {actual}, mais que os {agreed} combinados. Tudo é seu.',
  'They sent {actual}, against {agreed} agreed. The rate moved between signing and paying; chit accepts a small difference so a payment is never stranded.':
    'Mandaram {actual}, contra {agreed} combinados. A cotação mudou entre a assinatura e o pagamento; o chit aceita uma pequena diferença para nenhum pagamento ficar travado.',
  'Rate taken at': 'Cotação registrada em',
  'Chit id': 'ID do chit',

  /* ---- verify ---- */
  'Nothing to show': 'Nada para mostrar',
  'No chit has settled with that transaction. Check the link, or the payment may not have landed yet.':
    'Nenhum chit foi liquidado com essa transação. Confira o link, ou o pagamento talvez ainda não tenha caído.',
  'This is genuine': 'Isto é autêntico',
  'This does not check out': 'Isto não confere',
  'Verification failed': 'A verificação falhou',
  'This is a test-network chit. The signatures are real, but no real money moved — the amount below is not spendable.':
    'Este chit é da rede de testes. As assinaturas são reais, mas nenhum dinheiro real se moveu: o valor abaixo não pode ser gasto.',
  'quote — paying accepted it': 'orçamento — pagar aceitou',
  yes: 'sim',
  no: 'não',
  'On chain': 'Na blockchain',
  'not yet': 'ainda não',
  'Checked in your browser, against the chain': 'Conferido no seu navegador, contra a blockchain',
  'The chain disagrees with these words': 'A blockchain contradiz estas palavras',
  'Checked by chit’s server': 'Conferido pelo servidor do chit',
  'Your browser’s own check': 'A conferência do seu próprio navegador',
  'Digest in the payment': 'Resumo contido no pagamento',
  'matches these words': 'confere com estas palavras',
  'does NOT match': 'NÃO confere',
  'not the wallet the words name': 'não é a carteira que as palavras indicam',
  'Amount on chain': 'Valor na blockchain',
  Chain: 'Rede',
  'could not be read from your browser just now': 'não deu para ler do seu navegador agora',
  'This link does not carry the signed words, so the payment was checked by chit’s server. A link from the receipt screen carries them and is checked in your browser.':
    'Este link não carrega as palavras assinadas, então o pagamento foi conferido pelo servidor do chit. Um link da tela do comprovante carrega as palavras e é conferido no seu navegador.',
  'Signatures checked by chit’s server.': 'Assinaturas conferidas pelo servidor do chit.',
  'Show exactly what was signed': 'Mostrar exatamente o que foi assinado',
  'Every line above was signed by the wallets involved and anchored to the payment. Nothing here was typed by chit.':
    'Cada linha acima foi assinada pelas carteiras envolvidas e amarrada ao pagamento. O chit não escreveu nada disto.',
  'What is chit?': 'O que é o chit?',

  /* ---- activity ---- */
  'Paid to you': 'Pago a você',
  '{n} chit': '{n} chit',
  '{n} chits': '{n} chits',
  'from {n} payer': 'de {n} pagador',
  'from {n} payers': 'de {n} pagadores',
  Kept: 'Você ficou com',
  'a 20% marketplace cut': 'uma comissão de plataforma de 20 %',
  'As a payer': 'Como pagador',
  'paid {n}': 'pagou {n}',
  '{n} awaiting': '{n} pendentes',
  'Waiting to be paid': 'Esperando pagamento',
  'since yesterday': 'desde ontem',
  'for {n} days': 'há {n} dias',
  Nudge: 'Cobrar',
  'Still open: “{line}” — {amount}. Here is the chit: {link}': 'Ainda aberto: «{line}» — {amount}. Aqui está o chit: {link}',
  'Nothing yet': 'Ainda nada',
  'Your first chit will appear here the moment it is signed.': 'Seu primeiro chit aparece aqui assim que for assinado.',
  Declined: 'Recusado',
  Quote: 'Orçamento',
  'Signed — unpaid': 'Assinado, sem pagar',
  'Waiting for signature': 'Esperando assinatura',

  /* ---- about ---- */
  'What chit is': 'O que é o chit',
  'A receipt for a deal you already made. You paste the one line you agreed in a chat, both wallets sign it with Nimiq Pay, and the payment carries the agreement’s digest. The receipt is the contract, and anyone can check it against the chain.':
    'Um comprovante de um acordo que você já fechou. Você cola a única linha que combinaram na conversa, as duas carteiras assinam com o Nimiq Pay, e o pagamento carrega o resumo do acordo. O comprovante é o contrato, e qualquer um pode conferir na blockchain.',
  'What it never does': 'O que ele nunca faz',
  'Hold your money. Every payment goes straight from one wallet to the other; there is no balance and no withdrawal.':
    'Guardar o seu dinheiro. Cada pagamento vai direto de uma carteira para a outra; não existe saldo nem saque.',
  'Take a cut. There is no fee. A NIM transaction is free and lands in about a second.':
    'Ficar com uma parte. Não há taxa nenhuma. Uma transação em NIM é gratuita e cai em cerca de um segundo.',
  'Protect you. This is proof of payment, not escrow or a dispute service. Use it with clients you already talk to directly.':
    'Proteger você. Isto é prova de pagamento, não custódia nem serviço de disputa. Use com clientes com quem você já fala direto.',
  'Ask for an account. There is no password, no code sent to your phone, no identity check — and so there is nothing to be locked out of. Your wallet is your identity; your record is computed from settled payments and nothing else.':
    'Pedir uma conta. Não tem senha, nem código no celular, nem verificação de identidade — logo, não há de onde te barrarem. Sua carteira é a sua identidade; seu histórico é calculado só a partir de pagamentos liquidados.',
  Reference: 'Referência',
  'Give this to anyone who needs to check the payment.': 'Passe isto para quem precisar conferir o pagamento.',
  'Nothing is pending, nothing can be reversed, and nobody is holding it.':
    'Nada está pendente, nada pode ser revertido e ninguém está segurando.',
  'You kept all of it. A 20% marketplace cut would have been {amount}.':
    'Você ficou com tudo. Uma comissão de plataforma de 20 % teria sido {amount}.',
  'chit never asks you to deposit, or to pay a fee to be paid. If anyone asks you to send money first, it is a scam — leave.':
    'O chit nunca pede depósito nem taxa para você receber. Se alguém pedir que você mande dinheiro primeiro, é golpe: saia.',
  'When something goes wrong': 'Quando algo dá errado',
  'There is no support queue, because there is nothing for support to release. Everything that can go wrong has an answer you can act on yourself:':
    'Não existe fila de suporte, porque não há nada que o suporte possa liberar. Tudo que pode dar errado tem uma resposta que você mesmo pode aplicar:',
  'They signed and never paid. Nothing was lost — you were never owed anything until they paid. Their record now says one left unpaid, and anyone they send a chit to will see it.':
    'Assinaram e nunca pagaram. Nada se perdeu: nada era devido a você até o pagamento. O histórico dessa carteira agora diz que um ficou sem pagar, e quem receber um chit dela vai ver.',
  'You paid and the work never came. chit cannot reverse a payment; nobody can. Pay in smaller steps with someone new, and check their record before you sign.':
    'Você pagou e o trabalho nunca veio. O chit não pode reverter um pagamento; ninguém pode. Com alguém novo, pague em etapas menores e veja o histórico antes de assinar.',
  'The payment is not showing. chit watches the chain itself, not the wallet — reopen the chit and it will catch up. If the transaction is on nimiq.watch, the money has moved.':
    'O pagamento não aparece. O chit observa a blockchain, não a carteira: abra o chit de novo e ele se atualiza. Se a transação está no nimiq.watch, o dinheiro já saiu.',
  'You lost the link. Every chit your wallet signed is in Activity, on any device you connect the same wallet from.':
    'Você perdeu o link. Todo chit que a sua carteira assinou está na Atividade, em qualquer aparelho onde você conectar a mesma carteira.',
  'chit disappears. The receipt link carries the signed words, and your browser checks them against a public Nimiq node. It works without us.':
    'O chit some. O link do comprovante carrega as palavras assinadas, e o seu navegador confere contra um nó público da Nimiq. Funciona sem a gente.',
  'How a receipt is checked': 'Como um comprovante é conferido',
  'The words are hashed; that hash is the 64-byte memo of the NIM payment. A receipt link carries the words, so your browser recomputes the hash and reads the transaction from a public Nimiq node — no chit server needed.':
    'As palavras viram um hash; esse hash é a mensagem de 64 bytes do pagamento em NIM. O link do comprovante carrega as palavras, então o seu navegador recalcula o hash e lê a transação de um nó público da Nimiq — sem precisar de servidor do chit.',
  'The bounty': 'A recompensa',
  'chit pays real chits for a sentence of feedback, from a pool funded by the founder. The address, balance, rules and every payout are public.':
    'O chit paga chits de verdade por uma frase de opinião, com um fundo abastecido pelo fundador. O endereço, o saldo, as regras e cada pagamento são públicos.',
  'See the pool': 'Ver o fundo',
  'Open source under the MIT licence. Built for the Nimiq Mini Apps Competition, Cycle 2, 2026. Signatures are verified by chit’s server; payments by the Nimiq chain.':
    'Código aberto sob licença MIT. Feito para a Nimiq Mini Apps Competition, ciclo 2, 2026. As assinaturas são verificadas pelo servidor do chit; os pagamentos, pela blockchain da Nimiq.',
  'Nothing about you is stored until you sign something.': 'Nada sobre você é guardado até que você assine algo.',

  /* ---- the balance hint, before the wallet sheet ---- */
  'Your wallet holds {have}. This needs {need} — {short} more. Top up and try again; nothing has been sent.':
    'Sua carteira tem {have}. Isto precisa de {need}: faltam {short}. Recarregue e tente de novo; nada foi enviado.',

  /* ---- reviews ---- */
  '{n} out of 5': '{n} de 5',
  'For: {line}': 'Por: {line}',
  'What they said': 'O que disseram',
  'What the other side said': 'O que a outra parte disse',
  'Your rating': 'Sua avaliação',
  'One line, if you want to add one': 'Uma linha, se quiser acrescentar',
  'One line, if you want to add one (optional)': 'Uma linha, se quiser acrescentar (opcional)',
  'How did it go?': 'Como foi?',
  'Sign this review': 'Assinar esta avaliação',
  'Signed by your wallet over this payment, so it cannot be bought, faked or written by anyone else. It goes on their public record and it cannot be taken down — including by us.':
    'Assinada pela sua carteira sobre este pagamento, então não dá para comprar, falsificar nem escrever no lugar de outra pessoa. Ela entra no histórico público da outra parte e não pode ser removida, nem por nós.',
  '{n} review': '{n} avaliação',
  '{n} reviews': '{n} avaliações',

  /* ---- the public record ---- */
  Record: 'Histórico',
  'Your public record': 'Seu histórico público',
  'Everything paid, as a spreadsheet': 'Tudo que foi pago, em planilha',
  'Their record': 'O histórico dela',
  'Nothing here yet': 'Ainda não há nada aqui',
  'No settled work on this wallet': 'Nenhum trabalho liquidado nesta carteira',
  'The moment a chit you are part of is paid, it appears here — with the amount, the date, and anything either side said about it. Nothing on this page is written by you.':
    'Assim que um chit do qual você faz parte for pago, ele aparece aqui: com o valor, a data e o que cada lado disse a respeito. Nada nesta página é escrito por você.',
  'This wallet has not been paid through chit, and has not paid anyone. That is not a bad sign or a good one; it is a wallet with no record yet.':
    'Esta carteira não recebeu pelo chit e também não pagou ninguém. Não é sinal bom nem ruim: é uma carteira ainda sem histórico.',
  'Write a chit': 'Escrever um chit',
  'Paid to this wallet': 'Pago a esta carteira',
  '{n} job': '{n} trabalho',
  '{n} jobs': '{n} trabalhos',
  'from {n} client': 'de {n} cliente',
  'from {n} clients': 'de {n} clientes',
  'First paid': 'Primeiro pagamento',
  'As a client': 'Como cliente',
  'Settled work': 'Trabalhos liquidados',
  'Send this to a client': 'Mande isto para um cliente',
  'Share this record': 'Compartilhar este histórico',
  'One link. It opens for anyone, with no account and no app, and every line on it can be checked against the chain.':
    'Um link. Ele abre para qualquer pessoa, sem conta e sem app, e cada linha pode ser conferida na blockchain.',
  'Every figure on this page is computed from payments on the Nimiq chain. Nobody can edit it — not the person it is about, and not chit.':
    'Cada número desta página é calculado a partir de pagamentos na blockchain da Nimiq. Ninguém pode editar: nem a pessoa de quem se trata, nem o chit.',

  'The date on this has passed and it is still unpaid. Nothing is lost and nothing expired — it can still be paid. Send them a nudge, or write a new one at a number that works now.':
    'A data já passou e continua sem pagamento. Nada se perdeu e nada venceu: ainda dá para pagar. Mande uma cobrança, ou escreva outro com um valor que funcione agora.',
  'The date on this has passed. It can still be signed and still be paid; if it no longer fits, write a new one instead of leaving this open.':
    'A data já passou. Ainda dá para assinar e para pagar; se não serve mais, escreva outro em vez de deixar este aberto.',

  /* ---- agreements with no payment ---- */
  'Something changed?': 'Mudou alguma coisa?',
  'What changed': 'O que mudou',
  'e.g. one extra round of edits, same price': 'ex.: mais uma rodada de ajustes, mesmo preço',
  'Sign the change': 'Assinar a mudança',
  'Call it off': 'Cancelar',
  'Called off by agreement — {line}': 'Cancelado de comum acordo — {line}',
  'Change agreed — {line}': 'Mudança combinada — {line}',
  'Write what you both agreed and sign it. It moves no money and does not alter the chit above — it is a second signed line pointing at it, so the record shows the change instead of the argument.':
    'Escreva o que vocês combinaram e assine. Não move dinheiro nem altera o chit acima: é uma segunda linha assinada que aponta para ele, para o histórico mostrar a mudança em vez da discussão.',
  'Or close it. A chit nobody will pay is worse left open — this records that you both called it off, with both names on it.':
    'Ou encerre. Um chit que ninguém vai pagar é pior se ficar aberto: isto registra que vocês dois cancelaram, com os dois nomes.',
  'Open the chit this answers': 'Abrir o chit ao qual isto responde',
  'Signed by': 'Assinado por',
  'And by': 'E por',
  'Called off, by both of you': 'Cancelado, pelos dois',
  'The change is on the record': 'A mudança está registrada',
  'Both of you signed this. Nothing is owed and nothing is open — the original chit stays exactly as it was signed, with this beside it.':
    'Vocês dois assinaram. Nada é devido e nada fica aberto: o chit original continua exatamente como foi assinado, com isto ao lado.',
  'Both of you signed this. The original chit is untouched; this sits beside it, so what you agreed later is on the record too.':
    'Vocês dois assinaram. O chit original fica intacto; isto fica ao lado, para o que vocês combinaram depois também constar.',
  'Back to the chit': 'Voltar ao chit',
  'Nothing is being paid here. They open it, read the same words you signed, and sign too.':
    'Aqui não se paga nada. A outra parte abre, lê exatamente as palavras que você assinou e assina também.',
  'Waiting for them to sign.': 'Esperando a assinatura.',
  'Calling this off': 'Cancelar isto',
  'A change to sign': 'Uma mudança para assinar',
  'They want to call it off': 'Querem cancelar',
  'They want to agree a change': 'Querem combinar uma mudança',
  'Signing this closes the job for both of you. No money moves, and nothing that was already paid is affected.':
    'Assinar encerra o trabalho para vocês dois. Nenhum dinheiro se move, e o que já foi pago não é afetado.',
  'Signing means you agree to these exact words as well. No money moves, and the chit this answers is not altered.':
    'Assinar quer dizer que você também concorda com exatamente estas palavras. Nenhum dinheiro se move, e o chit ao qual isto responde não é alterado.',

  /* ---- what a wallet failure says to a person ---- */
  'You cancelled. Nothing was sent.': 'Você cancelou. Nada foi enviado.',
  'Your wallet returned a signature chit could not read. Please report this — it is our bug, not yours.':
    'Sua carteira devolveu uma assinatura que o chit não conseguiu ler. Por favor, avise: o erro é nosso, não seu.',
  'Your wallet reported: {message}': 'Sua carteira informa: {message}',
  'Something went wrong. Nothing was signed and nothing was sent.': 'Algo deu errado. Nada foi assinado nem enviado.',
  'Your wallet does not hold enough NIM for this. Top it up and try again — nothing was sent.':
    'Sua carteira não tem NIM suficientes para isto. Recarregue e tente de novo: nada foi enviado.',
  'Your phone could not reach the network. Nothing was sent — check your connection and try again.':
    'Seu celular não conseguiu alcançar a rede. Nada foi enviado: confira a conexão e tente de novo.',
  'Nimiq Pay is still catching up with the chain. Give it a few seconds and try again.':
    'O Nimiq Pay ainda está se sincronizando com a blockchain. Espere alguns segundos e tente de novo.',
  'Your wallet is locked. Unlock Nimiq Pay and try again.': 'Sua carteira está bloqueada. Desbloqueie o Nimiq Pay e tente de novo.',
  '{step} — Nimiq Pay did not answer. Open the wallet and try again.':
    '{step} — o Nimiq Pay não respondeu. Abra a carteira e tente de novo.',
  'Checking sync': 'Verificando a sincronização',
  'Sharing your address': 'Compartilhando seu endereço',
  Signing: 'Assinando',
  Paying: 'Pagando',
  'Reading the chain height': 'Lendo a altura da blockchain',

  /* ---- errors ---- */
  'Nothing here': 'Não há nada aqui',
  'That link does not point at anything in chit.': 'Esse link não aponta para nada dentro do chit.',
  'Not found': 'Não encontrado',
  'Something broke': 'Alguma coisa quebrou',
  'chit hit an error it did not expect. Anything already signed is safe on the server, and anything paid is on chain.':
    'O chit encontrou um erro inesperado. Tudo que já foi assinado está seguro no servidor, e tudo que foi pago está na blockchain.',
  'Test network — the signatures are real, the money is not.': 'Rede de testes: as assinaturas são reais, o dinheiro não.',
  'Demo mode — signatures here are for show and will not verify. Open in Nimiq Pay to sign for real.':
    'Modo demonstração: as assinaturas aqui são só para mostrar e não serão verificadas. Abra no Nimiq Pay para assinar de verdade.',
  'Signing and paying happen in the Nimiq Pay app. Open this there — Nimiq Pay may ask you to confirm the first time.':
    'Assinar e pagar acontecem no app Nimiq Pay. Abra isto por lá: o Nimiq Pay pode pedir confirmação na primeira vez.',
  'Your wallet is on the Nimiq test network, but this chit is for real NIM. Switch Nimiq Pay to mainnet and try again.':
    'Sua carteira está na rede de testes da Nimiq, mas este chit é de NIM reais. Mude o Nimiq Pay para a rede principal e tente de novo.',
  'Your wallet is on Nimiq mainnet, but this is a test-network chit. Switch Nimiq Pay to testnet and try again.':
    'Sua carteira está na rede principal da Nimiq, mas este chit é da rede de testes. Mude o Nimiq Pay para a rede de testes e tente de novo.',
};

export default pt;
