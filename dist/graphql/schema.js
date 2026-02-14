"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
const schema_1 = require("@graphql-tools/schema");
const type_1 = require("../modules/alert/type");
const resolver_1 = require("../modules/alert/resolver");
const resolver_2 = require("../modules/auditLog/resolver");
const type_2 = require("../modules/auditLog/type");
const type_3 = require("../modules/user/type");
const resolver_3 = require("../modules/user/resolver");
const resolver_4 = require("../modules/vinPassport/resolver");
const type_4 = require("../modules/vinPassport/type");
const resolver_5 = require("../modules/document/resolver");
const type_5 = require("../modules/document/type");
exports.schema = (0, schema_1.makeExecutableSchema)({
    typeDefs: [
        type_1.alertTypeDefs,
        type_2.auditLogTypeDefs,
        type_3.userTypeDefs,
        type_4.vinPassportTypeDefs,
        type_5.documentTypeDefs
    ],
    resolvers: [
        resolver_1.alertResolvers,
        resolver_2.auditLogResolvers,
        resolver_3.userResolvers,
        resolver_4.vinPassportResolvers,
        resolver_5.documentResolvers
    ],
});
