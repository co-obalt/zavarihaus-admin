const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@zavarihaus.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin1234';

const request = async (path, init = {}) => {
  const res = await fetch(`${API_BASE}${path}`, init);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
};

const run = async () => {
  console.log('Starting automated proof upload and sync integration tests...');

  // 1. Authenticate
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!login.res.ok) {
    throw new Error(`Login failed (${login.res.status}): ${login.text}`);
  }
  const token = login.body.token;
  console.log('✓ Successfully authenticated.');

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 2. Upload Proof
  const stamp = Date.now();
  const proofId = `PF-TST-${stamp}`;
  const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadPayload = {
    id: proofId,
    name: 'test_dot.png',
    mimeType: 'image/png',
    size: 68,
    dataUrl: testBase64
  };

  const uploadRes = await request('/api/proofs', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(uploadPayload),
  });
  if (!uploadRes.res.ok) {
    throw new Error(`Proof upload failed: ${uploadRes.text}`);
  }
  console.log('✓ Successfully uploaded proof file.');

  // 3. Download Proof - Authorized with Header
  const downloadResHeader = await request(`/api/proofs/${proofId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!downloadResHeader.res.ok) {
    throw new Error(`Authorized download (header) failed: ${downloadResHeader.text}`);
  }
  if (downloadResHeader.res.headers.get('Content-Type') !== 'image/png') {
    throw new Error(`Content-Type mismatch: got ${downloadResHeader.res.headers.get('Content-Type')}`);
  }
  console.log('✓ Successfully retrieved proof via Authorization header.');

  // 4. Download Proof - Authorized with Query Token
  const downloadResQuery = await request(`/api/proofs/${proofId}?token=${encodeURIComponent(token)}`);
  if (!downloadResQuery.res.ok) {
    throw new Error(`Authorized download (query param) failed: ${downloadResQuery.text}`);
  }
  console.log('✓ Successfully retrieved proof via query parameter token.');

  // 5. Download Proof - Unauthorized
  const unauthorizedRes = await request(`/api/proofs/${proofId}`);
  if (unauthorizedRes.res.status !== 401) {
    throw new Error(`Unauthorized download returned status ${unauthorizedRes.res.status} instead of 401`);
  }
  console.log('✓ Successfully blocked unauthorized download requests.');

  // 6. Test Sync with Active Proof reference
  const expenseId = `TST-EXP-${stamp}`;
  const syncPayload = {
    expenses: [
      {
        id: expenseId,
        title: 'Integration Test Expense',
        category: 'maintenance',
        amount: 500,
        date: new Date().toISOString().slice(0, 10),
        status: 'paid',
        proofs: [
          {
            id: proofId,
            name: 'test_dot.png',
            mimeType: 'image/png',
            size: 68,
            dataUrl: `/api/proofs/${proofId}`
          }
        ]
      }
    ]
  };

  const syncRes = await request('/api/sync', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(syncPayload),
  });
  if (!syncRes.res.ok) {
    throw new Error(`State sync failed: ${syncRes.text}`);
  }
  console.log('✓ Successfully completed sync containing active proof.');

  // 7. Verify Proof row is retained in DB
  const verifyRes = await request(`/api/proofs/${proofId}?token=${encodeURIComponent(token)}`);
  if (!verifyRes.res.ok) {
    throw new Error(`Verification download failed after sync: ${verifyRes.text}`);
  }
  console.log('✓ Verified proof row is retained in the database.');

  // 8. Test Garbage Collection - Sync without referencing proof ID
  const emptySyncPayload = { expenses: [] };
  const gcRes = await request('/api/sync', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(emptySyncPayload),
  });
  if (!gcRes.res.ok) {
    throw new Error(`Garbage collection sync failed: ${gcRes.text}`);
  }
  console.log('✓ Successfully completed empty sync to trigger garbage collection.');

  // 9. Verify Proof row is deleted from DB
  const deletedRes = await request(`/api/proofs/${proofId}?token=${encodeURIComponent(token)}`);
  if (deletedRes.res.status !== 404) {
    throw new Error(`Proof was not deleted by garbage collection (status: ${deletedRes.res.status})`);
  }
  console.log('✓ Verified proof row was successfully garbage-collected from the database.');

  console.log('\nAll API integration tests passed successfully!');
};

run().catch((error) => {
  console.error('\nIntegration test failed:');
  console.error(error.message || error);
  process.exit(1);
});
