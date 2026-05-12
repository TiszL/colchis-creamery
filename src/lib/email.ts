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
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:${C.cream};font-family:'Georgia','Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.cream};padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:100%;">
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
  return `
        <tr>
          <td style="background:${C.forest};padding:48px 48px 44px;text-align:center;background-image:linear-gradient(rgba(245,240,230,0.03) 1px, transparent 1px),linear-gradient(90deg,rgba(245,240,230,0.03) 1px, transparent 1px);background-size:40px 40px;">
            <img src="${SEAL_URL}" alt="Colchis Food" width="64" height="64" style="display:block;margin:0 auto 20px;" />
            <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:5px;color:rgba(245,240,230,0.45);text-transform:uppercase;">Colchis Food</p>
            <p style="margin:0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${C.accent2};text-transform:uppercase;">${subtitle}</p>
          </td>
        </tr>
        <tr><td style="height:2px;background:${C.accent};font-size:0;line-height:0;">&nbsp;</td></tr>`;
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
  } catch (err: any) {
    console.error('[Resend] Error sending email:', err);
    return { success: false, error: err.message };
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
  } catch (err: any) {
    console.error('[Resend] Error sending 2FA email:', err);
    return { success: false, error: err.message };
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
                  <td style="background:${C.forest};padding:18px 28px;text-align:center;">
                    <a href="mailto:${data.email}?subject=Re: Your message to Colchis Food" style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${C.cream};text-decoration:none;text-transform:uppercase;">Reply to ${data.name} →</a>
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
  } catch (err: any) {
    console.error('[Resend] Error sending contact form email:', err);
    return { success: false, error: err.message };
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
  } catch (err: any) {
    console.error('[Resend] Error sending B2B approval email:', err);
    return { success: false, error: err.message };
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
  } catch (err: any) {
    console.error('[Resend] Error sending B2B rejection email:', err);
    return { success: false, error: err.message };
  }
}
