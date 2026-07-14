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
  items: {
    id: string;
    name: string;
    price: number;
  }[];
}

export default function Home() {
  // Navigation State
  const [orderId, setOrderId] = useState<string | null>(null);

  // LIFF State
  const [isLiffInit, setIsLiffInit] = useState(false);
  const [liffProfile, setLiffProfile] = useState<{ displayName: string; userId: string } | null>(null);
  const [liffError, setLiffError] = useState<string | null>(null);

  // View state (Create Order)
  const [orderName, setOrderName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('KBANK');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([{ name: '', price: 0 }]);

  // View state (Place Order)
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [quantities, setQuantities] = useState<{ [itemId: string]: number }>({});
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const [slipMimeType, setSlipMimeType] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

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
          setLiffProfile({ displayName: 'Mock User (Local Development)', userId: 'U1234567890' });
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
          });
        }
      } catch (err: any) {
        console.error('LINE LIFF Init Failure:', err);
        setLiffError(err.message || 'Failed to initialize LIFF');
        // Set mock data so testing locally still works
        setLiffProfile({ displayName: 'Developer Test', userId: 'U1234567890' });
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
        const res = await fetch(`/api/order/${orderId}`);
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
          setError(data.error || 'Failed to fetch order details.');
        }
      } catch (err: any) {
        console.error('Fetch order error:', err);
        setError('Network error: Failed to fetch order details.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

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

  // File Upload Helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG/JPG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipBase64(reader.result as string);
      setSlipMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  // Create Flex Message for Order Creation
  const getCreateFlexMessage = (name: string, orderItems: OrderItem[], liffLink: string) => {
    const flexItems = orderItems.map((item) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: item.name,
          size: 'sm',
          color: '#555555',
          flex: 4,
          wrap: true,
        },
        {
          type: 'text',
          text: `${item.price.toLocaleString()} ฿`,
          size: 'sm',
          color: '#111111',
          align: 'right',
          weight: 'bold',
          flex: 2,
        },
      ],
    }));

    return {
      type: 'flex',
      altText: `📢 เปิดรับออเดอร์: ${name}`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#0284c7',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: '📢 เปิดรับออเดอร์แล้วจ้า!',
                  color: '#ffffff',
                  weight: 'bold',
                  size: 'sm',
                },
                {
                  type: 'text',
                  text: name,
                  color: '#ffffff',
                  size: 'xl',
                  weight: 'bold',
                  margin: 'sm',
                  wrap: true,
                },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              paddingAll: 'xl',
              contents: [
                {
                  type: 'text',
                  text: 'รายการสินค้า',
                  weight: 'bold',
                  size: 'sm',
                  color: '#888888',
                  margin: 'none',
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
              color: '#0284c7',
              action: {
                type: 'uri',
                label: '🛒 กดสั่งเลย',
                uri: liffLink,
              },
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
    orderNameVal: string,
    itemsBought: { name: string; quantity: number }[],
    totalAmountVal: number
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
                  text: '✅ สั่งสินค้าเรียบร้อย!',
                  color: '#38bdf8',
                  weight: 'bold',
                  size: 'xs',
                },
                {
                  type: 'text',
                  text: buyerName,
                  color: '#ffffff',
                  size: 'xl',
                  weight: 'bold',
                  margin: 'sm',
                  wrap: true,
                },
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
                      align: 'right',
                      color: '#0284c7',
                    },
                  ],
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'md',
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  cornerRadius: 'md',
                  paddingAll: 'md',
                  contents: [
                    {
                      type: 'text',
                      text: '🛡️ แนบสลิปและยืนยันแล้วโดย AI',
                      size: 'xs',
                      color: '#0284c7',
                      align: 'center',
                      weight: 'bold',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };
  };

  // Share/Send Flex message inside LIFF
  const shareMessage = async (messagePayload: any, directLink: string) => {
    try {
      const liff = (await import('@line/liff')).default;
      
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        alert(`โหมดพัฒนา (ไม่มี LIFF ID) คัดลอกลิงก์ไปแชร์: ${directLink}`);
        return;
      }

      if (liff.isApiAvailable('shareTargetPicker')) {
        const pickerResponse = await liff.shareTargetPicker([messagePayload]);
        if (pickerResponse) {
          alert('ส่งการแจ้งเตือนเสร็จสิ้น!');
        }
      } else {
        try {
          await liff.sendMessages([messagePayload]);
          alert('ส่งการแจ้งเตือนสำเร็จ!');
        } catch (msgErr) {
          console.error('liff.sendMessages error:', msgErr);
          alert(`ไม่สามารถส่งแชทตรงได้ คัดลอกลิงก์ไปแชร์: ${directLink}`);
        }
      }
    } catch (err) {
      console.error('Error sharing target picker:', err);
      alert(`คัดลอกลิงก์ไปแชร์: ${directLink}`);
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
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orderName,
          accountName,
          bankName: bankFinal,
          accountNumber,
          items: cleanItems,
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

        // Build Flex Message and trigger share
        const flexPayload = getCreateFlexMessage(orderName, cleanItems, finalLink);
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

    if (!slipBase64) {
      setError('กรุณาแนบสลิปโอนเงินเพื่อยืนยันออเดอร์');
      return;
    }

    setLoading(true);
    setLoadingStep('กำลังจัดเตรียมข้อมูล...');

    try {
      setLoadingStep('กำลังอัปโหลดสลิปและประมวลผลด้วย Gemini AI...');
      const response = await fetch(`/api/order/${orderDetails.id}/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: liffProfile.displayName,
          buyerUserId: liffProfile.userId,
          slipBase64,
          slipMimeType,
          items: selectedItems,
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
          orderDetails.name,
          purchasedDetails,
          calculateTotal()
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
      {/* HEADER SECTION */}
      <header className={styles.header}>
        <h1 className={styles.title}>Nationwide Market</h1>
        <span className={styles.subtitle}>ระบบตั้งแผงขายของบริษัทเนชั่นไวด์</span>
        {orderId && orderDetails && (
          <span className={styles.badge}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }}></span>
            เปิดรับออเดอร์: {orderDetails.name}
          </span>
        )}
      </header>

      {/* ERROR ALERT DISPLAY */}
      {error && (
        <div className={`${styles.alert} ${styles.alertError}`}>
          <span className={styles.alertTitle}>⚠️ เกิดข้อผิดพลาด</span>
          <span>{error}</span>
        </div>
      )}

      {/* LOADING OVERLAY SCREEN */}
      {loading && loadingStep !== '' && (
        <div className={styles.card} style={{ alignItems: 'center', padding: '36px 20px', gap: '20px' }}>
          <div className={styles.spinner} style={{ width: '36px', height: '36px' }}></div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>กรุณารอสักครู่...</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{loadingStep}</span>
          </div>
        </div>
      )}

      {/* MAIN VIEW */}
      {/* 1. ORDER PLACEMENT VIEW (When orderId query is set) */}
      {orderId ? (
        orderDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Items Choice Card */}
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

              <div className={styles.summaryTotal}>
                <span className={styles.totalLabel}>ราคารวมทั้งหมด</span>
                <span className={styles.totalValue}>{calculateTotal().toLocaleString()} ฿</span>
              </div>
            </div>

            {/* Merchant Payment Details Card */}
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

            {/* Slip Upload & Verification Card */}
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>แนบสลิปเพื่อยืนยันยอดเงิน</h3>
              <p className={styles.label} style={{ marginTop: '-8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                * ระบบจะทำการใช้ Gemini AI ในการตรวจสอบจำนวนเงินโอน, ชื่อผู้รับ, และประวัติการโอนโดยอัตโนมัติ
              </p>

              {slipBase64 ? (
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
              )}

              <button 
                type="button" 
                onClick={handleSubmitPlaceOrder} 
                disabled={loading || calculateTotal() === 0 || !slipBase64} 
                className={styles.btn}
                style={{ marginTop: '10px' }}
              >
                {loading ? <div className={styles.spinner}></div> : '🛒 ยืนยันสั่งสินค้าและชำระเงิน'}
              </button>
            </div>
          </div>
        ) : (
          !loading && (
            <div className={styles.card} style={{ textAlign: 'center', padding: '30px' }}>
              <span style={{ fontSize: '32px' }}>🔍</span>
              <h3 style={{ marginTop: '10px' }}>ไม่พบข้อมูลออเดอร์</h3>
              <p className={styles.label} style={{ marginTop: '6px' }}>กรุณาตรวจสอบลิงก์ออเดอร์อีกครั้ง</p>
            </div>
          )
        )
      ) : (
        /* 2. CREATE ORDER VIEW (Default screen) */
        <form onSubmit={handleSubmitCreateOrder} className={styles.card}>
          <h3 className={styles.sectionTitle}>รายละเอียดเปิดรับออเดอร์</h3>

          <div className={styles.formGroup}>
            <label className={styles.label}>ชื่อออเดอร์</label>
            <input 
              type="text" 
              placeholder="เช่น ข้าวมันไก่เจ๊ใจ, สั่งชานมไข่มุก" 
              value={orderName} 
              onChange={(e) => setOrderName(e.target.value)} 
              className={styles.input} 
              required 
            />
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
            {loading ? <div className={styles.spinner}></div> : '📢 เปิดออเดอร์และแชร์ลงห้องแชท'}
          </button>
        </form>
      )}
    </div>
  );
}
