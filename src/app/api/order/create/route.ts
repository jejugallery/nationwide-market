import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, accountName, bankName, accountNumber, promoImageUrl, items, creatorName, creatorPicture, creatorUserId } = body;

    if (!name || !accountName || !bankName || !accountNumber || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields. All fields and at least one item are required.' },
        { status: 400 }
      );
    }

    // 1. Insert Order metadata
    const orderResult = await sql`
      INSERT INTO orders (name, account_name, bank_name, account_number, promo_image_url, creator_name, creator_picture, creator_user_id)
      VALUES (${name}, ${accountName}, ${bankName}, ${accountNumber}, ${promoImageUrl || null}, ${creatorName || null}, ${creatorPicture || null}, ${creatorUserId || null})
      RETURNING id
    `;

    const orderId = orderResult[0].id;

    // 2. Insert Order Items sequentially
    for (const item of items) {
      if (!item.name || typeof item.price !== 'number') {
        throw new Error(`Invalid item: ${JSON.stringify(item)}`);
      }
      await sql`
        INSERT INTO order_items (order_id, name, price)
        VALUES (${orderId}, ${item.name}, ${item.price})
      `;
    }

    return NextResponse.json({ success: true, orderId });
  } catch (error: any) {
    console.error('Create order API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
