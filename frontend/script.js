/**
 * WalletPay — Frontend Application Logic
 * Modern, reactive client communicating with Python Flask APIs.
 */

// Determine API Base URL
const API_BASE = (window.location.protocol.startsWith('http')) 
  ? window.location.origin 
  : 'http://127.0.0.1:5001';

let currentUserId = 'U001';
let userProfiles = {};

// DOM Elements
const viewUserSelect = document.getElementById('viewUserSelect');
const senderSelect = document.getElementById('senderSelect');
const receiverSelect = document.getElementById('receiverSelect');
const transferAmountInput = document.getElementById('transferAmount');
const transactionIdInput = document.getElementById('transactionIdInput');
const transferForm = document.getElementById('transferForm');
const regenerateTxnBtn = document.getElementById('regenerateTxnBtn');
const refreshBtn = document.getElementById('refreshBtn');
const resetDemoBtn = document.getElementById('resetDemoBtn');
const notificationArea = document.getElementById('notificationArea');
const transactionTableBody = document.getElementById('transactionTableBody');
const accountsOverviewContainer = document.getElementById('accountsOverviewContainer');

// Section D Elements
const runTestsBtn = document.getElementById('runTestsBtn');
const testTotalCount = document.getElementById('testTotalCount');
const testPassedCount = document.getElementById('testPassedCount');
const testFailedCount = document.getElementById('testFailedCount');
const lastRunTime = document.getElementById('lastRunTime');

// Modal Elements
const openAddUserBtn = document.getElementById('openAddUserBtn');
const closeAddUserModal = document.getElementById('closeAddUserModal');
const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
const addUserModal = document.getElementById('addUserModal');
const addUserForm = document.getElementById('addUserForm');

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  generateNewTransactionId();
  loadAllUsersAndData();

  // Event Listeners
  viewUserSelect.addEventListener('change', (e) => switchUser(e.target.value));
  regenerateTxnBtn.addEventListener('click', generateNewTransactionId);
  refreshBtn.addEventListener('click', () => {
    loadAllUsersAndData();
    showNotification('Wallet data refreshed successfully.', 'success');
  });

  senderSelect.addEventListener('change', () => {
    if (senderSelect.value === receiverSelect.value) {
      const otherId = Object.keys(userProfiles).find(id => id !== senderSelect.value);
      if (otherId) receiverSelect.value = otherId;
    }
    switchUser(senderSelect.value);
  });

  transferForm.addEventListener('submit', handleTransferSubmit);

  if (resetDemoBtn) {
    resetDemoBtn.addEventListener('click', handleResetDemo);
  }

  // Section D Test Button
  if (runTestsBtn) {
    runTestsBtn.addEventListener('click', handleRunApiTests);
  }

  if (refreshTestStatsBtn) {
    refreshTestStatsBtn.addEventListener('click', () => {
      fetchTestSummary(true);
      showNotification('Test statistics refreshed from latest report.', 'success');
    });
  }

  // Modal Listeners
  if (openAddUserBtn) openAddUserBtn.addEventListener('click', () => addUserModal.classList.remove('hidden'));
  if (closeAddUserModal) closeAddUserModal.addEventListener('click', () => addUserModal.classList.add('hidden'));
  if (cancelAddUserBtn) cancelAddUserBtn.addEventListener('click', () => addUserModal.classList.add('hidden'));
  if (addUserForm) addUserForm.addEventListener('submit', handleAddUserSubmit);
});

/**
 * Generate a clean, unique transaction ID: TXN_XXXXXXXX
 */
function generateNewTransactionId() {
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const txnId = `TXN_${Date.now().toString().slice(-6)}${randomSuffix}`;
  transactionIdInput.value = txnId;
}

/**
 * Load all registered users from backend and populate dropdowns & cards
 */
async function loadAllUsersAndData() {
  try {
    const res = await fetch(`${API_BASE}/api/users?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const users = await res.json();

    userProfiles = {};
    users.forEach(u => {
      userProfiles[u.user_id] = {
        name: u.name,
        balance: u.balance_rupees,
        balance_paise: u.balance_paise
      };
    });

    // Populate dropdowns
    updateUserDropdowns();

    // Render overview pills
    renderAccountPills();

    // Fallback to first user if active user is missing
    if (!userProfiles[currentUserId] && users.length > 0) {
      currentUserId = users[0].user_id;
    }

    switchUser(currentUserId);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

/**
 * Update dropdown selectors with dynamic users list
 */
function updateUserDropdowns() {
  const savedView = viewUserSelect.value || currentUserId;
  const savedSender = senderSelect.value || currentUserId;
  const savedReceiver = receiverSelect.value;

  viewUserSelect.innerHTML = '';
  senderSelect.innerHTML = '';
  receiverSelect.innerHTML = '';

  const userIds = Object.keys(userProfiles);

  userIds.forEach(id => {
    const u = userProfiles[id];
    const optText = `${u.name} (${id})`;

    const viewOpt = new Option(optText, id);
    viewUserSelect.add(viewOpt);

    const senderOpt = new Option(optText, id);
    senderSelect.add(senderOpt);

    const recvOpt = new Option(optText, id);
    receiverSelect.add(recvOpt);
  });

  // Invalid test receiver option for boundary & negative testing
  const invalidOpt = new Option('Invalid Account (U999_NON_EXISTENT - Negative Test)', 'U999_NON_EXISTENT');
  receiverSelect.add(invalidOpt);

  // Restore selections
  if (userProfiles[savedView]) viewUserSelect.value = savedView;
  if (userProfiles[savedSender]) senderSelect.value = savedSender;

  if (savedReceiver && (userProfiles[savedReceiver] || savedReceiver === 'U999_NON_EXISTENT')) {
    receiverSelect.value = savedReceiver;
  } else if (userIds.length > 1) {
    receiverSelect.value = userIds.find(id => id !== senderSelect.value) || userIds[1];
  }
}

/**
 * Render quick overview pill cards for all users
 */
function renderAccountPills() {
  if (!accountsOverviewContainer) return;
  accountsOverviewContainer.innerHTML = '';

  const avatarColors = ['', 'avatar-blue', 'avatar-purple', 'avatar-green'];
  let colorIdx = 0;

  Object.keys(userProfiles).forEach(id => {
    const u = userProfiles[id];
    const card = document.createElement('div');
    card.className = `account-pill-card ${id === currentUserId ? 'active' : ''}`;
    card.id = `pill_${id}`;
    card.onclick = () => switchUser(id);

    const initial = u.name.charAt(0).toUpperCase();
    const colorClass = avatarColors[colorIdx % avatarColors.length];
    colorIdx++;

    card.innerHTML = `
      <div class="pill-avatar ${colorClass}">${initial}</div>
      <div class="pill-info">
        <span class="pill-name">${u.name} (${id})</span>
        <span class="pill-balance" id="balance_pill_${id}">${formatRupees(u.balance)}</span>
      </div>
    `;

    accountsOverviewContainer.appendChild(card);
  });
}

/**
 * Switch the active dashboard user
 */
function switchUser(userId) {
  if (!userProfiles[userId]) return;
  currentUserId = userId;
  viewUserSelect.value = userId;

  const profile = userProfiles[userId];

  // Update header
  document.getElementById('headerAvatar').textContent = profile.name.charAt(0).toUpperCase();
  document.getElementById('headerGreeting').innerHTML = `Active: <strong>${profile.name}</strong> (${userId})`;

  // Update Section A details
  document.getElementById('accountName').textContent = profile.name;
  document.getElementById('accountUserId').textContent = userId;
  document.getElementById('accountNumberDisplay').textContent = `Account ID: ${userId}`;

  // Update active pill highlight
  document.querySelectorAll('.account-pill-card').forEach(card => card.classList.remove('active'));
  const activePill = document.getElementById(`pill_${userId}`);
  if (activePill) activePill.classList.add('active');

  // Sync sender dropdown with current user
  if (senderSelect.value !== userId) {
    senderSelect.value = userId;
    if (receiverSelect.value === userId) {
      const otherId = Object.keys(userProfiles).find(id => id !== userId);
      if (otherId) receiverSelect.value = otherId;
    }
  }

  // Update balance display and transactions
  updateBalanceDisplay();
  fetchTransactions(userId);
}

/**
 * Set quick transfer amount via chip buttons
 */
function setTransferAmount(val) {
  transferAmountInput.value = val;
  transferAmountInput.focus();
}

/**
 * Format currency in Indian Rupees format (₹)
 */
function formatRupees(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Format timestamp nicely
 */
function formatDateTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

/**
 * Update the main balance card on the dashboard
 */
function updateBalanceDisplay() {
  const profile = userProfiles[currentUserId];
  if (profile) {
    document.getElementById('currentBalanceDisplay').textContent = formatRupees(profile.balance);
    document.getElementById('lastUpdatedDisplay').textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }
}

/**
 * Fetch transaction history for active user
 */
async function fetchTransactions(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/transactions/${userId}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderTransactions(data.transactions || []);
  } catch (err) {
    console.error(`Failed to fetch transactions for ${userId}:`, err);
    transactionTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Unable to load transactions. Verify backend is running.</td></tr>`;
  }
}

/**
 * Render transaction table rows
 */
function renderTransactions(transactions) {
  if (!transactions || transactions.length === 0) {
    transactionTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No transactions recorded for this account.</td></tr>`;
    return;
  }

  let html = '';
  transactions.forEach(tx => {
    const isDebit = tx.type === 'DEBIT';
    const amountClass = isDebit ? 'amount-debit' : 'amount-credit';
    const amountPrefix = isDebit ? '- ' : '+ ';
    const statusClass = (tx.status === 'SUCCESS') ? 'badge-success' : 'badge-failed';

    html += `
      <tr>
        <td><span class="txn-id-code">${tx.transaction_id}</span></td>
        <td><strong>${tx.sender_name || tx.sender_id}</strong></td>
        <td><strong>${tx.receiver_name || tx.receiver_id}</strong></td>
        <td class="${amountClass}">${amountPrefix}${formatRupees(tx.amount_rupees)}</td>
        <td>${formatDateTime(tx.timestamp)}</td>
        <td><span class="badge-status ${statusClass}">${tx.status}</span></td>
      </tr>
    `;
  });

  transactionTableBody.innerHTML = html;
}

/**
 * Handle Transfer Form Submission
 */
async function handleTransferSubmit(e) {
  e.preventDefault();

  const sender_id = senderSelect.value;
  const receiver_id = receiverSelect.value;
  const amount = parseFloat(transferAmountInput.value);
  const transaction_id = transactionIdInput.value.trim();

  // Client validation
  if (!transaction_id) {
    showNotification('Please enter or generate a Transaction ID.', 'error');
    return;
  }

  if (sender_id === receiver_id) {
    showNotification('Sender and Receiver accounts must be different.', 'error');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showNotification('Transfer amount must be a positive number greater than ₹0.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitTransferBtn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Processing...</span>`;

  try {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id,
        sender_id,
        receiver_id,
        amount
      })
    });

    const data = await res.json();

    if (res.ok) {
      showNotification(
        `✓ Transfer of ${formatRupees(amount)} from ${sender_id} to ${receiver_id} was successful! (Txn: ${transaction_id})`,
        'success'
      );

      transferAmountInput.value = '';
      generateNewTransactionId();
      await loadAllUsersAndData();
    } else {
      const errorMsg = data.error || 'Transfer was rejected by the server.';
      showNotification(`✕ Transfer Failed [HTTP ${res.status}]: ${errorMsg}`, 'error');
    }
  } catch (err) {
    showNotification(`✕ Network or server error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Handle Create New User Submission (POST /api/users)
 */
async function handleAddUserSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('newUserName');
  const balanceInput = document.getElementById('newUserBalance');
  const userIdInput = document.getElementById('newUserId');

  const name = nameInput.value.trim();
  const initial_balance = parseFloat(balanceInput.value);
  const user_id = userIdInput.value.trim();

  if (!name) {
    showNotification('Please enter the user name.', 'error');
    return;
  }

  if (isNaN(initial_balance) || initial_balance < 0) {
    showNotification('Initial balance cannot be negative.', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitAddUserBtn');
  submitBtn.disabled = true;

  try {
    const payload = { name, initial_balance };
    if (user_id) payload.user_id = user_id;

    const res = await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      showNotification(`✓ New wallet user created: ${data.user.name} (${data.user.user_id}) with ${formatRupees(data.user.balance_rupees)}`, 'success');
      addUserModal.classList.add('hidden');
      nameInput.value = '';
      balanceInput.value = '';
      userIdInput.value = '';

      await loadAllUsersAndData();
      switchUser(data.user.user_id);
    } else {
      showNotification(`✕ Failed to create user [HTTP ${res.status}]: ${data.error}`, 'error');
    }
  } catch (err) {
    showNotification(`✕ Network error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * LIVE API TEST RUNNER — runs all 5 tests directly from the browser
 * No Newman, no files, no reports — just real fetch calls to the Flask backend
 */
async function handleRunApiTests() {
  if (!runTestsBtn) return;

  // Disable button and show loading state
  runTestsBtn.disabled = true;
  runTestsBtn.innerHTML = `<svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path></svg> Running Tests...`;

  // Reset all 5 scenario cards to "running" state
  for (let i = 1; i <= 5; i++) {
    setScenarioState(i, 'running', 'Testing...');
  }
  testPassedCount.textContent = '--';
  testFailedCount.textContent = '--';

  // First reset the database so tests start from a clean state
  try {
    await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
  } catch (e) { /* ignore reset errors */ }

  // Wait a moment, then reload balances
  await new Promise(r => setTimeout(r, 300));
  await loadAllUsersAndData();

  let passed = 0;
  let failed = 0;

  // ─────────────────────────────────────────────────
  // TEST 1: Positive Test — valid ₹500 transfer (Alice → Bob)
  // Expected: HTTP 200
  // ─────────────────────────────────────────────────
  try {
    const txnId = 'TEST_TXN_' + Date.now();
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: txnId, sender_id: 'U001', receiver_id: 'U002', amount: 500 })
    });
    if (res.status === 200) {
      setScenarioState(1, 'passed', 'HTTP 200 ✓ — Transfer of ₹500 succeeded as expected');
      passed++;
    } else {
      const d = await res.json();
      setScenarioState(1, 'failed', `HTTP ${res.status} — Expected 200 but got rejection: ${d.error || ''}`);
      failed++;
    }
  } catch (e) {
    setScenarioState(1, 'failed', 'Network error: ' + e.message);
    failed++;
  }

  // ─────────────────────────────────────────────────
  // TEST 2: Insufficient Balance — transfer ₹99,999
  // Expected: HTTP 400
  // ─────────────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: 'TEST_INSUF_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 99999 })
    });
    if (res.status === 400) {
      setScenarioState(2, 'passed', 'HTTP 400 ✓ — Insufficient balance correctly rejected');
      passed++;
    } else {
      setScenarioState(2, 'failed', `HTTP ${res.status} — Expected 400 but got ${res.status}`);
      failed++;
    }
  } catch (e) {
    setScenarioState(2, 'failed', 'Network error: ' + e.message);
    failed++;
  }

  // ─────────────────────────────────────────────────
  // TEST 3: Zero Amount — transfer ₹0
  // Expected: HTTP 400
  // ─────────────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: 'TEST_ZERO_' + Date.now(), sender_id: 'U001', receiver_id: 'U002', amount: 0 })
    });
    if (res.status === 400) {
      setScenarioState(3, 'passed', 'HTTP 400 ✓ — Zero amount correctly rejected');
      passed++;
    } else {
      setScenarioState(3, 'failed', `HTTP ${res.status} — Expected 400 but got ${res.status}`);
      failed++;
    }
  } catch (e) {
    setScenarioState(3, 'failed', 'Network error: ' + e.message);
    failed++;
  }

  // ─────────────────────────────────────────────────
  // TEST 4: Invalid Receiver — user does not exist
  // Expected: HTTP 404
  // ─────────────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: 'TEST_INVLD_' + Date.now(), sender_id: 'U001', receiver_id: 'U999_INVALID', amount: 100 })
    });
    if (res.status === 404) {
      setScenarioState(4, 'passed', 'HTTP 404 ✓ — Invalid receiver correctly rejected');
      passed++;
    } else {
      setScenarioState(4, 'failed', `HTTP ${res.status} — Expected 404 but got ${res.status}`);
      failed++;
    }
  } catch (e) {
    setScenarioState(4, 'failed', 'Network error: ' + e.message);
    failed++;
  }

  // ─────────────────────────────────────────────────
  // TEST 5: Duplicate Transaction — same ID twice
  // Expected: first = 200, second = 409
  // ─────────────────────────────────────────────────
  try {
    const dupId = 'TEST_DUP_' + Date.now();
    // First request (should succeed)
    await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: dupId, sender_id: 'U001', receiver_id: 'U002', amount: 100 })
    });
    // Second request with same ID (should be rejected)
    const res2 = await fetch(`${API_BASE}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: dupId, sender_id: 'U001', receiver_id: 'U002', amount: 100 })
    });
    if (res2.status === 409) {
      setScenarioState(5, 'passed', 'HTTP 409 ✓ — Duplicate transaction correctly rejected');
      passed++;
    } else {
      setScenarioState(5, 'failed', `HTTP ${res2.status} — Expected 409 but got ${res2.status}`);
      failed++;
    }
  } catch (e) {
    setScenarioState(5, 'failed', 'Network error: ' + e.message);
    failed++;
  }

  // ─────────────────────────────────────────────────
  // Update summary stats
  // ─────────────────────────────────────────────────
  testPassedCount.textContent = passed;
  testFailedCount.textContent = failed;
  if (lastRunTime) {
    lastRunTime.textContent = `Last run: ${new Date().toLocaleTimeString()}`;
  }

  const allPassed = failed === 0;
  showNotification(
    allPassed
      ? `✓ All 5 tests PASSED — API is working correctly!`
      : `${passed} passed, ${failed} failed — check the results below`,
    allPassed ? 'success' : 'error'
  );

  // Restore button
  runTestsBtn.disabled = false;
  runTestsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run All 5 Tests`;

  // Refresh balances after tests
  await loadAllUsersAndData();
}

/**
 * Update a single scenario card's visual state
 * state: 'running' | 'passed' | 'failed'
 */
function setScenarioState(id, state, detail) {
  const card = document.getElementById(`scenarioCard${id}`);
  const icon = document.getElementById(`scenarioIcon${id}`);
  const detailEl = document.getElementById(`scenarioDetail${id}`);

  if (!card || !icon) return;

  if (state === 'running') {
    card.className = 'scenario-item';
    icon.className = 'scenario-status-icon';
    icon.textContent = '⟳';
  } else if (state === 'passed') {
    card.className = 'scenario-item passed';
    icon.className = 'scenario-status-icon';
    icon.textContent = '✓';
  } else {
    card.className = 'scenario-item failed';
    icon.className = 'scenario-status-icon failed';
    icon.textContent = '✕';
  }

  if (detailEl && detail) {
    detailEl.textContent = detail;
    detailEl.style.fontSize = '12px';
    detailEl.style.marginTop = '4px';
    detailEl.style.color = state === 'passed' ? '#16a34a' : state === 'failed' ? '#dc2626' : '#888';
  }
}

/**
 * Display Alert Notification Banner
 */
function showNotification(message, type = 'info') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span>${message}</span>
    <button class="alert-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  notificationArea.innerHTML = '';
  notificationArea.appendChild(alert);

  setTimeout(() => {
    if (alert && alert.parentElement) {
      alert.remove();
    }
  }, 7000);
}

/**
 * Handle Reset Sample Balances Button
 */
async function handleResetDemo() {
  if (!confirm('Reset wallet balances to initial sample state (Alice ₹5,000, Bob ₹2,000) and clear history?')) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/reset-database`, { method: 'POST' });
    if (res.ok) {
      showNotification('✓ Database successfully reset! Alice: ₹5,000 | Bob: ₹2,000', 'success');
      generateNewTransactionId();
      await loadAllUsersAndData();
      switchUser('U001');
    } else {
      showNotification('Could not reset database via API. You can also run: python3 scripts/reset_database.py', 'error');
    }
  } catch (err) {
    showNotification('Database reset error: ' + err.message, 'error');
  }
}
