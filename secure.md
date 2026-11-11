# Spendly / Trackey — Security Standards & Implementation Guidelines (`secure.md`)

> **MANDATORY SECURITY DIRECTIVE**
> Always consult and strictly adhere to this document whenever modifying, refactoring, deploying, or adding new features to this repository. Every commit, API endpoint, form, and database interaction must satisfy these security guidelines.

---

## 1. Secure Deployment & Infrastructure Security

> *"Configure the application for secure deployment. Enforce HTTPS, ensure secrets are stored securely, restrict direct database access from the public internet, and add logging for authentication attempts, API errors, and unusual traffic patterns so suspicious behavior can be detected."*

### Implementation Directives:
- **Enforce HTTPS Only**:
  - All production traffic must be served strictly over HTTPS. Never allow mixed content or fallback to unencrypted HTTP in production.
  - HSTS (`Strict-Transport-Security`) headers must be configured with `max-age=63072000; includeSubDomains; preload`.
  - Security headers must be enforced in deployment configurations (`vercel.json` / reverse proxy):
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - Robust `Content-Security-Policy` (CSP).
- **Database & Secret Protection**:
  - Restrict direct database access from the public internet: utilize connection pooling, Supabase network restrictions, and IP allowlisting where feasible.
  - Never allow raw administrative database ports or direct Postgres endpoints to be unprotected.
- **Audit & Security Logging**:
  - Log all authentication attempts (successful logins, failed attempts, logouts, session revocations) with timestamps, obfuscated identifiers, and client metadata (e.g. user-agent).
  - Log API errors and unexpected failures to alert monitoring systems.
  - Implement heuristics to detect unusual traffic spikes, repeated 4xx/5xx responses, and brute-force patterns.

---

## 2. Input Validation, Sanitization & Injection Prevention

> *"Identify every place where user input enters the system including forms, APIs, uploads, and query parameters. Add strict validation and sanitization to prevent SQL injection, command injection, script injection, and unsafe file uploads. Reject invalid data and enforce strict input types."*

### Implementation Directives:
- **Input Boundaries**:
  - Audit all entry points: form inputs (expenses, salaries, lending, cash, loans, EMIs, user profile, PINs), query parameters, URL parameters, file imports/uploads (CSV, receipts), and webhook payloads.
- **Type Safety & Schema Validation**:
  - Enforce strict input types (using schemas like Zod or explicit validation functions) before processing or persisting data.
  - Reject unexpected extra fields or malformed data immediately with strict error codes.
  - Validate numeric values against realistic business boundaries (e.g., non-negative amounts, finite bounds, integer-safe currency units).
- **Injection Defenses**:
  - **SQL Injection**: Never concatenate unescaped user strings into SQL queries. Always use parameterized queries, Supabase client query builders, or prepared statements with strict type casting.
  - **Script Injection / XSS**: Sanitize any user-controlled string before rendering into the DOM. Never use `dangerouslySetInnerHTML` with unsanitized user content. Ensure React's default escaping is preserved.
  - **Command Injection**: Never pass user input to shell commands, process spawning, or eval functions.
- **File Upload Safety**:
  - Strictly validate file MIME types and inspect file headers (magic bytes) rather than relying solely on user-supplied file extensions.
  - Enforce maximum file size limits (e.g. receipt photos, PDF statements).
  - Store uploaded media in isolated storage buckets with public execution disabled.

---

## 3. Secret Management & Credential Hygiene

> *"Scan the entire project for secrets and credentials. Ensure API keys, database service keys, and tokens are never exposed in frontend code or committed to the repository. Move all secrets to secure environment variables and ensure they are only used on the server."*

### Implementation Directives:
- **No Hardcoded Secrets**:
  - Scan the entire repository regularly for leaked tokens, private keys, service role keys, database passwords, or JWT secrets.
  - Ensure `.env`, `.env.local`, and sensitive configuration files are strictly included in `.gitignore`.
- **Frontend vs. Backend Separation**:
  - Only public, safe-to-expose keys (e.g., Supabase Anon Key with Row Level Security enforced) may be exposed in client code via `VITE_` or `NEXT_PUBLIC_` prefixes.
  - **Service Role Keys (`SUPABASE_SERVICE_ROLE_KEY`) and Administrative DB Credentials must NEVER be bundled into frontend client code.**
  - Any operation requiring privileged service permissions must reside in an isolated backend server, Supabase Edge Function, or serverless API route.

---

## 4. Abuse Protection & Rate Limiting

> *"Add abuse protection to the application. Implement rate limiting for login attempts, API endpoints, account creation, and AI generation requests. Prevent bots or automated scripts from repeatedly calling endpoints or scraping data."*

### Implementation Directives:
- **Rate Limiting**:
  - Implement rate limiting across critical surfaces:
    - Login / Authentication endpoints (e.g., maximum 5 failed attempts per 15-minute window per IP/user).
    - Account registration and password reset triggers.
    - Financial transaction writing / bulk mutation endpoints.
    - AI generation / LLM analysis endpoints to prevent token exhaustion and denial-of-wallet.
- **Bot & Automation Mitigation**:
  - Employ CAPTCHA / Proof-of-Work challenges (such as Cloudflare Turnstile) on public sign-up and password reset forms when abuse risk is elevated.
  - Block automated scrapers and bots through proper robots.txt, user-agent verification, and IP reputation filtering.
  - Enforce payload size limits on incoming JSON requests.

---

## 5. Authentication & Session Security Engineering

> *"Act as a senior security engineer. Review the authentication system of this project and make it secure. Ensure passwords are securely hashed, sessions expire, email verification is enabled, password reset tokens expire, login attempts are rate limited, and authentication secrets are never exposed to the frontend. Refactor any insecure authentication logic."*

### Implementation Directives:
- **Password & PIN Security**:
  - Passwords must be hashed using modern, memory-hard algorithms (e.g., Argon2, bcrypt, or Supabase Auth's native secure crypto).
  - Client-side App Lock PINs must be salted and hashed (SHA-256 via Web Crypto API with cryptographic salt) prior to persistence. Raw plaintext PINs/passwords must never be stored anywhere.
- **Session Lifecycle & Expiration**:
  - Configure short-lived access tokens (JWTs) paired with securely rotating refresh tokens.
  - Enforce idle timeouts and automatic lockouts (e.g. App Lock background timeout: immediate, 1m, 5m, 15m).
  - Explicitly invalidate tokens and revoke sessions upon logout.
- **Email Verification & Password Resets**:
  - Enforce email verification for new accounts prior to granting full access to financial synchronization.
  - Password reset tokens must have short expiration windows (maximum 15–30 minutes) and become single-use immediately upon consumption.
- **Refactoring Insecure Logic**:
  - Eliminate any client-side authentication bypasses or mock authorizations in production builds.

---

## 6. Access Control, IDOR Prevention & Row Level Security (RLS)

> *"Review all API endpoints and database queries. Ensure every request verifies the logged-in user owns the data being accessed. Prevent insecure direct object reference (IDOR) vulnerabilities by enforcing ownership checks before reading, modifying, or deleting any resource."*

### Implementation Directives:
- **Row Level Security (RLS) on Database Tables**:
  - Every table in PostgreSQL / Supabase (`expenses`, `salaries`, `lending_records`, `cash_records`, `loans`, `emi_schedules`, `profiles`, `app_lock_settings`, `user_logins`) MUST have Row Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
  - Policies must strictly enforce user ownership:
    ```sql
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id)
    ```
- **IDOR Prevention on Application Layer**:
  - Never trust client-supplied `user_id` without validating against the authenticated session (`auth.uid()`).
  - When querying or mutating by entity ID (e.g., `expenseId`, `lendingId`, `loanId`), always include the tenant/user constraint:
    ```typescript
    .eq('id', resourceId)
    .eq('user_id', authenticatedUserId)
    ```
  - Return `404 Not Found` or `403 Forbidden` if a user attempts to access or modify resources belonging to another user.

---

## 7. Developer Workflow Checklist

Before committing or pushing any code changes, verify:
- [ ] No API keys, secrets, or private tokens are introduced into frontend code or git history.
- [ ] All database queries filter by authenticated `user_id` or rely on audited RLS policies.
- [ ] User inputs are strictly typed, bounded, and sanitized against injection.
- [ ] App Lock and session timeout mechanisms function as intended in dark and light themes.
- [ ] Rate limits and error handlers prevent unhandled exceptions or denial of service.

