import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static & policy audit verifying that firestore.rules enforces all Dirty Dozen
 * protections from security_spec.md.
 */
describe('Firestore Security Rules — Dirty Dozen Invariant Verification', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf-8');

  it('starts with global default-deny safety net', () => {
    expect(rulesText).toContain('match /{document=**} {\n      allow read, write: if false;\n    }');
  });

  it('enforces email_verified == true and no unverified email spoofing', () => {
    expect(rulesText).toContain('request.auth.token.email_verified == true');
  });

  it('prevents self-role escalation on /users creation and forbids user deletion', () => {
    expect(rulesText).toContain("incoming().role == 'MEMBER'");
    expect(rulesText).toContain('match /users/{userId}');
    expect(rulesText).toContain('allow delete: if false;');
  });

  it('enforces hasOnly() shadow-update protection and path variable isValidId()', () => {
    expect(rulesText).toContain('data.keys().hasOnly(');
    expect(rulesText).toContain('isValidId(');
  });

  it('prevents permanent deletion of financial collections and auditLogs', () => {
    expect(rulesText).toContain('match /payments/{paymentId}');
    expect(rulesText).toContain('match /auditLogs/{logId}');
    expect(rulesText).toContain('allow update, delete: if false;');
  });

  it('enforces server request.time timestamps and positive integer payment amount', () => {
    expect(rulesText).toContain('incoming().createdAt == request.time');
    expect(rulesText).toContain('data.amountPaise is int && data.amountPaise > 0');
  });
});
