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
  
  // Save hash in DB
  const dbTx = await prisma.blockchainTransaction.create({
    data: {
      userId,
      entityType,
      entityId,
      txHash: tx.hash,
      status: "PENDING",
      chain: "ethereum", // replace with actual chain value if needed
      contract: contractMethod.address ?? "", // replace with actual contract address if available
      payload: JSON.stringify({ method: contractMethod.functionFragment?.name ?? "unknown" }) // or actual payload
    }
  });

  return dbTx;
};

// Polling function to update status
export const pollTxStatus = async (txId: string, txHash: string) => {
  const provider = new JsonRpcProvider(process.env.RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (receipt && (await receipt.confirmations()) > 0) {
    await prisma.blockchainTransaction.update({
      where: { id: txId },
      data: { status: "CONFIRMED", updatedAt: new Date() }
    });
  }
};
