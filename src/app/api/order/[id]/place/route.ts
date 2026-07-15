import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifySlip } from '@/lib/gemini';
import { uploadToImgbb } from '@/lib/imgbb';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();

    const { buyerName, buyerUserId, buyerPicture, slipBase64, slipMimeType, items, payLater } = body;

    if (!buyerName || !buyerUserId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields. Buyer details and items are required.' },
        { status: 400 }
      );
    }

    if (!payLater && (!slipBase64 || !slipMimeType)) {
      return NextResponse.json(
        { success: false, error: 'Slip image is required when not choosing Pay Later.' },
        { status: 400 }
      );
    }

    // 1. Fetch order details to get expected account name
    const orderResult = await sql`
      SELECT * FROM orders WHERE id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found.' }, { status: 404 });
    }

    const order = orderResult[0];

    if (!order.is_active) {
      return NextResponse.json(
        { success: false, error: 'ออเดอร์นี้ปิดรับคิวสั่งซื้อเรียบร้อยแล้ว' },
        { status: 400 }
      );
    }

    // 2. Fetch order items to calculate correct total price server-side
    const dbItemsResult = await sql`
      SELECT id, price FROM order_items WHERE order_id = ${orderId}
    `;

    const dbItemsMap = new Map<string, number>();
    for (const item of dbItemsResult) {
      dbItemsMap.set(item.id, parseFloat(item.price));
    }

    // Fetch previous orders of this buyer to separate paid vs unpaid quantities
    const existingOrders = await sql`
      SELECT bo.id, bo.verified, boi.order_item_id, boi.quantity
      FROM buyer_orders bo
      JOIN buyer_order_items boi ON bo.id = boi.buyer_order_id
      WHERE bo.order_id = ${orderId} AND bo.buyer_user_id = ${buyerUserId}
    `;

    const paidQuantities = new Map<string, number>();
    for (const row of existingOrders) {
      if (row.verified) {
        paidQuantities.set(row.order_item_id, (paidQuantities.get(row.order_item_id) || 0) + row.quantity);
      }
    }

    let calculatedTotal = 0;
    const purchaseItemsToInsert = [];

    for (const clientItem of items) {
      const dbPrice = dbItemsMap.get(clientItem.itemId);
      if (dbPrice === undefined) {
        return NextResponse.json(
          { success: false, error: `Item ${clientItem.itemId} is not part of this order.` },
          { status: 400 }
        );
      }
      if (typeof clientItem.quantity !== 'number' || clientItem.quantity < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item ${clientItem.itemId}.` },
          { status: 400 }
        );
      }

      const paidQty = paidQuantities.get(clientItem.itemId) || 0;
      const newUnpaidQty = clientItem.quantity - paidQty;

      if (newUnpaidQty < 0) {
        return NextResponse.json(
          { success: false, error: `ไม่สามารถลดจำนวนของสินค้าลงต่ำกว่าจำนวนที่ชำระเงินแล้วได้ (${paidQty} ชิ้น)` },
          { status: 400 }
        );
      }

      if (newUnpaidQty > 0) {
        calculatedTotal += dbPrice * newUnpaidQty;
        purchaseItemsToInsert.push({
          itemId: clientItem.itemId,
          quantity: newUnpaidQty
        });
      }
    }

    if (calculatedTotal === 0) {
      // User only kept their paid items (reduced unpaid items to 0) or did not order any extra.
      // Delete any previous unpaid orders
      await sql`
        DELETE FROM buyer_orders
        WHERE order_id = ${orderId} AND buyer_user_id = ${buyerUserId} AND verified = false
      `;

      return NextResponse.json({
        success: true,
        buyerOrderId: null,
        slipUrl: null,
        analysis: { payLater: false, message: 'Unpaid orders cleared successfully.' }
      });
    }

    let uploadedSlipUrl = 'PAY_LATER';
    let slipHash = null;
    let slipAnalysis: any = { payLater: true };
    let verified = false;

    if (!payLater) {
      // 3. Prevent duplicate image upload early by hashing image bytes
      const fileHash = crypto.createHash('sha256').update(slipBase64).digest('hex');
      const hashCheck = await sql`
        SELECT id FROM buyer_orders WHERE slip_hash = ${fileHash}
      `;

      if (hashCheck.length > 0) {
        return NextResponse.json(
          { success: false, error: 'This transfer slip image has already been submitted for another order.' },
          { status: 400 }
        );
      }

      // 4. Verify slip details via Gemini AI
      try {
        slipAnalysis = await verifySlip(slipBase64, slipMimeType, order.account_name);
      } catch (geminiError: any) {
        console.error('Gemini slip validation error:', geminiError);
        return NextResponse.json(
          { success: false, error: `Slip verification service error: ${geminiError.message}` },
          { status: 500 }
        );
      }

      if (!slipAnalysis.is_slip) {
        return NextResponse.json(
          { success: false, error: 'Invalid document: The uploaded file is not recognized as a valid bank transfer slip.' },
          { status: 400 }
        );
      }

      // 5. Verify total transfer amount matches order total
      const slipAmount = parseFloat(slipAnalysis.amount.toFixed(2));
      const targetAmount = parseFloat(calculatedTotal.toFixed(2));

      if (Math.abs(slipAmount - targetAmount) > 0.01) {
        return NextResponse.json(
          {
            success: false,
            error: `Payment amount mismatch: Slip indicates a transfer of ${slipAmount} THB, but the total price is ${targetAmount} THB.`
          },
          { status: 400 }
        );
      }

      // 6. Verify receiver name matches expected merchant account name (from Gemini)
      if (!slipAnalysis.receiver_matches) {
        return NextResponse.json(
          {
            success: false,
            error: `Recipient mismatch: The money was transferred to "${slipAnalysis.receiver}", but the merchant bank account name is "${order.account_name}".`
          },
          { status: 400 }
        );
      }

      // 7. Verify transaction reference code uniqueness
      slipHash = fileHash;
      if (slipAnalysis.ref_no && slipAnalysis.ref_no.trim() !== '') {
        slipHash = slipAnalysis.ref_no.trim();
        const refCheck = await sql`
          SELECT id FROM buyer_orders WHERE slip_hash = ${slipHash}
        `;
        if (refCheck.length > 0) {
          return NextResponse.json(
            { success: false, error: `This slip transaction (Ref: ${slipHash}) has already been used.` },
            { status: 400 }
          );
        }
      }

      // 8. Upload slip to Imgbb for hosting
      try {
        uploadedSlipUrl = await uploadToImgbb(slipBase64);
      } catch (uploadError: any) {
        console.error('Imgbb upload error:', uploadError);
        return NextResponse.json(
          { success: false, error: `Failed to store slip image: ${uploadError.message}` },
          { status: 500 }
        );
      }
      
      verified = true;
    }

    // Delete any previous unpaid orders before inserting the new updated one
    await sql`
      DELETE FROM buyer_orders
      WHERE order_id = ${orderId} AND buyer_user_id = ${buyerUserId} AND verified = false
    `;

    // 9. Record buyer order in database
    const buyerOrderResult = await sql`
      INSERT INTO buyer_orders (order_id, buyer_name, buyer_user_id, buyer_picture, slip_url, slip_hash, total_amount, verified, pay_later, verification_result)
      VALUES (${orderId}, ${buyerName}, ${buyerUserId}, ${buyerPicture || null}, ${uploadedSlipUrl}, ${slipHash}, ${calculatedTotal}, ${verified}, ${payLater || false}, ${JSON.stringify(slipAnalysis)})
      RETURNING id
    `;

    const buyerOrderId = buyerOrderResult[0].id;

    // 10. Record order items purchased
    for (const pItem of purchaseItemsToInsert) {
      await sql`
        INSERT INTO buyer_order_items (buyer_order_id, order_item_id, quantity)
        VALUES (${buyerOrderId}, ${pItem.itemId}, ${pItem.quantity})
      `;
    }

    return NextResponse.json({
      success: true,
      buyerOrderId,
      slipUrl: uploadedSlipUrl,
      analysis: slipAnalysis
    });
  } catch (error: any) {
    console.error('Place order API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
