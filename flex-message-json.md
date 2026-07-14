# โครงสร้าง JSON ของ Flex Message

นี่คือโครงสร้าง JSON ที่ถูกส่งไปยัง LINE Messaging API (ผ่าน LIFF) ในปัจจุบันครับ

## 1. แบบเปิดรับออเดอร์ (Create Order)
ส่งเมื่อผู้ใช้สร้าง "แผงขายของ" สำเร็จ

```json
{
  "type": "flex",
  "altText": "📢 เปิดรับออเดอร์: [ชื่อออเดอร์]",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "paddingAll": "none",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#0284c7",
          "paddingAll": "xl",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "spacing": "md",
              "alignItems": "center",
              "contents": [
                {
                  "type": "image",
                  "url": "[URL รูปภาพผู้สร้าง - ต้องเป็น https]",
                  "size": "xxs",
                  "aspectRatio": "1:1",
                  "aspectMode": "cover",
                  "cornerRadius": "xxl"
                },
                {
                  "type": "text",
                  "text": "เปิดรับออเดอร์จาก คุณ [ชื่อผู้สร้าง]",
                  "color": "#ffffff",
                  "weight": "bold",
                  "size": "sm",
                  "wrap": true
                }
              ]
            },
            {
              "type": "text",
              "text": "[ชื่อออเดอร์]",
              "color": "#ffffff",
              "size": "xl",
              "weight": "bold",
              "margin": "sm",
              "wrap": true
            }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "paddingAll": "xl",
          "contents": [
            {
              "type": "text",
              "text": "รายการสินค้า",
              "weight": "bold",
              "size": "sm",
              "color": "#888888",
              "margin": "md"
            },
            {
              "type": "separator",
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "vertical",
              "margin": "md",
              "spacing": "sm",
              "contents": [
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "text",
                      "text": "[ชื่อสินค้า]",
                      "size": "sm",
                      "color": "#555555",
                      "flex": 4,
                      "wrap": true
                    },
                    {
                      "type": "text",
                      "text": "[ราคาสินค้า] ฿",
                      "size": "sm",
                      "color": "#111111",
                      "align": "end",
                      "weight": "bold",
                      "flex": 2
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "style": "primary",
          "color": "#0284c7",
          "action": {
            "type": "uri",
            "label": "🛒 กดสั่งเลยตอนนี้",
            "uri": "[LIFF Link]"
          }
        }
      ]
    }
  }
}
```

---

## 2. แบบใบเสร็จสั่งซื้อ (Order Receipt)
ส่งเมื่อมีคน "กดสั่งซื้อ" สินค้าสำเร็จ

```json
{
  "type": "flex",
  "altText": "✅ คุณ [ชื่อผู้ซื้อ] สั่งซื้อสินค้าแล้ว!",
  "contents": {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#0369a1",
          "paddingAll": "xl",
          "contents": [
            {
              "type": "text",
              "text": "🛒 มีคำสั่งซื้อเข้ามาใหม่!",
              "color": "#38bdf8",
              "weight": "bold",
              "size": "xs"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "md",
              "spacing": "md",
              "contents": [
                {
                  "type": "image",
                  "url": "[URL รูปภาพผู้ซื้อ - ต้องเป็น https]",
                  "size": "xxs",
                  "aspectRatio": "1:1",
                  "aspectMode": "cover",
                  "cornerRadius": "xxl"
                },
                {
                  "type": "text",
                  "text": "จาก คุณ [ชื่อผู้ซื้อ]",
                  "color": "#ffffff",
                  "size": "md",
                  "weight": "bold",
                  "wrap": true
                }
              ]
            }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "paddingAll": "xl",
          "contents": [
            {
              "type": "text",
              "text": "ร้านค้า: [ชื่อร้าน]",
              "size": "sm",
              "color": "#888888",
              "weight": "bold"
            },
            {
              "type": "separator",
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "vertical",
              "margin": "md",
              "spacing": "sm",
              "contents": [
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "text",
                      "text": "[ชื่อสินค้า] x[จำนวน]",
                      "size": "sm",
                      "color": "#555555",
                      "flex": 4,
                      "wrap": true
                    }
                  ]
                }
              ]
            },
            {
              "type": "separator",
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "md",
              "contents": [
                {
                  "type": "text",
                  "text": "ราคารวมทั้งหมด",
                  "weight": "bold",
                  "size": "sm",
                  "color": "#444444"
                },
                {
                  "type": "text",
                  "text": "[ยอดรวม] ฿",
                  "weight": "bold",
                  "size": "md",
                  "align": "end",
                  "color": "#0284c7"
                }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "margin": "md",
              "backgroundColor": "#0284c714",
              "cornerRadius": "md",
              "paddingAll": "md",
              "contents": [
                {
                  "type": "text",
                  "text": "🛡️ แนบสลิปและยืนยันแล้วโดย AI",
                  "size": "xs",
                  "color": "#0284c7",
                  "align": "center",
                  "weight": "bold"
                }
              ]
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "style": "primary",
          "color": "#1e3a8a",
          "action": {
            "type": "uri",
            "label": "📋 ดูคำสั่งซื้อ",
            "uri": "[LIFF Link]"
          }
        }
      ],
      "flex": 0
    }
  }
}
```
