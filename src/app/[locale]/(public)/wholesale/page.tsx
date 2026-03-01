import WholesaleForm from '@/components/b2b/WholesaleForm';
import { Metadata } from 'next';
import Link from 'next/link';
import { Truck, FileText } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Wholesale Partners | Colchis Creamery',
    description: 'Apply to become a wholesale partner with Colchis Creamery and offer premium artisanal Georgian cheese at your establishment.',
};

export default function WholesalePage() {
    return (
        <main className="bg-[#1A1A1A] text-[#CBA153] min-h-screen pt-32 pb-24">
            <div className="max-w-7xl mx-auto px-6">

                {/* Hero / Value Prop Section */}
                <div className="grid md:grid-cols-2 gap-20 items-stretch mb-24">
                    <div className="flex flex-col justify-center">
                        <span className="text-xs tracking-[0.4em] uppercase opacity-60 mb-6 block">Supply & Distribution</span>
                        <h2 className="text-5xl md:text-7xl font-serif text-white mb-8 leading-tight">
                            Wholesale <br />
                            <span className="text-[#CBA153]">Partnership.</span>
                        </h2>
                        <p className="text-gray-400 text-lg mb-10 font-light leading-relaxed">
                            Elevate your culinary offerings with the finest authentic Georgian cheese. We empower premium retailers and fine-dining restaurants across Ohio and the Midwest with steady, high-quality artisanal cheese supply.
                        </p>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                    <Truck size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">Cold Chain Logistics</h4>
                                    <p className="text-sm text-gray-500">Fresh from our facility to your inventory.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full border border-[#CBA153]/30 flex items-center justify-center shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">Paperless Contracting</h4>
                                    <p className="text-sm text-gray-500">Fully integrated Adobe Sign agreements.</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-12">
                            <Link href="/b2b/login" className="bg-[#CBA153] text-black px-12 py-5 font-bold uppercase tracking-widest text-sm hover:bg-white transition-all inline-block">
                                Partner Portal Login
                            </Link>
                        </div>
                    </div>

                    <div className="relative p-10 hidden md:block aspect-[4/5]">
                        <div className="absolute top-0 left-0 w-full h-full border border-[#CBA153]/10"></div>
                        <img
                            src="https://images.unsplash.com/photo-1447078806655-40579c2520d6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
                            className="absolute inset-0 w-full h-full object-cover grayscale opacity-60 contrast-125"
                            alt="Artisanal Workshop"
                        />
                    </div>
                </div>

                {/* Form Section */}
                <div className="bg-[#2C2A29] p-8 md:p-12 rounded-lg max-w-4xl mx-auto shadow-2xl border border-gray-800">
                    <h3 className="text-3xl font-serif text-white mb-8 text-center">Apply for Distribution</h3>
                    <WholesaleForm />
                </div>

            </div>
        </main>
    );
}
