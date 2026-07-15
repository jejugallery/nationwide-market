import { NextResponse } from 'next/server';
import { uploadToImgbb } from '@/lib/imgbb';

export async function POST(request: Request) {
  try {
    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ success: false, error: 'Missing image data.' }, { status: 400 });
    }

    const url = await uploadToImgbb(image);
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error('Upload API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
