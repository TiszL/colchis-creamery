'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_string_for_build_time');
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@updates.colchiscreamery.com';
const FROM_NAME = 'Colchis Creamery';

const SALES_RECIPIENTS = [
    'sales@colchiscreamery.com',
    't.shergelashvili@colchiscreamery.com',
];

// ─── HTML Email Templates ──────────────────────────────────────────────────────

function buildApplicantConfirmationEmail(contactName: string, companyName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2C2A29 0%, #1A1A1A 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:28px;color:#CBA153;letter-spacing:2px;">
                COLCHIS CREAMERY
              </h1>
              <p style="margin:8px 0 0;font-size:11px;color:#CBA153;letter-spacing:4px;text-transform:uppercase;opacity:0.7;">
                Wholesale Partnership
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:22px;color:#2C2A29;">
                Application Received
              </h2>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
                Dear ${contactName},
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">
                Thank you for your interest in partnering with Colchis Creamery. We're thrilled that <strong>${companyName}</strong> is considering our artisanal Georgian cheeses for your offerings.
              </p>
              <p style="margin:0 0 25px;font-size:15px;color:#555;line-height:1.7;">
                Your partnership application has been received and is currently under review. Our sales team will reach out to you within <strong>0–48 business hours</strong> to discuss the next steps.
              </p>

              <!-- Highlight Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:25px 0;">
                <tr>
                  <td style="background-color:#FDFBF7;border-left:4px solid #CBA153;padding:20px 24px;border-radius:0 8px 8px 0;">
                    <p style="margin:0 0 8px;font-size:13px;color:#CBA153;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">
                      What Happens Next?
                    </p>
                    <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">
                      1. Our sales team reviews your application<br>
                      2. A dedicated account manager will contact you<br>
                      3. We'll arrange product sampling & pricing discussion<br>
                      4. Paperless contract via Adobe Sign
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:25px 0 0;font-size:15px;color:#555;line-height:1.7;">
                In the meantime, feel free to explore our product line at <a href="https://colchiscreamery.com/shop" style="color:#CBA153;text-decoration:none;font-weight:bold;">colchiscreamery.com/shop</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#2C2A29;padding:30px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#CBA153;font-weight:bold;letter-spacing:1px;">
                COLCHIS CREAMERY
              </p>
              <p style="margin:0 0 4px;font-size:12px;color:#888;">
                Columbus, Ohio | Premium Artisanal Georgian Cheese
              </p>
              <p style="margin:0;font-size:12px;color:#888;">
                <a href="mailto:sales@colchiscreamery.com" style="color:#CBA153;text-decoration:none;">sales@colchiscreamery.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSalesNotificationEmail(data: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    volume: string;
    message: string;
}): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:30px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);max-width:100%;">
          <tr>
            <td style="background:#CBA153;padding:20px 30px;">
              <h1 style="margin:0;color:#000;font-size:18px;font-weight:bold;">🔔 New Wholesale Partnership Request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#333;">
                <tr><td style="padding:8px 0;font-weight:bold;width:140px;color:#666;">Company:</td><td style="padding:8px 0;">${data.companyName}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#666;">Contact:</td><td style="padding:8px 0;">${data.contactName}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#666;">Email:</td><td style="padding:8px 0;"><a href="mailto:${data.email}" style="color:#CBA153;">${data.email}</a></td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#666;">Phone:</td><td style="padding:8px 0;"><a href="tel:${data.phone}" style="color:#CBA153;">${data.phone}</a></td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#666;">Address:</td><td style="padding:8px 0;">${data.address}</td></tr>
                <tr><td style="padding:8px 0;font-weight:bold;color:#666;">Est. Volume:</td><td style="padding:8px 0;">${data.volume}</td></tr>
                ${data.message ? `<tr><td style="padding:8px 0;font-weight:bold;color:#666;vertical-align:top;">Message:</td><td style="padding:8px 0;">${data.message}</td></tr>` : ''}
              </table>
              <p style="margin:20px 0 0;padding:15px;background:#f9f9f9;border-radius:6px;font-size:13px;color:#888;">
                This lead has been saved to the admin panel. <a href="https://colchiscreamery.com/admin/requests" style="color:#CBA153;">View all requests →</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Server Action ──────────────────────────────────────────────────────────────

export async function submitWholesaleLead(prevState: any, formData: FormData) {
    const companyName = (formData.get('companyName') as string)?.trim();
    const contactName = (formData.get('contactName') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim();
    const address = (formData.get('address') as string)?.trim();
    const volume = (formData.get('volume') as string) || 'Under 50 lbs';
    const message = (formData.get('message') as string)?.trim() || '';

    // ─── Anti-bot checks ─────────────────────────────────────────────────────
    // 1. Honeypot: hidden field that bots auto-fill
    const honeypot = formData.get('website_url') as string;
    if (honeypot) {
        // Bot detected — return fake success to not reveal detection
        await new Promise(r => setTimeout(r, 1000));
        return { success: 'Your request has been received. Our sales team will contact you within 0–48 business hours.' };
    }

    // 2. Timing: real humans take at least 5 seconds to fill a form
    const loadTime = parseInt(formData.get('_loadTime') as string, 10);
    if (loadTime && (Date.now() - loadTime) < 4000) {
        await new Promise(r => setTimeout(r, 1000));
        return { success: 'Your request has been received. Our sales team will contact you within 0–48 business hours.' };
    }

    // ─── Validation ──────────────────────────────────────────────────────────
    if (!companyName || !contactName || !email || !phone || !address) {
        return { error: 'Please fill in all required fields.' };
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Please enter a valid email address.' };
    }

    try {
        // ─── 1. Save to database ─────────────────────────────────────────────
        await prisma.b2bLead.create({
            data: {
                companyName,
                contactName,
                email,
                phone,
                address,
                expectedVolume: volume,
                message: message || null,
                status: 'NEW',
            },
        });

        // ─── 2. Send confirmation email to applicant ─────────────────────────
        try {
            await resend.emails.send({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [email],
                subject: `Partnership Application Received — Colchis Creamery`,
                html: buildApplicantConfirmationEmail(contactName, companyName),
            });
        } catch (emailErr) {
            console.error('[Wholesale] Failed to send confirmation email:', emailErr);
            // Don't block the submission if email fails
        }

        // ─── 3. Notify sales team ────────────────────────────────────────────
        try {
            await resend.emails.send({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: SALES_RECIPIENTS,
                subject: `🔔 New Wholesale Request: ${companyName}`,
                html: buildSalesNotificationEmail({ companyName, contactName, email, phone, address, volume, message }),
                replyTo: email,
            });
        } catch (emailErr) {
            console.error('[Wholesale] Failed to send sales notification:', emailErr);
        }

        // ─── 4. Revalidate admin pages ───────────────────────────────────────
        revalidatePath('/admin/requests');

        return { success: 'Your partnership request has been received. Our sales team will reach out to you within 0–48 business hours. Check your email for confirmation.' };
    } catch (error) {
        console.error('[Wholesale] Lead submission error:', error);
        return { error: 'System error. Please try again later or email us at sales@colchiscreamery.com.' };
    }
}
