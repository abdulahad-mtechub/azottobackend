import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import path from "path";
import multer from "multer";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { schema } from "./graphql/schema";
import { createDefaultSuperAdmin } from "./utils/authMiddleware";
import { expressMiddleware } from "@as-integrations/express5";
import { getAuthUserContext } from "./utils/authMiddleware";
import type { Request, Response } from "express";
import { parse } from "graphql";
import { ensureDatabaseSchema } from "./utils/prismaMigrate";
import "./jobs/workers"; // start BullMQ workers when Redis is available
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const PUBLIC_OPERATIONS = new Set(["createBookDemo"]);

// Common CORS configuration used across routes
const ALLOWED_ORIGINS = [
  "https://studio.apollographql.com",
  "http://localhost:4000",
  "http://localhost:5173",
  "http://localhost:5174",
];

const collectOperationNames = (body: any): string[] => {
  if (!body) return [];

  const bodies = Array.isArray(body) ? body : [body];
  const names: string[] = [];

  for (const entry of bodies) {
    if (!entry) continue;
    if (entry.operationName) {
      names.push(entry.operationName);
      continue;
    }

    if (typeof entry.query === "string") {
      try {
        const document = parse(entry.query);
        for (const definition of document.definitions) {
          if (definition.kind !== "OperationDefinition") {
            continue;
          }

          if (definition.name) {
            names.push(definition.name.value);
          } else {
            for (const selection of definition.selectionSet.selections) {
              if (selection.kind === "Field") {
                names.push(selection.name.value);
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse GraphQL document", error);
      }
    }
  }

  return names;
};

const determineApiType = (req: Request): "public" | "private" => {
  const names = collectOperationNames((req as any).body);
  if (!names.length) {
    return "private";
  }

  return names.every((name) => PUBLIC_OPERATIONS.has(name))
    ? "public"
    : "private";
};

async function startServer() {
  const app = express();
  app.use(express.json());
  const httpServer = http.createServer(app);

  const staticDir = path.join(__dirname, "..", "static");
  await fs.promises.mkdir(staticDir, { recursive: true });

  app.use("/static", express.static(staticDir));

  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS not allowed"), false);
      },
      credentials: true
    })
  );
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS not allowed"), false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, staticDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // ✅ Upload route (inherits common CORS)
  app.post("/upload", upload.single("file"), (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = `${req.protocol}://${req.get("host")}/static/${file.filename
        }`;

      return res.status(200).json({
        message: "File uploaded successfully",
        fileName: file.filename,
        fileType: file.mimetype,
        fileUrl,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
    verifyClient: ({ origin }, done) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        done(true);
      } else {
        done(false, 403, "CORS not allowed");
      }
    }
  });

  // ✅ Bind GraphQL WS with context
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        // For subscriptions, try to get user from connection params
        const token =
          ctx.connectionParams?.authorization ||
          ctx.connectionParams?.Authorization;
        let user = null;

        if (token) {
          try {
            const req = { headers: { authorization: token } };
            user = await getAuthUserContext(req);
          } catch (error) {
            console.error("❌ WebSocket auth error:", error);
          }
        }

        return { user };
      },
      onConnect: async (ctx) => {
        console.log("🔌 WebSocket client connected");
      },
      onDisconnect: async (ctx) => {
        console.log("🔌 WebSocket client disconnected");
      },
    },
    wsServer
  ) as unknown as {
    dispose: () => Promise<void>;
  };

  // ✅ Apollo Server
  const server = new ApolloServer({
    schema,
    introspection: true,
    csrfPrevention: false,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose?.();
            },
          };
        },
      },
    ],
  });

  await server.start();

  // ✅ HTTP endpoint for queries and mutations
  app.use(
    "/graphql",
    // bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }: { req: Request }) => {
        const apiType = determineApiType(req);
        const user = await getAuthUserContext(req);

        return {
          user,
          req,
          apiType,
          isPublic: apiType === "public",
        };
      },
    })
  );

  // Optional: dedicated /graphiql path
  app.get("/", (_req, res) => {
    res.redirect("/graphql");
  })
  await ensureDatabaseSchema();
  await createDefaultSuperAdmin();
  const port = Number(process.env.PORT) || 6000;
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  console.log(`🚀 HTTP endpoint: http://localhost:${port}/graphql`);
  console.log(`🔌 WS subscriptions: ws://localhost:${port}/graphql`);
}

startServer().catch((err) => console.error("❌ Error starting server:", err));
