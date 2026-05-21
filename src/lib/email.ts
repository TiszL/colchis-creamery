import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_string_for_build_time');

function getFrom(): string {
  const email = process.env.EMAIL_FROM || 'hello@noreply.colchisfood.com';
  return `Colchis Food <${email}>`;
}

// ─── Brand tokens — exactly matching globals.css ────────────────────────────

const C = {
  forest:  '#1F3026',   // --color-ink
  moss:    '#2C3D33',   // --color-ink2
  accent:  '#B96A3D',   // --color-accent (primary copper)
  accent2: '#8B4A28',   // --color-accent2 / --color-primary-dark (eyebrows)
  cream:   '#F5F0E6',   // --color-cream
  cream2:  '#EAE2D2',   // --color-cream2 (card bg)
  muted:   '#7A8278',   // --color-muted
  white:   '#ffffff',
  red:     '#C0392B',
  redBg:   '#FFF3F3',
};

// Hosted PNG — works in Gmail/Outlook (SVG and data URIs are stripped)
const SEAL_URL = 'https://colchisfood.com/brand/seal-primary.png';

// ─── Shared building blocks ─────────────────────────────────────────────────

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- color-scheme + supported-color-schemes tell iOS Mail / Outlook / Gmail
       Web that we own our colors. Without these, iOS Mail in dark mode
       AGGRESSIVELY auto-inverts cream + forest backgrounds into muddy
       mint/brown shades that look terrible. With them, the client respects
       the hex values we set. We're a brand-heavy design — preserve the
       palette over honoring client preference. -->
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="only light">
  <style>
    :root { color-scheme: only light; supported-color-schemes: only light; }
    /* Belt-and-suspenders: Gmail honors [data-ogsc] in dark mode. */
    @media (prefers-color-scheme: dark) {
      .ch-card, .ch-body { background-color: ${C.cream2} !important; }
      .ch-cream-bg     { background-color: ${C.cream} !important; }
    }
    [data-ogsc] .ch-card,
    [data-ogsc] .ch-body    { background-color: ${C.cream2} !important; }
    [data-ogsc] .ch-cream-bg { background-color: ${C.cream} !important; }
  </style>
</head>
<body class="ch-body" style="margin:0;padding:0;background-color:${C.cream};font-family:'Georgia','Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" class="ch-cream-bg" style="background-color:${C.cream};padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" class="ch-card" style="max-width:100%;background-color:${C.cream2};">
        ${inner}
      </table>
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:100%;">
        <tr><td style="padding:32px 0 8px;text-align:center;">
          <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:4px;color:${C.muted};text-transform:uppercase;">Colchis Food · Dublin, Ohio · Est. 2026</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function sealHead(subtitle: string): string {
  // Cream-on-cream brand header. The previous design used a dark forest slab
  // which iOS Mail dark-mode auto-inverted into a jarring muddy mint. The
  // cream-cream2 treatment matches the body palette (cohesive look) AND
  // survives any client's dark-mode tinting because cream is neutral enough.
  // Copper accent line at bottom provides the brand stripe.
  return `
        <tr>
          <td class="ch-cream-bg" style="background-color:${C.cream};padding:44px 48px 36px;text-align:center;border-bottom:1px solid ${C.forest}14;">
            <img src="${SEAL_URL}" alt="Colchis Food" width="68" height="68" style="display:block;margin:0 auto 22px;" />
            <p style="margin:0 0 10px;font-family:'Georgia','Times New Roman',serif;font-size:13px;letter-spacing:6px;color:${C.forest};text-transform:uppercase;font-weight:500;">Colchis Food</p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3.5px;color:${C.accent};text-transform:uppercase;">${subtitle}</p>
          </td>
        </tr>
        <tr><td style="height:3px;background:${C.accent};font-size:0;line-height:0;">&nbsp;</td></tr>`;
}

function darkFoot(): string {
  return `
        <tr>
          <td style="background:${C.forest};padding:28px 48px;text-align:center;">
            <p style="margin:0 0 2px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:3px;color:rgba(245,240,230,0.25);text-transform:uppercase;">© ${new Date().getFullYear()} Colchis Food</p>
            <p style="margin:0;font-family:'Georgia',serif;font-size:10px;color:rgba(245,240,230,0.18);font-style:italic;">Heritage in every bite</p>
          </td>
        </tr>`;
}

function divider(bg = C.cream2): string {
  return `<tr><td style="background:${bg};padding:0 48px;"><div style="height:1px;background:${C.forest};opacity:0.12;"></div></td></tr>`;
}

// ─── 1. Email Verification ──────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, code: string, name?: string) {
  const greeting = name || 'there';

  try {
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: [to],
      subject: `${code} is your Colchis Food verification code`,
      html: wrap(`
          ${sealHead('Account Verification')}

          <tr>
            <td style="background:${C.cream2};padding:48px 48px 24px;">
              <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Verify your email</p>
              <h1 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:28px;font-weight:300;color:${C.forest};line-height:1.2;">
                Hello, <em style="color:${C.accent2};font-weight:400;">${greeting}.</em>
              </h1>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                Thank you for creating your Colchis Food account. Enter the code below to confirm your email:
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:12px 48px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${C.cream};border:2px solid ${C.accent};padding:32px 20px;text-align:center;">
                    <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:4px;color:${C.muted};text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:40px;font-weight:700;letter-spacing:10px;color:${C.forest};">${code}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:0 48px 44px;">
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:13px;color:${C.muted};line-height:1.6;text-align:center;">
                This code expires in <strong style="color:${C.forest};">15 minutes</strong>. If you didn't create an account, you can safely ignore this email.
              </p>
              <div style="height:1px;background:${C.forest};opacity:0.08;margin:0 0 20px;"></div>
              <p style="margin:0;font-family:'Georgia',serif;font-size:12px;color:${C.muted};text-align:center;">
                Questions? <a href="mailto:support@colchisfood.com" style="color:${C.accent2};text-decoration:none;">support@colchisfood.com</a>
              </p>
            </td>
          </tr>

          ${darkFoot()}
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] Verification email sent to', to, '| ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── 2. Admin 2FA ───────────────────────────────────────────────────────────

export async function send2FAEmail(to: string, code: string, name?: string) {
  const greeting = name || 'Admin';

  try {
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: [to],
      subject: `${code} — Colchis Food Admin Login Verification`,
      html: wrap(`
          ${sealHead('Admin Security')}

          <tr>
            <td style="background:${C.cream2};padding:48px 48px 24px;">
              <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Two-factor verification</p>
              <h1 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:28px;font-weight:300;color:${C.forest};line-height:1.2;">
                Hello, <em style="color:${C.accent2};font-weight:400;">${greeting}.</em>
              </h1>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                A login attempt was detected for your admin account. Enter the code below to complete sign-in:
              </p>
            </td>
          </tr>

          <!-- Red-accented code box for security distinction -->
          <tr>
            <td style="background:${C.cream2};padding:12px 48px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${C.redBg};border:2px solid ${C.red};padding:32px 20px;text-align:center;">
                    <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:4px;color:${C.red};text-transform:uppercase;">🔐 Two-Factor Code</p>
                    <p style="margin:8px 0 0;font-family:'Courier New',monospace;font-size:40px;font-weight:700;letter-spacing:10px;color:${C.forest};">${code}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:4px 48px 16px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:13px;color:${C.muted};text-align:center;">
                Expires in <strong style="color:${C.forest};">5 minutes</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:0 48px 44px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-left:2px solid ${C.red};padding:12px 20px;background:${C.redBg};">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:12px;color:${C.red};line-height:1.5;">
                      ⚠️ If you did not attempt to log in, your password may be compromised. Change it immediately.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${darkFoot()}
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send 2FA email:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] 2FA email sent to', to, '| ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending 2FA email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

// ─── 3. Contact Form ────────────────────────────────────────────────────────

const CONTACT_RECIPIENTS = [
  'sales@colchisfood.com',
  't.shergelashvili@colchisfood.com',
];

export async function sendContactFormEmail(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    const { data: result, error } = await resend.emails.send({
      from: getFrom(),
      to: CONTACT_RECIPIENTS,
      replyTo: data.email,
      subject: `New Contact Form Message from ${data.name}`,
      html: wrap(`
          <!-- Copper alert bar -->
          <tr>
            <td style="background:${C.accent2};padding:16px 48px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${C.cream};text-transform:uppercase;">✉ New contact message</p>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:40px 48px 20px;">
              <h2 style="margin:0 0 4px;font-family:'Georgia',serif;font-size:26px;font-weight:300;color:${C.forest};letter-spacing:-0.5px;">${data.name}</h2>
              <p style="margin:0;font-family:'Georgia',serif;font-size:14px;color:${C.muted};font-style:italic;">
                <a href="mailto:${data.email}" style="color:${C.accent2};text-decoration:none;">${data.email}</a>
              </p>
            </td>
          </tr>

          ${divider()}

          <tr>
            <td style="background:${C.cream2};padding:28px 48px 40px;">
              <p style="margin:0 0 12px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Message</p>
              <div style="border-left:2px solid ${C.accent};padding:20px 24px;background:${C.cream};">
                <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};line-height:1.75;white-space:pre-wrap;">${data.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:0 48px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${C.accent};padding:0;text-align:center;border-radius:2px;">
                    <a href="mailto:${data.email}?subject=Re: Your message to Colchis Food" style="display:block;padding:18px 28px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:3.5px;color:${C.cream};text-decoration:none;text-transform:uppercase;font-weight:bold;">Reply to ${data.name} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${C.forest};padding:14px 48px;text-align:center;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:8px;letter-spacing:2px;color:rgba(245,240,230,0.25);text-transform:uppercase;">
                ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </td>
          </tr>
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send contact form email:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] Contact form email sent | ID:', result?.id);
    return { success: true, id: result?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending contact form email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

// ─── 4. B2B Approval ────────────────────────────────────────────────────────

export async function sendB2bApprovalEmail(
  to: string,
  accessCode: string,
  companyName: string,
  contactName?: string | null
) {
  const greeting = contactName || 'Partner';

  try {
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: [to],
      subject: `Your B2B Partnership Application Has Been Approved!`,
      html: wrap(`
          ${sealHead('B2B Partnership')}

          <tr>
            <td style="background:${C.cream2};padding:48px 48px 24px;">
              <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Application approved</p>
              <h1 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:28px;font-weight:300;color:${C.forest};line-height:1.2;">
                Welcome aboard, <em style="color:${C.accent2};font-weight:400;">${greeting}.</em>
              </h1>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                Your wholesale partnership for <strong style="color:${C.forest};font-style:normal;">${companyName}</strong> has been <strong style="color:#2E7D32;font-style:normal;">approved</strong>. Use the code below to create your partner account.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:12px 48px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${C.cream};border:2px solid ${C.accent};padding:32px 20px;text-align:center;">
                    <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:4px;color:${C.muted};text-transform:uppercase;">B2B Access Code</p>
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:${C.forest};">${accessCode}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${divider()}

          <tr>
            <td style="background:${C.cream2};padding:28px 48px 40px;">
              <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Getting started</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">01</td>
                    <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Visit <a href="https://colchisfood.com/b2b/register" style="color:${C.accent2};text-decoration:none;">colchisfood.com/b2b/register</a></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">02</td>
                    <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Click <strong>"Register with Access Code"</strong></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid ${C.forest}0d;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">03</td>
                    <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Enter the code above with <strong>${to}</strong></td>
                  </tr></table>
                </td></tr>
                <tr><td style="padding:10px 0;">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="width:28px;font-family:'Georgia',serif;font-size:18px;color:${C.accent};vertical-align:top;font-style:italic;">04</td>
                    <td style="padding-left:14px;font-family:'Georgia',serif;font-size:14px;color:${C.moss};line-height:1.5;">Complete registration and start ordering</td>
                  </tr></table>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:${C.cream2};padding:0 48px 44px;">
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:13px;color:${C.muted};text-align:center;">
                Code locked to your email · expires in <strong style="color:${C.forest};">30 days</strong>
              </p>
              <div style="height:1px;background:${C.forest};opacity:0.08;margin:0 0 16px;"></div>
              <p style="margin:0;font-family:'Georgia',serif;font-size:12px;color:${C.muted};text-align:center;">
                Questions? <a href="mailto:sales@colchisfood.com" style="color:${C.accent2};text-decoration:none;">sales@colchisfood.com</a>
              </p>
            </td>
          </tr>

          ${darkFoot()}
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send B2B approval email:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] B2B approval email sent to', to, '| ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending B2B approval email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

// ─── 5. B2B Rejection ───────────────────────────────────────────────────────

export async function sendB2bRejectionEmail(
  to: string,
  companyName: string,
  contactName?: string | null
) {
  const greeting = contactName || 'there';

  try {
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: [to],
      subject: `Update on Your Colchis Food Partnership Application`,
      html: wrap(`
          ${sealHead('Partnership Update')}

          <tr>
            <td style="background:${C.cream2};padding:48px 48px 24px;">
              <p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Application update</p>
              <h1 style="margin:0 0 24px;font-family:'Georgia',serif;font-size:28px;font-weight:300;color:${C.forest};line-height:1.2;">
                Dear <em style="color:${C.accent2};font-weight:400;">${greeting},</em>
              </h1>
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                Thank you for your interest in partnering with Colchis Food. We carefully reviewed the application for <strong style="color:${C.forest};font-style:normal;">${companyName}</strong>.
              </p>
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                After consideration, we are unable to approve your application at this time. This may be due to capacity constraints, geographic considerations, or other factors.
              </p>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.moss};line-height:1.75;font-style:italic;">
                We encourage you to apply again as our distribution network expands.
              </p>
            </td>
          </tr>

          ${divider()}

          <tr>
            <td style="background:${C.cream2};padding:28px 48px 44px;">
              <p style="margin:0;font-family:'Georgia',serif;font-size:12px;color:${C.muted};text-align:center;">
                Questions? <a href="mailto:sales@colchisfood.com" style="color:${C.accent2};text-decoration:none;">sales@colchisfood.com</a>
              </p>
            </td>
          </tr>

          ${darkFoot()}
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send B2B rejection email:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] B2B rejection email sent to', to, '| ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending B2B rejection email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

// ─── 7. Order confirmation (Phase 7a.7) ─────────────────────────────────────
//
// Sent from the Stripe webhook handler on payment_intent.succeeded. "Plain-but-
// readable" per the 7a plan — the pretty refresh ships in 7b. Best-effort: the
// webhook catches send failures and continues (payment + fulfillment is already
// committed by the time we get here).
//
// Phase 7b.3: includes a signed "View your order" link so guests (who don't have
// an account-based session) can revisit their order from the email.

import { signOrderToken } from './order-token';

export type OrderForEmail = {
  id: string;
  totalAmount: string;
  subtotalAmount: string | null;
  shippingAmount: string | null;
  taxAmount: string | null;
  guestEmail: string | null;
  shippingAddress: string | null;
  createdAt: Date;
  user: { email: string; name: string | null };
  fulfillments: {
    deliveryMethod: string;
    shippingCost: string | null;
    location: { name: string };
    items: {
      quantity: number;
      orderItem: { unitPrice: string; product: { name: string } };
    }[];
  }[];
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(s: string | null | undefined): string {
  if (!s) return '$0.00';
  const n = parseFloat(s);
  if (isNaN(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function fmtChannel(deliveryMethod: string): string {
  return deliveryMethod.replace(/_/g, ' ');
}

export async function sendOrderConfirmation(order: OrderForEmail) {
  const recipient = order.guestEmail || order.user.email;
  if (!recipient) {
    console.warn('[Resend] No recipient for order confirmation:', order.id);
    return { success: false, error: 'No recipient email on order' };
  }
  const bcc = process.env.BAKERY_NOTIFICATION_EMAIL || undefined;

  const shortId = order.id.slice(0, 8).toUpperCase();
  const customerName = order.user.name?.trim() || 'there';
  const placedOn = order.createdAt.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  // Phase 7b.3: signed lookup link. Default 30-day expiry — long enough that
  // even slow buyers can click through, short enough that a leaked email's
  // link is bounded.
  //
  // The `/en/` locale prefix is mandatory: the route lives under
  // `app/[locale]/(public)/orders/[token]/page.tsx`, and the next-intl
  // middleware that auto-injects the default locale is configured to skip
  // paths containing a dot (matcher excludes `.*\..*` for static-file handling).
  // JWT tokens have two dots (header.payload.signature), so an unprefixed
  // `/orders/<jwt>` URL would skip middleware and 404. Hard-coding the locale
  // here side-steps the matcher entirely. The email body is English-only, so
  // the customer landing on /en/ is also semantically correct.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const token = await signOrderToken(order.id);
  const lookupUrl = `${siteUrl}/en/orders/${token}`;

  // Phase 7b.7: aggregate stats for the hero strip
  const totalItemCount = order.fulfillments.reduce(
    (sum, f) => sum + f.items.reduce((ss, i) => ss + i.quantity, 0),
    0,
  );

  // Phase 7b.7: per-fulfillment cards (white panel on cream2 backdrop). Item
  // rows have stronger typographic rhythm — serif name + mono quantity + price.
  const fulfillmentBlocks = order.fulfillments.map((f, idx) => {
    const itemRows = f.items.map((it, i) => `
      <tr>
        <td style="padding:10px 0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};${i > 0 ? `border-top:1px solid ${C.forest}10;` : ''}">
          ${escHtml(it.orderItem.product.name)}
          <span style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px;color:${C.muted};margin-left:6px;">×${it.quantity}</span>
        </td>
        <td style="padding:10px 0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};text-align:right;${i > 0 ? `border-top:1px solid ${C.forest}10;` : ''}">
          ${fmtMoney((parseFloat(it.orderItem.unitPrice) * it.quantity).toFixed(2))}
        </td>
      </tr>`).join('');

    return `
      <tr>
        <td style="background:${C.cream2};padding:0 48px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.white};border:1px solid ${C.forest}22;">
            <tr>
              <td style="padding:20px 24px 14px;border-bottom:1px solid ${C.forest}14;">
                <p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:9px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
                  № ${String(idx + 1).padStart(2, '0')} — Fulfillment ${idx + 1} of ${order.fulfillments.length}
                </p>
                <p style="margin:0;font-family:'Georgia',serif;font-style:italic;font-size:22px;color:${C.forest};line-height:1.2;">
                  ${escHtml(f.location.name)}
                </p>
                <p style="margin:6px 0 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2.5px;color:${C.muted};text-transform:uppercase;">
                  ${escHtml(fmtChannel(f.deliveryMethod))}${f.shippingCost && parseFloat(f.shippingCost) > 0 ? ` · ${fmtMoney(f.shippingCost)} shipping` : f.shippingCost === '0.00' ? ' · free' : ''}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 24px 18px;">
                <table width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  try {
    const { data, error } = await resend.emails.send({
      from: getFrom(),
      to: recipient,
      bcc,
      subject: `Order placed — Colchis Food (#${shortId})`,
      html: wrap(`
          ${sealHead('Order placed')}

          <!-- Hero / greeting -->
          <tr>
            <td style="background:${C.cream2};padding:44px 48px 18px;">
              <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
                ✓ Confirmed · Order #${shortId}
              </p>
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:38px;font-weight:300;color:${C.forest};letter-spacing:-1px;line-height:1.05;">
                Thank you, <em style="color:${C.accent};">${escHtml(customerName)}.</em>
              </h1>
              <p style="margin:16px 0 0;font-family:'Georgia',serif;font-size:14px;color:${C.muted};font-style:italic;line-height:1.55;">
                We received your order on ${placedOn}. Here&rsquo;s everything that&rsquo;s on its way.
              </p>
            </td>
          </tr>

          <!-- Stats strip -->
          <tr>
            <td style="background:${C.cream2};padding:0 48px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.forest}22;">
                <tr>
                  <td width="33%" style="padding:14px 18px;border-right:1px solid ${C.forest}14;background:${C.white};">
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2.5px;color:${C.muted};text-transform:uppercase;">Items</p>
                    <p style="margin:6px 0 0;font-family:'Georgia',serif;font-size:24px;color:${C.forest};font-weight:300;line-height:1;">${totalItemCount}</p>
                  </td>
                  <td width="34%" style="padding:14px 18px;border-right:1px solid ${C.forest}14;background:${C.white};">
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2.5px;color:${C.muted};text-transform:uppercase;">Fulfillments</p>
                    <p style="margin:6px 0 0;font-family:'Georgia',serif;font-size:24px;color:${C.forest};font-weight:300;line-height:1;">${order.fulfillments.length}</p>
                  </td>
                  <td width="33%" style="padding:14px 18px;background:${C.white};text-align:right;">
                    <p style="margin:0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2.5px;color:${C.muted};text-transform:uppercase;">Total</p>
                    <p style="margin:6px 0 0;font-family:'Georgia',serif;font-size:24px;color:${C.forest};font-weight:400;line-height:1;">${fmtMoney(order.totalAmount)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA — copper-on-white pill keeps the "View order" button visually
               dominant AND survives email-client dark-mode tinting (the warm
               copper is mid-tone enough that auto-inversion can't ruin it). -->
          <tr>
            <td style="background:${C.cream2};padding:0 48px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${C.accent};padding:0;text-align:center;border-radius:2px;">
                    <a href="${lookupUrl}" style="display:block;padding:18px 28px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:3.5px;color:${C.cream};text-decoration:none;text-transform:uppercase;font-weight:bold;">View your order →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:10px 0 0;font-family:'Courier New',monospace;font-size:9px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;text-align:center;">
                Link valid for 30 days · no login required
              </p>
            </td>
          </tr>

          ${divider(C.cream2)}

          <!-- Section heading: fulfillments -->
          <tr>
            <td style="background:${C.cream2};padding:24px 48px 8px;">
              <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
                What you ordered
              </p>
              <p style="margin:4px 0 18px;font-family:'Georgia',serif;font-style:italic;font-size:16px;color:${C.muted};">
                Grouped by where each leg ships from.
              </p>
            </td>
          </tr>

          ${fulfillmentBlocks}

          ${divider(C.cream2)}

          <!-- Totals -->
          <tr>
            <td style="background:${C.cream2};padding:32px 48px 24px;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
                The reckoning
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;">Subtotal</td>
                  <td style="padding:5px 0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};text-align:right;">${fmtMoney(order.subtotalAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;">Shipping</td>
                  <td style="padding:5px 0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};text-align:right;">${fmtMoney(order.shippingAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:${C.muted};text-transform:uppercase;">Sales tax</td>
                  <td style="padding:5px 0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};text-align:right;">${fmtMoney(order.taxAmount)}</td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0;border-top:1px solid ${C.forest};font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Total</td>
                  <td style="padding:16px 0 0;border-top:1px solid ${C.forest};font-family:'Georgia',serif;font-size:32px;font-weight:400;color:${C.forest};text-align:right;letter-spacing:-0.5px;line-height:1;">${fmtMoney(order.totalAmount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${order.shippingAddress ? `
          <tr>
            <td style="background:${C.cream2};padding:0 48px 28px;">
              <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">Shipping to</p>
              <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:${C.forest};line-height:1.55;">
                ${escHtml(order.shippingAddress)}
              </p>
            </td>
          </tr>` : ''}

          ${divider(C.cream2)}

          <!-- What's next -->
          <tr>
            <td style="background:${C.cream2};padding:32px 48px 36px;">
              <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">
                What&rsquo;s next
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 14px;font-family:'Georgia',serif;font-size:14.5px;color:${C.forest};line-height:1.65;">
                    <strong style="color:${C.accent2};font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;margin-right:8px;">01</strong>
                    We start preparing as soon as the kitchen opens (hot items) or when our cold warehouse staff is on shift (creamery).
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px;font-family:'Georgia',serif;font-size:14.5px;color:${C.forest};line-height:1.65;">
                    <strong style="color:${C.accent2};font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;margin-right:8px;">02</strong>
                    You&rsquo;ll get a separate note when each fulfillment ships or is ready for pickup.
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;font-family:'Georgia',serif;font-size:14.5px;color:${C.forest};line-height:1.65;">
                    <strong style="color:${C.accent2};font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;margin-right:8px;">03</strong>
                    Questions? Reply to this email or write to
                    <a href="mailto:hello@colchisfood.com?subject=Order%20%23${shortId}" style="color:${C.accent2};text-decoration:none;border-bottom:1px solid ${C.accent2}55;">hello@colchisfood.com</a>
                    — your order number will be pre-filled.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${darkFoot()}
      `),
    });

    if (error) {
      console.error('[Resend] Failed to send order confirmation:', error);
      return { success: false, error: error.message };
    }
    console.log('[Resend] Order confirmation sent to', recipient, '| Order:', order.id, '| ID:', data?.id);
    return { success: true, id: data?.id };
  } catch (err: unknown) {
    console.error('[Resend] Error sending order confirmation:', err);
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}
