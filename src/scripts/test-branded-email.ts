// Send the REAL branded wholesale confirmation template
// Run: npx tsx src/scripts/test-branded-email.ts
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'hello@noreply.colchisfood.com';
const TO = 'tornikeshergelashvili@gmail.com';

// ─── Shared brand tokens ───────────────────────────────────────────────────

const B = {
  forest: '#1F3026', moss: '#2C3D33', copper: '#B96A3D',
  cream: '#F5F0E6', muted: '#7A8278', white: '#ffffff',
};

function wrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:${B.cream};font-family:'Georgia','Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${B.cream};padding:40px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:${B.white};max-width:100%;box-shadow:0 1px 3px rgba(31,48,38,0.06);">${content}</table>
<table width="600" cellpadding="0" cellspacing="0" style="max-width:100%;"><tr><td style="padding:28px 0;text-align:center;">
<p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:4px;color:${B.muted};text-transform:uppercase;">Colchis Food · Dublin, Ohio</p>
<p style="margin:0;font-family:'Georgia',serif;font-size:11px;color:${B.muted};font-style:italic;">Heritage in every bite</p>
</td></tr></table></td></tr></table></body></html>`;
}

const header = `<tr><td style="background:${B.forest};padding:44px 48px 40px;text-align:center;">
<div style="display:inline-block;width:52px;height:52px;border:1.5px solid ${B.copper};text-align:center;line-height:50px;font-family:'Georgia',serif;font-size:20px;font-weight:700;color:${B.copper};letter-spacing:1px;margin-bottom:16px;">CF</div>
<p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:5px;color:rgba(245,240,230,0.4);text-transform:uppercase;">Est. MMXXVI</p>
<p style="margin:0;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${B.copper};text-transform:uppercase;">Wholesale Partnership</p>
</td></tr><tr><td style="height:3px;background:${B.copper};font-size:0;line-height:0;">&nbsp;</td></tr>`;

const footer = `<tr><td style="background:${B.forest};padding:32px 48px;text-align:center;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(245,240,230,0.1);padding-top:20px;text-align:center;">
<p style="margin:0 0 4px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:rgba(245,240,230,0.3);text-transform:uppercase;">© 2026 Colchis Food</p>
<p style="margin:0;font-family:'Georgia',serif;font-size:11px;color:rgba(245,240,230,0.25);font-style:italic;">5340 Tuller Rd · Dublin, Ohio</p>
</td></tr></table></td></tr>`;

const html = wrap(`${header}
<tr><td style="padding:48px 48px 20px;">
<p style="margin:0 0 24px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${B.copper};text-transform:uppercase;">№ 01 — Application Received</p>
<h1 style="margin:0 0 28px;font-family:'Georgia',serif;font-size:32px;font-weight:400;color:${B.forest};line-height:1.2;letter-spacing:-0.5px;">Thank you,<br><em style="color:${B.copper};font-weight:400;">Tornike.</em></h1>
<p style="margin:0 0 12px;font-family:'Georgia',serif;font-size:15px;color:${B.moss};line-height:1.7;">We've received the partnership application for <strong style="color:${B.forest};">Colchis Food LLC</strong>. Our wholesale team reviews every request personally — expect to hear from us within <strong>1–2 business days</strong>.</p>
</td></tr>
<tr><td style="padding:0 48px;"><div style="height:1px;background:${B.forest};opacity:0.1;"></div></td></tr>
<tr><td style="padding:32px 48px;">
<p style="margin:0 0 20px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:${B.copper};text-transform:uppercase;">№ 02 — What happens next</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:12px 0;border-bottom:1px solid rgba(31,48,38,0.06);"><table cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;font-family:'Georgia',serif;font-size:20px;color:${B.copper};vertical-align:top;">01</td>
<td style="padding-left:12px;font-family:'Georgia',serif;font-size:14px;color:${B.moss};line-height:1.5;">Our sales team reviews your application</td>
</tr></table></td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid rgba(31,48,38,0.06);"><table cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;font-family:'Georgia',serif;font-size:20px;color:${B.copper};vertical-align:top;">02</td>
<td style="padding-left:12px;font-family:'Georgia',serif;font-size:14px;color:${B.moss};line-height:1.5;">A dedicated account manager contacts you</td>
</tr></table></td></tr>
<tr><td style="padding:12px 0;border-bottom:1px solid rgba(31,48,38,0.06);"><table cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;font-family:'Georgia',serif;font-size:20px;color:${B.copper};vertical-align:top;">03</td>
<td style="padding-left:12px;font-family:'Georgia',serif;font-size:14px;color:${B.moss};line-height:1.5;">Product sampling &amp; pricing discussion</td>
</tr></table></td></tr>
<tr><td style="padding:12px 0;"><table cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;font-family:'Georgia',serif;font-size:20px;color:${B.copper};vertical-align:top;">04</td>
<td style="padding-left:12px;font-family:'Georgia',serif;font-size:14px;color:${B.moss};line-height:1.5;">Paperless contract via Adobe Sign</td>
</tr></table></td></tr>
</table></td></tr>
<tr><td style="padding:8px 48px 48px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="background:${B.forest};padding:20px 28px;text-align:center;">
<a href="https://colchisfood.com/shop" style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:${B.cream};text-decoration:none;text-transform:uppercase;">Explore our products →</a>
</td></tr></table></td></tr>
${footer}`);

async function send() {
  console.log('Sending branded wholesale confirmation email...');
  const { data, error } = await resend.emails.send({
    from: `Colchis Food <${FROM}>`,
    to: [TO],
    subject: 'Partnership Application Received — Colchis Food',
    html,
  });
  if (error) console.error('❌', JSON.stringify(error));
  else console.log('✅ Sent! ID:', data?.id, '— check your inbox');
}

send().catch(console.error);
