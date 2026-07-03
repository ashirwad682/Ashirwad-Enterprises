import PDFDocument from 'pdfkit'
import { calculateSlabDiscountAmount, formatSlabRuleText, resolveApplicableSlab } from './slab-utils.js'

// Generate bill PDF matching the HTML invoice format exactly
export async function generateBillPdf(orderId, supabase) {
  try {
    // Get order details
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (orderError || !orderData) {
      throw new Error('Order not found')
    }
    
    // Get user details
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', orderData.user_id)
      .single()
    
    // Get product details for each item
    const rawItems = Array.isArray(orderData.items)
      ? orderData.items
      : (typeof orderData.items === 'string' ? JSON.parse(orderData.items || '[]') : [])
    const items = rawItems.map((item) => ({
      ...item,
      product_id: item?.product_id || item?.productId || item?.product?.id || item?.id,
      quantity: Number(item?.quantity ?? item?.qty ?? 1)
    }))
    const productsData = []

    for (const item of items) {
      if (!item.product_id) continue

      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .single()

      if (productData) {
        productsData.push({
          ...productData,
          quantity: item.quantity || 1,
          subtotal: (productData.price || 0) * (item.quantity || 1)
        })
      }

      if (!item.slab && item.product_id) {
        const { data: slabs } = await supabase
          .from('product_slabs')
          .select('*')
          .eq('product_id', item.product_id)
          .order('min_quantity', { ascending: false })

        const orderDate = new Date(orderData.created_at || Date.now())
        item.slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], item.quantity, orderDate)
      }
    }
    
    // Owner/Company details
    const ownerDetails = {
      name: 'Ashirwad Enterprises',
      gst: 'GJKLJW23NJ128JH',
      contact: '6204938006',
      email: 'info@ashirwadenterprises.com',
      address: 'Gujarat, India'
    }

    // Get offer title if applicable
    let offerTitle = null
    if (orderData.offer_id) {
      try {
        const { data: offerRow } = await supabase
          .from('offers')
          .select('title')
          .eq('id', orderData.offer_id)
          .single()
      } catch (err) {
        offerTitle = null
      }
    }

    // Calculate totals with 5% GST - matching server.js logic exactly
    const gstRate = 0.05
    const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

    const rawSubtotal = productsData.reduce((sum, p) => sum + (p.subtotal || 0), 0)
    const orderTotal = Number(orderData.total_amount || 0)

    const storedSubtotal = Number(orderData.subtotal || 0)
    const storedDiscount = Number(orderData.discount_total || 0)
    const storedCouponDiscount = Number(orderData.coupon_discount || 0)
    const storedOfferDiscount = Number(orderData.offer_discount || 0)
    const storedSlabDiscount = Number(orderData.Slab_discount || orderData.slab_discount || 0)
    const storedShipping = Number(orderData.shipping_fee || 0)
    const storedGst = Number(orderData.gst_amount || 0)

    const subtotal = round2(storedSubtotal > 0 ? storedSubtotal : rawSubtotal)
    const couponDiscount = round2(storedCouponDiscount > 0 ? storedCouponDiscount : 0)
    const offerDiscount = round2(storedOfferDiscount > 0 ? storedOfferDiscount : 0)
    const slabDiscountFromColumn = round2(storedSlabDiscount > 0 ? storedSlabDiscount : 0)
    let discountTotal = round2(storedDiscount > 0 ? storedDiscount : (couponDiscount + offerDiscount + slabDiscountFromColumn))

    if (discountTotal < couponDiscount + offerDiscount + slabDiscountFromColumn) {
      discountTotal = round2(couponDiscount + offerDiscount + slabDiscountFromColumn)
    }

    let shippingFee = round2(Number.isFinite(storedShipping) ? storedShipping : 0)
    let gstAmount = round2(storedGst > 0 ? storedGst : 0)

    if (!storedDiscount && !storedShipping && !storedGst && orderTotal > 0) {
      const candidates = [0, 500]
      let inferred = false

      for (const candidateShipping of candidates) {
        const baseBeforeGst = (orderTotal - candidateShipping) / (1 + gstRate)
        const inferredDiscount = subtotal - baseBeforeGst
        if (inferredDiscount >= -0.01 && inferredDiscount <= subtotal + 0.01) {
          discountTotal = round2(Math.max(0, inferredDiscount))
          shippingFee = round2(candidateShipping)
          inferred = true
          break
        }
      }

      if (!inferred) {
        discountTotal = 0
        shippingFee = round2(Math.max(0, orderTotal - subtotal - (subtotal * gstRate)))
      }

      gstAmount = round2(Math.max(0, (subtotal - discountTotal) * gstRate))
    } else if (!storedGst) {
      gstAmount = round2(Math.max(0, (subtotal - discountTotal) * gstRate))
    }

    let expectedTotal = round2(subtotal - discountTotal + shippingFee + gstAmount)
    let totalWithGST = orderTotal > 0 ? round2(orderTotal) : expectedTotal

    if (orderTotal > 0 && Math.abs(totalWithGST - expectedTotal) > 0.01) {
      gstAmount = round2(Math.max(0, totalWithGST - (subtotal - discountTotal + shippingFee)))
      expectedTotal = round2(subtotal - discountTotal + shippingFee + gstAmount)
    }

    const subtotalAfterDiscount = round2(Math.max(0, subtotal - discountTotal))

    const couponLabel = orderData.coupon_code ? `Coupon Discount (${orderData.coupon_code})` : 'Coupon Discount'
    const offerLabel = offerTitle ? `Offer Discount (${offerTitle})` : 'Offer Discount'

    let displayCouponDiscount = couponDiscount
    let displayOfferDiscount = offerDiscount
    if (discountTotal > 0 && displayCouponDiscount <= 0 && displayOfferDiscount <= 0) {
      if (orderData.coupon_code) {
        displayCouponDiscount = discountTotal
      } else if (orderData.offer_id) {
        displayOfferDiscount = discountTotal
      }
    }

    let slabDiscount = slabDiscountFromColumn > 0
      ? slabDiscountFromColumn
      : round2(Math.max(0, discountTotal - displayCouponDiscount - displayOfferDiscount))
    let totalSavings = round2(slabDiscount + displayOfferDiscount + displayCouponDiscount)

    if (Math.abs(totalSavings - discountTotal) > 0.01) {
      slabDiscount = round2(Math.max(0, slabDiscount + (discountTotal - totalSavings)))
      totalSavings = round2(slabDiscount + displayOfferDiscount + displayCouponDiscount)
    }

    const productMap = new Map(productsData.map((p) => [String(p.id), p]))
    const slabDetails = []

    for (const item of items) {
      const quantity = Number(item?.quantity ?? item?.qty ?? 0)
      if (quantity <= 0) continue

      const productId = item?.product_id || item?.productId || item?.product?.id || item?.id
      const productNameHint = item?.product?.name || item?.name || item?.product_name || null
      let product = productMap.get(String(productId))

      if (!product && productNameHint) {
        product = productsData.find((entry) => String(entry.name || '').toLowerCase() === String(productNameHint).toLowerCase()) || null
      }

      const productName = product?.name || productNameHint || 'Product'
      const productPrice = Number(product?.price || item?.price || item?.product?.price || 0)

      let slab = item?.slab || null
      const resolvedProductId = product?.id || productId
      if (!slab && resolvedProductId) {
        const { data: slabs } = await supabase
          .from('product_slabs')
          .select('*')
          .eq('product_id', resolvedProductId)
          .order('min_quantity', { ascending: false })

        slab = resolveApplicableSlab(Array.isArray(slabs) ? slabs : [], quantity, new Date(orderData.created_at || Date.now()))
      }

      if (!slab) continue

      const minQty = Number(slab.min_quantity || 0)
      if (!minQty || quantity < minQty) continue

      let detailAmount = round2(Number(item?.slab_discount || 0))
      if (detailAmount <= 0) {
        detailAmount = round2(calculateSlabDiscountAmount({ price: productPrice, quantity, slab }))
      }

      if (detailAmount <= 0) continue

      slabDetails.push({
        name: productName,
        qty: quantity,
        minQty,
        discountLabel: slab.discount_type === 'percent'
          ? `${Number(slab.discount_value || 0)}%`
          : `Rs${Number(slab.discount_value || 0).toFixed(2)}`,
        ruleText: formatSlabRuleText(slab),
        amount: detailAmount
      })
    }

    if (slabDiscount > 0 && slabDetails.length === 0) {
      for (const item of items) {
        const quantity = Number(item?.quantity ?? item?.qty ?? 0)
        if (quantity <= 0) continue

        const productId = item?.product_id || item?.productId || item?.product?.id || item?.id
        const productNameHint = item?.product?.name || item?.name || item?.product_name || null
        const product = productMap.get(String(productId))
          || productsData.find((entry) => String(entry.name || '').toLowerCase() === String(productNameHint || '').toLowerCase())
          || null

        const amount = round2(Number(item?.slab_discount || 0))
        if (amount <= 0) continue

        slabDetails.push({
          name: product?.name || productNameHint || 'Product',
          qty: quantity,
          minQty: Number(item?.slab?.min_quantity || 0) || null,
          discountLabel: item?.slab?.discount_type === 'percent'
            ? `${Number(item?.slab?.discount_value || 0)}%`
            : item?.slab
              ? `Rs${Number(item.slab.discount_value || 0).toFixed(2)}`
              : null,
          ruleText: item?.slab ? formatSlabRuleText(item.slab) : `Rs${amount.toFixed(2)} slab applied`,
          amount
        })
      }

      if (slabDetails.length === 0) {
        slabDetails.push({
          name: 'Slab Discount',
          qty: null,
          minQty: null,
          discountLabel: null,
          ruleText: 'Applied on eligible quantities',
          amount: slabDiscount
        })
      }
    }

    // Create PDF matching HTML format
    const doc = new PDFDocument({ size: 'A4', margin: 20 })
    const chunks = []
    
    return await new Promise((resolve, reject) => {
      doc.on('data', (d) => chunks.push(d))
      doc.on('error', reject)
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      
      const rupee = (n) => `Rs${Number(n || 0).toFixed(2)}`
      
      // Header Box (2px border)
      const margin = 20
      const pageWidth = doc.page.width - (margin * 2)
      
      doc.lineWidth(2)
      doc.rect(margin, margin, pageWidth, 60).stroke('#000000')
      
      // Company name (left) and Invoice details (right)
      doc.font('Courier-Bold').fontSize(14).fillColor('#000000')
      doc.text(ownerDetails.name, margin + 10, margin + 15, { width: pageWidth / 2 })
      
      doc.font('Courier-Bold').fontSize(10)
      const invoiceX = margin + pageWidth - 150
      doc.text(`INVOICE #${orderId.slice(0, 8).toUpperCase()}`, invoiceX, margin + 12, { align: 'right', width: 140 })
      doc.font('Courier').fontSize(9)
      doc.text(new Date(orderData.created_at).toLocaleDateString('en-IN'), invoiceX, margin + 27, { align: 'right', width: 140 })
      doc.text(`Status: ${orderData.status}`, invoiceX, margin + 40, { align: 'right', width: 140 })
      
      // Info Box (1px border, 3 columns)
      const infoY = margin + 60 + 10
      doc.lineWidth(1)
      doc.rect(margin, infoY, pageWidth, 70).stroke('#000000')
      
      const col1X = margin + 10
      const col2X = margin + (pageWidth / 3)
      const col3X = margin + (2 * pageWidth / 3)
      
      // Column 1: Seller Details
      doc.font('Courier-Bold').fontSize(9).text('SELLER DETAILS', col1X, infoY + 5)
      doc.font('Courier-Bold').fontSize(10).text(ownerDetails.name, col1X, infoY + 18)
      doc.font('Courier').fontSize(9)
      doc.text(`GST: ${ownerDetails.gst}`, col1X, infoY + 30)
      doc.text(`Phone: ${ownerDetails.contact}`, col1X, infoY + 40)
      doc.text(`Email: ${ownerDetails.email}`, col1X, infoY + 50)
      doc.text(`Location: ${ownerDetails.address}`, col1X, infoY + 60)
      
      // Column 2: Bill To
      doc.font('Courier-Bold').fontSize(9).text('BILL TO', col2X + 5, infoY + 5)
      doc.font('Courier-Bold').fontSize(10).text(userData?.full_name || 'Customer', col2X + 5, infoY + 18)
      doc.font('Courier').fontSize(9)
      doc.text(`Email: ${userData?.email || 'N/A'}`, col2X + 5, infoY + 30)
      doc.text(`Phone: ${userData?.phone || 'N/A'}`, col2X + 5, infoY + 42)
      
      // Column 3: Order Info
      doc.font('Courier-Bold').fontSize(9).text('ORDER INFO', col3X + 5, infoY + 5)
      doc.font('Courier').fontSize(9)
      doc.text(`Order Date: ${new Date(orderData.created_at).toLocaleDateString('en-IN')}`, col3X + 5, infoY + 18)
      doc.text(`Order ID: ${orderId.slice(0, 8)}`, col3X + 5, infoY + 30)
      doc.text(`Items: ${items.length}`, col3X + 5, infoY + 42)
      doc.text(`Status: ${orderData.status}`, col3X + 5, infoY + 54)
      
      // Products Table
      const tableY = infoY + 70 + 15
      doc.lineWidth(1)
      doc.rect(margin, tableY, pageWidth, 25).stroke('#000000')
      
      // Table header with gray background
      doc.rect(margin, tableY, pageWidth, 25).fill('#f5f5f5')
      doc.fillColor('#000000').font('Courier-Bold').fontSize(10)
      doc.text('Item Description', margin + 10, tableY + 8, { width: pageWidth * 0.4 })
      doc.text('Qty', margin + (pageWidth * 0.5), tableY + 8, { width: pageWidth * 0.1, align: 'center' })
      doc.text('Unit Price', margin + (pageWidth * 0.65), tableY + 8, { width: pageWidth * 0.15, align: 'right' })
      doc.text('Amount (Rs)', margin + (pageWidth * 0.82), tableY + 8, { width: pageWidth * 0.15, align: 'right' })
      
      // Table rows
      let currentY = tableY + 25
      doc.font('Courier').fontSize(9)
      
      productsData.forEach((product, idx) => {
        const isLast = idx === productsData.length - 1
        doc.lineWidth(isLast ? 2 : 1)
        doc.rect(margin, currentY, pageWidth, 22).stroke('#000000')
        
        doc.text(product.name, margin + 10, currentY + 6, { width: pageWidth * 0.38 })
        if (product.description) {
          doc.fontSize(8).fillColor('#666666')
          doc.text(product.description.substring(0, 40), margin + 10, currentY + 16, { width: pageWidth * 0.38 })
          doc.fillColor('#000000').fontSize(9)
        }
        doc.text(product.quantity.toString(), margin + (pageWidth * 0.5), currentY + 6, { width: pageWidth * 0.1, align: 'center' })
        doc.text(rupee(product.price), margin + (pageWidth * 0.65), currentY + 6, { width: pageWidth * 0.15, align: 'right' })
        doc.font('Courier-Bold').text(rupee(product.subtotal), margin + (pageWidth * 0.82), currentY + 6, { width: pageWidth * 0.15, align: 'right' })
        doc.font('Courier')
        
        currentY += 22
      })
      
      // Totals Box
      const totalsY = currentY + 15
      const slabDetailsExtraHeight = slabDetails.length > 0 ? (12 + slabDetails.length * 10) : 0
      const totalsBoxHeight = 190 + slabDetailsExtraHeight
      doc.lineWidth(1)
      doc.rect(margin, totalsY, pageWidth, totalsBoxHeight).stroke('#000000')
      
      let totalsLineY = totalsY + 10
      doc.font('Courier').fontSize(10)
      
      // Subtotal
      doc.text('Subtotal:', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
      doc.text(rupee(subtotal), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
      totalsLineY += 15
      
      doc.text('Slab Discount:', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
      doc.text('-' + rupee(slabDiscount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
      totalsLineY += 15

      if (slabDetails.length > 0) {
        doc.fontSize(8).fillColor('#334155')
        doc.text('Slab Discount Details:', margin + 18, totalsLineY, { width: pageWidth * 0.65 })
        totalsLineY += 10

        for (const detail of slabDetails) {
          const qtyLabel = detail.qty ? `Qty: ${detail.qty}` : 'Eligible Qty'
          const detailText = `${detail.name} (${qtyLabel}) - ${detail.ruleText}`
          const compactText = detailText.length > 78 ? `${detailText.slice(0, 75)}...` : detailText

          doc.text(`• ${compactText}`, margin + 22, totalsLineY, { width: pageWidth * 0.62 })
          doc.text('-' + rupee(detail.amount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
          totalsLineY += 10
        }

        doc.fillColor('#000000').fontSize(10)
      }

      // Show offer discount
      if (displayOfferDiscount > 0) {
        doc.text(offerLabel + ':', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
        doc.text('-' + rupee(displayOfferDiscount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
        totalsLineY += 15
      }

      // Show coupon discount
      if (displayCouponDiscount > 0) {
        doc.text(couponLabel + ':', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
        doc.text('-' + rupee(displayCouponDiscount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
        totalsLineY += 15
      }

      if (totalSavings > 0) {
        doc.text('Total Savings:', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
        doc.text('-' + rupee(totalSavings), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
        totalsLineY += 15

        doc.text('Subtotal after discount:', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
        doc.text(rupee(subtotalAfterDiscount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
        totalsLineY += 15
      }
      
      // Shipping
      doc.text('Shipping:', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
      doc.text(rupee(shippingFee), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
      totalsLineY += 15
      
      // GST
      doc.text('GST (5%):', margin + 10, totalsLineY, { width: pageWidth * 0.7 })
      doc.text(rupee(gstAmount), margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
      totalsLineY += 15

      doc.fontSize(8)
      doc.text('* GST applied on products only, not on shipping', margin + 10, totalsLineY, { width: pageWidth - 20 })
      doc.fontSize(10)
      totalsLineY += 14
      
      // Divider line
      doc.moveTo(margin + 10, totalsLineY).lineTo(margin + pageWidth - 10, totalsLineY).stroke('#000000')
      totalsLineY += 10
      
      // Final total box
      doc.lineWidth(1)
      doc.rect(margin + 10, totalsLineY, pageWidth - 20, 28).fill('#f9f9f9')
      doc.rect(margin + 10, totalsLineY, pageWidth - 20, 28).stroke('#000000')
      doc.fillColor('#000000').font('Courier-Bold').fontSize(11)
      doc.text('INVOICE TOTAL:', margin + 20, totalsLineY + 9, { width: pageWidth * 0.6 })
      doc.text(rupee(totalWithGST), margin + 20, totalsLineY + 9, { width: pageWidth - 40, align: 'right' })
      
      totalsLineY += 35
      doc.font('Courier').fontSize(9)
      doc.text(`Total GST (5%): ${rupee(gstAmount)}`, margin + 10, totalsLineY, { width: pageWidth - 20, align: 'right' })
      
      // Footer Box
      const footerY = totalsY + totalsBoxHeight + 10
      doc.lineWidth(1)
      doc.rect(margin, footerY, pageWidth, 50).stroke('#000000')
      
      doc.font('Courier').fontSize(8).fillColor('#000000')
      doc.text('* This is an electronically generated invoice and is valid without signature or seal', margin + 10, footerY + 6, { width: pageWidth - 20, align: 'center' })
      doc.text(`* For any queries, please contact ${ownerDetails.name} at ${ownerDetails.contact}`, margin + 10, footerY + 18, { width: pageWidth - 20, align: 'center' })
      doc.text('* All amounts in Indian Rupees (Rs)', margin + 10, footerY + 30, { width: pageWidth - 20, align: 'center' })
      
      // Bottom line with generation info
      doc.moveTo(margin + 10, footerY + 42).lineTo(margin + pageWidth - 10, footerY + 42).stroke('#000000')
      doc.fontSize(7)
      doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')} | © ${ownerDetails.name}`, 
        margin + 10, footerY + 45, { width: pageWidth - 20, align: 'center' })
      
      doc.end()
    })
  } catch (error) {
    console.error('Bill PDF generation error:', error)
    throw error
  }
}
