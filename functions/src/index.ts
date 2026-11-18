import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

admin.initializeApp();
const db = admin.firestore();

const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = defineSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

function formatPhoneE164(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Triggered automatically when a payment document is created in Firestore.
 * Dispatches an approved WhatsApp Cloud API template receipt if the member opted in.
 */
export const onPaymentCreatedSendWhatsApp = onDocumentCreated(
  {
    document: 'payments/{paymentId}',
    secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
  },
  async (event) => {
    const payment = event.data?.data();
    if (!payment || payment.status !== 'COMPLETED') return;

    const memberSnap = await db.collection('members').doc(payment.memberId).get();
    const member = memberSnap.data();
    if (!member || !member.whatsappConsent) return;

    const settingsSnap = await db.collection('settings').doc('committee').get();
    const settings = settingsSnap.data();
    if (settings && settings.whatsappEnabled === false) return;

    const token = WHATSAPP_ACCESS_TOKEN.value();
    const phoneNumberId = WHATSAPP_PHONE_NUMBER_ID.value() || settings?.whatsappPhoneNumberId;
    const apiVersion = settings?.whatsappApiVersion || 'v21.0';
    const lang = settings?.whatsappDefaultLanguage === 'en' ? 'en' : 'bn';
    const templateName = settings?.whatsappReceiptTemplate || 'maa_chanda_receipt_bn';

    const notificationId = `wa_${event.params.paymentId}`;
    const notifRef = db.collection('whatsappNotifications').doc(notificationId);

    // Idempotency guard
    const existingNotif = await notifRef.get();
    if (existingNotif.exists && existingNotif.data()?.metaMessageId) return;

    const recipientPhone = formatPhoneE164(member.whatsappNumber || member.mobile);

    if (!token || !phoneNumberId) {
      await notifRef.set({
        notificationId,
        memberId: payment.memberId,
        memberName: payment.memberName,
        recipientPhone,
        type: 'RECEIPT',
        templateName,
        language: lang,
        relatedPaymentId: event.params.paymentId,
        status: 'FAILED',
        errorMessage: 'WhatsApp Cloud Function secrets are not configured.',
        sentByUid: payment.collectedByUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: lang === 'bn' ? 'bn' : 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: payment.memberName },
              { type: 'text', text: payment.monthKey },
              { type: 'text', text: String(Math.round(payment.amountPaise / 100)) },
              { type: 'text', text: payment.paymentDate },
              { type: 'text', text: payment.receiptNumber },
              { type: 'text', text: String(Math.round(payment.remainingDuePaise / 100)) },
            ],
          },
        ],
      },
    };

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as { messages?: Array<{ id: string }>; error?: { message?: string } };
      if (!resp.ok || !json.messages?.[0]?.id) {
        await notifRef.set({
          notificationId,
          memberId: payment.memberId,
          memberName: payment.memberName,
          recipientPhone,
          type: 'RECEIPT',
          templateName,
          language: lang,
          relatedPaymentId: event.params.paymentId,
          status: 'FAILED',
          errorMessage: json.error?.message || `HTTP ${resp.status}`,
          sentByUid: payment.collectedByUid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      await notifRef.set({
        notificationId,
        memberId: payment.memberId,
        memberName: payment.memberName,
        recipientPhone,
        type: 'RECEIPT',
        templateName,
        language: lang,
        relatedPaymentId: event.params.paymentId,
        metaMessageId: json.messages[0].id,
        status: 'SENT',
        sentByUid: payment.collectedByUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      await notifRef.set({
        notificationId,
        memberId: payment.memberId,
        memberName: payment.memberName,
        recipientPhone,
        type: 'RECEIPT',
        templateName,
        language: lang,
        relatedPaymentId: event.params.paymentId,
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Network error',
        sentByUid: payment.collectedByUid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

/**
 * Official Meta WhatsApp Webhook for Firebase Cloud Functions
 */
export const whatsappWebhook = onRequest(
  { secrets: [WHATSAPP_WEBHOOK_VERIFY_TOKEN] },
  async (req, res) => {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN.value()) {
        res.status(200).send(challenge);
        return;
      }
      res.sendStatus(403);
      return;
    }

    if (req.method === 'POST') {
      const entries = req.body?.entry || [];
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          for (const st of change.value?.statuses || []) {
            const snap = await db
              .collection('whatsappNotifications')
              .where('metaMessageId', '==', st.id)
              .limit(1)
              .get();
            if (!snap.empty) {
              const upper = String(st.status || '').toUpperCase();
              if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(upper)) {
                await snap.docs[0].ref.update({
                  status: upper,
                  errorMessage: st.errors?.[0]?.message || '',
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            }
          }
        }
      }
      res.sendStatus(200);
      return;
    }
    res.sendStatus(405);
  }
);
