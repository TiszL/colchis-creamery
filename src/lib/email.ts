import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_string_for_build_time');

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@updates.colchiscreamery.com';
const FROM_NAME = 'Colchis Creamery';

export async function sendVerificationEmail(to: string, code: string, name?: string) {
  const greeting = name ? `Hello ${name}` : 'Hello';

  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `${code} is your Colchis Creamery verification code`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2C2A29 0%,#4A4745 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#CBA153;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;">COLCHIS CREAMERY</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Authentic Georgian Cheese</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#333;font-size:16px;margin:0 0 8px;font-weight:600;">${greeting},</p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 28px;">
                Thank you for creating your Colchis Creamery account. Please use the verification code below to confirm your email address:
              </p>
              
              <!-- Code Box -->
              <div style="background:linear-gradient(135deg,#FDFBF7 0%,#FAFAFA 100%);border:2px solid #CBA153;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                <p style="color:#999;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">Your Verification Code</p>
                <p style="color:#2C2A29;font-size:36px;font-weight:700;letter-spacing:8px;margin:0;font-family:'Courier New',monospace;">${code}</p>
              </div>
              
              <p style="color:#999;font-size:12px;line-height:1.5;margin:0 0 24px;text-align:center;">
                This code expires in <strong style="color:#666;">15 minutes</strong>. If you didn't create an account, you can safely ignore this email.
              </p>
              
              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
              
              <p style="color:#999;font-size:11px;line-height:1.5;margin:0;text-align:center;">
                Questions? Reply to this email or contact us at<br/>
                <a href="mailto:support@colchiscreamery.com" style="color:#CBA153;text-decoration:none;font-weight:600;">support@colchiscreamery.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#2C2A29;padding:20px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.4);font-size:10px;margin:0;letter-spacing:1px;">
                © ${new Date().getFullYear()} Colchis Creamery · Columbus, Ohio · Authentic Georgian Cheese
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
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

export async function send2FAEmail(to: string, code: string, name?: string) {
  const greeting = name ? `Hello ${name}` : 'Hello';

  try {
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `${code} — Colchis Creamery Admin Login Verification`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2C2A29 0%,#4A4745 100%);padding:32px 40px;text-align:center;">
              <h1 style="color:#CBA153;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;">COLCHIS CREAMERY</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Admin Security Verification</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#333;font-size:16px;margin:0 0 8px;font-weight:600;">${greeting},</p>
              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 28px;">
                A login attempt was detected for your admin account. Enter the code below to complete sign-in:
              </p>
              
              <!-- Code Box -->
              <div style="background:#FFF8F0;border:2px solid #E8614A;border-radius:12px;padding:28px;text-align:center;margin:0 0 28px;">
                <p style="color:#E8614A;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">🔐 Two-Factor Code</p>
                <p style="color:#2C2A29;font-size:36px;font-weight:700;letter-spacing:8px;margin:8px 0 0;font-family:'Courier New',monospace;">${code}</p>
              </div>
              
              <p style="color:#999;font-size:12px;line-height:1.5;margin:0 0 16px;text-align:center;">
                This code expires in <strong style="color:#666;">5 minutes</strong>.
              </p>
              
              <div style="background:#FFF3F3;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
                <p style="color:#C0392B;font-size:12px;margin:0;line-height:1.5;">
                  ⚠️ If you did not attempt to log in, your password may be compromised. Please change it immediately.
                </p>
              </div>
              
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
              
              <p style="color:#999;font-size:11px;line-height:1.5;margin:0;text-align:center;">
                Colchis Creamery Admin Portal<br/>
                <a href="mailto:t.shergelashvili@colchiscreamery.com" style="color:#CBA153;text-decoration:none;font-weight:600;">t.shergelashvili@colchiscreamery.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#2C2A29;padding:20px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.4);font-size:10px;margin:0;letter-spacing:1px;">
                © ${new Date().getFullYear()} Colchis Creamery · Columbus, Ohio · Admin Security
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
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

// ──────────────────────────────────────────────────────────────────────────────
// Contact Form Email — forwards to sales + admin
// ──────────────────────────────────────────────────────────────────────────────

const CONTACT_RECIPIENTS = [
  'sales@colchiscreamery.com',
  't.shergelashvili@colchiscreamery.com',
];

export async function sendContactFormEmail(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    const { data: result, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: CONTACT_RECIPIENTS,
      replyTo: data.email,
      subject: `New Contact Form Message from ${data.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#FDFBF7;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2C2A29 0%,#4A4745 100%);padding:28px 40px;text-align:center;">
              <h1 style="color:#CBA153;margin:0;font-size:22px;font-weight:700;letter-spacing:1px;">COLCHIS CREAMERY</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">New Contact Form Message</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              
              <!-- Sender Info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;background:#FDFBF7;border-radius:8px;border-left:4px solid #CBA153;">
                    <p style="margin:0 0 4px;font-size:13px;color:#999;">From</p>
                    <p style="margin:0;font-size:16px;color:#2C2A29;font-weight:600;">${data.name}</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#666;">
                      <a href="mailto:${data.email}" style="color:#CBA153;text-decoration:none;">${data.email}</a>
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Message -->
              <div style="padding:20px;background:#FAFAFA;border-radius:8px;border:1px solid #eee;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;">Message</p>
                <p style="margin:0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${data.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
              </div>
              
              <!-- Reply CTA -->
              <div style="text-align:center;margin-top:28px;">
                <a href="mailto:${data.email}?subject=Re: Your message to Colchis Creamery" 
                   style="display:inline-block;background:#2C2A29;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
                  Reply to ${data.name}
                </a>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color:#2C2A29;padding:16px 40px;text-align:center;">
              <p style="color:rgba(255,255,255,0.4);font-size:10px;margin:0;letter-spacing:1px;">
                Contact form submission · ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
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

