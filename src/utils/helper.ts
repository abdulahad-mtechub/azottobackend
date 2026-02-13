import { ethers, JsonRpcProvider } from "ethers";
import { PrismaClient, EntityType } from "@prisma/client";
const prisma = new PrismaClient();

// Example: send a transaction and save hash
export const sendBlockchainTx = async (
  userId: string,
  entityType: EntityType,
  entityId: string,
  contractMethod: any
) => {
  // Assuming you have a provider + signer
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Send transaction
  const tx = await contractMethod.connect(signer).send(); // e.g., contract.someFunction()
  


  return tx;
};

// Polling function to update status
export const pollTxStatus = async (txId: string, txHash: string) => {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);

  
};
