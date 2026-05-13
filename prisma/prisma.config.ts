import { defineConfig } from "prisma/config";
import { config } from "dotenv";
config({ path: ".env" });
export default defineConfig({
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL },
});
