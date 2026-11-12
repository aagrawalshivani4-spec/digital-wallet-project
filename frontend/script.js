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
const refreshTestStatsBtn = document.getElementById('refreshTestStatsBtn');
const viewReportLink = document.getElementById('viewReportLink');
const testTotalCount = document.getElementById('testTotalCount');
const testPassedCount = document.getElementById('testPassedCount');
const testFailedCount = document.getElementById('testFailedCount');
const passRateSubtext = document.getElementById('passRateSubtext');
const latestExecutionTime = document.getElementById('latestExecutionTime');
const latestExecutionBanner = document.getElementById('latestExecutionBanner');

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
  fetchTestSummary();

  // Event Listeners
  viewUserSelect.addEventListener('change', (e) => switchUser(e.target.value));
  regenerateTxnBtn.addEventListener('click', generateNewTransactionId);
  refreshBtn.addEventListener('click', () => {
    loadAllUsersAndData();
    fetchTestSummary();
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

  // Section D Test Buttons
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
 * Trigger Actual Newman API Tests (Button: "Run API Tests")
 */
async function handleRunApiTests() {
  if (!runTestsBtn) return;
  const originalHTML = runTestsBtn.innerHTML;
  runTestsBtn.disabled = true;
  runTestsBtn.innerHTML = `
    <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor"></path>
    </svg>
    Running Tests...
  `;

  try {
    const res = await fetch(`${API_BASE}/api/run-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (res.ok && data.executed) {
      updateTestingDashboard(data);
      showNotification(
        `✓ API Tests Completed: ${data.passed}/${data.total} Assertions Passed in ${data.duration_ms}ms`,
        data.failed === 0 ? 'success' : 'error'
      );
      // Reload user data because DB was reset before test execution
      await loadAllUsersAndData();
    } else {
      const errText = data.error || 'Failed to execute automated tests.';
      showNotification(`✕ Test Execution Error: ${errText}`, 'error');
      if (latestExecutionTime) {
        latestExecutionTime.textContent = `Execution Error: ${errText}`;
      }
    }
  } catch (err) {
    showNotification(`✕ Test runner error: ${err.message}`, 'error');
  } finally {
    runTestsBtn.disabled = false;
    runTestsBtn.innerHTML = originalHTML;
  }
}

/**
 * Fetch latest test execution summary from Newman JSON report
 */
async function fetchTestSummary(showFeedback = false) {
  try {
    const res = await fetch(`${API_BASE}/api/test-summary?t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const summary = await res.json();
    updateTestingDashboard(summary);
  } catch (err) {
    console.error('Failed to fetch test summary:', err);
    resetTestingDashboardToIdle();
  }
}

/**
 * Update Section D Dashboard UI with real test summary data
 */
function updateTestingDashboard(summary) {
  if (!summary || !summary.executed || summary.total === undefined) {
    resetTestingDashboardToIdle();
    return;
  }

  // Update Assertion Numbers (genuine data, never hardcoded)
  testTotalCount.textContent = summary.total;
  testPassedCount.textContent = summary.passed;
  testFailedCount.textContent = summary.failed;

  // Pass rate subtext
  if (passRateSubtext) {
    passRateSubtext.textContent = (summary.failed === 0) 
      ? '100% verification passed' 
      : `${summary.failed} assertion(s) failed`;
  }

  // Update Execution Timestamp
  if (latestExecutionTime) {
    latestExecutionTime.textContent = `${summary.execution_time} (${summary.duration_ms} ms execution)`;
  }

  // Update Status Indicator Dot
  if (latestExecutionBanner) {
    const dot = latestExecutionBanner.querySelector('.exec-dot');
    if (dot) {
      dot.className = (summary.failed === 0) ? 'exec-dot' : 'exec-dot exec-dot-failed';
    }
  }

  // Update Five Scenarios Cards dynamically
  if (Array.isArray(summary.scenarios)) {
    summary.scenarios.forEach(sc => {
      const card = document.getElementById(`scenarioCard${sc.id}`);
      const icon = document.getElementById(`scenarioIcon${sc.id}`);
      if (card && icon) {
        const isPassed = (sc.status === 'PASSED');
        card.className = `scenario-item ${isPassed ? 'passed' : 'failed'}`;
        icon.className = `scenario-status-icon ${isPassed ? '' : 'failed'}`;
        icon.textContent = isPassed ? '✓' : '✕';
      }
    });
  }

  // Update HTML Report Link with cache buster query parameter
  if (viewReportLink) {
    viewReportLink.href = `/reports/postman_test_report.html?t=${Date.now()}`;
  }
}

/**
 * Reset Section D when no test execution has occurred yet
 */
function resetTestingDashboardToIdle() {
  testTotalCount.textContent = '--';
  testPassedCount.textContent = '--';
  testFailedCount.textContent = '--';

  if (passRateSubtext) {
    passRateSubtext.textContent = 'Awaiting execution';
  }

  if (latestExecutionTime) {
    latestExecutionTime.textContent = 'No automated test execution recorded yet. Click "Run API Tests".';
  }

  if (latestExecutionBanner) {
    const dot = latestExecutionBanner.querySelector('.exec-dot');
    if (dot) dot.className = 'exec-dot exec-dot-idle';
  }

  for (let i = 1; i <= 5; i++) {
    const card = document.getElementById(`scenarioCard${i}`);
    const icon = document.getElementById(`scenarioIcon${i}`);
    if (card && icon) {
      card.className = 'scenario-item';
      icon.className = 'scenario-status-icon';
      icon.textContent = '•';
    }
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
