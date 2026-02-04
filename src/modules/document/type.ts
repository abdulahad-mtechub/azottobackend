import gql from "graphql-tag";

export const documentTypeDefs = gql`
  scalar DateTime

  enum FileType {
    IMAGE
    PDF
    OTHER
  }

  enum FileState {
    UPLOADED
    PROCESSING
    VERIFIED
    REJECTED
  }

  type Document {
    id: ID!
    fileName: String!
    fileUrl: String!
    fileType: FileType!
    state: FileState!
    checksum: String!
    vinPassportId: ID
    uploadedById: ID
    createdAt: DateTime!
  }

  input CreateDocumentInput {
    fileName: String!
    fileUrl: String!
    fileType: FileType!
    vinPassportId: ID
    uploadedById: ID
    checksum: String!
  }

  input UpdateDocumentInput {
    id: ID!
    state: FileState
  }

  type DocumentPayload {
    message: String!
    document: Document!
  }

  type Query {
    getDocuments(limit: Int, offset: Int): [Document!]!
    getDocument(id: ID!): Document!
  }

  type Mutation {
    createDocument(input: CreateDocumentInput!): Document!
    updateDocument(input: UpdateDocumentInput!): Document!
    deleteDocument(id: ID!): Boolean!
  }

  type Subscription {
    documentNotification: DocumentPayload!
  }
`;

