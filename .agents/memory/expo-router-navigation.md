---
name: Expo Router dynamic route navigation
description: How to navigate to dynamic routes in Expo Router without TypeScript errors
---

## Pattern
Template literal paths like `/game/${id}` fail TypeScript checks in Expo Router because the router's typed `push()` only accepts known literal paths.

## Correct approach
Use the pathname + params object form:
```typescript
router.push({ pathname: "/game/[id]", params: { id: game.id } } as any)
```

The `as any` is needed because the Href generic doesn't infer the union of all dynamic segment combos. This is safe at runtime — Expo Router resolves it correctly.

**Why:** Expo Router generates strict union types for all known routes; dynamic segments are typed as literal bracket patterns, not as string interpolations.
