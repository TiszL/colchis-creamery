import type { Metadata } from "next";
import Link from "next/link";
import { submitB2bApplicationAction } from "@/app/actions/b2b-leads";

export const dynamic = "force-dynamic";

// Distinct from /wholesale (the marketing page) so the two don't compete for
// the same query with an identical title/description.
export const metadata: Metadata = {
    title: "Wholesale application",
    description: "Apply for a Colchis Food wholesale account — Georgian cheese for restaurants, grocers, and hospitality across the Midwest.",
};

export default async function WholesaleApplyPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const prefix = locale === "en" ? "" : `/${locale}`;

    return (
        <div className="max-w-2xl mx-auto px-6 py-16">
            <header className="mb-10">
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#B96A3D] mb-3">Wholesale partnership</p>
                <h1 className="text-4xl font-serif text-ink mb-3">Apply to carry Colchis Food</h1>
                <p className="text-base text-ink/70 leading-relaxed">
                    Tell us about your business. Sales review applications within 1–2 business days and reach out with terms + pricing for approved partners.
                </p>
                <p className="text-xs text-ink/50 mt-4">
                    Approved partners get net-terms invoicing via Resolve, recurring order schedules, and our wholesale catalog.
                    See the <Link href={`${prefix}/wholesale`} className="text-[#B96A3D] underline">wholesale program overview</Link> first.
                </p>
            </header>

            <form
                action={async fd => { "use server"; await submitB2bApplicationAction(fd); }}
                className="space-y-5 bg-white border border-ink/10 p-8 shadow-sm"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Company name *" name="companyName" required />
                    <Field label="Contact name" name="contactName" />
                    <Field label="Email *" name="email" type="email" required />
                    <Field label="Phone" name="phone" type="tel" placeholder="+1 614 555 0100" />
                </div>
                <Field label="Business address" name="address" placeholder="Street, City, ST ZIP" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Expected monthly volume" name="expectedVolume" placeholder="e.g. 100 lbs cheese / 200 frozen units" />
                    <div>
                        <label className="block text-[10px] font-bold text-ink/60 mb-1 uppercase tracking-wider">Account type *</label>
                        <select name="accountType" className="w-full bg-cream border border-ink/15 text-ink py-2 px-3 text-sm focus:outline-none focus:border-[#B96A3D]" required>
                            <option value="restaurant">Restaurant / cafe</option>
                            <option value="grocery">Grocery / specialty shop</option>
                            <option value="private_label">Private label</option>
                            <option value="distributor">Distributor</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-ink/60 mb-1 uppercase tracking-wider">Tell us about your business</label>
                    <textarea
                        name="message"
                        rows={4}
                        placeholder="What you do, who your customers are, why Colchis Food fits your menu/store."
                        className="w-full bg-cream border border-ink/15 text-ink py-2 px-3 text-sm focus:outline-none focus:border-[#B96A3D]"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-ink text-cream py-3 text-[11px] font-mono uppercase tracking-[0.24em] hover:bg-ink/90 transition-colors"
                >
                    Submit application
                </button>

                <p className="text-[10px] text-ink/40 text-center">
                    By submitting, you agree we&apos;ll contact you about wholesale terms. We don&apos;t share your info with third parties.
                </p>
            </form>
        </div>
    );
}

function Field({ label, name, type = "text", required, placeholder }: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-ink/60 mb-1 uppercase tracking-wider">{label}</label>
            <input
                name={name}
                type={type}
                required={required}
                placeholder={placeholder}
                className="w-full bg-cream border border-ink/15 text-ink py-2 px-3 text-sm focus:outline-none focus:border-[#B96A3D]"
            />
        </div>
    );
}
