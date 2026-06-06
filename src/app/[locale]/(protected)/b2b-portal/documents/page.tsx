import { prisma as db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartnerContext } from "@/lib/b2b-partner";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, FileSignature, BadgeCheck, FileText, Download, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
    return d ? new Date(d).toLocaleDateString() : "—";
}

export default async function PartnerDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations("b2bPortal.documents");
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);
    // Org documents (contracts, resale cert) are owner-level — members redirected.
    const ctx = await getPartnerContext(session.userId);
    if (ctx && !ctx.isOwner) redirect(`/${locale}/b2b-portal`);

    const [partner, contracts] = await Promise.all([
        db.b2bPartner.findUnique({
            where: { userId: session.userId },
            select: {
                id: true,
                resaleCertificateUrl: true,
                resaleCertificateNumber: true,
                resaleCertificateState: true,
                resaleCertificateExpiresAt: true,
            },
        }),
        // Contract.partnerId references User.id (see schema relation + cron usage).
        db.contract.findMany({
            where: { partnerId: session.userId },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, discountPercentage: true, validUntil: true, signedDocumentUrl: true, createdAt: true },
        }),
    ]);

    const openInvoiceCount = partner
        ? await db.b2bInvoice.count({ where: { partnerId: partner.id, status: { in: ["PENDING", "OVERDUE"] } } })
        : 0;

    const cardCls = "bg-white border border-[#E8E6E1] shadow-sm rounded-xl";
    const linkBtn = "inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#CBA153] hover:text-[#2C2A29] transition";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <header>
                <h1 className="text-3xl font-serif text-[#2C2A29] mb-1 flex items-center gap-2">
                    <FolderOpen className="w-6 h-6 text-[#CBA153]" /> {t("title")}
                </h1>
                <p className="text-sm text-gray-500">{t("subtitle")}</p>
            </header>

            {/* Contracts */}
            <section className={cardCls}>
                <div className="px-5 py-3 border-b border-[#E8E6E1] flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-[#CBA153]" />
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">{t("contracts")}</h2>
                </div>
                {contracts.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-500">{t("noContracts")}</p>
                ) : (
                    <div className="divide-y divide-[#E8E6E1]">
                        {contracts.map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-[#2C2A29]">
                                        {t("discountTier", { percent: c.discountPercentage })}
                                        <span className={`ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${c.status === "SIGNED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.status}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-500 font-mono">
                                        {t("issuedValidUntil", { issued: fmtDate(c.createdAt), validUntil: c.validUntil ? fmtDate(c.validUntil) : t("indefinite") })}
                                    </p>
                                </div>
                                {c.signedDocumentUrl ? (
                                    <a href={c.signedDocumentUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                                        <Download className="w-3.5 h-3.5" /> {t("signedPdf")}
                                    </a>
                                ) : (
                                    <span className="text-[11px] text-gray-400 font-mono">{t("noPdf")}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Resale certificate */}
            <section className={cardCls}>
                <div className="px-5 py-3 border-b border-[#E8E6E1] flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-[#CBA153]" />
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">{t("resaleCertificate")}</h2>
                </div>
                <div className="px-5 py-4">
                    {partner?.resaleCertificateNumber || partner?.resaleCertificateUrl ? (
                        <div className="flex items-center justify-between gap-4">
                            <div className="text-sm text-[#2C2A29] space-y-0.5">
                                {partner.resaleCertificateNumber && <p>{t("certNumberLabel")} <span className="font-mono">{partner.resaleCertificateNumber}</span>{partner.resaleCertificateState ? ` · ${partner.resaleCertificateState}` : ""}</p>}
                                <p className="text-[11px] text-gray-500 font-mono">{t("expires", { date: fmtDate(partner.resaleCertificateExpiresAt) })}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {partner.resaleCertificateUrl && (
                                    <a href={partner.resaleCertificateUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                                        <ExternalLink className="w-3.5 h-3.5" /> {t("view")}
                                    </a>
                                )}
                                <Link href={`/${locale}/b2b-portal/account`} className={linkBtn}>{t("update")}</Link>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">
                            {t("noResaleCertPrefix")}{" "}
                            <Link href={`/${locale}/b2b-portal/account`} className="text-[#CBA153] hover:text-[#2C2A29]">{t("accountCompanyLink")}</Link> {t("noResaleCertSuffix")}
                        </p>
                    )}
                </div>
            </section>

            {/* Invoices */}
            <section className={cardCls}>
                <div className="px-5 py-3 border-b border-[#E8E6E1] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#CBA153]" />
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">{t("invoicesBilling")}</h2>
                </div>
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">
                        {openInvoiceCount > 0
                            ? t("openInvoiceCount", { count: openInvoiceCount })
                            : t("noOpenInvoices")}
                    </p>
                    <Link href={`/${locale}/b2b-portal/invoices`} className={linkBtn}>
                        <ExternalLink className="w-3.5 h-3.5" /> {t("viewAllInvoices")}
                    </Link>
                </div>
            </section>
        </div>
    );
}
