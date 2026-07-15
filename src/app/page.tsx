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
  const [paidQuantities, setPaidQuantities] = useState<{ [itemId: string]: number }>({});
  const [previousBuyerOrders, setPreviousBuyerOrders] = useState<any[]>([]);
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
  const [selectedSlipUrl, setSelectedSlipUrl] = useState<string | null>(null);

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
          const initialQuantities: { [itemId: string]: number } = {};
          const initialPaid: { [itemId: string]: number } = {};
          data.order.items.forEach((item: any) => {
            initialQuantities[item.id] = 0;
            initialPaid[item.id] = 0;
          });
          
          if (data.order.previousBuyerOrders && Array.isArray(data.order.previousBuyerOrders)) {
            setPreviousBuyerOrders(data.order.previousBuyerOrders);
            data.order.previousBuyerOrders.forEach((bo: any) => {
              if (bo.items && Array.isArray(bo.items)) {
                bo.items.forEach((bi: any) => {
                  initialQuantities[bi.itemId] = (initialQuantities[bi.itemId] || 0) + bi.quantity;
                  if (bo.verified) {
                    initialPaid[bi.itemId] = (initialPaid[bi.itemId] || 0) + bi.quantity;
                  }
                });
              }
            });
          }
          setQuantities(initialQuantities);
          setPaidQuantities(initialPaid);
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

  // Automatically close window after order placement success
  useEffect(() => {
    if (success && orderId) {
      const timer = setTimeout(() => {
        import('@line/liff').then((m) => {
          const liff = m.default;
          try {
            liff.closeWindow();
          } catch (e) {
            window.close();
          }
        });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success, orderId]);


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

  const calculateUnpaidTotal = () => {
    if (!orderDetails) return 0;
    return orderDetails.items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      const paidQty = paidQuantities[item.id] || 0;
      const unpaidQty = Math.max(0, qty - paidQty);
      return sum + item.price * unpaidQty;
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
    const minQty = paidQuantities[itemId] || 0;
    const newQty = direction === 'inc' ? currentQty + 1 : Math.max(minQty, currentQty - 1);
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
            {
              type: 'text',
              text: 'เปิดรับออเดอร์',
              align: 'center',
              weight: 'bold',
              size: 'xxl',
              margin: 'xs',
              color: '#FFFFFF',
            },
          ],
          backgroundColor: '#3b61ad',
        },
        hero: {
          type: 'image',
          url: (promoImageUrl && promoImageUrl.startsWith('https')) 
            ? promoImageUrl 
            : 'https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800',
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
              color: '#00b3f0',
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
                label: 'สั่งเลยตอนนี้',
                uri: liffLink,
              },
              color: '#FFFFFF',
            },
          ],
          backgroundColor: '#3b61ad',
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
    const isCancelled = itemsBought.length === 0;

    const flexItems = isCancelled 
      ? [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: 'ยกเลิกรายการสินค้าทั้งหมดในคำสั่งซื้อนี้แล้ว',
                color: '#ef4444',
                size: 'sm',
                weight: 'bold',
                wrap: true,
              }
            ]
          }
        ]
      : itemsBought.map((item) => ({
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

    const bubbleContents: any = {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: isCancelled 
          ? [
              {
                type: 'text',
                text: '🚫 ยกเลิกคำสั่งซื้อเรียบร้อย',
                size: 'lg',
                color: '#000000',
                align: 'center',
              },
              {
                type: 'text',
                text: `ของ ${buyerName}`,
                align: 'center',
                size: 'xs',
              },
            ]
          : [
              {
                type: 'text',
                text: 'มีคำสั่งซื้อจาก',
                align: 'center',
                color: '#FFFFFF',
                size: 'lg',
              },
              {
                type: 'text',
                text: buyerName,
                align: 'center',
                size: 'xs',
                color: '#FFFFFF',
              },
            ],
        backgroundColor: isCancelled ? '#ffc67b' : '#1e3a8a',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'xl',
            contents: isCancelled
              ? [
                  {
                    type: 'text',
                    text: orderNameVal,
                    size: 'md',
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
                ]
              : [
                  {
                    type: 'text',
                    text: orderNameVal,
                    size: 'lg',
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
                        color: '#1e3a8a',
                      },
                    ],
                  },
                  {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    backgroundColor: payLaterReceipt ? '#47556914' : '#1e3a8a14',
                    cornerRadius: 'md',
                    paddingAll: 'md',
                    contents: [
                      {
                        type: 'text',
                        text: payLaterReceipt ? '🕒 สั่งก่อนจ่ายทีหลัง (ค้างชำระ)' : '🛡️ แนบสลิปและยืนยันแล้วโดย AI',
                        size: 'xs',
                        color: payLaterReceipt ? '#475569' : '#1e3a8a',
                        align: 'center',
                        weight: 'bold',
                      },
                    ],
                  },
                ],
          },
        ],
      },
    };

    if (!isCancelled) {
      bubbleContents.footer = {
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
      };
    }

    return {
      type: 'flex',
      altText: isCancelled 
        ? `🚫 คุณ ${buyerName} ยกเลิกคำสั่งซื้อเรียบร้อย` 
        : `✅ คุณ ${buyerName} สั่งซื้อสินค้าแล้ว!`,
      contents: bubbleContents,
    };
  };

  // Share/Send Flex message inside LIFF
  const shareMessage = async (messagePayload: any, directLink: string, enablePicker = true) => {
    console.log('Starting shareMessage...', { messagePayload, directLink, enablePicker });
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
        if (enablePicker) {
          alert(`โหมดพัฒนา (ไม่มี LIFF ID) คัดลอกลิงก์ไปแชร์: ${directLink}`);
        }
        return;
      }

      // 1. Try sending directly to the active chat context (Reply/Send)
      const context = liff.getContext();
      console.log('LIFF Context:', context);
      if (context && context.type && ['utou', 'room', 'group'].includes(context.type)) {
        console.log('Attempting liff.sendMessages...');
        try {
          await liff.sendMessages([messagePayload]);
          console.log('liff.sendMessages success');
          return;
        } catch (msgErr: any) {
          console.error('liff.sendMessages failed:', msgErr);
        }
      }

      if (!enablePicker) {
        console.log('Picker sharing is disabled for this flow, skipping picker/alert.');
        return;
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
      if (enablePicker) {
        navigator.clipboard.writeText(directLink);
        alert(`เกิดข้อผิดพลาด: ${directLink}`);
      }
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

    // Map all items with their selected quantities
    const selectedItems = orderDetails.items.map((item) => ({
      itemId: item.id,
      quantity: quantities[item.id] || 0,
    }));

    const totalQty = (Object.values(quantities) as number[]).reduce((a, b) => a + b, 0);
    const hasPreviousOrder = previousBuyerOrders.length > 0;
    if (totalQty === 0 && !hasPreviousOrder) {
      setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    const unpaidTotal = calculateUnpaidTotal();

    if (unpaidTotal > 0 && !payLater && !slipBase64) {
      setError('กรุณาแนบสลิปโอนเงินเพื่อยืนยันออเดอร์');
      return;
    }

    setLoading(true);
    setLoadingStep(
      unpaidTotal === 0
        ? 'กำลังอัปเดตรายการออเดอร์...'
        : payLater
        ? 'กำลังบันทึกข้อมูลออเดอร์...'
        : 'กำลังอัปโหลดสลิปและประมวลผลด้วย Gemini AI...'
    );

    try {
      const response = await fetch(`/api/order/${orderDetails.id}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: liffProfile.displayName,
          buyerUserId: liffProfile.userId,
          buyerPicture: liffProfile.pictureUrl || null,
          slipBase64: (payLater || unpaidTotal === 0) ? null : slipBase64,
          slipMimeType: (payLater || unpaidTotal === 0) ? null : slipMimeType,
          items: selectedItems,
          payLater: unpaidTotal === 0 ? false : payLater,
        }),
      });

      const resData = await response.json();
      if (resData.success) {
        setSuccessData(resData);
        setSuccess(true);
        setLoadingStep('');
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

        // Map purchased items to names for flex message (only show quantity > 0)
        const purchasedDetails = selectedItems
          .filter((sItem) => sItem.quantity > 0)
          .map((sItem) => {
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
        await shareMessage(receiptPayload, finalLink, false);
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
    const totalQty = (Object.values(quantities) as number[]).reduce((a, b) => a + b, 0);
    const isCancelled = totalQty === 0;

    return (
      <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '20px', animation: 'fadeIn 0.5s ease-out' }}>
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '24px',
          padding: '48px 32px',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: isCancelled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            color: isCancelled ? '#ef4444' : '#10b981',
            boxShadow: isCancelled ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(16, 185, 129, 0.2)',
          }}>
            {isCancelled ? '✕' : '✓'}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {isCancelled ? 'ยกเลิกคำสั่งซื้อเรียบร้อย' : 'ทำรายการสำเร็จ'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              กำลังปิดหน้าต่างเพื่อกลับเข้าสู่หน้าแชทของคุณ...
            </p>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--card-border)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginTop: '8px'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: isCancelled ? '#ef4444' : '#10b981',
              borderRadius: '3px',
              animation: 'shrinkWidth 2.5s linear forwards'
            }} />
          </div>
        </div>
      </div>
    );
  }

  const groupedOrders = (() => {
    if (!orderDetails?.buyerOrders) return [];
    
    const groups: { [buyerUserId: string]: {
      buyerUserId: string;
      buyerName: string;
      buyerPicture: string | null;
      latestCreatedAt: string;
      items: { [itemName: string]: number };
      totalPaid: number;
      totalUnpaid: number;
      totalAmount: number;
      slips: { id: string; url: string; verified: boolean; payLater: boolean; createdAt: string }[];
    }} = {};

    orderDetails.buyerOrders.forEach((bo) => {
      if (!groups[bo.buyerUserId]) {
        groups[bo.buyerUserId] = {
          buyerUserId: bo.buyerUserId,
          buyerName: bo.buyerName,
          buyerPicture: bo.buyerPicture || null,
          latestCreatedAt: bo.createdAt,
          items: {},
          totalPaid: 0,
          totalUnpaid: 0,
          totalAmount: 0,
          slips: []
        };
      }

      const g = groups[bo.buyerUserId];
      
      if (new Date(bo.createdAt) > new Date(g.latestCreatedAt)) {
        g.latestCreatedAt = bo.createdAt;
      }

      if (bo.items && Array.isArray(bo.items)) {
        bo.items.forEach((item) => {
          g.items[item.name] = (g.items[item.name] || 0) + item.quantity;
        });
      }

      g.totalAmount += bo.totalAmount;
      if (bo.verified) {
        g.totalPaid += bo.totalAmount;
      } else {
        g.totalUnpaid += bo.totalAmount;
      }

      if (bo.slipUrl && bo.slipUrl !== 'PAY_LATER') {
        g.slips.push({
          id: bo.id,
          url: bo.slipUrl,
          verified: bo.verified,
          payLater: bo.payLater,
          createdAt: bo.createdAt
        });
      }
    });

    return Object.values(groups).sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
  })();

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
                  📅 {new Date(orderDetails.createdAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
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
                        📋 ดูคำสั่งซื้อ ({groupedOrders.length} คน)
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'dashboard' && liffProfile?.userId === orderDetails.creatorUserId ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 className={styles.sectionTitle}>รายการคำสั่งซื้อลูกค้า</h3>
                    
                    {groupedOrders.length === 0 ? (
                      <div className={styles.card} style={{ textAlign: 'center', padding: '32px 16px' }}>
                        <span style={{ fontSize: '24px' }}>📭</span>
                        <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>ยังไม่มีใครสั่งซื้อสินค้าในขณะนี้</p>
                      </div>
                    ) : (
                      groupedOrders.map((g) => (
                        <div key={g.buyerUserId} className={styles.card} style={{ padding: '16px 20px', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {g.buyerPicture ? (
                              <img src={g.buyerPicture} alt={g.buyerName} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>👤</div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800 }}>{g.buyerName}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                อัปเดตล่าสุด: {new Date(g.latestCreatedAt).toLocaleString('th-TH')}
                              </span>
                            </div>

                            <div style={{ marginLeft: 'auto' }}>
                              {g.totalUnpaid === 0 ? (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #cbd5e1' }}>
                                  ✅ ชำระแล้ว
                                </span>
                              ) : g.slips.some(s => !s.verified && !s.payLater) ? (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                                  ⚠️ รอยืนยันสลิป
                                </span>
                              ) : (
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                  🕒 ค้างชำระ
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {Object.entries(g.items).map(([name, qty], idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: '#475569' }}>{name}</span>
                                <span style={{ fontWeight: 700 }}>x{qty}</span>
                              </div>
                            ))}
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', marginTop: '4px', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                                <span>จ่ายแล้ว</span>
                                <span>{g.totalPaid.toLocaleString()} ฿</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 600 }}>
                                <span>ค้างจ่าย</span>
                                <span>{g.totalUnpaid.toLocaleString()} ฿</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #f1f5f9', paddingTop: '4px', marginTop: '2px', fontSize: '13px' }}>
                                <span>ยอดรวมทั้งหมด</span>
                                <span style={{ color: '#0369a1' }}>{g.totalAmount.toLocaleString()} ฿</span>
                              </div>
                            </div>
                          </div>

                          {g.slips.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                              {g.slips.map((slip, sIdx) => (
                                <button 
                                  key={slip.id}
                                  type="button"
                                  onClick={() => setSelectedSlipUrl(slip.url)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#0284c7',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: '#f0f9ff',
                                    border: '1px solid rgba(2, 132, 199, 0.15)',
                                    cursor: 'pointer',
                                    transition: 'var(--transition-smooth)'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = '#e0f2fe'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
                                >
                                  📄 สลิปที่ {sIdx + 1} ({slip.verified ? '✅ ผ่าน' : '⚠️ รอยืนยัน'})
                                </button>
                              ))}
                            </div>
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

                  <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>ราคารวมทั้งหมด</span>
                        <span>{calculateTotal().toLocaleString()} ฿</span>
                      </div>
                      {(Object.values(paidQuantities) as number[]).reduce((a: number, b: number) => a + b, 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                          <span>ชำระเงินแล้ว</span>
                          <span>-{Object.keys(paidQuantities).reduce((sum: number, id: string) => {
                            const item = orderDetails.items.find((it: any) => it.id === id);
                            return sum + (item ? item.price * paidQuantities[id] : 0);
                          }, 0).toLocaleString()} ฿</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '8px', fontSize: '15px', fontWeight: 800, color: '#ef4444' }}>
                        <span>ยอดที่ต้องชำระเพิ่ม</span>
                        <span>{calculateUnpaidTotal().toLocaleString()} ฿</span>
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
                      {calculateUnpaidTotal() > 0 ? (
                        <>
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
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '28px' }}>✅</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>ชำระเงินครบแล้ว ไม่ต้องแนบสลิปเพิ่มเติม</span>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>คุณสามารถกดปุ่มด้านล่างเพื่ออัปเดตคำสั่งซื้อได้ทันที</p>
                        </div>
                      )}

                      <button 
                        type="button" 
                        onClick={handleSubmitPlaceOrder} 
                        disabled={loading || (!payLater && calculateUnpaidTotal() > 0 && !slipBase64) || !orderDetails.isActive} 
                        className={styles.btn}
                        style={{ marginTop: '10px' }}
                      >
                        {loading ? <div className={styles.spinner}></div> : (!orderDetails.isActive ? '🕒 ปิดรับคิวสั่งซื้อแล้ว' : (calculateUnpaidTotal() === 0 ? '🛒 ยืนยันปรับปรุงคำสั่งซื้อ' : '🛒 ยืนยันทำรายการ'))}
                      </button>
                    </div>

                    {previousBuyerOrders.length > 0 && (
                      <div className={styles.card} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h3 className={styles.sectionTitle}>ประวัติการสั่งซื้อและสลิปเดิมของคุณ</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {previousBuyerOrders.map((bo, idx) => (
                            <div key={bo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: 700 }}>
                                  รายการที่ {previousBuyerOrders.length - idx}: {bo.totalAmount.toLocaleString()} ฿
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                  {new Date(bo.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: bo.verified ? '#f0f9ff' : '#fef2f2', color: bo.verified ? '#0369a1' : '#ef4444', border: '1px solid #cbd5e1' }}>
                                  {bo.verified ? '✅ จ่ายแล้ว' : bo.payLater ? '🕒 ค้างจ่าย' : '⚠️ รอยืนยัน'}
                                </span>
                                {!bo.payLater && bo.slipUrl && bo.slipUrl !== 'PAY_LATER' && (
                                  <button 
                                    type="button" 
                                    onClick={() => setSelectedSlipUrl(bo.slipUrl)} 
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: '#0284c7',
                                      fontSize: '11px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      padding: '2px 4px'
                                    }}
                                  >
                                    📄 สลิป
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
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
                          cursor: 'pointer'
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
                          cursor: 'pointer',
                          marginLeft: 'auto'
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

    {selectedSlipUrl && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setSelectedSlipUrl(null)}
      >
        <div 
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '12px',
            maxWidth: '95%',
            maxHeight: '90%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            onClick={() => setSelectedSlipUrl(null)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              color: '#ffffff',
              border: 'none',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            ✕
          </button>
          <div style={{ overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src={selectedSlipUrl} 
              alt="Payment Slip" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '75vh', 
                borderRadius: '12px', 
                objectFit: 'contain',
                display: 'block' 
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <a 
              href={selectedSlipUrl} 
              target="_blank" 
              rel="noreferrer"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0284c7',
                textDecoration: 'underline'
              }}
            >
              💾 เปิดในหน้าต่างใหม่ (เพื่อดาวน์โหลด)
            </a>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
