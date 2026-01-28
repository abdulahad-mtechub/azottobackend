import { spawn } from "child_process";

let hasRun = false;

const shouldSkip = () =>
  process.env.SKIP_PRISMA_MIGRATE?.toLowerCase() === "true";

export const ensureDatabaseSchema = async () => {
  if (hasRun || shouldSkip()) {
    return;
  }

  hasRun = true;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`prisma migrate deploy exited with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
};
