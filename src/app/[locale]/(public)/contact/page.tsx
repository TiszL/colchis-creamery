import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Contact Us | Colchis Creamery',
    description: 'Get in touch with the Colchis Creamery team for inquiries, support, or feedback.',
};

export default function ContactPage() {
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
                                <p>123 Heritage Way<br />Columbus, OH 43215</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Email</strong>
                                <p>support@colchiscreamery.com</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Phone</strong>
                                <p>+1 (555) 123-4567</p>
                            </div>
                            <div>
                                <strong className="block uppercase tracking-wider text-xs text-gray-400 mb-1">Hours</strong>
                                <p>Monday - Friday: 9 AM - 5 PM EST</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-serif text-[#CBA153] mb-6">Send a Message</h2>
                        <form className="space-y-4">
                            <div>
                                <label className="block text-sm text-[#2C2A29] mb-1">Full Name</label>
                                <input type="text" className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-sm text-[#2C2A29] mb-1">Email Address</label>
                                <input type="email" className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]" />
                            </div>
                            <div>
                                <label className="block text-sm text-[#2C2A29] mb-1">Message</label>
                                <textarea rows={4} className="w-full border border-gray-300 p-3 rounded focus:outline-none focus:border-[#CBA153]"></textarea>
                            </div>
                            <button type="button" className="bg-[#2C2A29] text-white px-8 py-3 rounded hover:bg-opacity-90 transition font-medium w-full">
                                Send Message
                            </button>
                        </form>
                    </div>

                </div>

            </div>
        </main>
    );
}
