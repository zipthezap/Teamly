# Tournament Hosting Production Readiness

This document defines the canonical readiness baseline for tournament hosting and is the source of truth for lifecycle, permissions, golden flows, and release gates.

## 1) Canonical lifecycle matrix

### Lifecycle statuses

`draft → registration → registration_closed → in_progress → completed`  
`cancelled` is terminal override.

### Allowed lifecycle transitions

| From | Allowed to |
|---|---|
| `draft` | `registration`, `registration_closed`, `in_progress`, `cancelled` |
| `registration` | `registration_closed`, `in_progress`, `cancelled` |
| `registration_closed` | `in_progress`, `cancelled` |
| `in_progress` | `completed`, `cancelled` |
| `completed` | _(none)_ |
| `cancelled` | _(none)_ |

### Lifecycle actions by status

| Action | Allowed statuses |
|---|---|
| Team self-registration | `draft`, `registration` |
| Tournament setup edit | `draft`, `registration`, `registration_closed` |
| Generate group matches (groups_knockout) | `registration_closed` |
| Generate/regenerate brackets | any non-terminal status |
| Start match | `in_progress` (or organizer/admin early-start from `registration_closed`) |

## 2) Permission matrix (backend intent)

| Capability | Organizer | Tournament Admin | Team Captain / Player | Public / Authenticated User |
|---|---:|---:|---:|---:|
| Create/update/delete tournament | ✅ | Scoped by permission | ❌ | ❌ |
| Manage teams/pools/categories/matches | ✅ | Scoped by permission | ❌ | ❌ |
| Submit score | ✅ | ✅ (with score permission) | ✅ (captain/player/referee/scorekeeper rules) | ❌ |
| Create/resolve disputes/incidents | ✅ | ✅ | context-dependent | ❌ |
| Payment status updates | ✅ | ✅ | ❌ | ❌ |
| Public portal read | n/a | n/a | n/a | ✅ (share token route) |
| Organizer analytics | ✅ | ✅ (authorized) | ❌ | ❌ |

## 3) Golden flows (must never regress)

1. Create tournament
2. Team registration
3. Registration close
4. Match/bracket generation
5. Game-day operations (start, score, schedule)
6. Disputes/incidents/payments
7. Tournament completion

Each flow must have positive + negative tests for lifecycle, permission, and input validation.

## 4) Release gates (backend + mobile)

A tournament release is blocked unless all gates pass:

1. **Contract gate**  
   - Tournament API + mobile contract tests green  
   - Lifecycle status mapping consistency green

2. **Behavior gate**  
   - Golden-flow tests green  
   - Lifecycle transition matrix tests green  
   - Concurrency/idempotency tests green for high-risk mutations

3. **Security gate**  
   - Authorization negative tests green  
   - Rate-limit coverage tests green for high-risk mutations  
   - CodeQL scan green (or accepted waivers documented)

4. **Operations gate**  
   - Lifecycle sync, incident SLA, and payment reminder runbooks updated  
   - Monitoring/metrics alerts configured and verified

5. **Documentation gate**  
   - API docs reflect current routes/statuses  
   - Legacy/deprecated route behavior documented

