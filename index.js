const express = require('express');
const { createServer } = require('http');
const { PubSub } = require('apollo-server');
const { ApolloServer, gql } = require('apollo-server-express');
const fs = require('fs');
const https = require('https');
const http = require('http');

const configurations = {
  // Note: You may need sudo to run on port 443
  production: { ssl: true, port: 443, hostname: 'example.com' },
  development: { ssl: false, port: 8000, hostname: 'localhost' }
}

const environment = process.env.NODE_ENV || 'production'
const config = configurations[environment]


const app = express();

const pubsub = new PubSub();
const MESSAGE_CREATED = 'MESSAGE_CREATED';

const typeDefs = gql`
  type Query {
    messages: [Message!]!
  }

  type Subscription {
    messageCreated: Message
  }

  type Message {
    id: String
    content: String
  }
`;

const resolvers = {
  Query: {
    messages: () => [
      { id: 0, content: 'Hello!' },
      { id: 1, content: 'Bye!' },
    ],
  },
  Subscription: {
    messageCreated: {
      subscribe: () => pubsub.asyncIterator(MESSAGE_CREATED),
    },
  },
};

const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  playground: true
});

apollo.applyMiddleware({ app, path: '/graphql' });

// Create the HTTPS or HTTP server, per configuration
var server
if (config.ssl) {
  // Assumes certificates are in .ssl folder from package root. Make sure the files
  // are secured.
  server = https.createServer(
    {
      key: fs.readFileSync(`./ssl/${environment}/server.key`),
      cert: fs.readFileSync(`./ssl/${environment}/server.crt`)
    },
    app
  )
} else {
  server = http.createServer(app)
}

// Add subscription support
apollo.installSubscriptionHandlers(server);

server.listen({ port: config.port }, () => {
 console.log(
    '🚀 Server ready at',
    `http${config.ssl ? 's' : ''}://${config.hostname}:${config.port}${apollo.graphqlPath}`
  )
});

let id = 2;

setInterval(() => {
  pubsub.publish(MESSAGE_CREATED, {
    messageCreated: { id, content: new Date().toString() },
  });

  id++;
}, 1000);