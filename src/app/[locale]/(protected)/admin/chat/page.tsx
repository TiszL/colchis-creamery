import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ChatInbox from '@/components/admin/ChatInbox';

export const dynamic = 'force-dynamic';

export default async function AdminChatPage({ params }: { params: any }) {
    const { locale } = await params;
    const session = await getSession();
    if (!session || session.role !== 'MASTER_ADMIN') redirect(`/${locale}/staff`);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-serif text-white mb-2">Live Chat</h1>
                <p className="text-gray-500 font-light">Monitor and respond to customer conversations.</p>
            </div>
            <ChatInbox />
        </div>
    );
}
