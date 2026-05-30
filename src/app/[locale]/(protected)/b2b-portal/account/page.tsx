import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import B2BAccountClient from "@/components/b2b/B2BAccountClient";
import { UserCog } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PartnerAccountPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

    const [user, partner, locations] = await Promise.all([
        prisma.user.findUnique({ where: { id: session.userId }, select: { phone: true, companyName: true, stripeCustomerId: true } }),
        prisma.b2bPartner.findUnique({ where: { userId: session.userId } }),
        prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);

    if (!partner) {
        return (
            <div className="max-w-3xl mx-auto">
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-2 flex items-center gap-2"><UserCog className="w-6 h-6 text-[#CBA153]" /> Account &amp; company</h1>
                <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm rounded-lg mt-4">
                    Your partner profile isn&apos;t initialized yet. Place your first Resolve net-terms order and your account details will appear here.
                </div>
            </div>
        );
    }

    // Saved Stripe payment methods (read-only).
    let paymentMethods: { id: string; label: string }[] = [];
    if (user?.stripeCustomerId) {
        try {
            const pms = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, limit: 10 });
            paymentMethods = pms.data.map(pm => ({
                id: pm.id,
                label: pm.type === "card" && pm.card ? `${pm.card.brand.toUpperCase()} ···· ${pm.card.last4}`
                    : pm.type === "us_bank_account" && pm.us_bank_account ? `Bank ···· ${pm.us_bank_account.last4}`
                    : pm.type,
            }));
        } catch (e) {
            console.warn("[b2b-account] Stripe payment methods list failed:", e instanceof Error ? e.message : e);
        }
    }

    const profile = {
        companyName: partner.companyName,
        businessAddress: partner.businessAddress,
        ein: partner.ein,
        phone: user?.phone ?? null,
        defaultFulfillmentLocationId: partner.defaultFulfillmentLocationId,
        taxExempt: partner.taxExempt,
        resaleCertificateNumber: partner.resaleCertificateNumber,
        resaleCertificateState: partner.resaleCertificateState,
        resaleCertificateExpiresAt: partner.resaleCertificateExpiresAt ? partner.resaleCertificateExpiresAt.toISOString().slice(0, 10) : null,
        resaleCertificateUrl: partner.resaleCertificateUrl,
        creditLimitCents: partner.resolveCreditLimitCents,
        creditApproved: partner.resolveCreditApproved,
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2"><UserCog className="w-6 h-6 text-[#CBA153]" /> Account &amp; company</h1>
                <p className="text-sm text-gray-500">Manage your company profile, resale certificate, credit, and payment methods.</p>
            </header>
            <B2BAccountClient profile={profile} locations={locations} paymentMethods={paymentMethods} />
        </div>
    );
}
