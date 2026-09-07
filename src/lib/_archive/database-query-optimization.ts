// Database Query Optimization Utilities - Phase 3 Week 10
import { Prisma } from '@prisma/client';

// Query optimization patterns and utilities
interface QueryOptimizationRule {
  name: string;
  pattern: RegExp;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  autoFix?: (query: string) => string;
}

interface OptimizedQuery {
  original: string;
  optimized: string;
  improvements: string[];
  estimatedSpeedup: number;
}

interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

// Query Optimization Engine
class QueryOptimizer {
  private static instance: QueryOptimizer;
  private optimizationRules: QueryOptimizationRule[];
  private indexSuggestions: Map<string, IndexSuggestion> = new Map();
  private queryPatterns: Map<string, number> = new Map();

  constructor() {
    this.optimizationRules = this.initializeRules();
  }

  static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  private initializeRules(): QueryOptimizationRule[] {
    return [
      {
        name: 'Missing WHERE clause',
        pattern: /SELECT.*FROM\s+\w+(?!\s+WHERE)/i,
        suggestion: 'Add WHERE clause to limit results and improve performance',
        severity: 'high',
      },
      {
        name: 'SELECT * usage',
        pattern: /SELECT\s+\*/i,
        suggestion: 'Select only required columns instead of using SELECT *',
        severity: 'medium',
        autoFix: (query) => {
          // This is a simplified autofix - in practice, you'd need to know which columns are needed
          return query.replace(/SELECT\s+\*/i, 'SELECT id, name, created_at');
        },
      },
      {
        name: 'Missing LIMIT clause',
        pattern: /SELECT.*FROM\s+\w+.*(?!LIMIT)/i,
        suggestion: 'Add LIMIT clause to prevent excessive data retrieval',
        severity: 'medium',
      },
      {
        name: 'Inefficient LIKE pattern',
        pattern: /LIKE\s+['"]%.*%['"]/i,
        suggestion: 'Leading wildcard in LIKE prevents index usage - consider full-text search',
        severity: 'high',
      },
      {
        name: 'OR in WHERE clause',
        pattern: /WHERE.*\bOR\b/i,
        suggestion: 'OR conditions can prevent index usage - consider UNION or IN clause',
        severity: 'medium',
      },
      {
        name: 'Function in WHERE clause',
        pattern: /WHERE\s+\w+\s*\([^)]*\)\s*[=<>]/i,
        suggestion: 'Functions in WHERE clause prevent index usage',
        severity: 'high',
      },
      {
        name: 'Missing JOIN optimization',
        pattern: /FROM\s+\w+\s*,\s*\w+\s+WHERE/i,
        suggestion: 'Use explicit JOIN syntax instead of comma-separated tables',
        severity: 'medium',
        autoFix: (query) => {
          // Convert comma joins to explicit JOINs
          return query.replace(
            /FROM\s+(\w+)\s*,\s*(\w+)\s+WHERE\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i,
            'FROM $1 JOIN $2 ON $1.$4 = $2.$6 WHERE'
          );
        },
      },
      {
        name: 'Inefficient ORDER BY',
        pattern: /ORDER\s+BY\s+[^,\s]+(?:\s+DESC|\s+ASC)?\s*$/i,
        suggestion: 'ORDER BY without proper indexing can be slow on large datasets',
        severity: 'medium',
      },
    ];
  }

  // Analyze and optimize a single query
  optimizeQuery(query: string): OptimizedQuery {
    const improvements: string[] = [];
    let optimizedQuery = query;
    let estimatedSpeedup = 1;

    // Track query patterns
    const normalizedQuery = this.normalizeQuery(query);
    const currentCount = this.queryPatterns.get(normalizedQuery) || 0;
    this.queryPatterns.set(normalizedQuery, currentCount + 1);

    // Apply optimization rules
    for (const rule of this.optimizationRules) {
      if (rule.pattern.test(query)) {
        improvements.push(`${rule.severity.toUpperCase()}: ${rule.suggestion}`);
        
        // Apply auto-fix if available
        if (rule.autoFix) {
          optimizedQuery = rule.autoFix(optimizedQuery);
          estimatedSpeedup *= rule.severity === 'high' ? 2.5 : rule.severity === 'medium' ? 1.5 : 1.2;
        }

        // Generate index suggestions
        this.generateIndexSuggestion(query, rule);
      }
    }

    return {
      original: query,
      optimized: optimizedQuery,
      improvements,
      estimatedSpeedup,
    };
  }

  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/['"]\w+['"]/g, '?') // Replace string literals
      .replace(/\b\d+\b/g, '?') // Replace numbers
      .trim();
  }

  private generateIndexSuggestion(query: string, rule: QueryOptimizationRule): void {
    const lowerQuery = query.toLowerCase();

    // Extract table and column information
    const tableMatch = lowerQuery.match(/from\s+(\w+)/);
    const whereMatch = lowerQuery.match(/where\s+(\w+)/);
    const orderByMatch = lowerQuery.match(/order\s+by\s+(\w+)/);
    const joinMatch = lowerQuery.match(/join\s+\w+\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/);

    if (tableMatch) {
      const tableName = tableMatch[1];
      let columns: string[] = [];
      let indexType: 'btree' | 'hash' | 'gin' | 'gist' = 'btree';
      let reason = '';
      let priority: 'low' | 'medium' | 'high' = 'medium';

      if (rule.name === 'Inefficient LIKE pattern') {
        const likeMatch = lowerQuery.match(/(\w+)\s+like/);
        if (likeMatch) {
          columns = [likeMatch[1]];
          indexType = 'gin';
          reason = 'Full-text search optimization';
          priority = 'high';
        }
      } else if (rule.name === 'Inefficient ORDER BY' && orderByMatch) {
        columns = [orderByMatch[1]];
        reason = 'ORDER BY optimization';
        priority = 'medium';
      } else if (whereMatch) {
        columns = [whereMatch[1]];
        reason = 'WHERE clause optimization';
        priority = 'high';
      } else if (joinMatch) {
        columns = [joinMatch[2], joinMatch[4]];
        reason = 'JOIN optimization';
        priority = 'high';
      }

      if (columns.length > 0) {
        const suggestionKey = `${tableName}_${columns.join('_')}`;
        this.indexSuggestions.set(suggestionKey, {
          table: tableName,
          columns,
          type: indexType,
          reason,
          priority,
        });
      }
    }
  }

  // Get all index suggestions
  getIndexSuggestions(): IndexSuggestion[] {
    return Array.from(this.indexSuggestions.values());
  }

  // Generate optimized Prisma queries
  optimizePrismaQuery(model: string, operation: string, args: any): any {
    const optimized = { ...args };

    // Optimize select operations
    if (operation === 'findMany' || operation === 'findFirst') {
      // Add pagination if missing
      if (!optimized.take && !optimized.first) {
        optimized.take = 20; // Default reasonable limit
      }

      // Optimize includes/selects
      if (optimized.include) {
        optimized.include = this.optimizeIncludes(optimized.include);
      }

      // Add orderBy for consistent results
      if (!optimized.orderBy && operation === 'findMany') {
        optimized.orderBy = { id: 'desc' };
      }
    }

    // Optimize where clauses
    if (optimized.where) {
      optimized.where = this.optimizeWhereClause(optimized.where);
    }

    return optimized;
  }

  private optimizeIncludes(include: any): any {
    const optimized = { ...include };

    // Limit nested includes to prevent N+1 queries
    Object.keys(optimized).forEach(key => {
      if (typeof optimized[key] === 'object' && optimized[key].include) {
        // Limit depth of nested includes
        delete optimized[key].include;
        console.warn(`Removed nested include for ${key} to prevent performance issues`);
      }

      // Add take limits to array relations
      if (typeof optimized[key] === 'object' && !optimized[key].take) {
        optimized[key].take = 10; // Reasonable default
      }
    });

    return optimized;
  }

  private optimizeWhereClause(where: any): any {
    const optimized = { ...where };

    // Convert OR conditions to more efficient alternatives where possible
    if (optimized.OR && Array.isArray(optimized.OR)) {
      // Check if OR conditions can be converted to IN
      const orConditions = optimized.OR;
      const firstCondition = orConditions[0];
      
      if (firstCondition && typeof firstCondition === 'object') {
        const keys = Object.keys(firstCondition);
        
        if (keys.length === 1) {
          const key = keys[0];
          const allSameKey = orConditions.every(
            (condition: any) => Object.keys(condition).length === 1 && condition[key] !== undefined
          );

          if (allSameKey) {
            const values = orConditions.map((condition: any) => condition[key]);
            delete optimized.OR;
            optimized[key] = { in: values };
            console.log(`Optimized OR condition to IN clause for ${key}`);
          }
        }
      }
    }

    // Optimize string searches
    Object.keys(optimized).forEach(key => {
      const condition = optimized[key];
      
      if (condition && typeof condition === 'object' && condition.contains) {
        // Suggest using search for better performance on large text fields
        if (typeof condition.contains === 'string' && condition.contains.length > 2) {
          console.info(`Consider using full-text search for field ${key}`);
        }
      }
    });

    return optimized;
  }

  // Analyze query patterns for optimization opportunities
  analyzeQueryPatterns(): {
    frequentQueries: Array<{ query: string; count: number; suggestions: string[] }>;
    recommendations: string[];
  } {
    const frequentQueries = Array.from(this.queryPatterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({
        query,
        count,
        suggestions: this.optimizeQuery(query).improvements,
      }));

    const recommendations: string[] = [];

    // Analyze patterns
    if (frequentQueries.some(q => q.query.includes('select *'))) {
      recommendations.push('Multiple queries use SELECT * - consider selecting specific columns');
    }

    if (frequentQueries.some(q => !q.query.includes('limit'))) {
      recommendations.push('Many queries lack LIMIT clauses - add pagination to improve performance');
    }

    const indexSuggestions = this.getIndexSuggestions();
    if (indexSuggestions.length > 0) {
      recommendations.push(`Consider adding ${indexSuggestions.length} database indexes for better performance`);
    }

    return {
      frequentQueries,
      recommendations,
    };
  }

  // Generate migration script for suggested indexes
  generateIndexMigrations(): string {
    const suggestions = this.getIndexSuggestions()
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

    if (suggestions.length === 0) {
      return '-- No index suggestions available';
    }

    let migration = '-- Generated Index Migration\n';
    migration += '-- Phase 3 Week 10: Database Performance Optimization\n\n';

    suggestions.forEach((suggestion, index) => {
      const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
      const columnList = suggestion.columns.join(', ');
      
      migration += `-- ${suggestion.reason} (Priority: ${suggestion.priority})\n`;
      
      if (suggestion.type === 'gin') {
        migration += `CREATE INDEX CONCURRENTLY ${indexName} ON ${suggestion.table} USING GIN (${columnList});\n`;
      } else if (suggestion.type === 'hash') {
        migration += `CREATE INDEX CONCURRENTLY ${indexName} ON ${suggestion.table} USING HASH (${columnList});\n`;
      } else {
        migration += `CREATE INDEX CONCURRENTLY ${indexName} ON ${suggestion.table} (${columnList});\n`;
      }
      
      migration += '\n';
    });

    return migration;
  }

  // Clear collected data
  reset(): void {
    this.queryPatterns.clear();
    this.indexSuggestions.clear();
  }
}

// Prisma query optimization middleware
export function createQueryOptimizationMiddleware() {
  const optimizer = QueryOptimizer.getInstance();

  return Prisma.defineExtension({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Optimize the query arguments
          const optimizedArgs = optimizer.optimizePrismaQuery(model, operation, args);
          
          // Execute with optimized arguments
          const result = await query(optimizedArgs);
          
          // Track the query for pattern analysis
          const queryInfo = `${model}.${operation}(${JSON.stringify(optimizedArgs)})`;
          // In a real implementation, you'd extract the SQL query here
          
          return result;
        },
      },
    },
  });
}

// Query performance utilities
export const queryUtils = {
  // Build efficient pagination
  buildPagination: (page: number, pageSize: number = 20) => {
    const maxPageSize = 100;
    const safePageSize = Math.min(pageSize, maxPageSize);
    const skip = Math.max(0, (page - 1) * safePageSize);
    
    return {
      take: safePageSize,
      skip,
    };
  },

  // Build efficient search conditions
  buildSearchConditions: (searchTerm: string, fields: string[]) => {
    if (!searchTerm || fields.length === 0) return {};

    const conditions = fields.map(field => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    }));

    return {
      OR: conditions,
    };
  },

  // Build efficient filter conditions
  buildFilterConditions: (filters: Record<string, any>) => {
    const conditions: any = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          conditions[key] = { in: value };
        }
      } else if (typeof value === 'string' && value.includes('*')) {
        conditions[key] = {
          contains: value.replace(/\*/g, ''),
          mode: 'insensitive',
        };
      } else {
        conditions[key] = value;
      }
    });

    return conditions;
  },

  // Build efficient sorting
  buildSortConditions: (sortBy?: string, sortOrder: 'asc' | 'desc' = 'desc') => {
    if (!sortBy) {
      return { id: sortOrder }; // Default sort
    }

    return { [sortBy]: sortOrder };
  },

  // Optimize includes for better performance
  optimizeIncludes: (includes: string[]): any => {
    const includeObj: any = {};
    
    includes.forEach(include => {
      const parts = include.split('.');
      let current = includeObj;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = {
            take: 10, // Limit nested results
            orderBy: { id: 'desc' },
          };
        } else {
          current[part] = current[part] || { include: {} };
          current = current[part].include;
        }
      });
    });

    return includeObj;
  },
};

// Export singleton instance
export const queryOptimizer = QueryOptimizer.getInstance();

// Export types and utilities
export {
  QueryOptimizer,
  type QueryOptimizationRule,
  type OptimizedQuery,
  type IndexSuggestion,
};