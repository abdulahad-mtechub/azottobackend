import { makeExecutableSchema } from "@graphql-tools/schema";
import { aiResolvers } from "../modules/ai/resolver";
import { aiTypeDefs } from "../modules/ai/type";
import { alertTypeDefs } from "../modules/alert/type";
import { alertResolvers } from "../modules/alert/resolver";
import { auditLogResolvers } from "../modules/auditLog/resolver";
import { auditLogTypeDefs } from "../modules/auditLog/type";
import { blockchainResolvers } from "../modules/blockchain/resolver";
import { blockchainTypeDefs } from "../modules/blockchain/type";
import { invoiceResolvers } from "../modules/invoice/resolver";
import { invoiceTypeDefs } from "../modules/invoice/type";
import { systemResolvers } from "../modules/system/resolver";
import { systemTypeDefs } from "../modules/system/type";
import { userTypeDefs } from "../modules/user/type";
import { userResolvers } from "../modules/user/resolver";
import { vinPassportResolvers } from "../modules/vinPassport/resolver";
import { vinPassportTypeDefs } from "../modules/vinPassport/type";
import { documentResolvers } from "../modules/document/resolver";
import {documentTypeDefs} from "../modules/document/type"

export const schema = makeExecutableSchema({
  typeDefs: [
    aiTypeDefs,
    alertTypeDefs,
    auditLogTypeDefs,
    blockchainTypeDefs,
    invoiceTypeDefs,
    systemTypeDefs,
    userTypeDefs,
    vinPassportTypeDefs,
    documentTypeDefs
  ],
  resolvers: [
    aiResolvers,
    alertResolvers,
    auditLogResolvers,
    blockchainResolvers,
    invoiceResolvers,
    systemResolvers,
    userResolvers,
    vinPassportResolvers,
    documentResolvers
  ],
});
