'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_string_for_build_time');
function getFrom(): string {
    const email = process.env.EMAIL_FROM || 'hello@noreply.colchisfood.com';
    return `Colchis Food <${email}>`;
}

const SALES_RECIPIENTS = [
    'sales@colchisfood.com',
    't.shergelashvili@colchisfood.com',
];

// ─── Brand tokens — exactly matching globals.css ────────────────────────────

const C = {
    forest:    '#1F3026',   // --color-ink (hero bg, primary text)
    moss:      '#2C3D33',   // --color-ink2 (body text)
    accent:    '#B96A3D',   // --color-accent (primary copper)
    accent2:   '#8B4A28',   // --color-accent2 / --color-primary-dark (eyebrows)
    cream:     '#F5F0E6',   // --color-cream (page bg)
    cream2:    '#EAE2D2',   // --color-cream2 (card bg)
    muted:     '#7A8278',   // --color-muted
    white:     '#ffffff',
};

// Hosted PNG — works in Gmail/Outlook (SVG and data URIs are stripped)
const SEAL_URL = 'https://colchisfood.com/brand/seal-primary.png';

// ─── Shared building blocks ─────────────────────────────────────────────────

function emailShell(inner: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:${C.cream};font-family:'Georgia','Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.cream};padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;">
        ${inner}
      </table>

      <!-- Brand sign-off -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;">
        <tr><td style="padding:32px 0 8px;text-align:center;">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:4px;color:${C.muted};text-transform:uppercase;">
            Colchis Food · Dublin, Ohio · Est. 2026
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function sealHeader(subtitle: string): string {
    return `
        <!-- Hero header with grid overlay -->
        <tr>
          <td style="background:${C.forest};padding:48px 48px 44px;text-align:center;background-image:linear-gradient(rgba(245,240,230,0.03) 1px, transparent 1px),linear-gradient(90deg,rgba(245,240,230,0.03) 1px, transparent 1px);background-size:40px 40px;">
            <img src="${SEAL_URL}" alt="Colchis Food" width="64" height="64" style="display:block;margin:0 auto 20px;" />
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:5px;color:rgba(245,240,230,0.45);text-transform:uppercase;">
              Colchis Food
            </p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
              ${subtitle}
            </p>
          </td>
        </tr>
        <!-- Thin copper rule -->
        <tr><td style="height:2px;background:${C.accent};font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

function darkFooter(): string {
    return `
        <tr>
          <td style="background:${C.forest};padding:28px 48px;text-align:center;">
            <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:3px;color:rgba(245,240,230,0.25);text-transform:uppercase;">
              © ${new Date().getFullYear()} Colchis Food
            </p>
            <p style="margin:0;font-family:'Georgia',serif;font-size:10px;color:rgba(245,240,230,0.18);font-style:italic;">
              Heritage in every bite
            </p>
          </td>
        </tr>`;
}

// ─── Wholesale Applicant Confirmation ───────────────────────────────────────

function buildApplicantConfirmationEmail(contactName: string, companyName: string): string {
    return emailShell(`
        ${sealHeader('Wholesale Partnership')}

        <!-- Main body on parchment -->
        <tr>
          <td style="background:${C.cream2};padding:48px 48px 24px;">
            <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
              Application Received
            </p>
            <h1 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:30px;font-weight:300;color:${C.forest};line-height:1.15;letter-spacing:-0.5px;">
              Thank you, <em style="color:${C.accent2};font-weight:400;">${contactName}.</em>
            </h1>
            <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
              We've received the partnership application for <strong style="color:${C.forest};font-style:normal;">${companyName}</strong>. Our wholesale team reviews every request personally — expect to hear back within 1–2 business days.
            </p>
          </td>
        </tr>

        <!-- Separator -->
        <tr><td style="background:${C.cream2};padding:0 48px;"><div style="height:1px;background:${C.forest};opacity:0.12;"></div></td></tr>

        <!-- Steps -->
        <tr>
          <td style="background:${C.cream2};padding:28px 48px 40px;">
            <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
              What happens next
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">01</td>
                  <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Application review by our sales team</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">02</td>
                  <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Dedicated account manager reaches out</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">03</td>
                  <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Product sampling &amp; pricing discussion</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:10px 0;">
                <table cellpadding="0" cellspacing="0"><tr>
                  <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">04</td>
                  <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Paperless contract &amp; first order</td>
                </tr></table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:${C.cream2};padding:0 48px 48px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${C.forest};padding:18px 28px;text-align:center;">
                  <a href="https://colchisfood.com/shop" style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${C.cream};text-decoration:none;text-transform:uppercase;">
                    Explore our products →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${darkFooter()}
    `);
}

// ─── Sales Team Notification ────────────────────────────────────────────────

function buildSalesNotificationEmail(data: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    volume: string;
    message: string;
}): string {
    const row = (label: string, value: string, link = false) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;width:100px;vertical-align:top;">${label}</td>
                <td style="padding:10px 0 10px 16px;border-bottom:1px solid ${C.forest}0d;font-family:'Georgia',serif;font-size:14px;color:${C.forest};">${link ? `<a href="mailto:${value}" style="color:${C.accent2};text-decoration:none;">${value}</a>` : value}</td>
              </tr>`;

    return emailShell(`
        <!-- Copper alert bar -->
        <tr>
          <td style="background:${C.accent2};padding:16px 48px;">
            <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${C.cream};text-transform:uppercase;">
              🔔 New wholesale request
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:${C.cream2};padding:36px 48px 16px;">
            <h2 style="margin:0 0 4px;font-family:'Georgia',serif;font-size:26px;font-weight:300;color:${C.forest};letter-spacing:-0.5px;">${data.companyName}</h2>
            <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:${C.muted};font-style:italic;">${data.contactName} · ${data.volume}</p>
          </td>
        </tr>

        <tr><td style="background:${C.cream2};padding:0 48px;"><div style="height:1px;background:${C.forest};opacity:0.12;"></div></td></tr>

        <tr>
          <td style="background:${C.cream2};padding:20px 48px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${row('Company', data.companyName)}
              ${row('Contact', data.contactName)}
              ${row('Email', data.email, true)}
              ${row('Phone', data.phone)}
              ${row('Address', data.address)}
              ${row('Volume', data.volume)}
              ${data.message ? row('Message', data.message) : ''}
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:${C.cream2};padding:0 48px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-left:2px solid ${C.accent};padding:12px 20px;background:${C.cream};">
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;">
                    Lead saved · <a href="https://colchisfood.com/admin/requests" style="color:${C.accent2};text-decoration:none;">View in admin →</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${darkFooter()}
    `);
}

// ─── Server Action ──────────────────────────────────────────────────────────

export async function submitWholesaleLead(prevState: any, formData: FormData) {
    const companyName = (formData.get('companyName') as string)?.trim();
    const contactName = (formData.get('contactName') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim();
    const address = (formData.get('address') as string)?.trim();
    const zipCode = (formData.get('zipCode') as string)?.trim();
    const volume = (formData.get('volume') as string) || 'Under 50 lbs';
    const message = (formData.get('message') as string)?.trim() || '';

    // ─── Anti-bot checks ─────────────────────────────────────────────────────
    const honeypot = (formData.get('website_url') as string || '').trim();
    if (honeypot) {
        console.log('[Wholesale] Honeypot triggered, blocking submission');
        await new Promise(r => setTimeout(r, 1000));
        return { success: 'Your partnership request has been received. Our sales team will reach out within 1–2 business days.' };
    }

    const loadTimeStr = formData.get('_loadTime') as string;
    const loadTime = loadTimeStr ? parseInt(loadTimeStr, 10) : 0;
    if (loadTime && !isNaN(loadTime) && (Date.now() - loadTime) < 3000) {
        console.log('[Wholesale] Timing check triggered, blocking submission');
        await new Promise(r => setTimeout(r, 1000));
        return { success: 'Your partnership request has been received. Our sales team will reach out within 1–2 business days.' };
    }

    // ─── Validation ──────────────────────────────────────────────────────────
    if (!companyName || !contactName || !email || !phone || !address || !zipCode) {
        return { error: 'Please fill in all required fields.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Please enter a valid email address.' };
    }

    try {
        // ─── 1. Save to database ─────────────────────────────────────────────
        await prisma.b2bLead.create({
            data: { companyName, contactName, email, phone, address: `${address}, ${zipCode}`, expectedVolume: volume, message: message || null, status: 'NEW' },
        });

        // ─── 2. Send confirmation email to applicant ─────────────────────────
        try {
            const { data: confData, error: confError } = await resend.emails.send({
                from: getFrom(),
                to: [email],
                subject: `Partnership Application Received — Colchis Food`,
                html: buildApplicantConfirmationEmail(contactName, companyName),
            });
            if (confError) {
                console.error('[Wholesale] Resend rejected confirmation email:', JSON.stringify(confError));
            } else {
                console.log('[Wholesale] Confirmation email sent to', email, '| ID:', confData?.id);
            }
        } catch (emailErr) {
            console.error('[Wholesale] Exception sending confirmation email:', emailErr);
        }

        // ─── 3. Notify sales team ────────────────────────────────────────────
        try {
            const { data: salesData, error: salesError } = await resend.emails.send({
                from: getFrom(),
                to: SALES_RECIPIENTS,
                subject: `🔔 New Wholesale Request: ${companyName}`,
                html: buildSalesNotificationEmail({ companyName, contactName, email, phone, address: `${address}, ${zipCode}`, volume, message }),
                replyTo: email,
            });
            if (salesError) {
                console.error('[Wholesale] Resend rejected sales notification:', JSON.stringify(salesError));
            } else {
                console.log('[Wholesale] Sales notification sent to', SALES_RECIPIENTS.join(', '), '| ID:', salesData?.id);
            }
        } catch (emailErr) {
            console.error('[Wholesale] Exception sending sales notification:', emailErr);
        }

        revalidatePath('/admin/requests');
        return { success: 'Your partnership request has been received. Our sales team will reach out within 1–2 business days. Check your email for confirmation.' };
    } catch (error) {
        console.error('[Wholesale] Lead submission error:', error);
        return { error: 'System error. Please try again later or email us at sales@colchisfood.com.' };
    }
}
