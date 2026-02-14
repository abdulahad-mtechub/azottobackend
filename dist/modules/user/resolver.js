"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const graphql_1 = require("graphql");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const graphql_type_json_1 = require("graphql-type-json");
const client_1 = require("../../prisma/client");
const client_2 = require("@prisma/client");
const user_1 = require("./user");
const auditLogger_1 = require("../../utils/auditLogger");
const pubsub_1 = require("../../utils/pubsub");
const authMiddleware_1 = require("../../utils/authMiddleware");
const pagination_1 = require("../../utils/pagination");
exports.userResolvers = {
    JSON: graphql_type_json_1.GraphQLJSON,
    Query: {
        getUsers: async (_, { limit = 10, offset = 0, filter }, context) => {
            (0, authMiddleware_1.requireAdmin)(context);
            const take = (0, pagination_1.capLimit)(limit, 10);
            const where = { isDeleted: false };
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
            const totalCount = await user_1.UserModel.count({ where });
            const users = await user_1.UserModel.findMany({
                where,
                take,
                skip: Math.max(0, offset ?? 0),
                include: { wallet: true },
            });
            return { users, totalCount };
        },
        getUser: async (_, { id }, context) => {
            (0, authMiddleware_1.requireAuth)(context);
            const user = await client_1.prisma.user.findFirst({ where: { id }, include: { wallet: true } });
            if (!user || user.isDeleted)
                throw new graphql_1.GraphQLError("User not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, user.id);
            return user;
        },
        getWallets: async (_, { limit = 10, offset = 0 }, context) => {
            (0, authMiddleware_1.requireAdmin)(context);
            return client_1.prisma.wallet.findMany({
                where: { isDeleted: false },
                take: (0, pagination_1.capLimit)(limit, 10),
                skip: Math.max(0, offset ?? 0),
            });
        },
        getWallet: async (_, { id }, context) => {
            (0, authMiddleware_1.requireAuth)(context);
            const wallet = await client_1.prisma.wallet.findUnique({ where: { id } });
            if (!wallet || wallet.isDeleted)
                throw new graphql_1.GraphQLError("Wallet not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, wallet.userId);
            return wallet;
        },
        getWalletNonce: async (_, { walletAddress }) => {
            if (!walletAddress) {
                throw new graphql_1.GraphQLError("Wallet address is required");
            }
            const nonce = (0, authMiddleware_1.generateNonce)();
            await client_1.prisma.user.upsert({
                where: { walletAddress },
                update: { signature: nonce },
                create: {
                    walletAddress,
                    role: client_2.UserRole.CUSTOMER,
                    signature: nonce,
                    name: "Customer",
                },
            });
            return nonce;
        },
    },
    Mutation: {
        registerUser: async (_, { input }, context) => {
            const { name, email, password } = input;
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            const newUser = await client_1.prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: client_2.UserRole.CUSTOMER,
                    isDeleted: false,
                },
            });
            await pubsub_1.pubsub.publish("USER_NOTIFICATION", {
                userCreated: {
                    message: `User ${newUser.name} has been created!`,
                    newUser,
                },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "USER",
                entityId: newUser.id,
                action: "CREATE",
                actorId: context.user?.id,
            });
            return newUser;
        },
        updateUser: async (_, { input }, context) => {
            const { id, name, email, password, role, imageUrl } = input;
            const existingUser = await client_1.prisma.user.findUnique({ where: { id } });
            if (!existingUser)
                throw new graphql_1.GraphQLError("User not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, existingUser.id);
            if (email && email !== existingUser.email) {
                const emailConflict = await client_1.prisma.user.findFirst({
                    where: { email, id: { not: id } },
                });
                if (emailConflict)
                    throw new graphql_1.GraphQLError("A user with this email already exists.");
            }
            const hashedPassword = password ? await bcryptjs_1.default.hash(password, 10) : undefined;
            const updatedUser = await client_1.prisma.user.update({
                where: { id },
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role,
                },
            });
            await pubsub_1.pubsub.publish("USER_NOTIFICATION", {
                userUpdated: {
                    message: `User ${updatedUser.name} has been updated!`,
                    updatedUser,
                },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "USER",
                entityId: updatedUser.id,
                action: "UPDATE",
                actorId: context.user?.id,
            });
            return updatedUser;
        },
        staffLogin: async (_, input) => {
            const { password, email } = input;
            const user = await client_1.prisma.user.findFirst({
                where: { email, isDeleted: false },
            });
            if (!user)
                throw new Error("User not found");
            if (!password)
                throw new Error("Password is required");
            // Check if user is NOT a Customer (staff/admin only)
            if (user.role !== "ADMIN") {
                throw new Error("Invalid credentials. Please use the website to login.");
            }
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.password || "");
            if (!isPasswordValid)
                throw new graphql_1.GraphQLError("Invalid email or password.");
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "30d" });
            // Return the tokens and user details
            return {
                token,
                user: {
                    ...user,
                    password: undefined, // Exclude password from the returned object
                },
            };
        },
        changePassword: async (_, { id, oldPassword, newPassword }, context) => {
            (0, authMiddleware_1.requireSelfOrAdmin)(context, id);
            const user = await client_1.prisma.user.findUnique({ where: { id } });
            if (!user)
                throw new graphql_1.GraphQLError("User not found");
            if (!user.password)
                throw new graphql_1.GraphQLError("User password is not set.");
            const isOldPasswordValid = await bcryptjs_1.default.compare(oldPassword, user.password);
            if (!isOldPasswordValid)
                throw new graphql_1.GraphQLError("Old password is incorrect");
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
            return client_1.prisma.user.update({ where: { id }, data: { password: hashedPassword } });
        },
        loginUser: async (_, { input }) => {
            const { email, password, role } = input;
            if (!email || !password)
                throw new graphql_1.GraphQLError("Email and password are required.");
            const user = await client_1.prisma.user.findFirst({ where: { email, isDeleted: false } });
            if (!user || user.isDeleted)
                throw new graphql_1.GraphQLError("Invalid email or password.");
            if (role && user.role !== role)
                throw new graphql_1.GraphQLError("Invalid role for this user.");
            if (!user.password)
                throw new graphql_1.GraphQLError("Invalid email or password.");
            const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid)
                throw new graphql_1.GraphQLError("Invalid email or password.");
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return { token, user };
        },
        connectWallet: async (_, { walletAddress, signature, }) => {
            if (!walletAddress || !signature) {
                throw new graphql_1.GraphQLError("Wallet address and signature are required.");
            }
            const user = await client_1.prisma.user.findUnique({
                where: { walletAddress },
            });
            if (!user || !user.signature) {
                throw new graphql_1.GraphQLError("Call getWalletNonce first to obtain the message to sign.");
            }
            const isValid = (0, authMiddleware_1.verifyWalletSignature)(user.signature, signature, walletAddress);
            if (!isValid) {
                throw new graphql_1.GraphQLError("Invalid wallet signature");
            }
            // Generate JWT
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                role: user.role,
                walletAddress: user.walletAddress,
                isLoggedIn: true,
            }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return {
                token,
                user,
            };
        },
        coinbaseLogin: async (_value, { input, }) => {
            const { email, address, signature, message, timestamp } = input || {};
            if (!email || !address || !signature || !message || !timestamp) {
                throw new graphql_1.GraphQLError("email, address, signature, message, timestamp are required");
            }
            const signedAt = new Date(timestamp);
            if (Number.isNaN(signedAt.getTime())) {
                throw new graphql_1.GraphQLError("Invalid timestamp");
            }
            const maxAgeMs = 5 * 60 * 1000;
            if (Date.now() - signedAt.getTime() > maxAgeMs) {
                throw new graphql_1.GraphQLError("Signature expired");
            }
            const normalizedAddress = address.toLowerCase();
            const normalizedEmail = email.trim().toLowerCase();
            if (!message.includes(`Email: ${email}`) ||
                !message.includes(`Address: ${address}`) ||
                !message.includes(`Timestamp: ${timestamp}`)) {
                throw new graphql_1.GraphQLError("Invalid signature message payload");
            }
            const isValid = (0, authMiddleware_1.verifyWalletSignature)(message, signature, address);
            if (!isValid) {
                throw new graphql_1.GraphQLError("Invalid wallet signature");
            }
            let user = await client_1.prisma.user.findFirst({
                where: {
                    OR: [
                        { walletAddress: normalizedAddress },
                        { email: normalizedEmail },
                    ],
                    isDeleted: false,
                },
            });
            if (!user) {
                user = await client_1.prisma.user.create({
                    data: {
                        name: "Coinbase User",
                        email: normalizedEmail,
                        walletAddress: normalizedAddress,
                        signature: message,
                        role: client_2.UserRole.OWNER,
                        isDeleted: false,
                    },
                });
            }
            else {
                user = await client_1.prisma.user.update({
                    where: { id: user.id },
                    data: {
                        email: normalizedEmail,
                        walletAddress: normalizedAddress,
                        signature: message,
                    },
                });
            }
            const token = jsonwebtoken_1.default.sign({
                userId: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                walletAddress: user.walletAddress,
                isLoggedIn: true,
                provider: "coinbase_wallet_sdk",
            }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return { token, user };
        },
        deleteUser: async (_, { id }, context) => {
            const user = await client_1.prisma.user.findUnique({ where: { id } });
            if (!user)
                throw new graphql_1.GraphQLError("User not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, user.id);
            const deletedUser = await client_1.prisma.user.update({ where: { id }, data: { isDeleted: true } });
            await pubsub_1.pubsub.publish("USER_NOTIFICATION", {
                userDeleted: {
                    message: `User ${deletedUser.name} has been deleted!`,
                    deletedUser,
                },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "USER",
                entityId: deletedUser.id,
                action: "DELETE",
                actorId: context.user?.id,
            });
            return true;
        },
        createWallet: async (_, { input }, context) => {
            (0, authMiddleware_1.requireAuth)(context);
            const { userId, availableAZTO } = input;
            // check if user exists; only admin can create wallet for another user
            const user = await client_1.prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.isDeleted)
                throw new graphql_1.GraphQLError("User not found");
            if (context.user.id !== userId && context.user.role !== "ADMIN") {
                throw new graphql_1.GraphQLError("Forbidden: can only create wallet for self or as admin");
            }
            const wallet = await client_1.prisma.wallet.create({
                data: { userId, address: "", availableAZTO, lockedAZTO: 0 },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "WALLET",
                entityId: wallet.id,
                action: "CREATE",
                actorId: context.user?.id,
            });
            await pubsub_1.pubsub.publish("WALLET_NOTIFICATION", {
                walletCreated: {
                    message: `Wallet against ${user.name} has been created!`,
                    user,
                },
            });
            return wallet;
        },
        updateWallet: async (_, { input }, context) => {
            const { id, availableAZTO, lockedAZTO } = input;
            const wallet = await client_1.prisma.wallet.findUnique({ where: { id }, include: { user: true } });
            if (!wallet || wallet.isDeleted)
                throw new graphql_1.GraphQLError("Wallet not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, wallet.userId);
            const updatedWallet = await client_1.prisma.wallet.update({
                where: { id },
                data: { availableAZTO, lockedAZTO },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "WALLET",
                entityId: wallet.id,
                action: "UPDATE",
                actorId: context.user?.id,
            });
            await pubsub_1.pubsub.publish("WALLET_NOTIFICATION", {
                walletUpdated: {
                    message: `Wallet against ${wallet.user.name} has been updated!`,
                    user: wallet.user,
                },
            });
            return updatedWallet;
        },
        deleteWallet: async (_, { id }, context) => {
            const wallet = await client_1.prisma.wallet.findUnique({ where: { id }, include: { user: true } });
            if (!wallet || wallet.isDeleted)
                throw new graphql_1.GraphQLError("Wallet not found");
            (0, authMiddleware_1.requireSelfOrAdmin)(context, wallet.userId);
            const deletedWallet = await client_1.prisma.wallet.update({
                where: { id },
                data: { isDeleted: true },
            });
            await (0, auditLogger_1.createAuditLog)({
                entityType: "WALLET",
                entityId: deletedWallet.id,
                action: "DELETE",
                actorId: context.user?.id,
            });
            await pubsub_1.pubsub.publish("WALLET_NOTIFICATION", {
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
            subscribe: () => (0, pubsub_1.getAsyncIterator)(["USER_NOTIFICATION"]),
        },
        walletNotification: {
            subscribe: () => (0, pubsub_1.getAsyncIterator)(["WALLET_NOTIFICATION"]),
        },
    },
};
