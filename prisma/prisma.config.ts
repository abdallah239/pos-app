import { defineConfig } from '@prisma/ts-config'
export default defineConfig({
  orm: {
    adapter = "prisma-sqlite",
    from = "./schema.prisma"
  }
})