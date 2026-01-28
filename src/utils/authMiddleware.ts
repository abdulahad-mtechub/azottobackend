import jwt from "jsonwebtoken";
import { UserModel } from "../modules/user/user";
import bcrypt from "bcryptjs";
import prisma from "../prisma/client";
import { verifyMessage } from "ethers";

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  businessId?: string | null;
}

export const getUserFromToken = (req: any): AuthUser | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    return decoded;
  } catch (error) {
    return null; // ✅ Don’t throw error, just mark as unauthenticated
  }
};
/**
 * Get full user context from token including name
 */
export const getAuthUserContext = async (
  req: any
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    let user = null;
    user = await UserModel.findFirst({
      where: { id: decoded.userId || decoded.id },
    });
    if (!user) return null;
  } catch (error) {
    return null;
  }
};

export const createDefaultSuperAdmin = async (): Promise<void> => {
  try {
    // Check if SuperAdmin exists
    const existingSuperAdmin = await UserModel.findFirst({
      where: { role: "ADMIN" },
    });

    if (!existingSuperAdmin) {
      console.log("🛠️ No SuperAdmin found. Creating default SuperAdmin...");

      const hashedPassword = await bcrypt.hash("SuperAdmin@123", 10);
      await prisma.user.create({
        data: {
          name: "Default",
          email: "superadmin@example.com",
          password: hashedPassword,
          role: "ADMIN",
        },
      });
      console.log("✅ Default SuperAdmin created successfully!");
      console.log("📧 Email: superadmin@example.com");
    } else {
      console.log("✅ SuperAdmin already exists.");
    }
  } catch (error) {
    console.error("❌ Error creating default SuperAdmin:", error);
  }
};
export function generateNonce(): string {
  return `Azotto Wallet Login :: ${crypto.randomUUID()}`;
}
export function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  const recovered = verifyMessage(message, signature);
  return recovered.toLowerCase() === expectedAddress.toLowerCase();
}
