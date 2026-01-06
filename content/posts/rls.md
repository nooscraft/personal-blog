+++
title = "Exploring PostgreSQL Row-Level Security"
date = 2026-01-06
description = "Notes from implementing RLS in a multi-tenant setup—what worked, what surprised me, and what I'd do differently."
[taxonomies]
categories = ["Database"]
tags = ["postgresql", "rls", "security", "database"]
+++

I recently needed to implement data isolation for a multi-tenant application. The usual approach—filtering in application code—felt fragile. What if someone forgets to add the filter? What if a new service is added and the pattern isn't followed? These questions led me to explore PostgreSQL's Row-Level Security (RLS).

This is what I learned along the way.

---

## The Problem

The application had multiple tenants sharing the same database tables. Each tenant's data needed to be completely isolated—users from one tenant shouldn't see or modify data from another, even if they somehow bypassed application-level checks.

The traditional approach would be to add `WHERE tenant_id = ?` filters everywhere in the application code. But that's error-prone. A missed filter in one query, and you have a data leak. I wanted something that would enforce isolation at the database level, regardless of where the query came from.

That's where RLS comes in.

---

## What is RLS?

Row-Level Security lets you define policies that control which rows can be returned by queries. These policies run at the database level, so they apply whether the query comes from your application, a direct database connection, or even a third-party tool.

Think of it as a bouncer for your tables. Even if your application forgets to check credentials, the database won't.

---

## The Implementation

For this example, let's say we have a `documents` table where each document belongs to an `owner_id`. The goal: users should only see and modify their own documents. (These are example table and column names—adapt to your schema.)

### Enabling RLS

The first step is straightforward:

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
```

Once enabled, RLS blocks all access by default. You need to create policies to allow specific operations.

### Creating Policies

I decided to use a session variable to pass the current user ID. This keeps the policies simple and avoids fragile string matching or role-based approaches.

```sql
-- Users can only see their own documents
CREATE POLICY user_documents_select ON documents
  FOR SELECT
  USING (owner_id = current_setting('myapp.current_user_id')::int);

-- Users can only update their own documents
CREATE POLICY user_documents_update ON documents
  FOR UPDATE
  USING (owner_id = current_setting('myapp.current_user_id')::int);

-- Users can only delete their own documents
CREATE POLICY user_documents_delete ON documents
  FOR DELETE
  USING (owner_id = current_setting('myapp.current_user_id')::int);

-- Users can only insert documents with their own owner_id
CREATE POLICY user_documents_insert ON documents
  FOR INSERT
  WITH CHECK (owner_id = current_setting('myapp.current_user_id')::int);
```

The `USING` clause controls which rows are visible for SELECT, UPDATE, and DELETE. The `WITH CHECK` clause ensures new rows respect the policy on INSERT.

### Setting the Session Variable

The tricky part was ensuring the session variable is set correctly in the application. I ended up setting it at the start of each database connection or transaction:

```sql
BEGIN;
SET LOCAL myapp.current_user_id = '42';  -- Example user ID
SELECT * FROM documents;  -- Only sees documents where owner_id = 42
COMMIT;
```

In the application code (Node.js with `pg`), it looked like:

```js
await client.query("SELECT set_config('myapp.current_user_id', $1, false)", ['42']);  // Example user ID
const rows = await client.query('SELECT * FROM documents');
```

---

## What Surprised Me

### The INSERT Policy Gotcha

Initially, I only created SELECT, UPDATE, and DELETE policies. I assumed INSERT would just work. It didn't. Without an INSERT policy with `WITH CHECK`, users couldn't insert rows at all—RLS blocked everything.

The `WITH CHECK` clause is crucial for INSERT operations. It ensures that new rows being inserted actually match the policy criteria.

### Performance Considerations

I was worried about performance. Would RLS policies slow down queries? In my testing, the overhead was minimal for simple policies like `owner_id = current_setting(...)`. But I can see how complex policies with joins or subqueries could become a bottleneck.

The key is to keep policies simple and efficient. If you need complex logic, consider materialized views or application-level filters.

### Testing is Critical

RLS policies can be subtle. A policy that looks correct might have edge cases. I spent time testing different scenarios:
- What happens if the session variable isn't set?
- What if it's set to a non-existent user ID?
- What if multiple policies apply to the same operation?

Testing revealed that forgetting to set the session variable results in users seeing no data (or all data, depending on your policy setup). This is something you need to catch early.

---

## RLS vs Application Filters

I found myself thinking about the trade-offs. RLS centralizes security logic in the database, which is great for consistency. But it also means your security logic lives in the database, which can be harder to version control, test, and reason about compared to application code.

For this project, I went with RLS for the core isolation requirements. Business-specific filtering still happens in the application layer. It's a hybrid approach, but it feels like the right balance.

---

## Looking Back

If I were starting over:

1. **Start with a single table**: I tried to enable RLS on multiple tables at once. Starting with one table would have made debugging easier.

2. **Add better error handling**: When the session variable isn't set, queries fail silently or return unexpected results. Better error messages would help.

3. **Document the session variable pattern**: This is now part of our database connection setup, but it wasn't obvious at first. Clear documentation would have saved time.

4. **Test with different connection patterns**: I initially tested with simple queries, but real applications use connection pooling, transactions, and prepared statements. Testing those scenarios earlier would have caught issues sooner.

---

## The Bottom Line

RLS solved the problem I set out to solve. Data isolation is now enforced at the database level, which gives me confidence that even if application code has bugs, the database won't leak data between tenants.

It's not a silver bullet—there are trade-offs, and it requires careful implementation and testing. But for multi-tenant applications where data isolation is critical, RLS is worth exploring.

---

### Further Reading

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) – Official documentation
- [RLS Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html) – Policy syntax and options
