import { prisma } from '../lib/prisma.js';

const PRODUCTS = [
    {
        name: 'Country Sourdough Loaf',
        description: 'Crusty naturally-leavened sourdough, baked daily.',
        imageUrl: 'https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/blogs/33965/images/6Hs6RS3SwqZiHx6i1wBQ_Old_Faithful_Kajabi_V1.jpg',
        type: 'bread',
        price: 8,
        stock: 20,
    },
    {
        name: 'Butter Croissant',
        description: 'Flaky all-butter croissant, laminated and baked to order.',
        imageUrl: 'https://www.hormelfoods.com/wp-content/uploads/culinary_collective_croissants-Recipe-2400x1000-1.jpg',
        type: 'pastry',
        price: 4,
        stock: 30,
    },
    {
        name: 'Chocolate Layer Cake',
        description: 'Rich chocolate sponge with whipped ganache.',
        imageUrl: 'https://i.etsystatic.com/59164232/r/il/3963a5/6875398033/il_1588xN.6875398033_ec1y.jpg',
        type: 'cake',
        price: 28,
        stock: 8,
    },
    {
        name: 'Chocolate Chip Cookie',
        description: 'Warm, chewy, with dark chocolate chunks.',
        imageUrl: 'https://www.meatloafandmelodrama.com/wp-content/uploads/2024/10/best-chocolate-chip-cookies-recipe.jpg',
        type: 'cookie',
        price: 3,
        stock: 50,
    },
    {
        name: 'House Latte',
        description: 'Espresso with steamed milk and latte art.',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Latte_with_winged_tulip_art.jpg',
        type: 'drink',
        price: 5,
        stock: 40,
    },
];

async function main() {
    for (const p of PRODUCTS) {
        const existing = await prisma.product.findFirst({ where: { name: p.name } });
        if (existing) {
            const { stock: _seedStock, ...rest } = p;
            await prisma.product.update({ where: { id: existing.id }, data: rest });
            console.log(`updated: ${p.name}`);
        } else {
            await prisma.product.create({ data: p });
            console.log(`created: ${p.name}`);
        }
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
