"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const server_1 = require("@apollo/server");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const ws_1 = require("ws");
const ws_2 = require("graphql-ws/lib/use/ws");
const schema_1 = require("./graphql/schema");
const authMiddleware_1 = require("./utils/authMiddleware");
const express5_1 = require("@as-integrations/express5");
const authMiddleware_2 = require("./utils/authMiddleware");
const graphql_1 = require("graphql");
const prismaMigrate_1 = require("./utils/prismaMigrate");
require("./jobs/workers"); // start BullMQ workers when Redis is available
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const customParseFormat_1 = __importDefault(require("dayjs/plugin/customParseFormat"));
const gemini_1 = require("./utils/gemini");
const vinDecode_1 = require("./utils/vinDecode");
const rateLimit_1 = require("./utils/rateLimit");
const depthLimit_1 = require("./utils/depthLimit");
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(customParseFormat_1.default);
const PUBLIC_OPERATIONS = new Set(["createBookDemo"]);
// Common CORS configuration used across routes
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
    : [];
const useCorsAllowlist = process.env.NODE_ENV === "production" && ALLOWED_ORIGINS.length > 0;
const collectOperationNames = (body) => {
    if (!body)
        return [];
    const bodies = Array.isArray(body) ? body : [body];
    const names = [];
    for (const entry of bodies) {
        if (!entry)
            continue;
        if (entry.operationName) {
            names.push(entry.operationName);
            continue;
        }
        if (typeof entry.query === "string") {
            try {
                const document = (0, graphql_1.parse)(entry.query);
                for (const definition of document.definitions) {
                    if (definition.kind !== "OperationDefinition") {
                        continue;
                    }
                    if (definition.name) {
                        names.push(definition.name.value);
                    }
                    else {
                        for (const selection of definition.selectionSet.selections) {
                            if (selection.kind === "Field") {
                                names.push(selection.name.value);
                            }
                        }
                    }
                }
            }
            catch (error) {
                console.error("Failed to parse GraphQL document", error);
            }
        }
    }
    return names;
};
const determineApiType = (req) => {
    const names = collectOperationNames(req.body);
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
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const httpServer = http_1.default.createServer(app);
    // ✅ Static folder
    const staticDir = path_1.default.join(__dirname, "..", "static");
    await fs_1.default.promises.mkdir(staticDir, { recursive: true });
    app.use("/static", express_1.default.static(staticDir));
    app.use((0, cors_1.default)({
        origin: useCorsAllowlist
            ? (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin))
            : true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }));
    const graphqlRateLimit = (0, rateLimit_1.rateLimit)({ max: 200, prefix: "graphql", windowMs: 15 * 60 * 1000 });
    const uploadRateLimit = (0, rateLimit_1.rateLimit)({ max: 20, prefix: "upload", windowMs: 15 * 60 * 1000 });
    // Allowed MIME types and extensions for uploads
    const ALLOWED_MIMES = new Set([
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
    ]);
    const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"]);
    const storage = multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, staticDir),
        filename: (_req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path_1.default.extname(file.originalname).toLowerCase();
            cb(null, `${uniqueSuffix}${ext || ".bin"}`);
        },
    });
    const upload = (0, multer_1.default)({
        storage,
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname || "").toLowerCase();
            const mimeOk = file.mimetype && ALLOWED_MIMES.has(file.mimetype);
            const extOk = ext && ALLOWED_EXT.has(ext);
            if (mimeOk && extOk)
                return cb(null, true);
            cb(new Error("File type not allowed. Allowed: images (jpeg, png, gif, webp) and PDF."));
        },
    });
    app.post("/upload", uploadRateLimit, async (req, res, next) => {
        const user = await (0, authMiddleware_2.getAuthUserContext)(req);
        if (!user)
            return res.status(401).json({ error: "Unauthorized" });
        req.user = user;
        next();
    }, upload.single("file"), (err, req, res, next) => {
        if (err)
            return res.status(400).json({ error: err?.message || "Upload failed" });
        next();
    }, (req, res) => {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const fileUrl = `${req.protocol}://${req.get("host")}/static/${req.file.filename}`;
        res.json({ fileUrl });
    });
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
            const vinPublicData = await (0, vinDecode_1.decodeVinPublicData)(vin);
            const docExtract = {
                ownershipStatus: null,
                registrationNo: null,
                insuranceProvider: null,
                policyNumber: null,
                invoiceDate: null,
                vendorName: null,
                serviceType: null,
                oilChangeRecord: null,
                invoiceMileage: null,
                maintenanceHistory: [],
            };
            for (const doc of documents) {
                if (!doc?.fileUrl)
                    continue;
                const fileType = doc.fileType || "application/pdf";
                const extracted = await (0, gemini_1.extractGeminiFields)(doc.fileUrl, fileType);
                if (!extracted)
                    continue;
                docExtract.registrationNo ?? (docExtract.registrationNo = extracted.registrationNo);
                docExtract.policyNumber ?? (docExtract.policyNumber = extracted.policyNumber);
                docExtract.invoiceDate ?? (docExtract.invoiceDate = extracted.invoiceDate);
                docExtract.vendorName ?? (docExtract.vendorName = extracted.vendorName);
                docExtract.serviceType ?? (docExtract.serviceType = extracted.serviceType);
                docExtract.oilChangeRecord ?? (docExtract.oilChangeRecord = extracted.oilChangeRecord);
                docExtract.invoiceMileage ?? (docExtract.invoiceMileage = extracted.invoiceMileage);
                if (extracted.invoiceDate ||
                    extracted.vendorName ||
                    extracted.serviceType ||
                    extracted.invoiceMileage ||
                    extracted.oilChangeRecord !== null) {
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
                conditionEvents: [],
                fraudChecks: {
                    duplicateInvoice: false,
                    mileageRollback: false,
                    vendorVerification: true,
                },
                listingStatus: { status: "PENDING" },
            };
            return res.json(response);
        }
        catch (error) {
            console.error("VIN verification error:", error?.message || error);
            return res.status(500).json({ error: "VIN verification failed" });
        }
    });
    // ✅ WebSocket + GraphQL subscriptions
    const wsServer = new ws_1.WebSocketServer({
        server: httpServer,
        path: "/graphql",
    });
    const serverCleanup = (0, ws_2.useServer)({
        schema: schema_1.schema,
        context: async (ctx) => {
            const token = ctx.connectionParams?.authorization || ctx.connectionParams?.Authorization;
            let user = null;
            if (token)
                user = await (0, authMiddleware_2.getAuthUserContext)({ headers: { authorization: token } });
            return { user };
        },
    }, wsServer);
    const server = new server_1.ApolloServer({
        schema: schema_1.schema,
        introspection: process.env.NODE_ENV !== "production",
        csrfPrevention: true,
        validationRules: [(0, depthLimit_1.depthLimitRule)(10)],
        plugins: [
            (0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer }),
            {
                async serverWillStart() {
                    return { async drainServer() { await serverCleanup.dispose?.(); } };
                },
            },
        ],
    });
    await server.start();
    app.use("/graphql", graphqlRateLimit, (0, express5_1.expressMiddleware)(server, {
        context: async ({ req }) => {
            const apiType = determineApiType(req);
            const user = await (0, authMiddleware_2.getAuthUserContext)(req);
            return { user, req, apiType, isPublic: apiType === "public" };
        },
    }));
    // ✅ Redirect root
    app.get("/", (_req, res) => res.redirect("/graphql"));
    await (0, prismaMigrate_1.ensureDatabaseSchema)();
    await (0, authMiddleware_1.createDefaultSuperAdmin)();
    const port = Number(process.env.PORT) || 8000;
    await new Promise((resolve) => httpServer.listen(port, resolve));
    console.log(`🚀 HTTP endpoint: http://localhost:${port}/graphql`);
    console.log(`🔌 WS subscriptions: ws://localhost:${port}/graphql`);
}
startServer().catch((err) => console.error("❌ Error starting server:", err));
