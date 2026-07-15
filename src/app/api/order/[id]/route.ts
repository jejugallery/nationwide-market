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

    // 3. Fetch buyer orders if requester is creator
    let buyerOrders: any[] = [];
    try {
      const { searchParams } = new URL(request.url);
      const requesterUserId = searchParams.get('userId');
      if (requesterUserId && requesterUserId === order.creator_user_id) {
        const buyerOrdersResult = await sql`
          SELECT bo.id, bo.buyer_name, bo.buyer_user_id, bo.buyer_picture, bo.slip_url, bo.total_amount, bo.verified, bo.pay_later, bo.created_at,
                 COALESCE(
                   json_agg(
                     json_build_object(
                       'name', oi.name,
                       'price', oi.price,
                       'quantity', boi.quantity
                     )
                   ) FILTER (WHERE oi.id IS NOT NULL),
                   '[]'
                 ) as items
          FROM buyer_orders bo
          LEFT JOIN buyer_order_items boi ON bo.id = boi.buyer_order_id
          LEFT JOIN order_items oi ON boi.order_item_id = oi.id
          WHERE bo.order_id = ${id}
          GROUP BY bo.id
          ORDER BY bo.created_at DESC
        `;
        buyerOrders = buyerOrdersResult.map((bo: any) => ({
          id: bo.id,
          buyerName: bo.buyer_name,
          buyerUserId: bo.buyer_user_id,
          buyerPicture: bo.buyer_picture,
          slipUrl: bo.slip_url,
          totalAmount: parseFloat(bo.total_amount),
          verified: bo.verified,
          payLater: bo.pay_later,
          createdAt: bo.created_at,
          items: bo.items
        }));
      }
    } catch (err) {
      console.error('Failed to fetch buyer orders:', err);
    }

    let previousBuyerOrders: any[] = [];
    try {
      const { searchParams } = new URL(request.url);
      const requesterUserId = searchParams.get('userId');
      if (requesterUserId) {
        const previousResult = await sql`
          SELECT bo.id, bo.buyer_name, bo.buyer_user_id, bo.buyer_picture, bo.slip_url, bo.total_amount, bo.verified, bo.pay_later, bo.created_at,
                 COALESCE(
                   json_agg(
                     json_build_object(
                       'itemId', boi.order_item_id,
                       'name', oi.name,
                       'price', oi.price,
                       'quantity', boi.quantity
                     )
                   ) FILTER (WHERE oi.id IS NOT NULL),
                   '[]'
                 ) as items
          FROM buyer_orders bo
          LEFT JOIN buyer_order_items boi ON bo.id = boi.buyer_order_id
          LEFT JOIN order_items oi ON boi.order_item_id = oi.id
          WHERE bo.order_id = ${id} AND bo.buyer_user_id = ${requesterUserId}
          GROUP BY bo.id
          ORDER BY bo.created_at DESC
        `;
        previousBuyerOrders = previousResult.map((bo: any) => ({
          id: bo.id,
          buyerName: bo.buyer_name,
          buyerUserId: bo.buyer_user_id,
          buyerPicture: bo.buyer_picture,
          slipUrl: bo.slip_url,
          totalAmount: parseFloat(bo.total_amount),
          verified: bo.verified,
          payLater: bo.pay_later,
          createdAt: bo.created_at,
          items: bo.items
        }));
      }
    } catch (err) {
      console.error('Failed to fetch previous buyer orders:', err);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        name: order.name,
        accountName: order.account_name,
        bankName: order.bank_name,
        accountNumber: order.account_number,
        promoImageUrl: order.promo_image_url,
        shippingDate: order.shipping_date,
        creatorName: order.creator_name,
        creatorPicture: order.creator_picture,
        creatorUserId: order.creator_user_id,
        isActive: order.is_active,
        createdAt: order.created_at,
        items,
        buyerOrders,
        previousBuyerOrders
      }
    });
  } catch (error: any) {
    console.error('Fetch order API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, userId } = body;

    if (userId === undefined || isActive === undefined) {
      return NextResponse.json({ success: false, error: 'Missing parameters.' }, { status: 400 });
    }

    const orderQuery = await sql`
      SELECT creator_user_id FROM orders WHERE id = ${id}
    `;

    if (orderQuery.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    if (orderQuery[0].creator_user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    await sql`
      UPDATE orders
      SET is_active = ${isActive}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, isActive });
  } catch (error: any) {
    console.error('Toggle order status API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId.' }, { status: 400 });
    }

    const orderQuery = await sql`
      SELECT creator_user_id FROM orders WHERE id = ${id}
    `;

    if (orderQuery.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    if (orderQuery[0].creator_user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    await sql`
      DELETE FROM orders WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete order API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
