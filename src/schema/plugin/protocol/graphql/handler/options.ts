/* eslint-disable max-len */
/*
  GraphQL Plugin default options for base schema and resolvers
*/

import { GraphQLProtocolPluginOptions } from "../plugin";
import { InMemoryLRUCache } from "apollo-server-caching";
import { GraphQLUpload } from "graphql-upload";
import { GraphQLJSON } from "graphql-type-json";
import { GraphQLDate, GraphQLDateTime, GraphQLTime } from "graphql-iso-date";

delete GraphQLUpload.description;
delete GraphQLJSON.description;
delete GraphQLDate.description;
delete GraphQLDateTime.description;
delete GraphQLTime.description;

const typeDefs: string[] = [];
const resolvers: any = {};

/* default scalar types */
typeDefs.push(`
"""
Upload scalar type
@input: [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
@output: { filename, mimetype, encoding, createReadStream }
filename           string     File name.
mimetype          string    File MIME type. Provided by the client and can’t be trusted.
encoding          string    File stream transfer encoding.
createReadStream  Function  Returns a Node.js readable stream of the file contents, for processing and storing the file. Multiple calls create independent streams. Throws if called after all resolvers have resolved, or after an error has interrupted the request.
"""
scalar Upload
`);
resolvers.Upload = GraphQLUpload;

typeDefs.push(`
"""
JSON scalar type
@input: JSON string
@output: Result of JSON.parse(@input)
"""
scalar JSON
`);
resolvers.JSON = GraphQLJSON;

typeDefs.push(`
"""
Date scalar type
@input: RFC3339 full-date string: "2007-12-03"
@output: Date instance
"""
scalar Date
`);
resolvers.Date = GraphQLDate;

typeDefs.push(`
"""
Time scalar type
@input: RFC3339 full-time string (UTC): "13:10:20Z"
@output: Date instance
"""
scalar Time
`);
resolvers.Time = GraphQLTime;

typeDefs.push(`
"""
DateTime scalar Type
@input: RFC3339 date-time string (UTC): "2016-01-01T13:10:20Z"
@output: Date instance
"""
scalar DateTime
`);
resolvers.DateTime = GraphQLDateTime;

export const defaultGraphQLHandlersOptions: GraphQLProtocolPluginOptions = {
  typeDefs,
  resolvers,
  subscriptions: {
    keepAlive: 1000,
  },
  persistedQueries: {
    cache: new InMemoryLRUCache({
      maxSize: 1000,
    }),
  },
  tracing: true,
  playground: true,
  introspection: true,
  debug: false,
};
