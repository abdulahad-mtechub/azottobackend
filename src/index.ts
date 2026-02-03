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
import type { Request } from "express";
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
const ALLOW_ALL_ORIGINS = true;

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

  // ✅ Static folder
  const staticDir = path.join(__dirname, "..", "static");
  await fs.promises.mkdir(staticDir, { recursive: true });
  app.use("/static", express.static(staticDir));

  // ✅ Single CORS middleware
  app.use(
    cors({
      origin: ALLOW_ALL_ORIGINS ? true : undefined,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ✅ Upload route
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, staticDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

  app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const fileUrl = `${req.protocol}://${req.get("host")}/static/${req.file.filename}`;
    res.json({ fileUrl });
  });

  // ✅ WebSocket + GraphQL subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx) => {
        const token = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization;
        let user = null;
        if (token) user = await getAuthUserContext({ headers: { authorization: token } });
        return { user };
      },
    },
    wsServer
  ) as unknown as { dispose: () => Promise<void> };

  // ✅ Apollo Server
  const server = new ApolloServer({
    schema,
    introspection: true,
    csrfPrevention: false,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return { async drainServer() { await serverCleanup.dispose?.(); } };
        },
      },
    ],
  });

  await server.start();

  // ✅ Apply middleware
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        const apiType = determineApiType(req);
        const user = await getAuthUserContext(req);
        return { user, req, apiType, isPublic: apiType === "public" };
      },
    })
  );

  // ✅ Redirect root
  app.get("/", (_req, res) => res.redirect("/graphql"));

  await ensureDatabaseSchema();
  await createDefaultSuperAdmin();

  const port = Number(process.env.PORT) || 8000;
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  console.log(`🚀 HTTP endpoint: http://localhost:${port}/graphql`);
  console.log(`🔌 WS subscriptions: ws://localhost:${port}/graphql`);
}

startServer().catch((err) => console.error("❌ Error starting server:", err));
