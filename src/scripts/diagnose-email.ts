// Resend Email Diagnostic — Run with: npx tsx src/scripts/diagnose-email.ts
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'updates@noreply.colchisfood.com';

console.log('\n══════════════════════════════════════════');
console.log('       RESEND EMAIL DIAGNOSTIC');
console.log('══════════════════════════════════════════\n');

console.log('1. ENV CHECK');
console.log('   RESEND_API_KEY:', API_KEY ? `${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)} (${API_KEY.length} chars)` : '❌ MISSING');
console.log('   EMAIL_FROM:', FROM_EMAIL);

if (!API_KEY || API_KEY === 're_dummy_string_for_build_time') {
  console.error('\n❌ No valid RESEND_API_KEY found. Check .env.local');
  process.exit(1);
}

const resend = new Resend(API_KEY);

async function run() {
  // 2. Verify API key by listing domains
  console.log('\n2. DOMAIN VERIFICATION');
  try {
    const { data: domains, error: domainErr } = await resend.domains.list();
    if (domainErr) {
      console.error('   ❌ Domain list error:', domainErr);
    } else if (domains) {
      console.log(`   Found ${(domains as any).data?.length || 0} domains:`);
      for (const d of (domains as any).data || []) {
        console.log(`   • ${d.name} — Status: ${d.status} | Region: ${d.region}`);
      }
    }
  } catch (e: any) {
    console.error('   ❌ API Error:', e.message);
    if (e.message?.includes('API key')) {
      console.error('   → Your API key may be invalid or expired');
    }
  }

  // 3. Send a test email to the user's gmail
  const TEST_TO = 'tornikeshergelashvili@gmail.com';
  console.log(`\n3. SENDING TEST EMAIL`);
  console.log(`   From: Colchis Food <${FROM_EMAIL}>`);
  console.log(`   To: ${TEST_TO}`);

  try {
    const { data, error } = await resend.emails.send({
      from: `Colchis Food <${FROM_EMAIL}>`,
      to: [TEST_TO],
      subject: `[TEST] Resend Diagnostic — ${new Date().toISOString()}`,
      html: `<div style="font-family:Georgia,serif;padding:40px;background:#F5F0E6;">
        <h1 style="color:#1F3026;">✅ Email Delivery Confirmed</h1>
        <p style="color:#2C3D33;">This test email was sent at ${new Date().toLocaleString()}.</p>
        <p style="color:#2C3D33;">From: <code>${FROM_EMAIL}</code></p>
        <p style="color:#B96A3D;font-weight:bold;">If you see this, Resend is working correctly.</p>
      </div>`,
    });

    if (error) {
      console.error('   ❌ SEND FAILED:', JSON.stringify(error, null, 2));
      console.log('\n   DIAGNOSIS:');
      if (error.message?.includes('not verified')) {
        console.log('   → The sending domain is not verified in Resend');
      } else if (error.message?.includes('api_key')) {
        console.log('   → API key issue');
      } else {
        console.log('   → Check Resend dashboard > Logs for details');
      }
    } else {
      console.log('   ✅ Email accepted by Resend!');
      console.log('   Email ID:', data?.id);
      console.log('\n   → Check your inbox AND spam folder');
      console.log('   → Also check Resend dashboard > Emails > Logs for delivery status');
    }
  } catch (e: any) {
    console.error('   ❌ EXCEPTION:', e.message);
    console.error('   Full error:', JSON.stringify(e, null, 2));
  }

  // 4. Check recent emails
  console.log('\n4. RECENT EMAIL LOG (last 5)');
  try {
    const { data: emails, error: listErr } = await resend.emails.list();
    if (listErr) {
      console.error('   ❌ List error:', listErr);
    } else if (emails) {
      const list = (emails as any).data || [];
      for (const e of list.slice(0, 5)) {
        console.log(`   • ${e.id} | To: ${e.to} | Subject: ${(e.subject || '').slice(0, 50)} | Status: ${e.last_event || 'unknown'} | ${e.created_at}`);
      }
      if (list.length === 0) {
        console.log('   No recent emails found — this suggests emails are NOT being sent');
      }
    }
  } catch (e: any) {
    // emails.list() may not be available on all plans
    console.log('   ⚠ Could not list emails (may require paid plan):', e.message?.slice(0, 80));
  }

  console.log('\n══════════════════════════════════════════');
  console.log('   DIAGNOSIS COMPLETE');
  console.log('══════════════════════════════════════════\n');
}

run().catch(console.error);
