// Phase 0 Security Specification Reference Tests for PYTHOX WORLD Firestore Rules
// Verifies the 12 Dirty Dozen attack payloads documented in security_spec.md.

export interface SecurityTestCase {
  id: string;
  title: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Unauthenticated Product Create',
    collectionPath: '/products/prod-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'prod-1', name: 'Tee', status: 'Published' },
  },
  {
    id: 'DD-02',
    title: 'Ghost Field Shadow Injection on Product',
    collectionPath: '/products/prod-1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'prod-1', isVerified: true, status: 'Published' },
  },
  {
    id: 'DD-03',
    title: 'Oversized Poisoned Document ID',
    collectionPath: `/products/${'a'.repeat(200)}`,
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Public Get on Unpublished Draft Product',
    collectionPath: '/products/draft-1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Unfiltered Public List on Products',
    collectionPath: '/products',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'PII Order Collection List Scrape',
    collectionPath: '/orders',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'PII Order Cross-User Read',
    collectionPath: '/orders/ord-victim',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'Forged Paid Order Create',
    collectionPath: '/orders/ord-forged',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { id: 'ord-forged', status: 'Delivered', paymentStatus: 'Paid' },
  },
  {
    id: 'DD-09',
    title: 'Unauthorized Order Status Update',
    collectionPath: '/orders/ord-1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'Delivered' },
  },
  {
    id: 'DD-10',
    title: 'Order Tracking List Enumeration',
    collectionPath: '/order_tracking',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Unverified Email Admin Spoof',
    collectionPath: '/settings/store_config',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Self-Assigned Admin Role Escalation',
    collectionPath: '/admins/attacker-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { email: 'attacker@example.com', role: 'admin' },
  },
];
