import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch order metadata
    const orderResult = await sql`
      SELECT * FROM orders WHERE id = ${id}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    const order = orderResult[0];

    // 2. Fetch all items in this order
    const itemsResult = await sql`
      SELECT * FROM order_items WHERE order_id = ${id} ORDER BY created_at ASC
    `;

    const items = itemsResult.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: parseFloat(item.price)
    }));

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        accountName: order.account_name,
        bankName: order.bank_name,
        accountNumber: order.account_number,
        createdAt: order.created_at,
        items
      }
    });
  } catch (error: any) {
    console.error('Fetch order API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
