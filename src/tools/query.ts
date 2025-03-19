import { z } from 'zod'
import { TursoClient } from '../db/client'
import type { Config } from '../config'
import type { InValue } from '@libsql/client'

const ExecuteQuerySchema = z.object({
  method: z.literal('execute_query'),
  query: z.string(),
  params: z.record(z.unknown().transform((val): InValue => val as InValue)).optional(),
  page_size: z.number().min(1).max(100).optional(),
  page: z.number().min(1).optional(),
})

export class QueryTools {
  private client: TursoClient

  constructor(config: Config) {
    this.client = new TursoClient(config)
  }

  async executeQuery(params: z.infer<typeof ExecuteQuerySchema>) {
    const result = await this.client.executeQuery(
      params.query,
      params.params as Record<string, InValue> | undefined,
      params.page,
      params.page_size,
    )
    return {
      result,
      _meta: {},
    }
  }

  static getTools() {
    return [
      {
        name: 'execute_query',
        description: 'Execute SQL queries against a Turso database. Supports parameterized queries for security and complex query structures. Returns formatted results with pagination for large datasets.',
        inputSchema: ExecuteQuerySchema,
      },
    ]
  }
}
