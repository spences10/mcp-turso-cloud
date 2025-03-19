import { z } from 'zod'
import { TursoClient } from '../db/client'
import type { Config } from '../config'
import type { Row } from '@libsql/client'

const ListTablesSchema = z.object({
  method: z.literal('list_tables'),
})

const DescribeTableSchema = z.object({
  method: z.literal('describe_table'),
  table: z.string(),
})

const ListRelationshipsSchema = z.object({
  method: z.literal('list_relationships'),
})

export class SchemaTools {
  private client: TursoClient

  constructor(config: Config) {
    this.client = new TursoClient(config)
  }

  async listTables() {
    const result = await this.client.getTables()
    return {
      tables: result.rows.map((row: Row) => ({
        name: row.name as string,
        type: 'table',
      })),
    }
  }

  async describeTable(params: z.infer<typeof DescribeTableSchema>) {
    const result = await this.client.describeTable(params.table)
    return {
      columns: result.rows.map((col: Row) => ({
        name: col.name as string,
        type: col.type as string,
        nullable: col.notnull === 0,
        isPrimary: col.pk === 1,
      })),
    }
  }

  async listRelationships() {
    const result = await this.client.getRelationships()
    return {
      relationships: result.rows.map((rel: Row) => ({
        sourceTable: rel.tbl_name as string,
        sql: rel.sql as string,
      })),
    }
  }

  static getTools() {
    return [
      {
        name: 'list_tables',
        description: 'List all tables in the connected Turso database. Returns table names and types.',
        inputSchema: ListTablesSchema,
      },
      {
        name: 'describe_table',
        description: 'Get detailed information about a specific table including columns, types, and constraints.',
        inputSchema: DescribeTableSchema,
      },
      {
        name: 'list_relationships',
        description: 'Discover foreign key relationships between tables in the database.',
        inputSchema: ListRelationshipsSchema,
      },
    ]
  }
}
