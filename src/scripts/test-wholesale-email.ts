// Test sending the EXACT wholesale confirmation email template
// Run: npx tsx src/scripts/test-wholesale-email.ts
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'updates@noreply.colchisfood.com';
const TO = 'tornikeshergelashvili@gmail.com';

// This is the exact same template from wholesale.ts
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F5F0E6;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F0E6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;overflow:hidden;box-shadow:0 4px 24px rgba(31,48,38,0.08);max-width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#1F3026 0%,#2C3D33 100%);padding:40px 40px 30px;text-align:center;">
              <h1 style="margin:0;font-family:'Georgia',serif;font-size:24px;color:#B96A3D;letter-spacing:2px;font-weight:700;">COLCHIS FOOD</h1>
              <p style="margin:8px 0 0;font-size:11px;color:rgba(245,240,230,0.6);letter-spacing:4px;text-transform:uppercase;">Wholesale Partnership</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:22px;color:#1F3026;font-weight:400;">Application Received</h2>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">Dear Test User,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.7;">Thank you for your interest in partnering with Colchis Food. We're thrilled that <strong style="color:#1F3026;">Test Company</strong> is considering our artisanal Georgian cheeses.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#1F3026;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(245,240,230,0.5);">Dublin, Ohio · Heritage in every bite</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function test() {
  console.log('\n--- TEST 1: Simple plain text email ---');
  const { data: d1, error: e1 } = await resend.emails.send({
    from: `Colchis Food <${FROM_EMAIL}>`,
    to: [TO],
    subject: `[TEST-1] Plain text — ${new Date().toLocaleTimeString()}`,
    text: 'This is a plain text test email from Colchis Food wholesale diagnostic.',
  });
  console.log('Result:', e1 ? `❌ ERROR: ${JSON.stringify(e1)}` : `✅ ID: ${d1?.id}`);

  console.log('\n--- TEST 2: Wholesale HTML template (same as form) ---');
  const { data: d2, error: e2 } = await resend.emails.send({
    from: `Colchis Food <${FROM_EMAIL}>`,
    to: [TO],
    subject: `[TEST-2] Wholesale Template — ${new Date().toLocaleTimeString()}`,
    html: html,
  });
  console.log('Result:', e2 ? `❌ ERROR: ${JSON.stringify(e2)}` : `✅ ID: ${d2?.id}`);

  console.log('\n--- TEST 3: Sales notification to colchisfood.com ---');
  const { data: d3, error: e3 } = await resend.emails.send({
    from: `Colchis Food <${FROM_EMAIL}>`,
    to: ['sales@colchisfood.com', 't.shergelashvili@colchisfood.com'],
    subject: `[TEST-3] Sales Notification — ${new Date().toLocaleTimeString()}`,
    text: 'Test sales notification from wholesale form diagnostic.',
  });
  console.log('Result:', e3 ? `❌ ERROR: ${JSON.stringify(e3)}` : `✅ ID: ${d3?.id}`);

  console.log('\n--- DONE. Check all 3 inboxes. ---');
}

test().catch(console.error);
