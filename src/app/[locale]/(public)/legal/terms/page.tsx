import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service | Colchis Creamery',
};

export default function TermsOfServicePage() {
    return (
        <main className="min-h-screen bg-[#FAFAFA] py-20 px-4">
            <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 shadow-sm rounded border border-gray-100">

                <h1 className="text-4xl font-serif text-[#2C2A29] mb-8 border-b-2 border-[#CBA153] pb-4 inline-block">
                    Terms of Service
                </h1>

                <div className="prose prose-lg text-[#2C2A29] opacity-80">
                    <p className="mb-6">Last updated: October 2025</p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">1. Acceptance of Terms</h2>
                    <p className="mb-6">
                        By accessing and using colchiscreamery.com, you accept and agree to be bound by the terms and provisions of this agreement.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">2. B2B Wholesale Accounts</h2>
                    <p className="mb-6">
                        Wholesale accounts are subject to approval. By establishing a wholesale account, you agree to our Net-30 payment terms (where applicable) and acknowledge that pricing is confidential. Overdue invoices may incur a late fee of 1.5% per month.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">3. Product Information</h2>
                    <p className="mb-6">
                        We attempt to be as accurate as possible regarding product descriptions. However, because our cheeses are handmade artisan products, slight variations in weight and appearance may occur. All weights listed are approximate.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">4. Intellectual Property</h2>
                    <p className="mb-6">
                        The Site and its original content, features, functionalities, and branding (including the "Colchis Creamery" name and logos) are owned by Colchis Creamery LLC and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">5. Modifications</h2>
                    <p className="mb-6">
                        We reserve the right to modify these terms at any time. Your continued use of the Site following any such modification constitutes your agreement to follow and be bound by the modified terms.
                    </p>

                </div>

            </div>
        </main>
    );
}
