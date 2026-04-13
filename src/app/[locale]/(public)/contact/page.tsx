import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import ContactFormClient from '@/components/contact/ContactFormClient';

export const metadata: Metadata = {
    title: 'Contact Us | Colchis Creamery',
    description: 'Get in touch with the Colchis Creamery team for inquiries, support, or feedback.',
};

export default async function ContactPage() {
    const configs = await prisma.siteConfig.findMany({
        where: { key: { in: ['contact.email', 'contact.phone', 'contact.address'] } }
    });
    
    const emailConfig = configs.find(c => c.key === 'contact.email')?.value || 'support@colchiscreamery.com';
    const phoneConfig = configs.find(c => c.key === 'contact.phone')?.value || '+1 (555) 123-4567';
    const addressConfig = configs.find(c => c.key === 'contact.address')?.value || '123 Heritage Way, Columbus, OH 43215';

    return (
        <main className="min-h-screen bg-[#FDFBF7] py-20 px-4">
            <div className="max-w-4xl mx-auto">

                <div className="text-center mb-16">
                    <h1 className="text-5xl font-serif text-[#2C2A29] mb-4">Contact Us</h1>
                    <p className="text-xl text-[#2C2A29] opacity-80 max-w-2xl mx-auto">
                        We are here to assist you. Whether you have a question about our artisanal cheese, your recent order, or wholesale opportunities, our team is ready to help.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12 bg-white p-8 md:p-12 shadow-sm rounded border border-gray-100">

                    <div>
                        <h2 className="text-2xl font-serif text-[#CBA153] mb-6">Our Information</h2>
                        <div className="space-y-6 text-[#2C2A29]">
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Address</strong>
                                <p>{addressConfig}</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Email</strong>
                                <p>{emailConfig}</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Phone</strong>
                                <p>{phoneConfig}</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Hours</strong>
                                <p>Monday - Friday: 9 AM - 5 PM EST</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-serif text-[#CBA153] mb-6">Send a Message</h2>
                        <ContactFormClient />
                    </div>

                </div>

            </div>
        </main>
    );
}
