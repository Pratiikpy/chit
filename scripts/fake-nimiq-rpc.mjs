/**
 * A controllable Nimiq JSON-RPC endpoint, for end-to-end testing.
 *
 * This is NOT a mock of chit's own code. The API talks to it over real HTTP with the real
 * `NimiqRpcClient`, real JSON-RPC framing and the real settlement watcher — the only thing
 * substituted is the chain's *contents*, which a test must control because we cannot mine
 * a block or spend real NIM on demand.
 *
 * It speaks the two methods chit uses, in the shape the real endpoint returns them:
 *   getBlockNumber            -> number
 *   getTransactionsByAddress  -> [{ hash, blockNumber, from, to, value, recipientData }]
 *
 * Plus one control endpoint, `POST /_inject`, so a test can make a payment land.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const key = (address) => String(address ?? '').replace(/\s/g, '').toUpperCase();

export function startFakeRpc({ port = 8649, startHeight = 4_100_000 } = {}) {
  let height = startHeight;
  /** @type {Map<string, object[]>} */
  const byAddress = new Map();
  /** @type {Array<{hash: string, hex: string}>} */
  const broadcasts = [];

  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const reply = (payload, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      // Control surface: make a transaction appear on chain.
      if (req.method === 'POST' && req.url === '/_inject') {
        const tx = JSON.parse(body || '{}');
        height += 1;
        const record = {
          // 64 lowercase hex, the way a real Nimiq node reports a transaction hash. A
          // shorter placeholder once made a review impossible to sign in the journey while
          // production was fine, which is the fake lying about the thing it stands in for.
          hash: tx.hash ?? randomBytes(32).toString('hex'),
          blockNumber: height,
          timestamp: Math.floor(Date.now() / 1000),
          from: tx.from ?? '',
          to: tx.to ?? '',
          value: Number(tx.value ?? 0),
          recipientData: tx.data ?? '',
        };
        const bucket = byAddress.get(key(record.to)) ?? [];
        bucket.push(record);
        byAddress.set(key(record.to), bucket);
        return reply({ ok: true, hash: record.hash, blockNumber: record.blockNumber });
      }

      if (req.method !== 'POST') return reply({ error: 'method not allowed' }, 405);

      let request;
      try {
        request = JSON.parse(body);
      } catch {
        return reply({ jsonrpc: '2.0', id: null, error: { message: 'bad json' } }, 400);
      }

      const { id, method, params = [] } = request;

      if (method === 'sendRawTransaction') {
        // The pool's payout, as the node would accept it. It lands like any injected
        // payment so the existing settlement matcher sees it — the memo is parsed from the
        // hex the way a real node would report it: we cannot deserialise here, so the test
        // harness records the raw hex and the journey injects the matching transaction.
        const [hex] = params;
        const hash = randomBytes(32).toString('hex');
        broadcasts.push({ hash, hex: String(hex) });
        return reply({ jsonrpc: '2.0', id, result: { data: hash } });
      }

      if (method === 'getAccountByAddress') {
        return reply({ jsonrpc: '2.0', id, result: { data: { address: params[0], balance: 500_000_00000, type: 'basic' } } });
      }

      if (method === 'getBlockNumber') {
        return reply({ jsonrpc: '2.0', id, result: { data: height } });
      }

      if (method === 'getTransactionsByAddress') {
        const [address, max = 100] = params;
        const found = (byAddress.get(key(address)) ?? []).slice(-Number(max));
        return reply({ jsonrpc: '2.0', id, result: { data: found } });
      }

      return reply({ jsonrpc: '2.0', id, error: { message: `unknown method ${method}` } });
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        url: `http://localhost:${port}`,
        /** Make a payment land on chain, exactly as the RPC would report it. */
        async inject(tx) {
          const response = await fetch(`http://localhost:${port}/_inject`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(tx),
          });
          return response.json();
        },
        /** Every raw transaction the pool broadcast, in order. */
        get broadcasts() {
          return broadcasts;
        },
        advance(blocks = 1) {
          height += blocks;
        },
        get height() {
          return height;
        },
        stop: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
