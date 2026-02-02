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
import { generateNonce, verifyWalletSignature } from "../../utils/authMiddleware";

export const userResolvers = {
  JSON: GraphQLJSON,

  Query: {
    getUsers: async (_: any, { limit = 10, offset = 0, filter }: { limit?: number; offset?: number; filter?: UserFilter }) => {
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
        take: limit,
        skip: offset,
        include: { wallet: true },
      });

      return { users, totalCount };
    },
    getUser: async (_: any, { id }: { id: string }) => {
      const user = await prisma.user.findUnique({ where: { id }, include: { wallet: true } });
      if (!user || user.isDeleted) throw new GraphQLError("User not found");
      return user;
    },
    getWallets: async (_: any, { limit = 10, offset = 0 }) => {
      return prisma.aztoWallet.findMany({
        where: { isDeleted: false },
        take: limit,
        skip: offset,
      });
    },
    getWallet: async (_: any, { id }: { id: string }) => {
      const wallet = await prisma.aztoWallet.findUnique({ where: { id } });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");
      return wallet;
    },
    getWalletNonce: async ( _: any, { walletAddress }: { walletAddress: string } ) => {
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
    registerUser: async (_: any, { input }: { input: CreateUserInput },context:any) => {
      const { name, email, password, role } = input;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) throw new GraphQLError("A user with this email already exists.");

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: role || UserRole.CUSTOMER,
          isDeleted: false,
          // optionally add imageUrl if your prisma User model has it
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
        newValue: newUser,
        userId: context.user?.id,
      });
      return newUser;
    },

    updateUser: async (_: any, { input }: { input: UpdateUserInput },context:any) => {
      const { id, name, email, password, role, imageUrl } = input;

      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) throw new GraphQLError("User not found");

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
          updatedAt: new Date(),
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
        oldValue: existingUser,
        newValue: updatedUser,
        userId: context.user?.id,
      });
      return updatedUser;
    },

    staffLogin: async (_: any, input: { email: string; password: string }) => {
    },

    changePassword: async (_: any, { id, oldPassword, newPassword }: { id: string; oldPassword: string; newPassword: string }) => {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new GraphQLError("User not found");

      if (!user.password) throw new GraphQLError("User password is not set.");
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
      if (!isOldPasswordValid) throw new GraphQLError("Old password is incorrect");

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      return prisma.user.update({ where: { id }, data: { password: hashedPassword, updatedAt: new Date() } });
    },

    loginUser: async (_: any, { input }: { input: { email: string; password: string; role?: UserRole } }) => {
      const { email, password, role } = input;

      if (!email || !password) throw new GraphQLError("Email and password are required.");

      const user = await prisma.user.findUnique({ where: { email } });
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
    
    connectWallet: async ( _: any,{walletAddress, signature,}: { walletAddress: string; signature: string }) => {
    if (!walletAddress || !signature) {
      throw new GraphQLError("Wallet address and signature are required.");
    }

    // ✅ MUST MATCH FRONTEND MESSAGE EXACTLY
    const message = `Login to Azotto\nWallet: ${walletAddress}`;

    // 🔐 Verify signature
    const isValid = verifyWalletSignature(
      message,
      signature,
      walletAddress
    );

    if (!isValid) {
      throw new GraphQLError("Invalid wallet signature");
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          role: UserRole.CUSTOMER,
          name: "Customer",
        },
      });
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


    deleteUser: async (_: any, { id }: { id: string },context:any) => {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw new GraphQLError("User not found");

      const deletedUser = await prisma.user.update({ where: { id }, data: { isDeleted: true, updatedAt: new Date() } });
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
        oldValue: deletedUser,
        userId: context.user?.id,
      });
      return true;
    },

    createWallet: async (_: any, { input }: { input: CreateWalletInput },context:any) => {
      const { userId, balance } = input;

      // check if user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.isDeleted) throw new GraphQLError("User not found");

      const wallet = await prisma.aztoWallet.create({
        data: { userId, balance },
      });
      await createAuditLog({
        entityType: "WALLET",
        entityId: wallet.id,
        action: "CREATE",
        newValue: wallet,
        userId: context.user?.id,
      });
      await pubsub.publish("WALLET_NOTIFICATION", {
        walletCreated: {
          message: `Wallet against ${user.name} has been created!`,
          user,
        },
      });
      return wallet;
    },

    updateWallet: async (_: any, { input }: { input: UpdateWalletInput },context:any) => {
      const { id, balance } = input;

      const wallet = await prisma.aztoWallet.findUnique({ where: { id },include:{user:true} });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");

      const updatedWallet = prisma.aztoWallet.update({
        where: { id },
        data: { balance, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: "WALLET",
        entityId: wallet.id,
        action: "UPDATE",
        oldValue: wallet,
        newValue: updatedWallet,
        userId: context.user?.id,
      });

      await pubsub.publish("WALLET_NOTIFICATION", {
        walletUpdated: {
          message: `Wallet against ${wallet.user.name} has been updated!`,
          user:wallet.user,
        },
      });

      return updatedWallet;
    },

    deleteWallet: async (_: any, { id }: { id: string },context:any) => {
      const wallet = await prisma.aztoWallet.findUnique({ where: { id },include:{user:true} });
      if (!wallet || wallet.isDeleted) throw new GraphQLError("Wallet not found");

      const deletedWallet = await prisma.aztoWallet.update({
        where: { id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await createAuditLog({
        entityType: "WALLET",
        entityId: deletedWallet.id,
        action: "DELETE",
        oldValue: deletedWallet,
        userId: context.user?.id,
      });

      await pubsub.publish("WALLET_NOTIFICATION", {
        walletDeleted: {
          message: `Wallet against  ${wallet.user.name} has been deleted!`,
          user:wallet.user,
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
