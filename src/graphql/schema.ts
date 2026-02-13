import { makeExecutableSchema } from "@graphql-tools/schema";
import { alertTypeDefs } from "../modules/alert/type";
import { alertResolvers } from "../modules/alert/resolver";
import { auditLogResolvers } from "../modules/auditLog/resolver";
import { auditLogTypeDefs } from "../modules/auditLog/type";
import { userTypeDefs } from "../modules/user/type";
import { userResolvers } from "../modules/user/resolver";
import { vinPassportResolvers } from "../modules/vinPassport/resolver";
import { vinPassportTypeDefs } from "../modules/vinPassport/type";
import { documentResolvers } from "../modules/document/resolver";
import {documentTypeDefs} from "../modules/document/type"

export const schema = makeExecutableSchema({
  typeDefs: [
    alertTypeDefs,
    auditLogTypeDefs,
    userTypeDefs,
    vinPassportTypeDefs,
    documentTypeDefs
  ],
  resolvers: [
    alertResolvers,
    auditLogResolvers,
    userResolvers,
    vinPassportResolvers,
    documentResolvers
  ],
});
