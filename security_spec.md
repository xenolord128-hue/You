# Security Specification — PYTHOX WORLD Firestore Rules

## 1. Data Invariants
1. Public storefront visitors can read (`get`, `list`) ONLY products where `status == 'Published'`; unpublished/draft products are readable strictly by verified admins (`isAdmin()`).
2. Store catalog mutations (`products`, `categories`, `collections`, `coupons`, `settings`) are strictly restricted to verified admins (`isAdmin()`).
3. Customer orders (`/orders/{orderId}`) contain PII (`customerName`, `customerEmail`, `customerPhone`, `address`) and are NEVER readable or listable by anonymous or non-owner users; only `isAdmin()` or the authenticated order owner (`userId == request.auth.uid`) can read them.
4. Order creation must initialize `status == 'Order Received'` and `paymentStatus == 'Pending'` (non-admin callers cannot forge `'Delivered'` or `'Paid'` states or inject unapproved keys).
5. Guest order tracking uses a split non-PII collection (`/order_tracking/{trackingId}`) where `allow list: if false;` prevents enumeration and `allow get` returns only non-PII status fields.
6. Reviews require strict field bounds (`rating` 1..5, `comment` 1..1000, `authorName` 1..80) and reject ghost fields.
7. Every single-document ID path variable must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length 1..128).
8. Email-based admin bootstrap strictly requires `request.auth.token.email_verified == true`.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Product Create**: Anonymous user attempts `setDoc(/products/p1, { ... })`.
2. **Ghost Field Shadow Injection on Product**: User with invalid/extra field `isVerified: true` writes to `/products/p1`.
3. **Oversized Poisoned Document ID**: Attacker attempts write to `/products/<1500-char-id>`.
4. **Read Unpublished Draft Product**: Unauthenticated user calls `getDoc(/products/draft-1)` where `status == 'Draft'`.
5. **List Draft Products**: Unauthenticated user queries `/products` without `where('status', '==', 'Published')`.
6. **PII Order Scrape (`list`)**: Unauthenticated or non-admin user queries `/orders`.
7. **PII Order Read (`get`)**: User B attempts `getDoc(/orders/userA-order)` containing PII.
8. **Forge Order Payment Status on Create**: Customer submits order with `paymentStatus: 'Paid'` or `status: 'Delivered'`.
9. **Unauthorized Order Update**: Customer attempts `updateDoc(/orders/ord1, { status: 'Delivered' })`.
10. **Order Tracking Enumeration (`list`)**: Attacker queries `/order_tracking` to scrape order numbers.
11. **Unverified Admin Email Spoof**: User with `email: 'lord79915@gmail.com'` and `email_verified: false` attempts admin write.
12. **Self-Assigned Admin Role Escalation**: Non-admin user attempts `setDoc(/admins/myUid, { email: '...', role: 'admin' })`.
