import { redirect } from "next/navigation";

export default async function B2CRegisterPage({ params }: { params: any }) {
    const { locale } = await params;
    redirect(`/${locale}/login?mode=register`);
}
