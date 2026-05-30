import { prisma as db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderOpen, FileSignature, BadgeCheck, FileText, Download, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null | undefined): string {
    return d ? new Date(d).toLocaleDateString() : "—";
}

export default async function PartnerDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session) redirect(`/${locale}/b2b/login`);
    if (session.role !== "B2B_PARTNER" && session.role !== "MASTER_ADMIN") redirect(`/${locale}/`);

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
                    <FolderOpen className="w-6 h-6 text-[#CBA153]" /> Documents
                </h1>
                <p className="text-sm text-gray-500">Your contracts, tax documents, and billing in one place.</p>
            </header>

            {/* Contracts */}
            <section className={cardCls}>
                <div className="px-5 py-3 border-b border-[#E8E6E1] flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-[#CBA153]" />
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Contracts</h2>
                </div>
                {contracts.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-500">No contract on file yet.</p>
                ) : (
                    <div className="divide-y divide-[#E8E6E1]">
                        {contracts.map(c => (
                            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm text-[#2C2A29]">
                                        {c.discountPercentage}% discount tier
                                        <span className={`ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${c.status === "SIGNED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{c.status}</span>
                                    </p>
                                    <p className="text-[11px] text-gray-500 font-mono">
                                        Issued {fmtDate(c.createdAt)} · Valid until {c.validUntil ? fmtDate(c.validUntil) : "Indefinite"}
                                    </p>
                                </div>
                                {c.signedDocumentUrl ? (
                                    <a href={c.signedDocumentUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                                        <Download className="w-3.5 h-3.5" /> Signed PDF
                                    </a>
                                ) : (
                                    <span className="text-[11px] text-gray-400 font-mono">No PDF</span>
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
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Resale certificate</h2>
                </div>
                <div className="px-5 py-4">
                    {partner?.resaleCertificateNumber || partner?.resaleCertificateUrl ? (
                        <div className="flex items-center justify-between gap-4">
                            <div className="text-sm text-[#2C2A29] space-y-0.5">
                                {partner.resaleCertificateNumber && <p>No. <span className="font-mono">{partner.resaleCertificateNumber}</span>{partner.resaleCertificateState ? ` · ${partner.resaleCertificateState}` : ""}</p>}
                                <p className="text-[11px] text-gray-500 font-mono">Expires {fmtDate(partner.resaleCertificateExpiresAt)}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {partner.resaleCertificateUrl && (
                                    <a href={partner.resaleCertificateUrl} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                                        <ExternalLink className="w-3.5 h-3.5" /> View
                                    </a>
                                )}
                                <Link href={`/${locale}/b2b-portal/account`} className={linkBtn}>Update</Link>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">
                            No resale certificate on file. Add one on your{" "}
                            <Link href={`/${locale}/b2b-portal/account`} className="text-[#CBA153] hover:text-[#2C2A29]">Account &amp; Company</Link> page to keep wholesale orders tax-exempt.
                        </p>
                    )}
                </div>
            </section>

            {/* Invoices */}
            <section className={cardCls}>
                <div className="px-5 py-3 border-b border-[#E8E6E1] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#CBA153]" />
                    <h2 className="text-[11px] font-mono uppercase tracking-wider text-gray-500">Invoices &amp; billing</h2>
                </div>
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">
                        {openInvoiceCount > 0
                            ? `${openInvoiceCount} open invoice${openInvoiceCount === 1 ? "" : "s"}.`
                            : "No open invoices."}
                    </p>
                    <Link href={`/${locale}/b2b-portal/invoices`} className={linkBtn}>
                        <ExternalLink className="w-3.5 h-3.5" /> View all invoices
                    </Link>
                </div>
            </section>
        </div>
    );
}
