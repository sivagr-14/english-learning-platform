const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

const backendSource = path.join(__dirname, "packages/backend/src/database");
const backendBuild = path.join(__dirname, "packages/backend/dist/database");

if (process.env.NODE_ENV !== "production") {
  process.env.TS_NODE_PROJECT ||= path.join(
    __dirname,
    "packages/backend/tsconfig.json"
  );
  require("ts-node/register/transpile-only");
}

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "english_learning",
    },
    migrations: {
      directory: path.join(backendSource, "migrations"),
      extension: "ts",
    },
    seeds: {
      directory: path.join(backendSource, "seeds"),
      extension: "ts",
    },
  },

  test: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "english_learning",
    },
    migrations: {
      directory: path.join(backendSource, "migrations"),
      extension: "ts",
    },
    seeds: {
      directory: path.join(backendSource, "seeds"),
      extension: "ts",
    },
  },

  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: path.join(backendBuild, "migrations"),
      extension: "js",
    },
    seeds: {
      directory: path.join(backendBuild, "seeds"),
      extension: "js",
    },
  },
};
