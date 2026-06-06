# 📧 Order Email Notifications System

## Overview

Your PepsiCo Distributor application now has a complete order email notification system that sends automated emails to users at key stages of their order lifecycle.

---

## 📬 Email Notifications Sent

### 1. **Order Placed Email** (When user creates order)
- **Trigger**: User completes checkout and places order
- **Recipient**: Customer's registered email
- **Content Includes**:
  - Order ID
  - Order date
  - Order status (Pending - Awaiting Approval)
  - Items list with quantities and prices
  - Total amount
  - Direct tracking link
  - Information about what happens next

### 2. **Order Approved Email** (When admin approves order)
- **Trigger**: Admin approves the order in dashboard
- **Recipient**: Customer's registered email
- **Content Includes**:
  - Order ID
  - Order date
  - Order status (✅ APPROVED - Ready for Packing & Delivery)
  - Items list with quantities and prices
  - Total amount
  - Direct tracking link
  - "What's Next" information

---

## 🔧 How It Works

### Email Configuration

The system uses Gmail SMTP for sending emails. Configuration in `backend/.env`:

```env
Email_User=your_email@gmail.com
Email_Pass=your_app_password
```

**Important**: Use Gmail App Password, not your regular password!

### Email Templates

Templates are stored in `backend/email-templates/`:

- `order-confirmation.html` - Main order confirmation template
- `welcome.html` - User registration email
- `approval.html` - Account approval email
- `otp.html` - OTP verification email

### Email Variables

The order confirmation email automatically interpolates these variables:

```
{{userName}}       - Customer's full name
{{orderId}}        - Order ID (first 8 chars, uppercase)
{{orderDate}}      - Order creation date (formatted)
{{status}}         - Current order status
{{paymentMethod}}  - Payment method (COD/Prepaid)
{{items}}          - Array of items with details
{{totalAmount}}    - Total order amount
{{trackingUrl}}    - Direct link to track order
{{supportEmail}}   - Support email address
```

---

## 🔄 Email Sending Flow

```
USER PLACES ORDER
    ↓
Order created in database
    ↓
"Order Placed" email sent ✉️
    ↓
User receives confirmation email
    ↓
Admin reviews order
    ↓
Admin approves order (in dashboard)
    ↓
"Order Approved" email sent ✉️
    ↓
User receives approval email with tracking link
    ↓
User can click link to track order in real-time
```

---

## 📊 Email Content Examples

### Order Placed Email Message

```
Hello [Customer Name],

Great news! Your order has been placed successfully and is now being processed. 
We'll notify you once it's approved and ready for shipment.

ORDER DETAILS
Order ID: ABC12345
Date: 25 Dec 2025
Status: Pending - Awaiting Approval
Payment Method: Cash on Delivery
Items: 3 items
Total: ₹5,000

[Track Your Order Button]

What's Next?
• Your order is pending admin approval
• You'll receive an email once it's approved
• Track your order anytime using the Order ID above
```

### Order Approved Email Message

```
Hello [Customer Name],

Great news! Your order has been approved and is now ready for packing and delivery!

ORDER DETAILS
Order ID: ABC12345
Date: 25 Dec 2025
Status: ✅ APPROVED - Ready for Packing & Delivery
Payment Method: Cash on Delivery
Items: 3 items
Total: ₹5,000

[Track Your Order Button]

What's Next?
• Your order is approved
• Items are being packed
• You'll get another update when it ships
• Track your order anytime using the Order ID above
```

---

## 🚀 Testing the Email System

### Step 1: Start the servers

```bash
./start-project.sh
```

### Step 2: Register a user with valid email

Go to http://localhost:5173/register and create an account with your real email address

### Step 3: Admin approves user

- Go to Admin Dashboard at http://localhost:5173/admin/login
- Use API Key: `Qk3uX9n7r2sP5w8yZa1cV4eB6mJ0tDs`
- Find the user and approve them

### Step 4: User places an order

- Login as the user
- Add items to cart
- Go to checkout
- Place order (COD payment)
- **Expected**: Confirmation email should arrive within seconds

### Step 5: Admin approves order

- Go back to Admin Dashboard
- Find the order in Orders section
- Click "Approve" button
- **Expected**: Approval email should arrive within seconds

### Step 6: Check emails

- Check your email inbox for both emails
- Click the tracking link in the email
- You should see the order tracking page

---

## ✅ Email Sending Features

### Real-time Sending
Emails are sent immediately when:
- Order is placed
- Order is approved by admin

### Error Handling
- If email fails, order is still created/approved
- Error is logged but doesn't block the operation
- Graceful fallback if email not configured

### Email Headers
- Professional formatting with branding
- Mobile-responsive design
- Branded footer with company name
- Direct action buttons with tracking links

---

## 🔐 Security Features

1. **Email Configuration**: Hidden in .env (not in version control)
2. **App Passwords**: Using Gmail App Password instead of regular password
3. **Email Validation**: Basic email format validation before sending
4. **Error Logging**: All email errors logged for debugging
5. **No Data Exposure**: Email content doesn't expose sensitive data

---

## 🐛 Troubleshooting

### Issue: Emails not being sent

**Check 1**: Verify email configuration in `backend/.env`
```bash
grep "Email_" backend/.env
```

**Check 2**: Check backend logs for email errors
```bash
tail -f logs/backend.log | grep -i email
```

**Check 3**: Verify Gmail App Password
- Go to https://myaccount.google.com
- Enable 2-factor authentication
- Generate App Password for "Mail"
- Update `Email_Pass` in .env

### Issue: Email template not rendering

**Check**: Verify handlebars variables match template
- Template expects: `{{userName}}`, `{{orderId}}`, etc.
- Backend passes correct variable names

### Issue: Emails going to spam

**Solution**: Gmail may mark first emails as spam
- Mark as "Not Spam" in Gmail
- Wait for email reputation to build
- Check SPF/DKIM records if using custom domain

---

## 📝 Manual Email Testing

### Send test email via API

```bash
curl -X POST http://localhost:5001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Check if mailer is configured

```bash
curl http://localhost:5001/api/health | grep mailerConfigured
```

---

## 🎯 Next Steps

1. ✅ Test order placement and email delivery
2. ✅ Test admin approval and approval email
3. ✅ Verify tracking links work in emails
4. ✅ Check email formatting on different devices
5. ✅ Monitor email delivery logs

---

## 📧 Email Service Details

**Provider**: Gmail SMTP  
**Port**: 587  
**Encryption**: TLS  
**From**: Your configured Email_User  
**Template Engine**: Handlebars  
**Error Logging**: Yes (console & logs)

---

## 💡 Tips

- **Batch Emails**: Consider Sendgrid or AWS SES for production
- **Email Tracking**: Add open/click tracking for analytics
- **Unsubscribe Links**: Add unsubscribe links for compliance
- **Backup Email**: Configure fallback email if primary fails
- **Rate Limiting**: Consider rate limiting for high volume

---

## 🔗 Related Files

- Backend: `/backend/server.js` - Order and approval endpoints
- Emailer: `/backend/lib/emailer.js` - Email sending logic
- Templates: `/backend/email-templates/` - Email HTML templates
- Frontend: `/frontend/src/pages/OrderSuccess.jsx` - Post-order page
- Frontend: `/frontend/src/pages/TrackOrder.jsx` - Order tracking page

---

**Your email notification system is now fully configured and operational!** 🎉
