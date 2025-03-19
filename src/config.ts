import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const ConfigSchema = z.object({
  TURSO_DATABASE_URL: z.string().url(),
  TURSO_AUTH_TOKEN: z.string().min(1),
  PORT: z.string().default('3000'),
})

export type Config = z.infer<typeof ConfigSchema>

export function loadConfig(): Config {
  const config = ConfigSchema.safeParse({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    PORT: process.env.PORT,
  })

  if (!config.success) {
    throw new Error(`Configuration error: ${config.error.message}`)
  }

  return config.data
}
