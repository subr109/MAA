# MAA — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Integer Paise Integrity**: All monetary values (`amountPaise`, `monthlyChandaPaise`, `duePaise`, `paidPaise`, `advanceBalancePaise`) MUST be integers (`>= 0`, and `amountPaise > 0` for payments/expenses).
2. **Identity & Privilege Escalation Prevention**: Only Super Admins (bootstrapped `sroy22000@gmail.com` with `email_verified == true` or verified `/admins/{uid}` with `role == 'SUPER_ADMIN'`) may create or modify `/admins/{uid}` or promote a user's `role`. Self-registration in `/users/{uid}` is strictly restricted to `role == 'MEMBER'` and `status == 'ACTIVE'`.
3. **PII Isolation**: Member mobile numbers, addresses, and user emails are strictly unreadable to unauthenticated users. Authenticated `MEMBER` users can only read their own `/users/{uid}` document, their own `/members/{memberId}` record (`userUid == request.auth.uid`), their own `/payments`, `/memberLedgers`, and `/receipts`.
4. **Financial Immutability**: Ordinary admins and members CANNOT permanently `delete` documents in `/payments`, `/receipts`, `/memberLedgers`, `/expenses`, or `/auditLogs`. Payment reversals only transition `status` from `'COMPLETED'` to `'REVERSED'` via explicit Super Admin / authorized Collector action with an `auditLogs` entry.
5. **Audit Trail Immutability**: `/auditLogs/{logId}` is strictly append-only (`allow update, delete: if false`).
6. **Temporal Integrity**: `createdAt` and `updatedAt` timestamps on Firestore documents MUST equal `request.time`, and `createdAt` MUST remain immutable on updates.
7. **Secret Isolation**: `settings` MUST never contain `accessToken`, `appSecret`, or private API keys.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Member Read**: Anonymous/unauthenticated `get /members/MAA-0001` -> DENIED.
2. **Self-Role Escalation on User Create**: Non-admin user creates `/users/{uid}` with `role: "SUPER_ADMIN"` -> DENIED.
3. **Ghost Field Shadow Write on Member**: Admin writes `/members/m1` with extra undeclared field `isVerifiedMaster: true` -> DENIED.
4. **Email Spoofing Without Verification**: User with `email: "sroy22000@gmail.com"` and `email_verified: false` tries to write `/admins/u2` -> DENIED.
5. **Cross-Member PII Scraping**: Authenticated `MEMBER` A requests `get /members/member_B` or `list /members` -> DENIED.
6. **Negative Payment Injection**: Collector creates `/payments/p1` with `amountPaise: -50000` -> DENIED.
7. **Permanent Financial Deletion**: Collection Admin tries `delete /payments/p1` or `delete /auditLogs/a1` -> DENIED.
8. **Audit Log Tampering**: Super Admin tries `update /auditLogs/a1` -> DENIED.
9. **Resource Poisoning via Oversized ID**: Write `/members/<200-char-invalid-id>` -> DENIED by `isValidId()`.
10. **Client Timestamp Forgery**: Creating `/payments/p1` with backdated `createdAt` (`!= request.time`) -> DENIED.
11. **Member Mutating Own Ledger**: Authenticated `MEMBER` writes `/memberLedgers/m1_2026-11` -> DENIED.
12. **Terminal State Overwrite**: Modifying a `REVERSED` payment back to `COMPLETED` without Super Admin reversal guard -> DENIED.
