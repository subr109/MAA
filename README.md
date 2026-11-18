# MAA — Monthly Association Account
**Puja Monthly Chanda Collection Management System** · *Every Contribution Matters.*

## 1. Installation Guide
```bash
npm install
cp .env.example .env
npm run dev
```
The full-stack Express + Vite application runs on **port 3000** (`http://localhost:3000`).

## 2. Environment Variables (`.env`)
Configure server-side secrets in `.env` or your hosting Secret Manager (never expose tokens in client code):
- `WHATSAPP_ACCESS_TOKEN`: Meta Permanent System User Access Token
- `WHATSAPP_PHONE_NUMBER_ID`: WhatsApp Business Phone Number ID
- `WHATSAPP_BUSINESS_ACCOUNT_ID`: WhatsApp Business Account (WABA) ID
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: Custom secret token for Meta webhook verification
- `WHATSAPP_API_VERSION`: Graph API version (default `v21.0`)
- `WHATSAPP_APP_SECRET`: Meta App Secret for `X-Hub-Signature-256` verification

## 3. Firebase Deployment Instructions
1. Review `firebase-blueprint.json` and `firestore.rules`.
2. Verify security rules with ESLint:
   ```bash
   npx eslint firestore.rules
   ```
3. Deploy Firestore security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
4. Deploy Cloud Functions (optional if running Express backend):
   ```bash
   cd functions && npm install && npm run build
   firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN
   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
   firebase functions:secrets:set WHATSAPP_WEBHOOK_VERIFY_TOKEN
   firebase deploy --only functions
   ```

## 4. Official Meta WhatsApp Business Cloud API Setup
1. Create an App in **Meta for Developers** -> Add **WhatsApp** product.
2. Create a **System User** in Meta Business Suite with `whatsapp_business_messaging` & `whatsapp_business_management` permissions and generate a **Permanent Access Token**.
3. Copy **Phone Number ID** and **WABA ID** into `.env` (or Settings for non-secret IDs) and set `WHATSAPP_ACCESS_TOKEN` in server secrets.
4. Create & submit approved Utility templates:
   - `maa_chanda_receipt_bn` (Bengali receipt with `{{1}}..{{6}}`)
   - `maa_chanda_receipt_en` (English receipt with `{{1}}..{{6}}`)
   - `maa_chanda_reminder_bn` (Pending dues reminder)
   - `maa_puja_announcement_bn` (Committee notice)
5. Configure Meta Webhook Callback URL to `https://<your-domain>/api/whatsapp/webhook` with Verify Token matching `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and subscribe to `messages` field.

## 5. Testing Instructions
Run the automated Vitest financial & security unit tests:
```bash
npm test
```
Run TypeScript and Firestore rules validation:
```bash
npm run lint
npx eslint firestore.rules
npm run build
```
