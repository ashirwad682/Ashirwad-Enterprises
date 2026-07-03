# Responsive Route-by-Route QA Sheet

Date: 16 March 2026
Owner: QA / Frontend
Status: Ready for execution

## 1) Test matrix

Use these viewport sizes for every route:
- 390 x 844 (mobile portrait)
- 768 x 1024 (tablet portrait)
- 1024 x 768 (tablet landscape / small laptop)

Recommended browsers:
- Chrome (latest)
- Safari (latest)

## 2) Universal pass criteria (applies to every route)

- No horizontal body scroll.
- No clipped text, buttons, cards, or modals.
- Header, sticky elements, and overlays do not overlap content incorrectly.
- Inputs, selects, and action buttons remain fully visible and tappable.
- Long text wraps instead of forcing layout overflow.
- Console has no new runtime errors during route navigation and resize.

## 3) Route-by-route sheet

Mark each row as Pass or Fail at all 3 breakpoints.

| Route | Main focus | Explicit expected result |
|---|---|---|
| / | Landing page hero, sections, navbar/footer | Hero content stacks cleanly on 390; section cards reflow without overlap; navbar and footer links stay readable and tappable at all sizes. |
| /about | Content sections and typography | Long paragraphs wrap naturally; no section card overflow; heading hierarchy remains readable at 390/768/1024. |
| /contact | Contact form and information blocks | Form fields stay full-width on small screens; submit button remains visible; no clipping in contact cards/info panel. |
| /privacy-policy | Long legal content layout | Text column keeps readable line length; no horizontal scroll from headings or lists; spacing remains consistent. |
| /terms-conditions | Long legal content layout | Same behavior as privacy page: no overflow, readable spacing, and stable scroll behavior. |
| /support/ticket | Ticket form and attachments area | Form controls stack on mobile; attachment UI does not break width; submit area remains visible and tappable. |
| /support/chat | Chat UI and side panels | Chat messages wrap correctly; input bar remains anchored and visible; side controls collapse/stack on smaller widths. |
| /auth-debug | Debug panel readability | Debug blocks and keys wrap without overflow; copy/actions remain accessible at 390. |
| /login | Authentication form | Inputs and buttons fit container at all breakpoints; helper links remain visible; no modal/form cutoff. |
| /register | Registration form with multiple fields | Multi-field rows collapse to single column on smaller widths; validation text stays in-bounds. |
| /reset-password | Password reset form | All controls remain visible in viewport; password fields and action buttons align and wrap safely. |
| /profile | Standalone protected profile page | Profile cards and editable fields stack cleanly; no horizontal overflow in info rows or uploads. |
| /dashboard/home | User home cards and overview blocks | Stats/overview cards wrap from multi-column to single-column smoothly; no card text truncation. |
| /dashboard/products | Product list, filters, modal, slab controls | Filter/sort area stacks on mobile; sidebar collapses under content; product cards reflow; product modal fits viewport; slab quantity controls wrap cleanly. |
| /dashboard/orders | User order history list/cards | Order cards stack safely; long order IDs/status text wrap; action links remain tappable. |
| /dashboard/track | Tracking timeline / tracking widgets | Timeline and status widgets remain readable; no compressed or overlapped labels at 390. |
| /dashboard/track-order | Alternate tracking entry route | Same expected behavior as /dashboard/track with no additional overflow or clipping. |
| /dashboard/analytics | Charts and KPI blocks | Charts remain inside cards; legends and labels wrap; KPI tiles do not overflow on mobile/tablet. |
| /dashboard/order-success | Confirmation summary and action buttons | Summary block remains centered; totals and details wrap; CTA buttons remain fully visible on small screens. |
| /dashboard/cart | Cart item cards and totals panel | Each cart row stacks correctly on 390; quantity controls remain aligned; totals section and checkout button remain visible and do not overflow. |
| /dashboard/profile | In-dashboard profile page | Profile forms/cards are responsive and remain readable; no clipping in address/document rows. |
| /dashboard/notifications | Notification list/cards | Notification cards and filters stack without overlap; long titles/messages wrap safely. |
| /dashboard/checkout | Checkout main flow and summary | Main layout becomes single-column at <=1024; address rows collapse safely; coupon row stacks on mobile; summary panel is non-sticky on smaller widths and fully readable. |
| /admin/login | Admin login form | Form remains centered and fully visible; no overflow in logo/header area at small widths. |
| /admin | Admin login alias route | Same behavior as /admin/login. |
| /admin/dashboard | Admin shell and dashboard landing | Header controls remain accessible (scroll/wrap as needed); hero and stat cards reflow; recent transactions and distribution blocks stack without clipping. |
| /delivery-login | Delivery login form | Form fields and actions stay fully visible/tappable at all breakpoints. |
| /delivery-reset-password | Delivery password reset page | Reset fields and submit controls reflow cleanly with no overflow. |
| /delivery-dashboard | Delivery partner dashboard | Dashboard cards/tables remain usable on mobile; action buttons and filters do not clip. |
| /delevery | Delivery dashboard alias route | Must render same responsive behavior as /delivery-dashboard. |
| /warehouse-login | Warehouse login form | Form remains usable at all 3 breakpoints with no overlap. |
| /warehouse | Warehouse dashboard route | Warehouse dashboard widgets and tables remain inside viewport; no body overflow. |
| /warehouse-dashboard | Warehouse dashboard alias route | Same expected behavior as /warehouse. |
| /manager-login | Manager login form | Form fields/buttons remain fully visible and readable on mobile/tablet. |
| /manager-password-reset | Manager reset flow | Reset form stays in-bounds; helper text wraps cleanly. |
| /manager-personal-email-verify | Manager email verification UI | Verification messages, action buttons, and status blocks remain readable on small screens. |
| /manager-dashboard | Manager shell and dashboard landing | Header controls remain usable without clipping; welcome panel scales down cleanly; quick tiles collapse from wide grid to 2-column/tablet and 1-column/mobile where needed. |

## 4) In-route tab checks (same URL, tab-driven pages)

These are mandatory within /admin/dashboard and /manager-dashboard because major responsiveness changes were tab-level.

| Route + tab | Explicit expected result |
|---|---|
| /admin/dashboard -> Orders tab | Filter chips/cards wrap; order card right action column stacks on tablet/mobile; partner/warehouse selects use available width and do not force horizontal page scroll. |
| /admin/dashboard -> Products tab | Product editor switches to single-column on smaller widths; pricing and inventory field rows collapse cleanly; inventory table remains usable with internal horizontal scroll if needed. |
| /admin/dashboard -> Transactions and Revenue tab | Summary and payment split cards auto-fit; filter area stacks with full-width inputs/selects; transaction table remains readable with controlled internal scroll. |
| /admin/dashboard -> Notifications tab | Compose form two-column groups collapse to auto-fit/single-column on small widths; no clipping in toggle/settings blocks. |
| /admin/dashboard -> Coupons tab | Coupon form grids collapse safely; coupon cards/actions do not overflow and remain tappable. |
| /admin/dashboard -> Delivery Attendance tab | Filter bar wraps; partner select does not force overflow; table and KPI blocks remain readable on mobile/tablet. |
| /manager-dashboard -> Orders tab | Same responsive behavior as admin Orders tab for filters, cards, and assignment controls. |
| /manager-dashboard -> Products tab | Same responsive behavior as admin Products tab for editor and inventory listing. |
| /manager-dashboard -> Transactions and Revenue tab | Summary/filter/table sections remain readable and stack appropriately on mobile/tablet. |
| /manager-dashboard -> Notifications tab | Compose/preview areas and controls remain fully visible and non-overlapping at all breakpoints. |

## 5) Execution log template

Use this table during run execution.

| Route or tab | 390 result | 768 result | 1024 result | Pass/Fail | Notes and screenshot ref |
|---|---|---|---|---|---|
| Example: /dashboard/products | Pass | Pass | Pass | Pass | No overflow in filter row |

## 6) Final sign-off criteria

Release can be marked responsive-complete when:
- All rows in sections 3 and 4 are Pass at 390, 768, and 1024.
- No critical or high visual defects remain open.
- No new runtime errors are observed during navigation and viewport changes.
