import { tronWeb, USDT_CONTRACT, USDT_DECIMALS, TRX_DECIMALS, ENERGY_USDT_WITH_BALANCE } from './config.js';
import { getEnergyManager } from './energy-providers/index.js';

interface BuildTxRequest {
  userAddress: string;
  usdtAmountToService: string;
  trxAmountToUser: string;
  preferredProvider?: string;
}

interface BuildTxResponse {
  unsignedTx: unknown;
  energyOrderId: string;
  energyProvider: string;
  transactionId: string;
}

export async function buildTronTopUpTransaction(
  req: BuildTxRequest
): Promise<BuildTxResponse> {
  const usdtAmount = BigInt(
    Math.floor(parseFloat(req.usdtAmountToService) * 10 ** USDT_DECIMALS)
  );

  const serviceAddress = tronWeb.defaultAddress.base58;
  const energyManager = getEnergyManager();

  // Step 1: Delegate energy to user using preferred or best provider
  const energyOrder = await energyManager.delegateEnergy(
    req.userAddress,
    ENERGY_USDT_WITH_BALANCE,
    req.preferredProvider
  );

  // Step 2: Build USDT transfer transaction
  const parameter = [
    { type: 'address', value: serviceAddress },
    { type: 'uint256', value: usdtAmount.toString() }
  ];

  const unsignedTx = await tronWeb.transactionBuilder.triggerSmartContract(
    USDT_CONTRACT,
    'transfer(address,uint256)',
    {
      feeLimit: 100 * 1e6,
      callValue: 0
    },
    parameter,
    req.userAddress
  );

  return {
    unsignedTx: unsignedTx.transaction,
    energyOrderId: energyOrder.orderId,
    energyProvider: energyOrder.provider,
    transactionId: unsignedTx.transaction.txID
  };
}

export async function sendTrxToUser(userAddress: string, amount: string): Promise<string> {
  const trxAmount = Math.floor(parseFloat(amount) * 10 ** TRX_DECIMALS);
  const tx = await tronWeb.trx.sendTransaction(userAddress, trxAmount);
  return tx.txid;
}
