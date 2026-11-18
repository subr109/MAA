import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// In-memory idempotency and Meta webhook delivery tracking store
const dispatchedNotifications = new Map<
  string,
  { metaMessageId?: string; status: string; updatedAt: string }
>();
const webhookStatuses = new Map<
  string,
  { metaMessageId: string; status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'; errorMessage?: string; updatedAt: string }
>();

function formatPhoneE164(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

interface SendWhatsappBody {
  notificationId: string;
  to: string;
  templateName: string;
  language: 'bn' | 'en';
  parameters: string[];
  phoneNumberIdOverride?: string;
  apiVersionOverride?: string;
}

async function dispatchMetaTemplateMessage(payload: SendWhatsappBody): Promise<{
  ok: boolean;
  status: 'SENT' | 'FAILED';
  metaMessageId?: string;
  error?: string;
  httpStatus: number;
}> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || payload.phoneNumberIdOverride?.trim();
  const apiVersion =
    process.env.WHATSAPP_API_VERSION?.trim() || payload.apiVersionOverride?.trim() || 'v21.0';

  if (!accessToken) {
    return {
      ok: false,
      status: 'FAILED',
      httpStatus: 422,
      error:
        'WHATSAPP_ACCESS_TOKEN is not configured in server environment secrets. Payment was saved, but WhatsApp message could not be sent.',
    };
  }
  if (!phoneNumberId) {
    return {
      ok: false,
      status: 'FAILED',
      httpStatus: 422,
      error:
        'WHATSAPP_PHONE_NUMBER_ID is not configured in server environment secrets or Settings.',
    };
  }

  // Idempotency check to avoid duplicate messages
  const existing = dispatchedNotifications.get(payload.notificationId);
  if (existing && existing.metaMessageId) {
    return {
      ok: true,
      status: 'SENT',
      metaMessageId: existing.metaMessageId,
      httpStatus: 200,
    };
  }

  const recipient = formatPhoneE164(payload.to);
  if (recipient.length < 10) {
    return {
      ok: false,
      status: 'FAILED',
      httpStatus: 400,
      error: 'Invalid recipient WhatsApp phone number.',
    };
  }

  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: payload.templateName,
      language: {
        code: payload.language === 'bn' ? 'bn' : 'en_US',
      },
      components:
        payload.parameters && payload.parameters.length > 0
          ? [
              {
                type: 'body',
                parameters: payload.parameters.map((text) => ({
                  type: 'text',
                  text: String(text),
                })),
              },
            ]
          : [],
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    };

    if (!response.ok || !data.messages?.[0]?.id) {
      return {
        ok: false,
        status: 'FAILED',
        httpStatus: response.status || 502,
        error: data.error?.message || `Meta WhatsApp API returned HTTP ${response.status}`,
      };
    }

    const metaMessageId = data.messages[0].id;
    dispatchedNotifications.set(payload.notificationId, {
      metaMessageId,
      status: 'SENT',
      updatedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      status: 'SENT',
      metaMessageId,
      httpStatus: 200,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'FAILED',
      httpStatus: 502,
      error: err instanceof Error ? err.message : 'Network error calling Meta Graph API',
    };
  }
}

function safeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

async function createAppServer() {
  const app = express();

  // Capture raw body for optional Meta X-Hub-Signature-256 verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

  // Health & non-secret server capability status
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timezone: 'Asia/Kolkata',
      whatsapp: {
        tokenConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
        phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
        businessAccountIdConfigured: Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim()),
        webhookVerifyConfigured: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()),
        apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
      },
    });
  });

  // Committee Admin Credential Login (verified strictly server-side)
  app.post('/api/auth/admin-login', (req: Request, res: Response) => {
    const body = req.body as { adminId?: unknown; password?: unknown };
    const providedId = typeof body?.adminId === 'string' ? body.adminId.trim() : '';
    const providedPassword = typeof body?.password === 'string' ? body.password : '';

    if (!providedId || !providedPassword) {
      res.status(400).json({
        ok: false,
        error: 'Admin ID and Password are required.',
      });
      return;
    }

    const expectedId = (process.env.ADMIN_LOGIN_ID || 'Admin').trim();
    const expectedPassword = process.env.ADMIN_LOGIN_PASSWORD || 'Admin@2027';

    const idMatches = safeCompareStrings(providedId, expectedId);
    const passwordMatches = safeCompareStrings(providedPassword, expectedPassword);

    if (!idMatches || !passwordMatches) {
      res.status(401).json({
        ok: false,
        error: 'Invalid Admin ID or Password.',
      });
      return;
    }

    const now = new Date().toISOString();
    res.json({
      ok: true,
      user: {
        id: 'committee-super-admin',
        uid: 'committee-super-admin',
        name: 'Admin — শ্রী শ্রী শ্যামা পূজা মাশুন্ডা বুনিয়াদি স্কুল মাঠ কমিটি',
        email: 'admin@mashundashyamapuja.org',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        canAddMembers: true,
        canReversePayments: true,
        canManageExpenses: true,
        canSendBulkWhatsApp: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  // Official Meta WhatsApp Cloud API dispatch
  app.post('/api/whatsapp/send', async (req: Request, res: Response) => {
    const body = req.body as Partial<SendWhatsappBody>;
    if (!body.notificationId || !body.to || !body.templateName) {
      res.status(400).json({
        ok: false,
        status: 'FAILED',
        error: 'Missing required fields: notificationId, to, templateName.',
      });
      return;
    }

    const result = await dispatchMetaTemplateMessage({
      notificationId: body.notificationId,
      to: body.to,
      templateName: body.templateName,
      language: body.language === 'en' ? 'en' : 'bn',
      parameters: Array.isArray(body.parameters) ? body.parameters : [],
      phoneNumberIdOverride: body.phoneNumberIdOverride,
      apiVersionOverride: body.apiVersionOverride,
    });

    res.status(result.httpStatus).json(result);
  });

  // Rate-limited bulk reminder dispatch (strictly respects whatsappConsent === true)
  app.post('/api/whatsapp/bulk-reminder', async (req: Request, res: Response) => {
    const { items, phoneNumberIdOverride, apiVersionOverride } = req.body as {
      items?: Array<SendWhatsappBody & { whatsappConsent?: boolean }>;
      phoneNumberIdOverride?: string;
      apiVersionOverride?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ ok: false, error: 'items array is required.' });
      return;
    }

    if (items.length > 25) {
      res.status(429).json({
        ok: false,
        error: 'Rate limit: maximum 25 WhatsApp reminders per batch.',
      });
      return;
    }

    const results: Array<{
      notificationId: string;
      ok: boolean;
      status: 'SENT' | 'FAILED';
      metaMessageId?: string;
      error?: string;
    }> = [];

    for (const item of items) {
      if (item.whatsappConsent === false) {
        results.push({
          notificationId: item.notificationId,
          ok: false,
          status: 'FAILED',
          error: 'Member has not granted WhatsApp consent.',
        });
        continue;
      }

      const r = await dispatchMetaTemplateMessage({
        notificationId: item.notificationId,
        to: item.to,
        templateName: item.templateName,
        language: item.language === 'en' ? 'en' : 'bn',
        parameters: item.parameters || [],
        phoneNumberIdOverride,
        apiVersionOverride,
      });

      results.push({
        notificationId: item.notificationId,
        ok: r.ok,
        status: r.status,
        metaMessageId: r.metaMessageId,
        error: r.error,
      });

      // Gentle spacing to respect Meta Cloud API throughput
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    res.json({ ok: true, results });
  });

  // Meta Webhook Verification (GET)
  app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken =
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'maa_puja_webhook_verify_token';

    if (mode === 'subscribe' && token === expectedToken) {
      res.status(200).send(String(challenge || ''));
      return;
    }
    res.sendStatus(403);
  });

  // Meta Webhook Delivery Status Receiver (POST)
  app.post('/api/whatsapp/webhook', (req: Request, res: Response) => {
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    const sigHeader = req.headers['x-hub-signature-256'];
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

    if (appSecret && rawBody) {
      if (typeof sigHeader !== 'string') {
        res.sendStatus(401);
        return;
      }
      const expectedSig =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (sigHeader !== expectedSig) {
        res.sendStatus(401);
        return;
      }
    }

    const body = req.body as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id: string;
              status: string;
              errors?: Array<{ title?: string; message?: string }>;
            }>;
          };
        }>;
      }>;
    };

    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        for (const st of change.value?.statuses || []) {
          const upper = st.status?.toUpperCase();
          if (upper === 'SENT' || upper === 'DELIVERED' || upper === 'READ' || upper === 'FAILED') {
            webhookStatuses.set(st.id, {
              metaMessageId: st.id,
              status: upper,
              errorMessage: st.errors?.[0]?.message || st.errors?.[0]?.title,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    res.sendStatus(200);
  });

  // Endpoint for UI to poll real webhook-confirmed statuses
  app.get('/api/whatsapp/webhook-statuses', (_req: Request, res: Response) => {
    res.json({
      statuses: Array.from(webhookStatuses.values()),
    });
  });

  // Vite dev middleware OR static production build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Production build missing. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAA Server listening on http://0.0.0.0:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Failed to start MAA server:', err);
  process.exit(1);
});
