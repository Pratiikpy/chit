import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUNA_PER_NIM,
  MockWallet,
  NimiqPayWallet,
  SignatureDeclinedError,
  WalletOperationError,
  WalletUnavailableError,
  chitHash,
  lunaToProviderValue,
  resolveWallet,
  unwrap,
  waitForInjectedProvider,
  type Chit,
} from '../src/index.ts';

const ADDRESS = 'NQ56M67GT26X3N9VXDGEQ3BNHSVUE13YQNGV';

function chit(): Chit {
  return {
    chain: 'test',
    kind: 'handshake',
    nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
    text: '$40 for 3 thumbnails by Friday',
    amountMinor: 4000n,
    currency: 'USD',
    luna: 120400000n,
    rateBlock: 4102887,
    deadlineBlock: 4110000,
    payer: ADDRESS,
    payee: 'NQ0700000000000000000000000000000000',
    deliverables: 3,
  };
}

/** A fake injected provider, so the Nimiq Pay tier is exercised without a device. */
function fakeProvider(overrides: Record<string, unknown> = {}) {
  return {
    listAccounts: () => Promise.resolve([ADDRESS]),
    sign: () =>
      Promise.resolve({
        publicKey: '0e0791599f497e01d655125db71daaf036f7972ccc59ec9b07a259a31cd7fa22',
        signature: 'ab'.repeat(64),
      }),
    getBlockNumber: () => Promise.resolve(4_100_000),
    isConsensusEstablished: () => Promise.resolve(true),
    sendBasicTransactionWithData: () => Promise.resolve('serialized-tx'),
    ...overrides,
  };
}

test('unwrap passes a success value straight through', () => {
  assert.deepEqual(unwrap([ADDRESS], 'listAccounts'), [ADDRESS]);
  assert.equal(unwrap('ok', 'sign'), 'ok');
});

test('⭐ unwrap catches the resolved error union instead of treating it as a value', () => {
  // The provider resolves with an error object rather than rejecting. A caller using only
  // try/catch would sail past this and sign against "[object Object]".
  assert.throws(
    () => unwrap({ error: { type: 'InvalidTransactionError', message: 'bad recipient' } }, 'pay'),
    (err: unknown) =>
      err instanceof WalletOperationError &&
      err.type === 'InvalidTransactionError' &&
      /bad recipient/.test((err as Error).message),
  );
});

test('a declined operation is a decline, not an operation error', () => {
  assert.throws(
    () => unwrap({ error: { type: 'PermissionDeniedError', message: 'user said no' } }, 'sign'),
    SignatureDeclinedError,
  );
});

test('Luna conversion refuses anything unsafe rather than losing precision', () => {
  assert.equal(lunaToProviderValue(120_400_000n), 120_400_000);
  assert.equal(lunaToProviderValue(1n), 1);
  assert.throws(() => lunaToProviderValue(0n), /must be positive/);
  assert.throws(() => lunaToProviderValue(-1n), /must be positive/);
  assert.throws(() => lunaToProviderValue(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /safe integer/);
});

test('one NIM is one hundred thousand Luna', () => {
  assert.equal(LUNA_PER_NIM, 100_000n);
});

test('the Nimiq Pay tier reads an address, signs, and pays', async () => {
  const wallet = new NimiqPayWallet(fakeProvider());
  assert.equal(wallet.tier, 'nimiq-pay');
  assert.equal(await wallet.getAddress(), ADDRESS);
  assert.equal((await wallet.signText('hello')).signatureHex, 'ab'.repeat(64));
  assert.equal(await wallet.getBlockNumber(), 4_100_000);
  assert.equal((await wallet.pay({ recipient: ADDRESS, luna: 100n, data: chitHash(chit()) })).raw, 'serialized-tx');
});

test('the address is fetched once and cached', async () => {
  let calls = 0;
  const wallet = new NimiqPayWallet(
    fakeProvider({
      listAccounts: () => {
        calls++;
        return Promise.resolve([ADDRESS]);
      },
    }),
  );
  await wallet.getAddress();
  await wallet.getAddress();
  assert.equal(calls, 1);
});

test('an empty account list is an error, not an empty address', async () => {
  const wallet = new NimiqPayWallet(fakeProvider({ listAccounts: () => Promise.resolve([]) }));
  await assert.rejects(() => wallet.getAddress(), WalletOperationError);
});

test('a declined signature surfaces as a decline through the wallet', async () => {
  const wallet = new NimiqPayWallet(
    fakeProvider({ sign: () => Promise.resolve({ error: { type: 'PermissionDeniedError', message: '' } }) }),
  );
  await assert.rejects(() => wallet.signText('hello'), SignatureDeclinedError);
});

test('consensus never throws — not knowing is not a failure', async () => {
  const wallet = new NimiqPayWallet(
    fakeProvider({ isConsensusEstablished: () => Promise.reject(new Error('flaky')) }),
  );
  assert.equal(await wallet.isConsensusEstablished(), false);
});

test('a non-string payment result is refused rather than trusted', async () => {
  const wallet = new NimiqPayWallet(fakeProvider({ sendBasicTransactionWithData: () => Promise.resolve({ hash: 1 }) }));
  await assert.rejects(
    () => wallet.pay({ recipient: ADDRESS, luna: 100n, data: chitHash(chit()) }),
    WalletOperationError,
  );
});

test('no fee is sent — Nimiq Pay chooses one, using 0 if possible', async () => {
  let seen: Record<string, unknown> | undefined;
  const wallet = new NimiqPayWallet(
    fakeProvider({
      sendBasicTransactionWithData: (tx: Record<string, unknown>) => {
        seen = tx;
        return Promise.resolve('ok');
      },
    }),
  );
  await wallet.pay({ recipient: ADDRESS, luna: 120_400_000n, data: chitHash(chit()) });
  assert.ok(seen);
  assert.equal('fee' in seen, false, 'chit must not override the wallet\'s fee choice');
  assert.equal(seen['value'], 120_400_000, 'value is Luna as a number');
  assert.equal('validityStartHeight' in seen, false, 'omitted when not supplied');
});

test('resolveWallet prefers Nimiq Pay when the provider is injected', async () => {
  const scope = globalThis as { nimiq?: unknown };
  scope.nimiq = fakeProvider();
  try {
    const wallet = await resolveWallet();
    assert.equal(wallet.tier, 'nimiq-pay');
  } finally {
    delete scope.nimiq;
  }
});

test('resolveWallet uses the fallback in a plain browser — the desktop judge path', async () => {
  const wallet = await resolveWallet({ fallback: () => new MockWallet() });
  assert.equal(wallet.tier, 'mock');
});

test('waiting for a provider times out rather than hanging forever', async () => {
  await assert.rejects(() => waitForInjectedProvider(120, {}), WalletUnavailableError);
});

test('waiting resolves as soon as the provider appears', async () => {
  const scope: { nimiq?: unknown } = {};
  setTimeout(() => {
    scope.nimiq = fakeProvider();
  }, 80);
  const provider = await waitForInjectedProvider(3_000, scope);
  assert.ok(provider);
});

test('the mock signs deterministically with correct byte lengths', async () => {
  const wallet = new MockWallet();
  const a = await wallet.signText('same text');
  const b = await wallet.signText('same text');
  const c = await wallet.signText('different text');
  assert.deepEqual(a, b, 'same input must give the same signature');
  assert.notEqual(a.signatureHex, c.signatureHex);
  assert.equal(a.publicKeyHex.length, 64, '32 bytes');
  assert.equal(a.signatureHex.length, 128, '64 bytes');
});

test('the mock records payments so a flow can be asserted end to end', async () => {
  const wallet = new MockWallet();
  const memo = chitHash(chit());
  await wallet.pay({ recipient: ADDRESS, luna: 4_800_000n, data: memo });
  await wallet.pay({ recipient: ADDRESS, luna: 300_000n, data: memo });
  assert.equal(wallet.payments.length, 2);
  assert.equal(wallet.payments[0]?.luna, 4_800_000n);
  assert.equal(wallet.payments[1]?.data, memo);
});

test('the mock refuses a payment with no memo — every chit payment carries one', async () => {
  const wallet = new MockWallet();
  await assert.rejects(
    async () => wallet.pay({ recipient: ADDRESS, luna: 100n, data: '' }),
    WalletOperationError,
  );
});

test('the mock can be told to fail, so failure screens are testable', async () => {
  const declined = new MockWallet({ failSignWith: new SignatureDeclinedError('user cancelled') });
  await assert.rejects(() => declined.signText('x'), SignatureDeclinedError);

  const broke = new MockWallet({ failPayWith: new WalletOperationError('Offline', 'no network') });
  await assert.rejects(() => broke.pay({ recipient: ADDRESS, luna: 1n, data: 'x' }), WalletOperationError);
});

test('the mock block height can be frozen or made to advance', async () => {
  const frozen = new MockWallet({ blockNumber: 4_102_887 });
  assert.equal(await frozen.getBlockNumber(), 4_102_887);
  assert.equal(await frozen.getBlockNumber(), 4_102_887);

  const moving = new MockWallet({ blockNumber: 100, blocksPerCall: 10 });
  assert.equal(await moving.getBlockNumber(), 100);
  assert.equal(await moving.getBlockNumber(), 110);
});
