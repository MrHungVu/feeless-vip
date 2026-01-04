# Research Report: TRON Signed Transaction Decoding & Validation

**Research Date:** 2026-01-02
**Focus:** Server-side validation patterns for TRON signed transactions

## Executive Summary

TRON transaction validation uses ECDSA SECP256K1 signatures with 65-byte structure (32 bytes r + 32 bytes s + 1 byte v). TronWeb provides methods to decode signed transactions and extract transaction data without broadcasting. TRC20 transfers encode function selector + recipient + amount in raw transaction data. Server-side validation should verify signatures before state changes and decode transaction parameters for audit purposes.

## Key Findings

### 1. Transaction Signature Structure

- TRON uses ECDSA with SECP256K1 curve
- Signature is 65 bytes: r (32) + s (32) + v (1 byte recovery flag)
- Signed transaction contains: `raw_data`, `raw_data_hex`, `signature` array, `txID`, `visible`
- Full nodes verify by: computing address from (hash, r, s, v) → compare with contract owner address

### 2. Server-Side Validation Without Broadcasting

**TronWeb Methods:**
```javascript
// Verify message signature (returns signer address)
const signerAddress = await tronWeb.trx.verifyMessageV2(message, signature);

// Check multi-sig weight before broadcast
const weight = await tronWeb.trx.getSignWeight(signedTransaction);
const approved = await tronWeb.trx.getApprovedList(signedTransaction);

// Get transaction (broadcasted or raw)
const tx = await tronWeb.trx.getTransaction(txID);
const txInfo = await tronWeb.trx.getTransactionInfo(txID);
```

**Validation Pattern:**
1. Receive signed transaction from client
2. Call `tronWeb.trx.getTransaction()` or parse raw transaction locally
3. Extract `raw_data.contract[0].parameter.value.owner_address` (sender)
4. Verify signature matches sender address
5. Extract and validate recipient/amount from contract data
6. Store in audit log before broadcasting

### 3. Extracting Transaction Data

**Standard TRX Transfer:**
- Sender: `raw_data.contract[0].parameter.value.owner_address`
- Recipient: `raw_data.contract[0].parameter.value.to_address`
- Amount: `raw_data.contract[0].parameter.value.amount`

**TRC20 Transfer (Smart Contract):**
```
raw_data.contract[0].parameter.value.data =
  a9059cbb                        // function selector (transfer)
  0000...0000 (64 chars)          // recipient address (padded)
  0000...00de0b6b3a7640000        // amount (padded uint256)
```

Decode steps:
1. Extract first 8 characters: function selector (a9059cbb = transfer)
2. Characters 8-72: recipient address (convert from hex padded format)
3. Characters 72-136: amount (convert from hex to uint256)

### 4. Message Signing Standard (TIP-191)

- Standard: "\x19TRON Signed Message:\n" + message.length + message
- Use `tronWeb.trx.signMessageV2()` for signing
- Use `tronWeb.trx.verifyMessageV2()` for verification
- Always compare recovered address with known sender address

### 5. TRC20 Parameter Decoding

**Transfer Function Selector:** `a9059cbb` (SHA3-256 hash of "transfer(address,uint256)" first 4 bytes)

**Data Format Example:**
```
a9059cbb                                    // selector
0000000000000000000000007fdf5157514bf89ff  // to address (padded)
cb7ff36f34772afd4cdc7440000000000000000000 //
00000000000000000000000000de0b6b3a7640000  // amount
```

Use `tron-tx-decoder` npm package for automatic decoding or parse manually using address/uint256 decoders.

## Code Validation Pattern (TypeScript)

```typescript
// Decode transaction without broadcast
async function validateSignedTx(signedTx: any, expectedSender: string) {
  // 1. Verify signature
  const signer = await tronWeb.trx.verifyMessageV2(
    Buffer.from(signedTx.txID),
    signedTx.signature[0]
  );
  if (signer !== expectedSender) throw new Error('Invalid signature');

  // 2. Extract contract data
  const contract = signedTx.raw_data.contract[0];
  const { owner_address, contract_address, data } = contract.parameter.value;

  // 3. Decode TRC20 params if needed
  if (contract_address) {
    const fn = data.substring(0, 8);
    if (fn === 'a9059cbb') { // transfer
      const recipient = decodeAddress(data.substring(8, 72));
      const amount = decodeUint256(data.substring(72, 136));
      return { owner_address, recipient, amount, type: 'TRC20' };
    }
  }

  // 4. For TRX transfers
  const { to_address, amount } = contract.parameter.value;
  return { owner_address, to_address, amount, type: 'TRX' };
}
```

## Security Considerations

- **Never trust unsigned input:** Always verify signature against sender address
- **Store raw transaction:** Log full raw_data for audit before any state change
- **Signature recovery:** Use only verified addresses from signature recovery
- **Expiration check:** Validate `raw_data.expiration` hasn't passed before processing
- **Amount validation:** Check transaction amount against rate limits/caps
- **Multi-sig:** Use `getSignWeight()` to ensure sufficient approvals before accepting

## References

- [TronWeb Sign & Verify Message](https://tronweb.network/docu/docs/Sign%20and%20Verify%20Message/)
- [TRON Signature Validation](https://developers.tron.network/v4.5.1/reference/signature-validation)
- [TRC20 Contract Interaction](https://developers.tron.network/docs/trc20-contract-interaction)
- [Parameter Encoding & Decoding](https://developers.tron.network/docs/parameter-encoding-and-decoding)
- [tron-tx-decoder NPM Package](https://www.npmjs.com/package/tron-tx-decoder)
- [TRON Protocol Transaction](https://developers.tron.network/docs/tron-protocol-transaction)

## Unresolved Questions

- How to implement efficient local signature verification without RPC calls (for high-throughput systems)?
- Best practice for storing private keys of fee-payer accounts in production (KMS integration)?
