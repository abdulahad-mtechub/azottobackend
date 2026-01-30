"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_1 = require("@apollo/server");
const schema_1 = require("./graphql/schema");
const server = new apollo_server_1.ApolloServer({
    schema: schema_1.schema,
});
const PORT = process.env.PORT || 4000;
server.listen(PORT).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
