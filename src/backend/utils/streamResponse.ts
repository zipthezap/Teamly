/**
 * Response Streaming Utilities
 * 
 * Provides utilities for streaming large datasets to clients in chunks,
 * reducing memory usage and improving time-to-first-byte.
 */

import { Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Stream array data as JSON
 * 
 * Instead of loading all data into memory and sending at once,
 * this streams items as they're processed, reducing memory usage.
 * 
 * @example
 * await streamJsonArray(res, async function* () {
 *   const sessions = await prisma.session.findMany();
 *   for (const session of events) {
 *     yield session;
 *   }
 * });
 */
export async function streamJsonArray<T>(
  res: Response,
  generator: () => AsyncGenerator<T, void, unknown>
): Promise<void> {
  try {
    // Set headers for streaming JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Start JSON array
    res.write('[');
    
    let isFirst = true;
    const gen = generator();
    
    for await (const item of gen) {
      // Add comma before items (except the first one)
      if (!isFirst) {
        res.write(',');
      } else {
        isFirst = false;
      }
      
      // Write item as JSON
      res.write(JSON.stringify(item));
    }
    
    // Close JSON array
    res.write(']');
    res.end();
  } catch (error) {
    logger.error('Error streaming JSON array', 'StreamResponse', { error });
    
    // If response hasn't started, send error
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming response' });
    } else {
      // If response already started, close it
      res.end();
    }
  }
}

/**
 * Stream NDJSON (Newline Delimited JSON)
 * 
 * Each line is a complete JSON object, making it easy to parse incrementally.
 * Useful for real-time data feeds and large exports.
 * 
 * @example
 * await streamNdjson(res, async function* () {
 *   for (const session of events) {
 *     yield session;
 *   }
 * });
 */
export async function streamNdjson<T>(
  res: Response,
  generator: () => AsyncGenerator<T, void, unknown>
): Promise<void> {
  try {
    // Set headers for NDJSON streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    const gen = generator();
    
    for await (const item of gen) {
      // Write each item as JSON followed by newline
      res.write(JSON.stringify(item) + '\n');
    }
    
    res.end();
  } catch (error) {
    logger.error('Error streaming NDJSON', 'StreamResponse', { error });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming response' });
    } else {
      res.end();
    }
  }
}

/**
 * Stream CSV data
 * 
 * Useful for exporting large datasets to CSV format.
 * 
 * @example
 * await streamCsv(res, ['id', 'name', 'email'], async function* () {
 *   for (const user of users) {
 *     yield [user.id, user.name, user.email];
 *   }
 * });
 */
export async function streamCsv(
  res: Response,
  headers: string[],
  generator: () => AsyncGenerator<unknown[], void, unknown>
): Promise<void> {
  try {
    // Set headers for CSV streaming
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
    
    // Write CSV header row
    res.write(headers.map(escapeCSV).join(',') + '\n');
    
    const gen = generator();
    
    for await (const row of gen) {
      // Write each row
      res.write(row.map(escapeCSV).join(',') + '\n');
    }
    
    res.end();
  } catch (error) {
    logger.error('Error streaming CSV', 'StreamResponse', { error });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming response' });
    } else {
      res.end();
    }
  }
}

/**
 * Escape CSV field (handle quotes and commas)
 */
function escapeCSV(field: unknown): string {
  if (field === null || field === undefined) {
    return '';
  }
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

/**
 * Stream JSON with pagination metadata
 * 
 * Useful for paginated API responses with streaming support.
 * 
 * @example
 * await streamPaginatedJson(res, {
 *   limit: 50,
 *   offset: 0,
 *   total: 1000
 * }, async function* () {
 *   for (const item of items) {
 *     yield item;
 *   }
 * });
 */
export async function streamPaginatedJson<T>(
  res: Response,
  metadata: { limit: number; offset: number; total?: number; hasMore?: boolean },
  generator: () => AsyncGenerator<T, void, unknown>
): Promise<void> {
  try {
    // Set headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Start JSON object with metadata - write each part separately
    res.write('{"metadata":');
    res.write(JSON.stringify(metadata));
    res.write(',"data":');
    
    // Start array
    res.write('[');
    
    let isFirst = true;
    const gen = generator();
    
    for await (const item of gen) {
      if (!isFirst) {
        res.write(',');
      } else {
        isFirst = false;
      }
      res.write(JSON.stringify(item));
    }
    
    // Close array and object
    res.write(']}');
    res.end();
  } catch (error) {
    logger.error('Error streaming paginated JSON', 'StreamResponse', { error });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming response' });
    } else {
      res.end();
    }
  }
}

/**
 * Batch processor for streaming
 * 
 * Processes data in batches to avoid loading everything into memory.
 * 
 * @example
 * const batchStream = createBatchStream(
 *   async (offset, limit) => {
 *     return prisma.session.findMany({
 *       skip: offset,
 *       take: limit
 *     });
 *   },
 *   50 // batch size
 * );
 * 
 * await streamJsonArray(res, batchStream);
 */
export function createBatchStream<T>(
  fetchBatch: (offset: number, limit: number) => Promise<T[]>,
  batchSize: number = 50
): () => AsyncGenerator<T, void, unknown> {
  return async function* () {
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const batch = await fetchBatch(offset, batchSize);
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      for (const item of batch) {
        yield item;
      }
      
      offset += batch.length;
      hasMore = batch.length === batchSize;
    }
  };
}

logger.info('Response streaming utilities initialized', 'StreamResponse');
