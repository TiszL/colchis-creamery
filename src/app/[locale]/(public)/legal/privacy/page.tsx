import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | Colchis Creamery',
};

export default function PrivacyPolicyPage() {
    return (
        <main className="min-h-screen bg-[#FAFAFA] py-20 px-4">
            <div className="max-w-3xl mx-auto bg-white p-10 md:p-16 shadow-sm rounded border border-gray-100">

                <h1 className="text-4xl font-serif text-[#2C2A29] mb-8 border-b-2 border-[#CBA153] pb-4 inline-block">
                    Privacy Policy
                </h1>

                <div className="prose prose-lg text-[#2C2A29] opacity-80">
                    <p className="mb-6">Last updated: October 2025</p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">1. Information We Collect</h2>
                    <p className="mb-6">
                        We collect information you provide directly to us, such as when you create an account, make a purchase, sign up for our newsletter, or contact customer support. This may include your name, email address, shipping address, and payment information.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">2. How We Use Your Information</h2>
                    <p className="mb-6">
                        We use the information we collect to process transactions, provide customer service, send logistical updates, and improve our services. We may also use your email to send marketing communications, from which you can opt out at any time.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">3. Data Security</h2>
                    <p className="mb-6">
                        We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no internet transmission is completely secure, and we cannot guarantee absolute security.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">4. Sharing of Information</h2>
                    <p className="mb-6">
                        We do not sell or rent your personal information to third parties. We may share information with trusted service providers who assist us in operating our website and conducting our business (e.g., payment processors like Stripe, logistics partners), subject to strict confidentiality agreements.
                    </p>

                    <h2 className="text-2xl font-serif text-[#CBA153] mt-8 mb-4">5. Contact Us</h2>
                    <p className="mb-6">
                        If you have any questions about this Privacy Policy, please contact us at support@colchiscreamery.com.
                    </p>
                </div>

            </div>
        </main>
    );
}
