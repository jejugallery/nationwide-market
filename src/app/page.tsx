'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import confetti from 'canvas-confetti';

interface OrderItem {
  id?: string;
  name: string;
  price: number;
}

interface OrderDetails {
  id: string;
  name: string;
  accountName: string;
  bankName: string;
  accountNumber: string;
  promoImageUrl?: string;
  shippingDate?: string;
  creatorName?: string;
  creatorPicture?: string;
  creatorUserId?: string;
  isActive?: boolean;
  createdAt?: string;
  items: {
    id: string;
    name: string;
    price: number;
  }[];
  buyerOrders?: {
    id: string;
    buyerName: string;
    buyerUserId: string;
    buyerPicture?: string;
    slipUrl: string;
    totalAmount: number;
    verified: boolean;
    payLater: boolean;
    createdAt: string;
    items: {
      name: string;
      price: number;
      quantity: number;
    }[];
  }[];
}

export default function Home() {
  // Navigation State
  const [orderId, setOrderId] = useState<string | null>(null);

  // LIFF State
  const [isLiffInit, setIsLiffInit] = useState(false);
  const [liffProfile, setLiffProfile] = useState<{ displayName: string; userId: string; pictureUrl?: string } | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);

  // View state (Create Order)
  const [orderName, setOrderName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('KBANK');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [promoImageBase64, setPromoImageBase64] = useState<string | null>(null);
  const [shippingDate, setShippingDate] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', price: 0 }]);

  // View state (Place Order)
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const [slipMimeType, setSlipMimeType] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [payLater, setPayLater] = useState(false);
  const [activeTab, setActiveTab] = useState<'order' | 'dashboard'>('order');
  const [creatorOrders, setCreatorOrders] = useState<any[]>([]);

  // Process States
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<{ buyerOrderId: string; slipUrl: string; analysis?: any } | null>(null);
  const [createdOrderLink, setCreatedOrderLink] = useState<string | null>(null);

  // Parse URL search params for orderId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('orderId');
      if (id) {
        setOrderId(id);
      }
    }
  }, []);

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        
        if (!liffId) {
          console.warn('NEXT_PUBLIC_LIFF_ID environment variable is missing.');
          setLiffProfile({ displayName: 'Mock User (Local Development)', userId: 'U1234567890', pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' });
          setIsLiffInit(true);
          return;
        }

        await liff.init({ liffId });
        setIsLiffInit(true);

        if (!liff.isLoggedIn()) {
          liff.login();
        } else {
          const profile = await liff.getProfile();
          setLiffProfile({
            displayName: profile.displayName,
            userId: profile.userId,
            pictureUrl: profile.pictureUrl,
          });
        }
      } catch (err: any) {
        console.error('LINE LIFF Init Failure:', err);
        setLiffError(err.message || 'Failed to initialize LIFF');
        // Set mock data so testing locally still works
        setLiffProfile({ displayName: 'Developer Test', userId: 'U1234567890', pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150' });
        setIsLiffInit(true);
      }
    };
    initLiff();
  }, []);

  // Fetch Order Details if orderId is set
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const userIdParam = liffProfile?.userId ? `?userId=${liffProfile.userId}` : '';
        const res = await fetch(`/api/order/${orderId}${userIdParam}`);
        const data = await res.json();
        if (data.success) {
          setOrderDetails(data.order);
          // Initialize quantities to 0
          const initialQuantities: { [itemId: string]: number } = {};
          data.order.items.forEach((item: any) => {
            initialQuantities[item.id] = 0;
          });
          setQuantities(initialQuantities);
        } else {
          setOrderDetails(null);
        }
      } catch (err: any) {
        console.error('Fetch order error:', err);
        setOrderDetails(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, liffProfile]);

  // Automatically close window if orderId is set but orderDetails is not found
  useEffect(() => {
    if (orderId && !orderDetails && !loading) {
      const timer = setTimeout(() => {
        import('@line/liff').then((m) => {
          const liff = m.default;
          try {
            if (liff.isLoggedIn()) {
              liff.closeWindow();
            } else {
              window.close();
            }
          } catch (e) {
            window.close();
          }
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [orderId, orderDetails, loading]);

  // Fetch orders created by this user when on setting-up screen
  useEffect(() => {
    if (orderId || !liffProfile?.userId) return;

    const fetchCreatorOrders = async () => {
      try {
        const res = await fetch(`/api/order/creator?creatorUserId=${liffProfile.userId}`);
        const data = await res.json();
        if (data.success) {
          setCreatorOrders(data.orders);
        }
      } catch (err) {
        console.error('Failed to fetch creator orders:', err);
      }
    };

    fetchCreatorOrders();
  }, [orderId, liffProfile]);

  // Toggle order active status
  const handleToggleOrderStatus = async (id: string, currentStatus: boolean, isDetailPage = false) => {
    if (!liffProfile?.userId) return;
    try {
      const response = await fetch(`/api/order/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !currentStatus,
          userId: liffProfile.userId
        })
      });
      const data = await response.json();
      if (data.success) {
        if (isDetailPage) {
          setOrderDetails((prev) => prev ? { ...prev, isActive: data.isActive } : null);
        } else {
          setCreatorOrders((prev) => 
            prev.map((o) => o.id === id ? { ...o, isActive: data.isActive } : o)
          );
        }
      } else {
        alert(data.error || 'Failed to update order status.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('คัดลอกลิงก์เรียบร้อยแล้ว!');
  };

  const handleDeleteOrder = async (id: string) => {
    if (!liffProfile?.userId) return;
    if (!confirm('คุณต้องการลบแผงขายของนี้ใช่หรือไม่? ข้อมูลคำสั่งซื้อทั้งหมดจะถูกลบไปด้วยอย่างถาวร')) return;
    
    try {
      const response = await fetch(`/api/order/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: liffProfile.userId
        })
      });
      const data = await response.json();
      if (data.success) {
        setCreatorOrders((prev) => prev.filter((o) => o.id !== id));
        alert('ลบแผงขายของเรียบร้อยแล้ว!');
        if (orderId === id) {
          setOrderId(null);
          setActiveTab('order');
          window.history.pushState(null, '', window.location.pathname);
        }
      } else {
        alert(data.error || 'Failed to delete order.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete order.');
    }
  };

  // Calculate Order Total Price
  const calculateTotal = () => {
    if (!orderDetails) return 0;
    return orderDetails.items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      return sum + item.price * qty;
    }, 0);
  };

  // Add Item in Create Form
  const handleAddItem = () => {
    setItems([...items, { name: '', price: 0 }]);
  };

  // Remove Item in Create Form
  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  // Update Item field in Create Form
  const handleUpdateItem = (index: number, field: keyof OrderItem, val: string | number) => {
    const newItems = [...items];
    if (field === 'price') {
      const parsedVal = parseFloat(val as string) || 0;
      newItems[index] = { ...newItems[index], price: parsedVal };
    } else {
      newItems[index] = { ...newItems[index], name: val as string };
    }
    setItems(newItems);
  };

  // Adjust item quantity in Order Placement
  const adjustQuantity = (itemId: string, direction: 'inc' | 'dec') => {
    const currentQty = quantities[itemId] || 0;
    const newQty = direction === 'inc' ? currentQty + 1 : Math.max(0, currentQty - 1);
    setQuantities({ ...quantities, [itemId]: newQty });
  };

  // Copy Account Number helper
  const handleCopyAccountNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Image Resizer Helper
  const resizeImage = (file: File, maxDimension: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const image = new Image();
        image.onload = () => {
          let width = image.width;
          let height = image.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context could not be created'));
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
          resolve(dataUrl);
        };
        image.onerror = (err) => reject(err);
        image.src = readerEvent.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // File Upload Helper
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG/JPG).');
      return;
    }

    try {
      const resizedBase64 = await resizeImage(file, 1000);
      setSlipBase64(resizedBase64);
      setSlipMimeType(file.type);
    } catch (err) {
      console.error('Error resizing slip image:', err);
      setError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    }
  };

  // Promo Image Upload Helper
  const handlePromoImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('กรุณาอัปโหลดไฟล์ภาพ (PNG/JPG)');
      return;
    }

    try {
      const resizedBase64 = await resizeImage(file, 1000);
      setPromoImageBase64(resizedBase64);
    } catch (err) {
      console.error('Error resizing promo image:', err);
      setError('เกิดข้อผิดพลาดในการประมวลผลรูปภาพ');
    }
  };

  // Create Flex Message for Order Creation
  const getCreateFlexMessage = (
    name: string, 
    orderItems: OrderItem[], 
    liffLink: string,
    creatorName?: string,
    creatorPicture?: string,
    promoImageUrl?: string,
    shippingDate?: string
  ) => {
    const flexItems = orderItems.map((item) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `${item.name} ${item.price.toLocaleString()}฿`,
        },
      ],
    }));

    return {
      type: 'flex',
      altText: `📢 เปิดรับออเดอร์: ${name}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            creatorPicture && creatorPicture.startsWith('https') ? {
              type: 'box',
              layout: 'horizontal',
              justifyContent: 'center',
              alignItems: 'center',
              spacing: 'xs',
              contents: [
                {
                  type: 'image',
                  url: creatorPicture,
                  aspectMode: 'cover',
                  aspectRatio: '1:1',
                  size: 'xxs',
                  flex: 0,
                },
                {
                  type: 'text',
                  text: creatorName || 'ร้านค้า',
                  size: 'xs',
                  color: '#38bdf8',
                  flex: 0,
                  gravity: 'center',
                }
              ]
            } : {
              type: 'text',
              text: creatorName || 'ร้านค้า',
              align: 'center',
              size: 'xs',
              color: '#38bdf8',
            },
            {
              type: 'text',
              text: 'เปิดรับออเดอร์',
              align: 'center',
              weight: 'bold',
              size: 'md',
              margin: 'xs',
            },
          ],
        },
        hero: {
          type: 'image',
          url: (promoImageUrl && promoImageUrl.startsWith('https')) 
            ? promoImageUrl
            : (creatorPicture && creatorPicture.startsWith('https')) 
            ? creatorPicture 
            : 'https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png',
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover',
          action: {
            type: 'uri',
            uri: liffLink,
          },
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: name,
              weight: 'bold',
              size: 'xl',
            },
            {
              type: 'text',
              text: `พร้อมส่งสินค้า: ${shippingDate || 'โปรดสอบถามผู้ขาย'}`,
              size: 'xs',
              color: '#ef4444',
              weight: 'bold',
              margin: 'xs',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: flexItems,
              margin: 'md',
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🛒 สั่งเลยตอนนี้',
                uri: liffLink,
              },
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [],
              margin: 'sm',
            },
          ],
          flex: 0,
        },
      },
    };
  };

  // Create Flex Message for Order Placement Receipt
  const getReceiptFlexMessage = (
    buyerName: string,
    buyerPicture: string | null,
    orderNameVal: string,
    itemsBought: { name: string; quantity: number }[],
    totalAmountVal: number,
    payLaterReceipt?: boolean,
    liffLink?: string
  ) => {
    const flexItems = itemsBought.map((item) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `${item.name} x${item.quantity}`,
          size: 'sm',
          color: '#555555',
          flex: 4,
          wrap: true,
        },
      ],
    }));

    return {
      type: 'flex',
      altText: `✅ คุณ ${buyerName} สั่งซื้อสินค้าแล้ว!`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#0369a1',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: '🛒 มีคำสั่งซื้อเข้ามาใหม่!',
                  color: '#38bdf8',
                  weight: 'bold',
                  size: 'xs',
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'md',
                  spacing: 'md',
                  contents: [
                    (buyerPicture && buyerPicture.startsWith('https')) ? {
                      type: 'image',
                      url: buyerPicture,
                      size: 'xxs',
                      aspectRatio: '1:1',
                      aspectMode: 'cover',
                      cornerRadius: 'xxl',
                    } : {
                      type: 'text',
                      text: '👤',
                      color: '#ffffff',
                      size: 'sm',
                      flex: 0,
                    },
                    {
                      type: 'text',
                      text: `จาก คุณ ${buyerName}`,
                      color: '#ffffff',
                      size: 'md',
                      weight: 'bold',
                      wrap: true,
                    }
                  ]
                }
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: `ร้านค้า: ${orderNameVal}`,
                  size: 'sm',
                  color: '#888888',
                  weight: 'bold',
                },
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  margin: 'md',
                  spacing: 'sm',
                  contents: flexItems,
                },
                {
                  type: 'separator',
                  margin: 'md',
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: 'ราคารวมทั้งหมด',
                      weight: 'bold',
                      size: 'sm',
                      color: '#444444',
                    },
                    {
                      type: 'text',
                      text: `${totalAmountVal.toLocaleString()} ฿`,
                      weight: 'bold',
                      size: 'md',
                      align: 'end',
                      color: '#0284c7',
                    },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'md',
                  backgroundColor: payLaterReceipt ? '#47556914' : '#0284c714',
                  cornerRadius: 'md',
                  paddingAll: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: payLaterReceipt ? '🕒 สั่งก่อนจ่ายทีหลัง (ค้างชำระ)' : '🛡️ แนบสลิปและยืนยันแล้วโดย AI',
                      size: 'xs',
                      color: payLaterReceipt ? '#475569' : '#0284c7',
                      align: 'center',
                      weight: 'bold',
                    },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#1e3a8a',
              action: {
                type: 'uri',
                label: '📋 ดูคำสั่งซื้อ',
                uri: liffLink || '',
              },
            },
          ],
          flex: 0,
        },
      },
    };
  };

  // Share/Send Flex message inside LIFF
  const shareMessage = async (messagePayload: any, directLink: string) => {
    console.log('Starting shareMessage...', { messagePayload, directLink });
    try {
      const liff = (await import('@line/liff')).default;
      
      if (!liff.isLoggedIn()) {
        console.log('User not logged in, attempting login...');
        liff.login();
        return;
      }

      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        console.log('No LIFF ID found');
        alert(`โหมดพัฒนา (ไม่มี LIFF ID) คัดลอกลิงก์ไปแชร์: ${directLink}`);
        return;
      }

      // 1. Try sending directly to the active chat context (Reply/Send)
      const context = liff.getContext();
      console.log('LIFF Context:', context);
      if (context && context.type && ['utou', 'room', 'group', 'external'].includes(context.type)) {
        console.log('Attempting liff.sendMessages...');
        try {
          await liff.sendMessages([messagePayload]);
          console.log('liff.sendMessages success');
          liff.closeWindow();
          return;
        } catch (msgErr: any) {
          console.error('liff.sendMessages failed:', msgErr);
        }
      }

      // 2. Fallback to shareTargetPicker if sendMessages fails or context is not available
      console.log('Checking shareTargetPicker availability as fallback...');
      if (liff.isApiAvailable('shareTargetPicker')) {
        console.log('shareTargetPicker is available, opening...');
        try {
          const pickerResponse = await liff.shareTargetPicker([messagePayload]);
          console.log('shareTargetPicker response:', pickerResponse);
          if (pickerResponse) {
            // Success
            liff.closeWindow();
            return;
          } else {
            console.log('Target picker was closed without sharing');
          }
        } catch (pickerErr: any) {
          console.error('shareTargetPicker error:', pickerErr);
        }
      } else {
        console.log('shareTargetPicker is NOT available');
      }

      // 3. Last fallback: copy link to clipboard
      console.log('Falling back to clipboard copy');
      navigator.clipboard.writeText(directLink);
      alert(`สร้างออเดอร์สำเร็จ! กรุณาคัดลอกลิงก์ไปแชร์ในแชท: ${directLink}`);
    } catch (err) {
      console.error('Error in shareMessage:', err);
      navigator.clipboard.writeText(directLink);
      alert(`เกิดข้อผิดพลาด: ${directLink}`);
    }
  };

  // Submit Order Creation Form
  const handleSubmitCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation
    const cleanItems = items.filter((item) => item.name.trim() !== '' && item.price > 0);
    if (!orderName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      setLoading(false);
      return;
    }
    if (cleanItems.length === 0) {
      setError('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ พร้อมราคา');
      setLoading(false);
      return;
    }

    const bankFinal = bankName === 'CUSTOM' ? customBankName : bankName;
    if (!bankFinal.trim()) {
      setError('กรุณากรอกชื่อธนาคาร');
      setLoading(false);
      return;
    }

    try {
      let promoImageUrl = '';
      if (promoImageBase64) {
        setLoadingStep('กำลังอัปโหลดรูปโปรโมท...');
        const imgbbResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: promoImageBase64 }),
        });
        if (imgbbResponse.ok) {
          const imgData = await imgbbResponse.json();
          promoImageUrl = imgData.url;
        }
      }

      setLoadingStep('กำลังบันทึกข้อมูลแผงขายของ...');
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orderName,
          accountName,
          bankName: bankFinal,
          accountNumber,
          promoImageUrl,
          shippingDate,
          items: cleanItems,
          creatorName: liffProfile?.displayName || null,
          creatorPicture: liffProfile?.pictureUrl || null,
          creatorUserId: liffProfile?.userId || null,
        }),
      });

      const resData = await response.json();
      if (resData.success) {
        // Construct LIFF redirection link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        const finalLink = liffId 
          ? `https://liff.line.me/${liffId}?orderId=${resData.orderId}`
          : `${appUrl}?orderId=${resData.orderId}`;
        
        setCreatedOrderLink(finalLink);
        setSuccess(true);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

        // Refresh existing orders list
        if (liffProfile?.userId) {
          try {
            const res = await fetch(`/api/order/creator?creatorUserId=${liffProfile.userId}`);
            const data = await res.json();
            if (data.success) {
              setCreatorOrders(data.orders);
            }
          } catch (err) {
            console.error(err);
          }
        }

        // Build Flex Message and trigger share
        const flexPayload = getCreateFlexMessage(
          orderName, 
          cleanItems, 
          finalLink, 
          liffProfile?.displayName, 
          liffProfile?.pictureUrl || undefined,
          promoImageUrl || undefined,
          shippingDate || undefined
        );
        await shareMessage(flexPayload, finalLink);
      } else {
        setError(resData.error || 'Failed to create order.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Network error: Failed to submit form.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Order Placement Form (Purchase)
  const handleSubmitPlaceOrder = async () => {
    setError(null);
    if (!orderDetails || !liffProfile) return;

    // Filter out ordered items
    const selectedItems = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantity: qty,
      }));

    if (selectedItems.length === 0) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    if (!payLater && !slipBase64) {
      setError('กรุณาแนบสลิปโอนเงินเพื่อยืนยันออเดอร์');
      return;
    }

    setLoading(true);
    setLoadingStep(payLater ? 'กำลังบันทึกข้อมูลออเดอร์...' : 'กำลังอัปโหลดสลิปและประมวลผลด้วย Gemini AI...');

    try {
      const response = await fetch(`/api/order/${orderDetails.id}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: liffProfile.displayName,
          buyerUserId: liffProfile.userId,
          buyerPicture: liffProfile.pictureUrl || null,
          slipBase64: payLater ? null : slipBase64,
          slipMimeType: payLater ? null : slipMimeType,
          items: selectedItems,
          payLater,
        }),
      });

      const resData = await response.json();
      if (resData.success) {
        setSuccessData(resData);
        setSuccess(true);
        setLoadingStep('');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

        // Map purchased items to names for flex message
        const purchasedDetails = selectedItems.map((sItem) => {
          const itemMeta = orderDetails.items.find((i) => i.id === sItem.itemId);
          return {
            name: itemMeta?.name || 'Unknown Item',
            quantity: sItem.quantity,
          };
        });

        // Send Flex Receipt to chat
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        const finalLink = liffId
          ? `https://liff.line.me/${liffId}?orderId=${orderDetails.id}`
          : `${appUrl}?orderId=${orderDetails.id}`;

        const receiptPayload = getReceiptFlexMessage(
          liffProfile.displayName,
          liffProfile.pictureUrl || null,
          orderDetails.name,
          purchasedDetails,
          calculateTotal(),
          payLater,
          finalLink
        );
        await shareMessage(receiptPayload, finalLink);
      } else {
        setError(resData.error || 'Failed to submit order.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Network error: Failed to submit purchase details.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Wait for LIFF loader to complete
  if (!isLiffInit) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '16px' }}>
          <div className={styles.spinner}></div>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>กำลังโหลดระบบ LINE LIFF...</span>
        </div>
      </div>
    );
  }

  // Success view for Create Order
  if (success && !orderId) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successOverlay}>
            <div className={styles.successIconAnim}>✓</div>
            <h2 className={styles.title}>สร้างออเดอร์สำเร็จ!</h2>
            <p className={styles.subtitle}>เปิดรับออเดอร์สำหรับ "{orderName}" เรียบร้อยแล้ว</p>
            
            <div className={styles.alert} style={{ width: '100%', marginTop: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', color: 'var(--text-primary)' }}>
              <div className={styles.alertTitle} style={{ fontSize: '14px', color: 'var(--primary-light)' }}>
                🔗 ลิงก์ออเดอร์ของคุณ
              </div>
              <p style={{ fontSize: '12px', marginTop: '6px', wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px' }}>
                {createdOrderLink}
              </p>
              <button 
                onClick={() => handleCopyAccountNumber(createdOrderLink || '')} 
                className={styles.btn} 
                style={{ width: '100%', marginTop: '12px', padding: '10px' }}
              >
                {isCopied ? 'คัดลอกลิงก์สำเร็จ!' : 'คัดลอกลิงก์ออเดอร์'}
              </button>
            </div>

            <button 
              onClick={() => {
                setSuccess(false);
                setOrderName('');
                setAccountName('');
                setAccountNumber('');
                setItems([{ name: '', price: 0 }]);
                setPromoImageBase64(null);
                setShippingDate('');
              }} 
              className={styles.addBtn}
              style={{ width: '100%', borderStyle: 'solid', marginTop: '12px' }}
            >
              + สร้างออเดอร์อื่นเพิ่ม
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success view for Place Order
  if (success && orderId) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successOverlay}>
            <div className={styles.successIconAnim}>✓</div>
            <h2 className={styles.title}>สั่งสินค้าเรียบร้อย!</h2>
            <p className={styles.subtitle}>แนบสลิปและยืนยันความถูกต้องผ่าน Gemini AI สำเร็จ</p>

            <div className={styles.billingPanel} style={{ width: '100%', marginTop: '10px' }}>
              <div className={styles.billingDetail}>
                <span className={styles.label}>ยอดเงินที่สั่ง</span>
                <span className={styles.totalValue} style={{ fontSize: '18px' }}>{calculateTotal().toLocaleString()} ฿</span>
              </div>
              <div className={styles.billingDetail}>
                <span className={styles.label}>ชื่อผู้สั่ง</span>
                <span className={styles.label} style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{liffProfile?.displayName}</span>
              </div>
              {successData?.analysis && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '10px', marginTop: '4px' }}>
                  <span className={styles.label} style={{ fontSize: '11px', color: 'var(--primary-light)' }}>🛡️ รายละเอียดจากการตรวจสอบสลิป:</span>
                  <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', color: 'var(--text-secondary)' }}>
                    <span>ธนาคารผู้รับ: {successData.analysis.receiver}</span>
                    <span>จำนวนเงินบนสลิป: {successData.analysis.amount.toLocaleString()} ฿</span>
                    <span>รหัสอ้างอิง: {successData.analysis.ref_no || 'ไม่พบรหัสอ้างอิง'}</span>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                setSuccess(false);
                setSlipBase64(null);
                const initialQuantities: { [itemId: string]: number } = {};
                orderDetails?.items.forEach((item) => {
                  initialQuantities[item.id] = 0;
                });
                setQuantities(initialQuantities);
              }} 
              className={styles.btn}
              style={{ width: '100%', marginTop: '16px' }}
            >
              กลับหน้าสั่งสินค้า
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {(!orderId || !orderDetails) ? (
          <>
            <h1 className={styles.title}>Nationwide Market</h1>
            <span className={styles.subtitle}>ระบบตั้งแผงขายของบริษัทเนชั่นไวด์</span>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 0' }}>
            
            {orderDetails.isActive ? (
              <span className={styles.badge} style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#16a34a' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }}></span>
                เปิดรับออเดอร์
              </span>
            ) : (
              <span className={styles.badge} style={{ backgroundColor: '#fef2f2', borderColor: '#fecaca', color: '#dc2626' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                ปิดรับออเดอร์
              </span>
            )}

            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0', textAlign: 'center' }}>
              {orderDetails.name}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              {orderDetails.createdAt && (
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  📅 วันที่สร้าง: {new Date(orderDetails.createdAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })} น.
                </span>
              )}
              {orderDetails.shippingDate && (
                <span style={{ fontSize: '16px', color: '#ef4444', fontWeight: 800 }}>
                  🚚 พร้อมส่งสินค้า: {orderDetails.shippingDate}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <span className={styles.alertTitle}>⚠️ เกิดข้อผิดพลาด</span>
          <span>{error}</span>
        </div>
      )}

      {loading && loadingStep !== '' && (
        <div className={styles.card} style={{ alignItems: 'center', padding: '36px 20px', gap: '20px' }}>
          <div className={styles.spinner} style={{ width: '36px', height: '36px' }}></div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>กรุณารอสักครู่...</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{loadingStep}</span>
          </div>
        </div>
      )}

      {orderId ? (
        orderDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!orderDetails.isActive && liffProfile?.userId !== orderDetails.creatorUserId ? (
              <div className={styles.card} style={{ textAlign: 'center', padding: '40px 20px', gap: '12px' }}>
                <span style={{ fontSize: '48px' }}>🕒</span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>ออเดอร์นี้ปิดรับคิวแล้ว</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ผู้ตั้งแผงได้ทำการปิดรับคิวคำสั่งซื้อสินค้าสำหรับแผงนี้เรียบร้อยแล้ว
                </p>
                <button 
                  type="button" 
                  onClick={() => {
                    setOrderId(null);
                    setActiveTab('order');
                    window.history.pushState(null, '', window.location.pathname);
                  }}
                  className={styles.btn}
                >
                  ➕ สร้างแผงขายของใหม่
                </button>
              </div>
            ) : (
              <>
                {liffProfile?.userId === orderDetails.creatorUserId && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: 'var(--border-radius-md)' }}>
                      <button 
                        type="button"
                        onClick={() => setActiveTab('order')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: activeTab === 'order' ? '#ffffff' : 'transparent',
                          color: activeTab === 'order' ? '#1e3a8a' : 'var(--text-secondary)',
                          boxShadow: activeTab === 'order' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        🛒 สั่งสินค้า
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveTab('dashboard')}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: activeTab === 'dashboard' ? '#ffffff' : 'transparent',
                          color: activeTab === 'dashboard' ? '#1e3a8a' : 'var(--text-secondary)',
                          boxShadow: activeTab === 'dashboard' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        📋 ดูคำสั่งซื้อ ({orderDetails.buyerOrders?.length || 0})
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'dashboard' && liffProfile?.userId === orderDetails.creatorUserId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 className={styles.sectionTitle}>รายการคำสั่งซื้อลูกค้า</h3>
                    
                    {(!orderDetails.buyerOrders || orderDetails.buyerOrders.length === 0) ? (
                      <div className={styles.card} style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <span style={{ fontSize: '24px' }}>📭</span>
                        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>ยังไม่มีใครสั่งซื้อสินค้าในขณะนี้</p>
                      </div>
                    ) : (
                      orderDetails.buyerOrders.map((bo) => (
                        <div key={bo.id} className={styles.card} style={{ padding: '16px 20px', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {bo.buyerPicture ? (
                              <img src={bo.buyerPicture} alt={bo.buyerName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800 }}>{bo.buyerName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{new Date(bo.createdAt).toLocaleString('th-TH')}</span>
                            </div>

                            <div style={{ marginLeft: 'auto' }}>
                              {bo.payLater ? (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                  🕒 จ่ายทีหลัง
                                </span>
                              ) : bo.verified ? (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #cbd5e1' }}>
                                  ✅ ชำระแล้ว
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                                  ⚠️ รอยืนยัน
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {bo.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#475569' }}>{item.name} x{item.quantity}</span>
                                <span style={{ fontWeight: 700 }}>{(item.price * item.quantity).toLocaleString()} ฿</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: '6px', marginTop: '2px', fontSize: '13px', fontWeight: 800 }}>
                              <span>ยอดรวม</span>
                              <span style={{ color: '#0369a1' }}>{bo.totalAmount.toLocaleString()} ฿</span>
                            </div>
                          </div>

                          {!bo.payLater && bo.slipUrl && bo.slipUrl !== 'PAY_LATER' && (
                            <a 
                              href={bo.slipUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0284c7',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#f0f9ff',
                                border: '1px solid rgba(2, 132, 199, 0.15)',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'var(--transition-smooth)'
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.background = '#e0f2fe'; }}
                              onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
                            >
                              📄 เปิดดูภาพสลิป
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    {!orderDetails.isActive && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--border-radius-md)', color: '#ef4444', fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>
                        🕒 ออเดอร์นี้ปิดรับคิวสั่งซื้อแล้ว
                      </div>
                    )}

                    {orderDetails.promoImageUrl && (
                      <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: '12px' }}>
                        <img 
                          src={orderDetails.promoImageUrl} 
                          alt="Promo Banner" 
                          style={{ width: '100%', height: 'auto', display: 'block' }} 
                        />
                      </div>
                    )}

                    <div className={styles.card}>
                      <h3 className={styles.sectionTitle}>เลือกรายการสินค้า</h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {orderDetails.items.map((item) => (
                          <div key={item.id} className={styles.orderItemRow}>
                            <div className={styles.orderItemInfo}>
                              <span className={styles.orderItemName}>{item.name}</span>
                              <span className={styles.orderItemPrice}>{item.price.toLocaleString()} ฿</span>
                            </div>
                            <div className={styles.counter}>
                              <button 
                                type="button" 
                                onClick={() => adjustQuantity(item.id, 'dec')} 
                                className={styles.counterBtn}
                              >
                                -
                              </button>
                              <span className={styles.counterVal}>{quantities[item.id] || 0}</span>
                              <button 
                                type="button" 
                                onClick={() => adjustQuantity(item.id, 'inc')} 
                                className={styles.counterBtn}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  <div className={styles.card}>
                      <div className={styles.summaryTotal}>
                        <span className={styles.totalLabel}>ราคารวมทั้งหมด</span>
                        <span className={styles.totalValue}>{calculateTotal().toLocaleString()} ฿</span>
                      </div>
                    </div>

                    <div className={styles.card}>
                      <h3 className={styles.sectionTitle}>รายละเอียดการชำระเงิน</h3>
                      
                      <div className={styles.billingPanel}>
                        <div className={styles.billingDetail}>
                          <span className={styles.label}>ธนาคาร</span>
                          <span className={styles.billingVal} style={{ color: 'var(--primary-light)', fontSize: '14px' }}>{orderDetails.bankName}</span>
                        </div>
                        <div className={styles.billingDetail}>
                          <span className={styles.label}>ชื่อบัญชี</span>
                          <span className={styles.billingVal} style={{ fontSize: '14px' }}>{orderDetails.accountName}</span>
                        </div>
                        <div className={styles.billingDetail} style={{ borderTop: '1px solid rgba(16, 185, 129, 0.08)', paddingTop: '10px', marginTop: '4px' }}>
                          <div className={styles.billingInfo}>
                            <span className={styles.label}>เลขที่บัญชี</span>
                            <span className={styles.billingVal}>{orderDetails.accountNumber}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleCopyAccountNumber(orderDetails.accountNumber)}
                            className={`${styles.copyBadge} ${isCopied ? styles.copyBadgeActive : ''}`}
                          >
                            {isCopied ? '✓ คัดลอกแล้ว' : '❐ คัดลอกเลขบัญชี'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.card}>
                      <h3 className={styles.sectionTitle}>แนบสลิปเพื่อยืนยันยอดเงิน</h3>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 12px', background: '#f8fafc', borderRadius: 'var(--border-radius-md)', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                        <input 
                          type="checkbox" 
                          checked={payLater} 
                          onChange={(e) => {
                            setPayLater(e.target.checked);
                            if (e.target.checked) {
                              setSlipBase64(null);
                              setSlipMimeType('');
                            }
                          }} 
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>🕒 สั่งก่อนจ่ายทีหลัง (ค้างชำระ)</span>
                      </label>

                      {!payLater && (
                        slipBase64 ? (
                          <div className={styles.previewContainer}>
                            <img src={slipBase64} alt="Slip Preview" className={styles.previewImage} />
                            <button 
                              type="button" 
                              onClick={() => {
                                setSlipBase64(null);
                                setSlipMimeType('');
                              }} 
                              className={styles.removePreview}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <label className={styles.uploadZone}>
                            <div className={styles.uploadIcon}>⬆</div>
                            <span className={styles.uploadText}>เลือกไฟล์ภาพสลิปโอนเงิน</span>
                            <span className={styles.uploadSubtext}>รองรับ JPG, PNG และ JPEG เท่านั้น</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleFileChange} 
                              className={styles.hiddenInput} 
                            />
                          </label>
                        )
                      )}

                      <button 
                        type="button" 
                        onClick={handleSubmitPlaceOrder} 
                        disabled={loading || calculateTotal() === 0 || (!payLater && !slipBase64) || !orderDetails.isActive} 
                        className={styles.btn}
                        style={{ marginTop: '10px' }}
                      >
                        {loading ? <div className={styles.spinner}></div> : (!orderDetails.isActive ? '🕒 ปิดรับคิวสั่งซื้อแล้ว' : '🛒 ยืนยันสั่งสินค้า')}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          !loading && (
            <div className={styles.card} style={{ textAlign: 'center', padding: '40px 20px', gap: '12px' }}>
              <span style={{ fontSize: '36px' }}>🔍</span>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>ไม่พบข้อมูลออเดอร์</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>ระบบกำลังปิดหน้านี้อัตโนมัติ</p>
            </div>
          )
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.card} style={{ gap: '16px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {liffProfile?.pictureUrl ? (
                  <img src={liffProfile.pictureUrl} alt="Creator" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-blue)' }} />
                ) : (
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👤</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>ผู้ตั้งแผง</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>{liffProfile?.displayName || 'ผู้ตั้งแผง'}</span>
                </div>
              </div>

              {/* Date and Time aligned to the right */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>วันที่ตั้งแผง</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {new Date().toLocaleDateString('th-TH', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })} น.
                </span>
              </div>
            </div>
          </div>

          {creatorOrders.length > 0 && (
            <div className={styles.card} style={{ gap: '16px' }}>
              <h3 className={styles.sectionTitle}>แผงขายของที่คุณเปิดไว้</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {creatorOrders.map((co) => (
                  <div key={co.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e3a8a' }}>{co.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          สร้างเมื่อ: {new Date(co.createdAt).toLocaleDateString('th-TH', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })} น.
                        </span>
                        {co.shippingDate && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', marginTop: '2px' }}>
                            📅 พร้อมส่งสินค้า: {co.shippingDate}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({co.buyerCount} คำสั่งซื้อ)</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px', background: co.isActive ? '#f0f9ff' : '#f1f5f9', color: co.isActive ? '#0284c7' : '#64748b', border: '1px solid #cbd5e1' }}>
                          {co.isActive ? '🟢 เปิดอยู่' : '⚪ ปิดคิว'}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleOrderStatus(co.id, co.isActive)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '50px',
                          border: '1px solid',
                          borderColor: co.isActive ? '#ef4444' : '#0284c7',
                          background: co.isActive ? '#fef2f2' : '#f0f9ff',
                          color: co.isActive ? '#ef4444' : '#0284c7',
                          cursor: 'pointer',
                          marginLeft: 'auto'
                        }}
                      >
                        {co.isActive ? '⛔ ปิดรับออเดอร์' : '✅ เปิดรับออเดอร์'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setOrderId(co.id);
                          setActiveTab('dashboard');
                          window.history.pushState(null, '', `?orderId=${co.id}`);
                        }}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '50px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        🔍 ดูคำสั่งซื้อ
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(co.id)}
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '50px',
                          border: '1px solid #fee2e2',
                          background: '#fef2f2',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitCreateOrder} className={styles.card}>
            <h3 className={styles.sectionTitle}>ออเดอร์</h3>

          <div className={styles.formGroup}>
            <input 
              type="text" 
              placeholder="ชื่อออเดอร์" 
              value={orderName} 
              onChange={(e) => setOrderName(e.target.value)} 
              className={styles.input} 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>รูปภาพโปรโมทออเดอร์ (ไม่บังคับ)</label>
            {promoImageBase64 ? (
              <div className={styles.previewContainer}>
                <img src={promoImageBase64} alt="Promo Preview" className={styles.previewImage} />
                <button 
                  type="button" 
                  onClick={() => setPromoImageBase64(null)} 
                  className={styles.removePreview}
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className={styles.uploadZone}>
                <div className={styles.uploadIcon}>📸</div>
                <span className={styles.uploadText}>เลือกรูปภาพโปรโมท</span>
                <span className={styles.uploadSubtext}>รองรับ JPG, PNG และ JPEG เท่านั้น</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePromoImageChange} 
                  className={styles.hiddenInput} 
                />
              </label>
            )}
          </div>

          <h3 className={styles.sectionTitle} style={{ marginTop: '8px' }}>รายการสินค้า</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item, index) => (
              <div key={index} className={styles.itemRow}>
                <input 
                  type="text" 
                  placeholder="ชื่อเมนู/สินค้า" 
                  value={item.name} 
                  onChange={(e) => handleUpdateItem(index, 'name', e.target.value)} 
                  className={`${styles.input} ${styles.itemInputName}`} 
                  required 
                />
                <input 
                  type="number" 
                  placeholder="ราคา (฿)" 
                  value={item.price || ''} 
                  onChange={(e) => handleUpdateItem(index, 'price', e.target.value)} 
                  className={`${styles.input} ${styles.itemInputPrice}`} 
                  min="1" 
                  required 
                />
                {items.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItem(index)} 
                    className={styles.deleteBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            
            <button 
              type="button" 
              onClick={handleAddItem} 
              className={styles.addBtn}
            >
              + เพิ่มเมนูสินค้า
            </button>
          </div>

          <h3 className={styles.sectionTitle} style={{ marginTop: '16px' }}>การจัดส่ง</h3>
          <div className={styles.formGroup}>
            <label className={styles.label}>วันที่พร้อมส่งสินค้า</label>
            <input 
              type="text" 
              placeholder="เช่น พรุ่งนี้เช้า, ทุกวันจันทร์, หรือระบุวันที่ 17 ก.ค." 
              value={shippingDate} 
              onChange={(e) => setShippingDate(e.target.value)} 
              className={styles.input} 
              required 
            />
          </div>

          <h3 className={styles.sectionTitle} style={{ marginTop: '8px' }}>รายละเอียดการเรียกเก็บเงิน</h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>ธนาคาร / PromptPay</label>
            <select 
              value={bankName} 
              onChange={(e) => setBankName(e.target.value)} 
              className={styles.input}
            >
              <option value="PromptPay">PromptPay (พร้อมเพย์)</option>
              <option value="KBANK">K-Bank (ธนาคารกสิกรไทย)</option>
              <option value="SCB">SCB (ธนาคารไทยพาณิชย์)</option>
              <option value="Bangkok Bank">Bangkok Bank (ธนาคารกรุงเทพ)</option>
              <option value="Krungthai">Krungthai Bank (ธนาคารกรุงไทย)</option>
              <option value="TMBThanachart">ttb (ธนาคารทหารไทยธนชาต)</option>
              <option value="CUSTOM">อื่นๆ (ระบุเอง)</option>
            </select>
          </div>

          {bankName === 'CUSTOM' && (
            <div className={styles.formGroup} style={{ marginTop: '-6px' }}>
              <label className={styles.label}>ระบุชื่อธนาคาร</label>
              <input 
                type="text" 
                placeholder="ระบุธนาคารของคุณ" 
                value={customBankName} 
                onChange={(e) => setCustomBankName(e.target.value)} 
                className={styles.input} 
                required 
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>ชื่อบัญชีผู้รับเงิน</label>
            <input 
              type="text" 
              placeholder="เช่น นายสมชาย ใจดี" 
              value={accountName} 
              onChange={(e) => setAccountName(e.target.value)} 
              className={styles.input} 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>เลขบัญชี / เบอร์พร้อมเพย์</label>
            <input 
              type="text" 
              placeholder="เช่น 123-4-56789-0 หรือ 0812345678" 
              value={accountNumber} 
              onChange={(e) => setAccountNumber(e.target.value)} 
              className={styles.input} 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className={styles.btn} 
            style={{ marginTop: '12px' }}
          >
            {loading ? <div className={styles.spinner}></div> : '📢 ตั้งแผง'}
          </button>
        </form>
      </div>
    )}
    </div>
  );
}
