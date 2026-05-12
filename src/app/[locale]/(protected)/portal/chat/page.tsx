import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ChatInbox from '@/components/admin/ChatInbox';

export const dynamic = 'force-dynamic';

const ALLOWED = ['MASTER_ADMIN', 'PRODUCT_MANAGER'];

export default async function StaffChatPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || !ALLOWED.includes(session.role)) redirect(`/${locale}/staff`);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Live Chat</h1>
                <p className="text-gray-500 font-light">Respond to customer conversations in real time.</p>
            </div>
            <ChatInbox />
        </div>
    );
}
