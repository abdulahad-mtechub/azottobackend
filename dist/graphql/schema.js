"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
const schema_1 = require("@graphql-tools/schema");
const type_1 = require("../modules/user/type");
const resolver_1 = require("../modules/user/resolver");
exports.schema = (0, schema_1.makeExecutableSchema)({
    typeDefs: [type_1.userTypeDefs],
    resolvers: [resolver_1.userResolvers],
});
