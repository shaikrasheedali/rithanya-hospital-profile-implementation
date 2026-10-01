import "dotenv/config";
import { ensureSeed } from "../src/seed.js";

async function main() {
  await ensureSeed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/db.js");
    await prisma.$disconnect();
  });
