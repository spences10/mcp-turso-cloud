import type { ResultSet, Row } from '@libsql/client'

export interface TableInfo {
  name: string
  rowCount: number
  createdAt: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimary: boolean
  isUnique: boolean
}

export interface TableDetails extends TableInfo {
  columns: ColumnInfo[]
}

export interface Relationship {
  sourceTable: string
  sourceColumn: string
  targetTable: string
  targetColumn: string
}

export interface QueryResult {
  columns: string[]
  rows: Row[]
  totalRows: number
  page: number
  pageSize: number
}

export interface VectorSearchResult extends QueryResult {
  distances: number[]
}
