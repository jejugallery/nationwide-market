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

    const { buyerName, buyerUserId, slipBase64, slipMimeType, items } = body;

    if (!buyerName || !buyerUserId || !slipBase64 || !slipMimeType || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid fields. Buyer details, slip image, and items are required.' },
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

    // 2. Fetch order items to calculate correct total price server-side
    const dbItemsResult = await sql`
      SELECT id, price FROM order_items WHERE order_id = ${orderId}
    `;

    const dbItemsMap = new Map<string, number>();
    for (const item of dbItemsResult) {
      dbItemsMap.set(item.id, parseFloat(item.price));
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
      if (typeof clientItem.quantity !== 'number' || clientItem.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item ${clientItem.itemId}.` },
          { status: 400 }
        );
      }

      calculatedTotal += dbPrice * clientItem.quantity;
      purchaseItemsToInsert.push({
        itemId: clientItem.itemId,
        quantity: clientItem.quantity
      });
    }

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
    let slipAnalysis;
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
    let slipHash = fileHash;
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
    let uploadedSlipUrl = '';
    try {
      uploadedSlipUrl = await uploadToImgbb(slipBase64);
    } catch (uploadError: any) {
      console.error('Imgbb upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: `Failed to store slip image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 9. Record buyer order in database
    const buyerOrderResult = await sql`
      INSERT INTO buyer_orders (order_id, buyer_name, buyer_user_id, slip_url, slip_hash, total_amount, verified, verification_result)
      VALUES (${orderId}, ${buyerName}, ${buyerUserId}, ${uploadedSlipUrl}, ${slipHash}, ${calculatedTotal}, TRUE, ${JSON.stringify(slipAnalysis)})
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
