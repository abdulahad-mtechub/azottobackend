"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const user_1 = require("./user");
exports.userResolvers = {
    Query: {
        getUsers: async () => {
            return await user_1.UserModel.findMany();
        },
    },
    Mutation: {
        createUser: async (_, { input }) => {
            const { name, email, password, phone } = input;
            return await user_1.UserModel.create({
                data: { name, email, password, phone },
            });
        },
    },
};
