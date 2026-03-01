// Comprehensive seed script for all 7 roles
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🧀 Seeding Colchis Creamery Platform...\n');

    const hash = await bcrypt.hash('password123', 12);

    // ── 1. Master Admin ────────────────────────────────────────────────
    const admin = await prisma.user.upsert({
        where: { email: 'admin@colchis.com' },
        update: { role: 'MASTER_ADMIN', passwordHash: hash },
        create: {
            email: 'admin@colchis.com',
            name: 'Master Admin',
            passwordHash: hash,
            role: 'MASTER_ADMIN',
        },
    });
    console.log('✅ Master Admin:', admin.email);

    // ── 2. Product Manager ─────────────────────────────────────────────
    const pm = await prisma.user.upsert({
        where: { email: 'products@colchis.com' },
        update: { role: 'PRODUCT_MANAGER', passwordHash: hash },
        create: {
            email: 'products@colchis.com',
            name: 'Product Manager',
            passwordHash: hash,
            role: 'PRODUCT_MANAGER',
        },
    });
    console.log('✅ Product Manager:', pm.email);

    // ── 3. Content Manager ─────────────────────────────────────────────
    const cm = await prisma.user.upsert({
        where: { email: 'content@colchis.com' },
        update: { role: 'CONTENT_MANAGER', passwordHash: hash },
        create: {
            email: 'content@colchis.com',
            name: 'Content Manager',
            passwordHash: hash,
            role: 'CONTENT_MANAGER',
        },
    });
    console.log('✅ Content Manager:', cm.email);

    // ── 4. Sales ───────────────────────────────────────────────────────
    const sales = await prisma.user.upsert({
        where: { email: 'sales@colchis.com' },
        update: { role: 'SALES', passwordHash: hash },
        create: {
            email: 'sales@colchis.com',
            name: 'Sales Lead',
            passwordHash: hash,
            role: 'SALES',
        },
    });
    console.log('✅ Sales:', sales.email);

    // ── 5. B2B Partner ─────────────────────────────────────────────────
    const b2b = await prisma.user.upsert({
        where: { email: 'partner@wholesale.com' },
        update: { role: 'B2B_PARTNER', passwordHash: hash },
        create: {
            email: 'partner@wholesale.com',
            name: 'Wholesale Buyer',
            passwordHash: hash,
            role: 'B2B_PARTNER',
            companyName: 'Midwest Groceries Inc.',
            isActiveB2b: true,
        },
    });
    console.log('✅ B2B Partner:', b2b.email);

    // ── 6. B2C Customer ────────────────────────────────────────────────
    const b2c = await prisma.user.upsert({
        where: { email: 'customer@test.com' },
        update: { role: 'B2C_CUSTOMER', passwordHash: hash },
        create: {
            email: 'customer@test.com',
            name: 'Jane Smith',
            passwordHash: hash,
            role: 'B2C_CUSTOMER',
        },
    });
    // Create profile for customer
    await prisma.userProfile.upsert({
        where: { userId: b2c.id },
        update: {},
        create: {
            userId: b2c.id,
            shippingAddress: '123 Main Street',
            shippingCity: 'Columbus',
            shippingState: 'OH',
            shippingZip: '43215',
            shippingCountry: 'US',
        },
    });
    console.log('✅ B2C Customer:', b2c.email);

    // ── 7. Analytics Viewer ────────────────────────────────────────────
    const viewer = await prisma.user.upsert({
        where: { email: 'viewer@investor.com' },
        update: { role: 'ANALYTICS_VIEWER', passwordHash: hash },
        create: {
            email: 'viewer@investor.com',
            name: 'Investor Preview',
            passwordHash: hash,
            role: 'ANALYTICS_VIEWER',
        },
    });
    console.log('✅ Analytics Viewer:', viewer.email);

    // ── Products ───────────────────────────────────────────────────────
    const products = [
        {
            sku: 'SUL-001', name: 'Artisanal Sulguni', slug: 'artisanal-sulguni',
            description: 'Traditional Georgian stringy cheese, fresh and elastic.',
            imageUrl: 'https://images.unsplash.com/photo-1552767059-ce182ead6c1b?w=800',
            priceB2c: '$14.99', priceB2b: '$9.50', stockQuantity: 150,
            flavorProfile: 'Mild, milky, slightly tangy', pairsWith: 'Wine, bread',
            weight: '400g', ingredients: 'Organic milk, salt, rennet',
        },
        {
            sku: 'SMK-001', name: 'Smoked Sulguni', slug: 'smoked-sulguni',
            description: 'Deep hickory smoked Sulguni slices with rich aroma.',
            imageUrl: 'https://images.unsplash.com/photo-1634483211933-b9d49f19cbd9?w=800',
            priceB2c: '$18.50', priceB2b: '$12.00', stockQuantity: 85,
            flavorProfile: 'Smoky, savory, complex', pairsWith: 'Beer, pickles',
            weight: '350g', ingredients: 'Organic milk, salt, rennet, natural smoke',
        },
        {
            sku: 'IME-001', name: 'Authentic Imeruli', slug: 'authentic-imeruli',
            description: 'Soft, brined crumbly cheese perfect for Khachapuri.',
            imageUrl: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800',
            priceB2c: '$12.99', priceB2b: '$8.25', stockQuantity: 200,
            flavorProfile: 'Salty, crumbly, rich', pairsWith: 'Bread, herbs',
            weight: '500g', ingredients: 'Organic milk, salt, starter culture',
        },
        {
            sku: 'NAD-001', name: 'Nadughi Cream Cheese', slug: 'nadughi-cream',
            description: 'Light and creamy Georgian-style cream cheese spread.',
            imageUrl: 'https://images.unsplash.com/photo-1486297678162-ad249fa57731?w=800',
            priceB2c: '$9.99', priceB2b: '$6.00', stockQuantity: 12,
            flavorProfile: 'Light, fresh, creamy', pairsWith: 'Crackers, fruits',
            weight: '250g', ingredients: 'Organic milk, cream, salt',
        },
    ];

    for (const p of products) {
        await prisma.product.upsert({
            where: { sku: p.sku },
            update: {},
            create: p,
        });
    }
    console.log(`✅ ${products.length} products seeded`);

    // ── Analytics Pins ─────────────────────────────────────────────────
    const pins = [
        { name: 'Whole Foods - Columbus', latitude: 39.9612, longitude: -82.9988, pinType: 'PARTNER', status: 'ACTIVE', notes: 'Premium cheese section', createdById: admin.id },
        { name: 'Kroger Distribution - Dayton', latitude: 39.7589, longitude: -84.1916, pinType: 'PARTNER', status: 'ACTIVE', notes: 'Regional distributor', createdById: admin.id },
        { name: 'Giant Eagle - Pittsburgh', latitude: 40.4406, longitude: -79.9959, pinType: 'PROSPECT', status: 'ACTIVE', notes: 'Initial contact made', createdById: sales.id },
        { name: 'Trader Joe\'s - Cleveland', latitude: 41.4993, longitude: -81.6944, pinType: 'PROSPECT', status: 'ACTIVE', notes: 'Meeting scheduled Q2', createdById: sales.id },
        { name: 'Local Farm Supply - Cincinnati', latitude: 39.1031, longitude: -84.5120, pinType: 'SUPPLIER', status: 'ACTIVE', notes: 'Organic milk supplier', createdById: admin.id },
    ];

    for (const pin of pins) {
        await prisma.analyticsPin.create({ data: pin });
    }
    console.log(`✅ ${pins.length} analytics pins seeded`);

    // ── B2B Contract ───────────────────────────────────────────────────
    await prisma.contract.create({
        data: {
            partnerId: b2b.id,
            status: 'SIGNED',
            discountPercentage: '15',
            validUntil: new Date('2027-01-01'),
        },
    });
    console.log('✅ B2B contract created for', b2b.email);

    // ── Access Codes ───────────────────────────────────────────────────
    const accessCodes = [
        { code: 'COLCHIS-B2B-DEMO01', type: 'B2B', targetRole: 'B2B_PARTNER' },
        { code: 'COLCHIS-STAFF-PM01', type: 'STAFF', targetRole: 'PRODUCT_MANAGER' },
        { code: 'COLCHIS-STAFF-CM01', type: 'STAFF', targetRole: 'CONTENT_MANAGER' },
        { code: 'COLCHIS-STAFF-SL01', type: 'STAFF', targetRole: 'SALES' },
        { code: 'COLCHIS-VIEW-INV01', type: 'ANALYTICS_VIEWER', targetRole: 'ANALYTICS_VIEWER' },
    ];

    for (const ac of accessCodes) {
        await prisma.accessCode.upsert({
            where: { code: ac.code },
            update: {},
            create: {
                ...ac,
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            },
        });
    }
    console.log(`✅ ${accessCodes.length} access codes seeded`);

    console.log('\n🎉 Seed complete!');
    console.log('─────────────────────────────────────────');
    console.log('Test accounts (all passwords: password123):');
    console.log('');
    console.log('Staff Login (/staff):');
    console.log('  Master Admin:      admin@colchis.com');
    console.log('  Product Manager:   products@colchis.com');
    console.log('  Content Manager:   content@colchis.com');
    console.log('  Sales:             sales@colchis.com');
    console.log('  Analytics Viewer:  viewer@investor.com');
    console.log('');
    console.log('Customer Login (/login):');
    console.log('  B2C Customer:      customer@test.com');
    console.log('');
    console.log('B2B Login (/b2b/login):');
    console.log('  B2B Partner:       partner@wholesale.com');
    console.log('─────────────────────────────────────────');
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
