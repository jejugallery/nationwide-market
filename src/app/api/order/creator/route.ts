import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorUserId = searchParams.get('creatorUserId');

    if (!creatorUserId) {
      return NextResponse.json({ success: false, error: 'Missing creatorUserId.' }, { status: 400 });
    }

    const orders = await sql`
      SELECT o.id, o.name, o.account_name, o.bank_name, o.account_number, o.is_active, o.created_at, o.shipping_date,
             (SELECT COUNT(*) FROM buyer_orders WHERE order_id = o.id) as buyer_count
      FROM orders o
      WHERE o.creator_user_id = ${creatorUserId}
      ORDER BY o.created_at DESC
    `;

    // Map database output correctly
    const mappedOrders = orders.map((o: any) => ({
      id: o.id,
      name: o.name,
      accountName: o.account_name,
      bankName: o.bank_name,
      accountNumber: o.account_number,
      isActive: o.is_active,
      createdAt: o.created_at,
      shippingDate: o.shipping_date,
      buyerCount: parseInt(o.buyer_count || '0')
    }));

    return NextResponse.json({ success: true, orders: mappedOrders });
  } catch (error: any) {
    console.error('Fetch creator orders API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
