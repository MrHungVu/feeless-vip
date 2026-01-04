import {
  Transaction,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { connection, feePayerKeypair, USDC_MINT, USDC_DECIMALS } from './config.js';

interface BuildTxRequest {
  userAddress: string;
  usdcAmountToService: string;
  solAmountToUser: string;
}

interface BuildTxResponse {
  serializedTx: string;
  transactionId: string;
}

export async function buildTopUpTransaction(req: BuildTxRequest): Promise<BuildTxResponse> {
  const userPubkey = new PublicKey(req.userAddress);
  const feePayer = feePayerKeypair.publicKey;

  const usdcAmountRaw = BigInt(
    Math.floor(parseFloat(req.usdcAmountToService) * 10 ** USDC_DECIMALS)
  );
  const solAmountLamports = BigInt(
    Math.floor(parseFloat(req.solAmountToUser) * LAMPORTS_PER_SOL)
  );

  // Get token accounts
  const userUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, userPubkey);
  const serviceUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, feePayer);

  // Build transaction
  const tx = new Transaction();

  // Instruction 1: User pays USDC to service (fee)
  tx.add(
    createTransferCheckedInstruction(
      userUsdcAccount,
      USDC_MINT,
      serviceUsdcAccount,
      userPubkey,
      usdcAmountRaw,
      USDC_DECIMALS
    )
  );

  // Instruction 2: Service sends SOL to user
  tx.add(
    SystemProgram.transfer({
      fromPubkey: feePayer,
      toPubkey: userPubkey,
      lamports: solAmountLamports
    })
  );

  // Set fee payer (MUST be first account)
  tx.feePayer = feePayer;

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  // Service signs first (partial sign)
  tx.partialSign(feePayerKeypair);

  // Serialize for user to sign
  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false
  });

  return {
    serializedTx: serialized.toString('base64'),
    transactionId: tx.signature?.toString() || ''
  };
}
