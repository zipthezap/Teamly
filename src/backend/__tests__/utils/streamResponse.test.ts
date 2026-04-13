import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamJsonArray, streamNdjson, streamCsv, streamPaginatedJson, createBatchStream } from '../../utils/streamResponse';

// ---------------------------------------------------------------------------
// Mock res factory
// ---------------------------------------------------------------------------

const createMockRes = (headersSent = false) => {
  const written: string[] = [];
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  return {
    write: vi.fn((chunk: string) => { written.push(chunk); }),
    end: vi.fn(),
    setHeader: vi.fn(),
    status: statusFn,
    json: jsonFn,
    get headersSent() { return headersSent; },
    _written: written,
  };
};

/** Creates a mock res whose headersSent flips to true after the first write. */
const createMockResFlipping = () => {
  const written: string[] = [];
  let _headersSent = false;
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn });
  return {
    write: vi.fn((chunk: string) => { written.push(chunk); _headersSent = true; }),
    end: vi.fn(),
    setHeader: vi.fn(),
    status: statusFn,
    json: jsonFn,
    get headersSent() { return _headersSent; },
    _written: written,
  };
};

async function* emptyGen<T>(): AsyncGenerator<T, void, unknown> { /* yields nothing */ }

async function* itemsGen<T>(...items: T[]): AsyncGenerator<T, void, unknown> {
  for (const item of items) yield item;
}

// ---------------------------------------------------------------------------
// streamJsonArray
// ---------------------------------------------------------------------------

describe('streamJsonArray', () => {
  it('writes "[" and "]" for an empty generator, then ends', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => emptyGen());
    expect(res._written).toContain('[');
    expect(res._written).toContain(']');
    expect(res.end).toHaveBeenCalled();
  });

  it('writes a single item between "[" and "]"', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => itemsGen({ id: 1 }));
    const output = res._written.join('');
    expect(output).toBe('[{"id":1}]');
  });

  it('separates multiple items with commas and no leading/trailing comma', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => itemsGen({ id: 1 }, { id: 2 }, { id: 3 }));
    const output = res._written.join('');
    expect(output).toBe('[{"id":1},{"id":2},{"id":3}]');
  });

  it('sets Content-Type: application/json header', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
  });

  it('sets Transfer-Encoding: chunked header', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith('Transfer-Encoding', 'chunked');
  });

  it('calls res.status(500).json when generator throws and headersSent is false', async () => {
    const res = createMockRes(false);
    async function* throwingGen(): AsyncGenerator<never, void, unknown> {
      throw new Error('generator error');
    }
    await streamJsonArray(res as any, () => throwingGen());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('calls res.end() (not status 500) when generator throws and headersSent is true', async () => {
    const res = createMockRes(true);
    async function* throwingGen(): AsyncGenerator<never, void, unknown> {
      throw new Error('mid-stream error');
    }
    await streamJsonArray(res as any, () => throwingGen());
    expect(res.end).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('ends with res.end() after writing closes the array', async () => {
    const res = createMockRes();
    await streamJsonArray(res as any, () => itemsGen('a', 'b'));
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// streamNdjson
// ---------------------------------------------------------------------------

describe('streamNdjson', () => {
  it('writes each item as JSON followed by a newline', async () => {
    const res = createMockRes();
    await streamNdjson(res as any, () => itemsGen({ a: 1 }, { b: 2 }));
    expect(res._written).toContain('{"a":1}\n');
    expect(res._written).toContain('{"b":2}\n');
  });

  it('sets Content-Type: application/x-ndjson', async () => {
    const res = createMockRes();
    await streamNdjson(res as any, () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson');
  });

  it('calls res.end() after all items', async () => {
    const res = createMockRes();
    await streamNdjson(res as any, () => itemsGen({ x: 1 }));
    expect(res.end).toHaveBeenCalledTimes(1);
  });

  it('calls res.end() (not status 500) when generator throws and headersSent is true', async () => {
    const res = createMockRes(true);
    async function* errGen(): AsyncGenerator<never, void, unknown> {
      throw new Error('ndjson error');
    }
    await streamNdjson(res as any, () => errGen());
    expect(res.end).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// streamCsv
// ---------------------------------------------------------------------------

describe('streamCsv', () => {
  it('writes headers as the first CSV row', async () => {
    const res = createMockRes();
    await streamCsv(res as any, ['id', 'name', 'email'], () => emptyGen());
    const firstWrite = res._written[0];
    expect(firstWrite).toBe('id,name,email\n');
  });

  it('writes each data row as CSV', async () => {
    const res = createMockRes();
    await streamCsv(
      res as any,
      ['id', 'name'],
      () => itemsGen(['1', 'Alice'], ['2', 'Bob']),
    );
    const output = res._written.join('');
    expect(output).toContain('1,Alice\n');
    expect(output).toContain('2,Bob\n');
  });

  it('sets Content-Type: text/csv', async () => {
    const res = createMockRes();
    await streamCsv(res as any, ['id'], () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
  });

  it('sets Content-Disposition attachment header', async () => {
    const res = createMockRes();
    await streamCsv(res as any, ['id'], () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="export.csv"',
    );
  });

  it('wraps values containing commas in double quotes', async () => {
    const res = createMockRes();
    await streamCsv(
      res as any,
      ['field'],
      () => itemsGen(['hello, world']),
    );
    const output = res._written.join('');
    expect(output).toContain('"hello, world"');
  });

  it('calls res.end() after all rows', async () => {
    const res = createMockRes();
    await streamCsv(res as any, ['id'], () => itemsGen(['1']));
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// streamPaginatedJson
// ---------------------------------------------------------------------------

describe('streamPaginatedJson', () => {
  it('writes valid JSON containing metadata and data array', async () => {
    const res = createMockRes();
    const metadata = { limit: 10, offset: 0, total: 3 };
    await streamPaginatedJson(res as any, metadata, () => itemsGen({ id: 1 }, { id: 2 }, { id: 3 }));

    const output = res._written.join('');
    const parsed = JSON.parse(output);

    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('data is an empty array when generator yields nothing', async () => {
    const res = createMockRes();
    await streamPaginatedJson(res as any, { limit: 10, offset: 0 }, () => emptyGen());
    const parsed = JSON.parse(res._written.join(''));
    expect(parsed.data).toEqual([]);
  });

  it('sets Content-Type: application/json', async () => {
    const res = createMockRes();
    await streamPaginatedJson(res as any, { limit: 10, offset: 0 }, () => emptyGen());
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
  });

  it('calls res.end() at the end', async () => {
    const res = createMockRes();
    await streamPaginatedJson(res as any, { limit: 5, offset: 0 }, () => emptyGen());
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// createBatchStream
// ---------------------------------------------------------------------------

describe('createBatchStream', () => {
  it('yields all items across multiple full batches', async () => {
    const allItems = [1, 2, 3, 4, 5, 6];
    const fetchBatch = vi.fn(async (offset: number, limit: number) => {
      return allItems.slice(offset, offset + limit);
    });

    const gen = createBatchStream(fetchBatch, 3);
    const collected: number[] = [];
    for await (const item of gen()) {
      collected.push(item);
    }

    expect(collected).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fetchBatch).toHaveBeenCalledTimes(3); // [1-3], [4-6], [] (stops)
  });

  it('stops when fetchBatch returns an empty array', async () => {
    const fetchBatch = vi.fn(async () => []);
    const gen = createBatchStream(fetchBatch, 10);
    const collected: never[] = [];
    for await (const item of gen()) {
      collected.push(item);
    }
    expect(collected).toEqual([]);
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it('stops when batch length is less than batchSize (last partial page)', async () => {
    const items = [1, 2, 3, 4, 7]; // 5 items, batchSize 10 → one partial batch
    const fetchBatch = vi.fn(async (offset: number, limit: number) => {
      const slice = items.slice(offset, offset + limit);
      return slice;
    });

    const gen = createBatchStream(fetchBatch, 10);
    const collected: number[] = [];
    for await (const item of gen()) {
      collected.push(item);
    }

    expect(collected).toEqual(items);
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it('calls fetchBatch with increasing offsets', async () => {
    const allItems = ['a', 'b', 'c', 'd'];
    const fetchBatch = vi.fn(async (offset: number, limit: number) => {
      return allItems.slice(offset, offset + limit);
    });

    const gen = createBatchStream(fetchBatch, 2);
    for await (const _ of gen()) { /* drain */ }

    expect(fetchBatch).toHaveBeenNthCalledWith(1, 0, 2);
    expect(fetchBatch).toHaveBeenNthCalledWith(2, 2, 2);
    expect(fetchBatch).toHaveBeenNthCalledWith(3, 4, 2); // empty → stops
  });

  it('uses default batchSize of 50', async () => {
    const fetchBatch = vi.fn(async () => []);
    const gen = createBatchStream(fetchBatch);
    for await (const _ of gen()) { /* drain */ }
    expect(fetchBatch).toHaveBeenCalledWith(0, 50);
  });
});
