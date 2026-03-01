'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function submitWholesaleLead(prevState: any, formData: FormData) {
    const companyName = formData.get('companyName') as string;
    const email = formData.get('email') as string;
    const volume = formData.get('volume') as string;
    const message = formData.get('message') as string;

    // 1. Basic validation
    if (!companyName || !email) {
        return { error: 'Please fill in all required fields.' };
    }

    try {
        // 2. Mock saving to database since Prisma schema might not have the Leads table yet
        // In a real app with the full DB schema, we would insert into the B2B_Leads table like this:
        /*
        await prisma.b2b_Lead.create({
          data: {
            companyName,
            email,
            expectedVolume: volume,
            message,
            status: 'NEW',
          },
        });
        */

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 800));

        // 3. Clear cache
        revalidatePath('/admin/leads');

        return { success: 'Your request has been received. Our sales manager will contact you shortly.' };
    } catch (error) {
        console.error('Lead submission error:', error);
        return { error: 'System error. Please try again later.' };
    } finally {
        // Disconnect prisma if needed
        // await prisma.$disconnect();
    }
}
