import { createClient, Client, ResultSet, InValue } from '@libsql/client'
import type { Config } from '../config'
import type { QueryResult } from '../common/types'

export class TursoClient {
  private client: Client

  constructor(config: Config) {
    this.client = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
    })
  }

  async executeQuery(
    query: string,
    params: Record<string, InValue> = {},
    page = 1,
    pageSize = 10,
  ): Promise<QueryResult> {
    const offset = (page - 1) * pageSize
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`
    
    try {
      const paramArray = Object.values(params)
      const [countResult, dataResult] = await Promise.all([
        this.client.execute(countQuery, paramArray),
        this.client.execute(`${query} LIMIT ${pageSize} OFFSET ${offset}`, paramArray),
      ])

      const totalRows = Number((countResult.rows[0] as any).total)
      const columns = dataResult.columns ?? []

      return {
        columns,
        rows: dataResult.rows,
        totalRows,
        page,
        pageSize,
      }
    } catch (error) {
      throw new Error(`Query execution failed: ${(error as Error).message}`)
    }
  }

  async vectorSearch(
    table: string,
    vectorColumn: string,
    queryVector: number[],
    limit = 10,
    additionalColumns: string[] = [],
  ): Promise<QueryResult> {
    const columns = [...additionalColumns, vectorColumn]
    const columnList = columns.join(', ')
    const query = `
      SELECT ${columnList}, 
             l2_distance(${vectorColumn}, json_array(${queryVector.join(', ')})) as distance
      FROM ${table}
      ORDER BY distance ASC
      LIMIT ${limit}
    `

    const result = await this.executeQuery(query)
    return {
      ...result,
      columns: [...result.columns.filter(c => c !== 'distance'), 'distance'],
      rows: result.rows.map(row => ({
        ...row,
        [vectorColumn]: typeof row[vectorColumn] === 'string' ? JSON.parse(row[vectorColumn] as string) : row[vectorColumn],
      })),
    }
  }

  async getTables(): Promise<ResultSet> {
    return await this.client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
  }

  async describeTable(tableName: string): Promise<ResultSet> {
    return await this.client.execute(`PRAGMA table_info(${tableName})`)
  }

  async getRelationships(): Promise<ResultSet> {
    return await this.client.execute(
      "SELECT * FROM sqlite_master WHERE type='table' AND sql LIKE '%FOREIGN KEY%'"
    )
  }
}
