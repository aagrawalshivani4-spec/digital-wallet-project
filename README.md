# WalletPay: Automated API Testing & Transaction Validation of a Digital Wallet

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-black.svg)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-green.svg)](https://sqlite.org/)
[![Postman](https://img.shields.io/badge/Testing-Postman%20%7C%20Newman-orange.svg)](https://www.postman.com/)
[![Test Status](https://img.shields.io/badge/Tests-16%2F16%20Passed-brightgreen.svg)]()

A robust, modern digital wallet and money transfer system demonstrating **Automated API Testing & Financial Transaction Validation Using Postman & Newman**. This project showcases end-to-end API quality engineering: validating REST endpoints, ACID transaction consistency, negative boundary conditions, and automated Newman test reporting.

---

## 1. Project Introduction

**WalletPay** is a digital wallet application that facilitates secure peer-to-peer (P2P) money transfers between user accounts. The core objective of this project is demonstrating **automated API testing** using **Postman**:
- Testing positive functional behavior (successful money transfers).
- Testing negative boundary and business rule rejections (insufficient balance, zero amount, non-existent users).
- Testing idempotency and concurrency guards (duplicate transaction ID rejection).
- Testing database integrity (verifying wallet balances are never mutated on failed operations).

### Key Features
- **Dynamic Wallet Users:** Support for any number of users (Alice, Bob, Charlie, etc.) with custom names and opening balances.
- **Integer Paise Representation:** All balances and transfers are stored in integer paise (1 Rupee = 100 Paise) to eliminate floating-point currency rounding errors.
- **Atomic Database Operations:** SQLite `BEGIN IMMEDIATE` transactions ensure that failed transfers never modify balances.
- **Postman as Primary Testing Tool:** Standalone test requests with editable bodies, plus automated collection runs.
- **Interactive Newman HTML Report:** Comprehensive visual test dashboard generated via Newman CLI.

---

## 2. Technologies Used

| Tier | Technology | Description |
|---|---|---|
| **Frontend** | HTML5, CSS3, JavaScript (ES6) | Responsive UI with clean cards, subtle shadows, dynamic user selection, and live updates |
| **Backend** | Python Flask | Lightweight REST API framework with full CORS support |
| **Database** | SQLite3 | ACID-compliant embedded relational database |
| **API Testing** | Postman (v10+) | Test scripts with JavaScript assertions (`pm.test()`, `pm.sendRequest()`) |
| **Automation** | Newman & `newman-reporter-htmlextra` | CLI test execution and executive HTML reporting |

---

## 3. Database Schema

The application uses an embedded SQLite database (`backend/wallet.db`) containing two relational tables:

### Table 1: `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | TEXT | PRIMARY KEY | Unique user ID (e.g., `U001`, `U002`, `U003`) |
| `name` | TEXT | NOT NULL | User's display name |
| `balance_paise` | INTEGER | NOT NULL, `>= 0` | Balance stored in paise (₹1 = 100 paise) |

### Table 2: `transactions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `transaction_id` | TEXT | PRIMARY KEY | Unique reference ID (prevents duplicates) |
| `sender_id` | TEXT | FOREIGN KEY (`users.user_id`) | Sender identifier |
| `receiver_id` | TEXT | FOREIGN KEY (`users.user_id`) | Receiver identifier |
| `amount_paise` | INTEGER | NOT NULL, `> 0` | Transfer amount in paise |
| `status` | TEXT | NOT NULL | `SUCCESS` or `FAILED` |
| `timestamp` | TEXT | NOT NULL | ISO 8601 execution timestamp |

### Initial Sample Accounts
- **Alice (`U001`):** ₹5,000.00 (500,000 paise)
- **Bob (`U002`):** ₹2,000.00 (200,000 paise)
- *Additional users can be added dynamically at any time via the UI or API!*

---

## 4. API Endpoints Reference

All endpoints accept and return JSON.

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/health` | Backend and database connectivity status | `200 OK` |
| `GET` | `/api/balance/<user_id>` | Current wallet balance (paise & rupees) | `200 OK`, `404 Not Found` |
| `POST` | `/api/transfer` | Execute peer-to-peer money transfer | `200 OK`, `400 Bad Request`, `404 Not Found`, `409 Conflict` |
| `GET` | `/api/transactions/<user_id>` | Historical ledger audit trail | `200 OK`, `404 Not Found` |
| `GET` | `/api/users` | List all registered wallet users | `200 OK` |
| `POST` | `/api/users` | Create a new user with custom balance | `201 Created`, `400 Bad Request`, `409 Conflict` |
| `POST` | `/api/reset-database` | Reset sample accounts to default state | `200 OK` |

---

## 5. Five Core Test Scenarios (Software Testing Demonstration)

During your evaluation, explain each of these 5 test scenarios:

### Test 1: Positive Testing (Valid Money Transfer)
- **Objective:** Verify that a standard transfer between two existing accounts completes successfully.
- **Request:** `POST /api/transfer` with `amount: 500`, `sender_id: "U001"`, `receiver_id: "U002"`.
- **Expected Result:** `HTTP 200 OK`, `status: "SUCCESS"`.
- **Assertions:** Response status code is 200, payload contains updated balances (Alice: ₹4,500, Bob: ₹2,500), and a database query confirms Alice's actual balance is ₹4,500.

### Test 2: Negative Testing – Insufficient Balance
- **Objective:** Verify that a transfer exceeding the sender's available balance is rejected.
- **Request:** `POST /api/transfer` with `amount: 10000`, `sender_id: "U001"`, `receiver_id: "U002"`.
- **Expected Result:** `HTTP 400 Bad Request`.
- **Assertions:** Error message contains `"Insufficient wallet balance"`, and a database query confirms Alice's balance remains strictly unchanged at ₹4,500.

### Test 3: Boundary Testing – Zero Amount
- **Objective:** Verify boundary condition enforcement for minimum transfer amounts ($amount > 0$).
- **Request:** `POST /api/transfer` with `amount: 0`, `sender_id: "U001"`, `receiver_id: "U002"`.
- **Expected Result:** `HTTP 400 Bad Request`.
- **Assertions:** Error message indicates `"Transfer amount must be greater than zero"`, and wallet balances remain unchanged.

### Test 4: Negative Testing – Invalid Receiver
- **Objective:** Verify foreign key / account validation when transferring to a non-existent account ID.
- **Request:** `POST /api/transfer` with `receiver_id: "U999_NON_EXISTENT"`, `amount: 500`.
- **Expected Result:** `HTTP 404 Not Found`.
- **Assertions:** Error message indicates `"Receiver not found"`, and sender's balance is not debited.

### Test 5: Duplicate Transaction Testing (Idempotency)
- **Objective:** Verify that replaying the exact same `transaction_id` is rejected to prevent duplicate charges.
- **Request (Step 1):** `POST /api/transfer` with `transaction_id: "TXN_DUP_DEMO"` $\rightarrow$ `HTTP 200 OK`.
- **Request (Step 2):** Resend the identical request with `transaction_id: "TXN_DUP_DEMO"`.
- **Expected Result:** `HTTP 409 Conflict`.
- **Assertions:** Error message indicates `"Duplicate transaction"`, and money is NOT deducted twice.

---

## 6. How to Run the Project (macOS)

### Step 1: Open Terminal and Navigate to Project
```bash
cd /Users/shivaniagrawal/Downloads/softwaret/digital-wallet-project
```

### Step 2: Start the Flask Backend Server
```bash
python3 backend/app.py
```
*The server will start on `http://127.0.0.1:5001`.*

> **macOS Note:** macOS AirPlay Receiver uses port 5000 by default. To prevent port conflicts, this application defaults to port **5001**.

### Step 3: Open the Frontend Dashboard
Navigate to:
```text
http://127.0.0.1:5001
```
*(Or double-click `frontend/index.html` in your file explorer).*

---

## 7. How to Execute and Validate in Postman

### Step 1: Import Files into Postman
1. Open the **Postman** desktop application.
2. Click the **Import** button (top-left).
3. Select both files from the `postman/` directory:
   - `postman/Digital_Wallet_API_Tests.postman_collection.json`
   - `postman/Digital_Wallet_Environment.postman_environment.json`
4. In the top-right environment dropdown, select **Digital Wallet Environment**.

### Step 2: Live Demonstration of Individual Test Cases
You can demonstrate any request independently:
1. Select **"1. Valid Money Transfer - Expected Success"**.
2. Click **Send**.
3. Verify the following:
   - The response status: **`200 OK`**.
   - The response JSON showing the transaction details.
   - The **Test Results (4/4)** tab showing all green assertions passing!
4. Edit the request body (e.g., change `"amount": 500` to `"amount": 250`) and click **Send** again to demonstrate live dynamic input.
5. Select **"2. Insufficient Balance - Expected Rejection"** $\rightarrow$ Click **Send** $\rightarrow$ Show **`400 Bad Request`** with error message.
6. Select **"3. Zero Amount - Expected Rejection"** $\rightarrow$ Click **Send** $\rightarrow$ Show **`400 Bad Request`** zero amount rejection.
7. Select **"4. Invalid Receiver - Expected Rejection"** $\rightarrow$ Click **Send** $\rightarrow$ Show **`404 Not Found`**.
8. Select **"5. Duplicate Transaction ID - Expected Rejection"** $\rightarrow$ Click **Send** $\rightarrow$ Show **`409 Conflict`** duplicate transaction prevention.

### Step 3: Run the Complete Collection via Postman Collection Runner
1. In the left sidebar, click the three dots (`...`) next to **WalletPay - Core Automated API Test Suite**.
2. Click **Run collection**.
3. Ensure all 5 test cases are selected.
4. Click **Run WalletPay - Core Automated API Test Suite**.
5. Watch all test cases execute in sequence and display **100% Passed (All 16 assertions green)**!

---

## 8. Automated Test Execution via Newman & HTML Report

To execute the test suite from the terminal and generate the official HTML test report:

```bash
# Execute automated test suite
./scripts/run_tests.sh
```
*(Or run `python3 scripts/execute_tests.py`)*

### View the HTML Report:
```bash
open reports/postman_test_report.html
```
The report opens in your browser with interactive charts, response times, HTTP headers, request payloads, and individual assertion verifications.

---

## 9. Resetting the Database

To restore initial accounts (Alice: ₹5,000, Bob: ₹2,000) and wipe previous transactions:

```bash
python3 scripts/reset_database.py
```
*(Or click the **"Reset Sample Balances"** button directly in the WalletPay UI).*

---

## 10. Project Directory Structure

```text
digital-wallet-project/
├── backend/
│   ├── app.py              # Flask REST APIs (transfer, balance, users, health)
│   ├── database.py         # SQLite connection & schema initialization
│   ├── requirements.txt    # Python dependencies (Flask)
│   └── wallet.db           # SQLite database file
├── frontend/
│   ├── index.html          # Modern 4-section WalletPay dashboard
│   ├── style.css           # Clean white background with purple/blue accents
│   └── script.js           # Reactive UI logic & dynamic user management
├── postman/
│   ├── Digital_Wallet_API_Tests.postman_collection.json  # 5 test scenarios + audit
│   └── Digital_Wallet_Environment.postman_environment.json # Base URL & variables
├── reports/
│   ├── postman_test_report.html       # Full interactive Newman HTML report
│   ├── test_execution_summary.txt    # Plain-text summary of test results
│   ├── test_summary.json             # Structured summary metrics for frontend
│   └── postman_run_result.json       # Raw Newman execution payload
├── scripts/
│   ├── execute_tests.py    # Python automated test runner
│   ├── reset_database.py   # Resets database to sample starting state
│   └── run_tests.sh        # Shell test runner script
└── README.md               # Complete project documentation & viva guide
```
