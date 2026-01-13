# Database ID Strategy - Quick Reference

## Current Implementation: UUIDs ✅

**All database models in Teamly use UUIDs (Universally Unique Identifiers) as primary keys.**

```prisma
model User {
  id  String  @id @default(uuid())
  // ... other fields
}
```

## Quick Facts

- **Type**: UUID v4 (128-bit random)
- **Format**: `550e8400-e29b-41d4-a716-446655440000`
- **Storage**: 16 bytes per ID
- **Generation**: Automatic via Prisma `@default(uuid())`

## Why UUIDs?

1. ✅ **Security**: Non-sequential, can't be enumerated
2. ✅ **Scalability**: Generate IDs anywhere, no coordination needed
3. ✅ **Privacy**: No information leakage about system size
4. ✅ **Distribution**: Perfect for multi-region/microservices
5. ✅ **Integration**: Safe to expose in APIs and webhooks

## Developer Guidelines

### ✅ DO

```typescript
// Treat IDs as strings
const userId: string = req.user.id;
const event = await prisma.event.findUnique({ 
  where: { id: eventId } 
});

// Pass as strings
res.json({ id: event.id });

// Validate UUID format (optional)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

### ❌ DON'T

```typescript
// Don't parse as integers
const id = parseInt(req.params.id); // WRONG

// Don't use Number()
const userId = Number(req.user.id); // WRONG

// Don't use autoincrement
id  Int  @id @default(autoincrement()) // WRONG for new models
```

## Common Patterns

### Controller: Get Resource by ID
```typescript
export const getEvent = async (req: Request, res: Response) => {
  const { id } = req.params; // Already a string
  
  const event = await prisma.event.findUnique({
    where: { id }
  });
  
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  res.json(event);
};
```

### Creating Resources
```typescript
const event = await prisma.event.create({
  data: {
    title: 'Football Match',
    creatorId: req.user.id, // UUID string
    groupId: req.body.groupId, // UUID string
    // ... other fields
  }
});

// event.id is automatically generated as UUID
console.log(event.id); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### Querying with Relations
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    createdEvents: true, // All events where this user is creator
    eventParticipants: true, // All participation records
  }
});
```

## Performance Considerations

### Already Optimized ✅

- All foreign keys properly indexed
- Composite indexes for common queries
- PostgreSQL's native UUID support is efficient

### No Action Needed

The current implementation already includes:
- Proper indexing strategy
- Optimized query patterns
- Efficient PostgreSQL UUID handling

## Migration from Integer IDs

**NOT NEEDED** - Teamly was built with UUIDs from the start. 

If you ever need to integrate with legacy systems that use integer IDs:
1. Keep UUIDs as primary keys
2. Add an optional `legacyId` integer field if needed
3. Never replace UUIDs with integers

## Testing with UUIDs

```typescript
// In tests, use realistic UUIDs or let Prisma generate them
describe('Event API', () => {
  it('should get event by ID', async () => {
    const event = await prisma.event.create({
      data: { /* ... */ }
    });
    
    // event.id is a valid UUID
    const response = await request(app)
      .get(`/api/events/${event.id}`)
      .expect(200);
  });
});
```

## Troubleshooting

### "Invalid ID format" errors

If you encounter ID validation errors:
1. Ensure you're passing the full UUID string
2. Check that no code is calling `parseInt()` or `Number()` on IDs
3. Verify the UUID matches the regex pattern

### Performance Issues

If you suspect UUID-related performance issues:
1. Check query execution plans (`EXPLAIN ANALYZE`)
2. Verify indexes are being used
3. Review the composite indexes in the schema
4. Check the slow query logs (already configured)

Performance issues are rarely caused by UUIDs themselves - usually it's missing indexes or inefficient queries.

## Further Reading

- Full analysis: [UUID_VS_INTEGER_IDS.md](./UUID_VS_INTEGER_IDS.md)
- Security docs: [../SECURITY.md](../SECURITY.md)
- Schema design: [../../prisma/schema.prisma](../../prisma/schema.prisma)

---

**Summary**: Teamly's UUID implementation is correct and optimal. No changes needed.
