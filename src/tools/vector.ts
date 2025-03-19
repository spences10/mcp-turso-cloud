import { z } from 'zod'
import { TursoClient } from '../db/client'
import type { Config } from '../config'

const VectorSearchSchema = z.object({
  method: z.literal('vector_search'),
  table: z.string(),
  vector_column: z.string(),
  query_vector: z.string().transform(v => JSON.parse(v)),
  limit: z.number().min(1).max(100).optional(),
  additional_columns: z.array(z.string()).optional(),
})

const HybridSearchSchema = z.object({
  method: z.literal('hybrid_search'),
  table: z.string(),
  vector_column: z.string(),
  filter_conditions: z.string(),
  query_vector: z.string().transform(v => JSON.parse(v)),
  limit: z.number().min(1).max(100).optional(),
  additional_columns: z.array(z.string()).optional(),
})

export class VectorTools {
  private client: TursoClient

  constructor(config: Config) {
    this.client = new TursoClient(config)
  }

  async vectorSearch(params: z.infer<typeof VectorSearchSchema>) {
    const result = await this.client.vectorSearch(
      params.table,
      params.vector_column,
      params.query_vector,
      params.limit,
      params.additional_columns,
    )
    return {
      result,
      _meta: {},
    }
  }

  async hybridSearch(params: z.infer<typeof HybridSearchSchema>) {
    const columns = [...(params.additional_columns || []), params.vector_column]
    const columnList = columns.join(', ')
    const query = `
      WITH filtered AS (
        SELECT ${columnList}
        FROM ${params.table}
        WHERE ${params.filter_conditions}
      )
      SELECT *, 
             l2_distance(${params.vector_column}, json_array(${params.query_vector.join(', ')})) as distance
      FROM filtered
      ORDER BY distance ASC
      LIMIT ${params.limit || 10}
    `

    const result = await this.client.executeQuery(query)
    return {
      result,
      _meta: {},
    }
  }

  static getTools() {
    return [
      {
        name: 'vector_search',
        description: 'Perform semantic similarity search using Turso\'s vector capabilities. Uses the l2_distance function for approximate nearest neighbor search.',
        inputSchema: VectorSearchSchema,
      },
      {
        name: 'hybrid_search',
        description: 'Combine traditional SQL filtering with vector similarity search. Filter results by regular columns before applying vector similarity.',
        inputSchema: HybridSearchSchema,
      },
    ]
  }
}
