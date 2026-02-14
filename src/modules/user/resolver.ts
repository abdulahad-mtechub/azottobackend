import { GraphQLError } from "graphql";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { GraphQLJSON } from "graphql-type-json";
import { prisma } from "../../prisma/client";
import { CreateUserInput, CreateWalletInput, UpdateUserInput, UpdateWalletInput, UserFilter } from "./type";
import { UserRole } from "@prisma/client";
import { UserModel } from "./user";
import { createAuditLog } from "../../utils/auditLogger"
import { getAsyncIterator,pubsub } from "../../utils/pubsub";
import { generateNonce, requireAdmin, requireAuth, requireSelfOrAdmin, verifyWalletSignature } from "../../utils/authMiddleware";
import { capLimit } from "../../utils/pagination";

export const userResolvers = {
  JSON: GraphQLJSON,

  Query: {
    getUsers: async (_: any, { limit = 10, offset = 0, filter }: { limit?: number; offset?: number; filter?: UserFilter }, context: any) => {
      requireAdmin(context);
      const take = capLimit(limit, 10);
      const where: any = { isDeleted: false };

      if (filter?.roles && filter.roles.length > 0) {
        where.role = { in: filter.roles };
      }

      if (typeof filter?.isActive === "boolean") {
        where.isDeleted = !filter.isActive; // assuming isActive maps to !isDeleted
      }

      if (filter?.search) {
        where.OR = [
          { name: { contains: filter.search, mode: "insensitive" } },
          { email: { contains: filter.search, mode: "insensitive" } },
        ];
      }

      const totalCount = await UserModel.count({ where });

      const users = await UserModel.findMany({
        where,
        take,
        skip: Math.max(0, offset ?? 0),
        include: { wallet: true },
      });

      return { users, totalCount };
    },
    getUser: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const user = await prisma.user.findFirst({ where: { id }, include: { wallet: true } });
      if (!user || user.isDeleted) throw new GraphQLError("User not found");
      requireSelfOrAdmin(context, user.id);
      return user;
    },
    getWallets: async (_: any, { limit = 10, offset = 0 }, context: any) => {
      requireAdmin(context);
      return prisma.wallet.findMany({
        where: { isDeleted: false },
        take: capLimit(limit, 10),
        skip: Math.max(0, offset ?? 0),
      });
    },
    getWallet: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const wallet = await prisma.wallet.findUnique({ where: { id } });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");
      requireSelfOrAdmin(context, wallet.userId);
      return wallet;
    },
    getWalletNonce: async (_: any, { walletAddress }: { walletAddress: string }) => {
      if (!walletAddress) {
        throw new GraphQLError("Wallet address is required");
      }

      const nonce = generateNonce();

      await prisma.user.upsert({
        where: { walletAddress },
        update: { signature: nonce },
        create: {
          walletAddress,
          role: UserRole.CUSTOMER,
          signature: nonce,
          name: "Customer",
        },
      });

      return nonce;
    },
  },

  Mutation: {
    registerUser: async (_: any, { input }: { input: CreateUserInput }, context: any) => {
      const { name, email, password } = input;

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: UserRole.CUSTOMER,
          isDeleted: false,
        },
      });

      await pubsub.publish("USER_NOTIFICATION", {
        userCreated: {
          message: `User ${newUser.name} has been created!`,
          newUser,
        },
      });
      await createAuditLog({
        entityType: "USER",
        entityId: newUser.id,
        action: "CREATE",
        actorId: context.user?.id,
      });
      return newUser;
    },
    updateUser: async (_: any, { input }: { input: UpdateUserInput }, context: any) => {
      const { id, name, email, password, role, imageUrl } = input;

      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) throw new GraphQLError("User not found");
      requireSelfOrAdmin(context, existingUser.id);

      if (email && email !== existingUser.email) {
        const emailConflict = await prisma.user.findFirst({
          where: { email, id: { not: id } },
        });
        if (emailConflict) throw new GraphQLError("A user with this email already exists.");
      }

      const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          name,
          email,
          password: hashedPassword,
          role,
        },
      });
      await pubsub.publish("USER_NOTIFICATION", {
        userUpdated: {
          message: `User ${updatedUser.name} has been updated!`,
          updatedUser,
        },
      });
      await createAuditLog({
        entityType: "USER",
        entityId: updatedUser.id,
        action: "UPDATE",
        actorId: context.user?.id,
      });
      return updatedUser;
    },
    staffLogin: async (_: any, input: { email: string; password: string }) => {
      const { password, email } = input;

      const user = await prisma.user.findFirst({
        where: { email, isDeleted: false },
      });

      if (!user) throw new Error("User not found");
      if (!password) throw new Error("Password is required");

      // Check if user is NOT a Customer (staff/admin only)
      if (user.role !== "ADMIN") {
        throw new Error(
          "Invalid credentials. Please use the website to login."
        );
      }

      const isPasswordValid = await bcrypt.compare(password, user.password || "");
      if (!isPasswordValid) throw new GraphQLError("Invalid email or password.");

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
      );

      // Return the tokens and user details
      return {
        token,
        user: {
          ...user,
          password: undefined, // Exclude password from the returned object
        },
      };
    },
    changePassword: async (_: any, { id, oldPassword, newPassword }: { id: string; oldPassword: string; newPassword: string }, context: any) => {
      requireSelfOrAdmin(context, id);
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new GraphQLError("User not found");

      if (!user.password) throw new GraphQLError("User password is not set.");
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isOldPasswordValid) throw new GraphQLError("Old password is incorrect");

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      return prisma.user.update({ where: { id }, data: { password: hashedPassword} });
    },
    loginUser: async (_: any, { input }: { input: { email: string; password: string; role?: UserRole } }) => {
      const { email, password, role } = input;

      if (!email || !password) throw new GraphQLError("Email and password are required.");

      const user = await prisma.user.findFirst({ where: { email, isDeleted: false } });
      if (!user || user.isDeleted) throw new GraphQLError("Invalid email or password.");

      if (role && user.role !== role) throw new GraphQLError("Invalid role for this user.");

      if (!user.password) throw new GraphQLError("Invalid email or password.");
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) throw new GraphQLError("Invalid email or password.");

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
      );

      return { token, user };
    },
    connectWallet: async (_: any, { walletAddress, signature, }: { walletAddress: string; signature: string }) => {
      if (!walletAddress || !signature) {
        throw new GraphQLError("Wallet address and signature are required.");
      }

      const user = await prisma.user.findUnique({
        where: { walletAddress },
      });

      if (!user || !user.signature) {
        throw new GraphQLError("Call getWalletNonce first to obtain the message to sign.");
      }

      const isValid = verifyWalletSignature(user.signature, signature, walletAddress);
      if (!isValid) {
        throw new GraphQLError("Invalid wallet signature");
      }

      // Generate JWT
      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          walletAddress: user.walletAddress,
          isLoggedIn: true,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
      );

      return {
        token,
        user,
      };
    },
    coinbaseLogin: async (
      _value: any,
      {
        input,
      }: {
        input: {
          email: string;
          address: string;
          signature: string;
          message: string;
          timestamp: string;
        };
      }
    ) => {
      const { email, address, signature, message, timestamp } = input || {};
      if (!email || !address || !signature || !message || !timestamp) {
        throw new GraphQLError("email, address, signature, message, timestamp are required");
      }

      const signedAt = new Date(timestamp);
      if (Number.isNaN(signedAt.getTime())) {
        throw new GraphQLError("Invalid timestamp");
      }

      const maxAgeMs = 5 * 60 * 1000;
      if (Date.now() - signedAt.getTime() > maxAgeMs) {
        throw new GraphQLError("Signature expired");
      }

      const normalizedAddress = address.toLowerCase();
      const normalizedEmail = email.trim().toLowerCase();

      if (
        !message.includes(`Email: ${email}`) ||
        !message.includes(`Address: ${address}`) ||
        !message.includes(`Timestamp: ${timestamp}`)
      ) {
        throw new GraphQLError("Invalid signature message payload");
      }

      const isValid = verifyWalletSignature(message, signature, address);
      if (!isValid) {
        throw new GraphQLError("Invalid wallet signature");
      }

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { walletAddress: normalizedAddress },
            { email: normalizedEmail },
          ],
          isDeleted: false,
        },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: "Coinbase User",
            email: normalizedEmail,
            walletAddress: normalizedAddress,
            signature: message,
            role: UserRole.OWNER,
            isDeleted: false,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            email: normalizedEmail,
            walletAddress: normalizedAddress,
            signature: message,
          },
        });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          walletAddress: user.walletAddress,
          isLoggedIn: true,
          provider: "coinbase_wallet_sdk",
        },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
      );

      return { token, user };
    },
    deleteUser: async (_: any, { id }: { id: string }, context: any) => {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new GraphQLError("User not found");
      requireSelfOrAdmin(context, user.id);

      const deletedUser = await prisma.user.update({ where: { id }, data: { isDeleted: true } });
      await pubsub.publish("USER_NOTIFICATION", {
        userDeleted: {
          message: `User ${deletedUser.name} has been deleted!`,
          deletedUser,
        },
      });
      await createAuditLog({
        entityType: "USER",
        entityId: deletedUser.id,
        action: "DELETE",
        actorId: context.user?.id,
      });
      return true;
    },
    createWallet: async (_: any, { input }: { input: CreateWalletInput }, context: any) => {
      requireAuth(context);
      const { userId, availableAZTO } = input;

      // check if user exists; only admin can create wallet for another user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isDeleted) throw new GraphQLError("User not found");
      if (context.user.id !== userId && context.user.role !== "ADMIN") {
        throw new GraphQLError("Forbidden: can only create wallet for self or as admin");
      }

      const wallet = await prisma.wallet.create({
        data: { userId, address: "", availableAZTO, lockedAZTO: 0 },
      });
      await createAuditLog({
        entityType: "WALLET",
        entityId: wallet.id,
        action: "CREATE",
        actorId: context.user?.id,
      });
      await pubsub.publish("WALLET_NOTIFICATION", {
        walletCreated: {
          message: `Wallet against ${user.name} has been created!`,
          user,
        },
      });
      return wallet;
    },
    updateWallet: async (_: any, { input }: { input: UpdateWalletInput }, context: any) => {
      const { id, availableAZTO,lockedAZTO } = input;

      const wallet = await prisma.wallet.findUnique({ where: { id }, include: { user: true } });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");
      requireSelfOrAdmin(context, wallet.userId);

      const updatedWallet = await prisma.wallet.update({
        where: { id },
        data: { availableAZTO, lockedAZTO },
      });

      await createAuditLog({
        entityType: "WALLET",
        entityId: wallet.id,
        action: "UPDATE",
        actorId: context.user?.id,
      });

      await pubsub.publish("WALLET_NOTIFICATION", {
        walletUpdated: {
          message: `Wallet against ${wallet.user.name} has been updated!`,
          user: wallet.user,
        },
      });

      return updatedWallet;
    },
    deleteWallet: async (_: any, { id }: { id: string }, context: any) => {
      const wallet = await prisma.wallet.findUnique({ where: { id }, include: { user: true } });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");
      requireSelfOrAdmin(context, wallet.userId);

      const deletedWallet = await prisma.wallet.update({
        where: { id },
        data: { isDeleted: true },
      });

      await createAuditLog({
        entityType: "WALLET",
        entityId: deletedWallet.id,
        action: "DELETE",
        actorId: context.user?.id,
      });

      await pubsub.publish("WALLET_NOTIFICATION", {
        walletDeleted: {
          message: `Wallet against  ${wallet.user.name} has been deleted!`,
          user: wallet.user,
        },
      });

      return true;
    },
  },

  Subscription: {
    userNotification: {
      subscribe: () => getAsyncIterator(["USER_NOTIFICATION"]),
    },
    walletNotification: {
      subscribe: () => getAsyncIterator(["WALLET_NOTIFICATION"]),
    },
  },
};
