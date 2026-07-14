import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    // 1. Create orders table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        bank_name VARCHAR(255) NOT NULL,
        account_number VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 2. Create order_items table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 3. Create buyer_orders table
    await sql`
      CREATE TABLE IF NOT EXISTS buyer_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        buyer_name VARCHAR(255) NOT NULL,
        buyer_user_id VARCHAR(255) NOT NULL,
        slip_url VARCHAR(1024) NOT NULL,
        slip_hash VARCHAR(255) UNIQUE,
        total_amount DECIMAL(10, 2) NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        verification_result JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 4. Create buyer_order_items table
    await sql`
      CREATE TABLE IF NOT EXISTS buyer_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_order_id UUID REFERENCES buyer_orders(id) ON DELETE CASCADE,
        order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
      )
    `;

    return NextResponse.json({ success: true, message: 'Database initialized successfully.' });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
