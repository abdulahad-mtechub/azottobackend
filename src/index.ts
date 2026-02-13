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
import { extractGeminiFields } from "./utils/gemini";
import { decodeVinPublicData } from "./utils/vinDecode";
import { rateLimit } from "./utils/rateLimit";
import { depthLimitRule } from "./utils/depthLimit";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

const PUBLIC_OPERATIONS = new Set(["createBookDemo"]);

// Common CORS configuration used across routes
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
const useCorsAllowlist = process.env.NODE_ENV === "production" && ALLOWED_ORIGINS.length > 0;

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
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters. Refusing to start.");
  }

  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);

  // ✅ Static folder
  const staticDir = path.join(__dirname, "..", "static");
  await fs.promises.mkdir(staticDir, { recursive: true });
  app.use("/static", express.static(staticDir));

  app.use(
    cors({
      origin: useCorsAllowlist
        ? (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin))
        : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  const graphqlRateLimit = rateLimit({ max: 200, prefix: "graphql", windowMs: 15 * 60 * 1000 });
  const uploadRateLimit = rateLimit({ max: 20, prefix: "upload", windowMs: 15 * 60 * 1000 });

  // Allowed MIME types and extensions for uploads
  const ALLOWED_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ]);
  const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"]);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, staticDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uniqueSuffix}${ext || ".bin"}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const mimeOk = file.mimetype && ALLOWED_MIMES.has(file.mimetype);
      const extOk = ext && ALLOWED_EXT.has(ext);
      if (mimeOk && extOk) return cb(null, true);
      cb(new Error("File type not allowed. Allowed: images (jpeg, png, gif, webp) and PDF."));
    },
  });

  app.post(
    "/upload",
    uploadRateLimit,
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = await getAuthUserContext(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });
      (req as any).user = user;
      next();
    },
    upload.single("file"),
    (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err) return res.status(400).json({ error: err?.message || "Upload failed" });
      next();
    },
    (req: express.Request, res: express.Response) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `${req.protocol}://${req.get("host")}/static/${req.file.filename}`;
      res.json({ fileUrl });
    }
  );
  
  // ✅ VIN verification (documents + VIN)
  app.post("/api/v1/vin/verify", async (req, res) => {
    try {
      const { vin, documents } = req.body || {};
      if (!vin || typeof vin !== "string") {
        return res.status(400).json({ error: "vin is required" });
      }
      if (!Array.isArray(documents)) {
        return res.status(400).json({ error: "documents must be an array" });
      }

      const vinPublicData = await decodeVinPublicData(vin);

      const docExtract = {
        ownershipStatus: null as string | null,
        registrationNo: null as string | null,
        insuranceProvider: null as string | null,
        policyNumber: null as string | null,
        invoiceDate: null as string | null,
        vendorName: null as string | null,
        serviceType: null as string | null,
        oilChangeRecord: null as boolean | null,
        invoiceMileage: null as number | null,
        maintenanceHistory: [] as Array<{
          date: string | null;
          vendor: string | null;
          serviceType: string | null;
          mileage: number | null;
          oilChange: boolean | null;
        }>,
      };

      for (const doc of documents) {
        if (!doc?.fileUrl) continue;
        const fileType = doc.fileType || "application/pdf";
        const extracted = await extractGeminiFields(doc.fileUrl, fileType);
        if (!extracted) continue;

        docExtract.registrationNo ??= extracted.registrationNo;
        docExtract.policyNumber ??= extracted.policyNumber;
        docExtract.invoiceDate ??= extracted.invoiceDate;
        docExtract.vendorName ??= extracted.vendorName;
        docExtract.serviceType ??= extracted.serviceType;
        docExtract.oilChangeRecord ??= extracted.oilChangeRecord;
        docExtract.invoiceMileage ??= extracted.invoiceMileage;

        if (
          extracted.invoiceDate ||
          extracted.vendorName ||
          extracted.serviceType ||
          extracted.invoiceMileage ||
          extracted.oilChangeRecord !== null
        ) {
          docExtract.maintenanceHistory.push({
            date: extracted.invoiceDate,
            vendor: extracted.vendorName,
            serviceType: extracted.serviceType,
            mileage: extracted.invoiceMileage,
            oilChange: extracted.oilChangeRecord,
          });
        }
      }

      const response = {
        vinPublicData,
        docExtract,
        conditionMatrix: {
          greenLight: true,
          collisionStatus: "GREEN",
          riskColor: "GREEN",
          notes: "Pending automated analysis.",
        },
        conditionEvents: [] as Array<{
          type: string;
          source: string;
          severity: string;
          impact: string;
        }>,
        fraudChecks: {
          duplicateInvoice: false,
          mileageRollback: false,
          vendorVerification: true,
        },
        listingStatus: { status: "PENDING" },
      };

      return res.json(response);
    } catch (error: any) {
      console.error("VIN verification error:", error?.message || error);
      return res.status(500).json({ error: "VIN verification failed" });
    }
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

  const server = new ApolloServer({
    schema,
    introspection: process.env.NODE_ENV !== "production",
    csrfPrevention: true,
    validationRules: [depthLimitRule(10)],
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

  app.use(
    "/graphql",
    graphqlRateLimit,
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
