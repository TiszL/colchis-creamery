import { confirmAccessCodeEmailChangeAction } from "@/app/actions/auth";
import Link from "next/link";
import { CheckCircle, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface ConfirmProps {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ token?: string }>;
}

/**
 * Magic-link landing page. The original B2B invitee clicks this from the
 * "Confirm account transfer" email — we run the server action immediately
 * (idempotent: re-clicks read the same already-applied state) and render
 * a status page. No interaction required.
 */
export default async function B2BConfirmEmailPage({ params, searchParams }: ConfirmProps) {
    const { locale } = await params;
    const { token } = await searchParams;
    const prefix = locale === "en" ? "" : `/${locale}`;

    const result = token
        ? await confirmAccessCodeEmailChangeAction(token)
        : { ok: false as const, error: "Missing confirmation token." };

    return (
        <main className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md text-center">
                <Link href={`${prefix}/`} className="inline-block mb-8">
                    <img src="/logo.svg" alt="Colchis Food" className="w-16 h-16 object-contain mx-auto" />
                </Link>

                {result.ok ? (
                    <>
                        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
                        <h1 className="text-3xl font-serif text-white mb-3">Transfer confirmed</h1>
                        <p className="text-gray-400 font-light mb-6">
                            The B2B access code is now locked to <span className="font-mono text-[#CBA153]">{result.newEmail}</span>.
                            We&apos;ve emailed them a fresh registration link.
                        </p>
                        <p className="text-xs text-gray-600">
                            You can safely close this window. The original invite to your address is no longer usable.
                        </p>
                    </>
                ) : (
                    <>
                        <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-6" />
                        <h1 className="text-3xl font-serif text-white mb-3">Confirmation failed</h1>
                        <p className="text-gray-400 font-light mb-6">{result.error}</p>
                        <Link href={`${prefix}/b2b/login`} className="inline-block text-[#CBA153] hover:text-white text-sm uppercase tracking-widest">
                            Back to sign-in →
                        </Link>
                    </>
                )}
            </div>
        </main>
    );
}
