"""
WalletPay - Flask Backend Application
Automated API Testing and Transaction Validation of a Digital Wallet System.
"""

import os
import json
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from database import get_db_connection, init_db

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')

app = Flask(__name__, static_folder=FRONTEND_DIR)

# Initialize database on startup
init_db()


# Enable CORS for all routes
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


# Serve Frontend and Reports
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_frontend_assets(filename):
    if os.path.exists(os.path.join(FRONTEND_DIR, filename)):
        return send_from_directory(FRONTEND_DIR, filename)
    return "Not Found", 404


@app.route('/reports/<path:filename>')
def serve_reports(filename):
    if os.path.exists(os.path.join(REPORTS_DIR, filename)):
        response = send_from_directory(REPORTS_DIR, filename)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    return "Report not found", 404


# -------------------------------------------------------------
# 1. GET /api/health
# -------------------------------------------------------------
@app.route('/api/health', methods=['GET'])
def health_check():
    """Checks whether the backend is running."""
    try:
        conn = get_db_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return jsonify({
        "status": "healthy",
        "service": "WalletPay Digital Wallet API",
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }), 200


# -------------------------------------------------------------
# 2. GET /api/balance/<user_id>
# -------------------------------------------------------------
@app.route('/api/balance/<user_id>', methods=['GET'])
def get_balance(user_id):
    """Returns the current wallet balance for the specified user."""
    conn = get_db_connection()
    user = conn.execute(
        "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    conn.close()

    if not user:
        return jsonify({
            "error": "User not found",
            "user_id": user_id
        }), 404

    balance_paise = user['balance_paise']
    balance_rupees = round(balance_paise / 100.0, 2)

    return jsonify({
        "user_id": user['user_id'],
        "name": user['name'],
        "balance_paise": balance_paise,
        "balance_rupees": balance_rupees
    }), 200


# -------------------------------------------------------------
# 3. POST /api/transfer
# -------------------------------------------------------------
@app.route('/api/transfer', methods=['POST', 'OPTIONS'])
def transfer_money():
    """
    Transfers money between users.
    Validates sender, receiver, balance, duplicate txn, and records the transfer.
    Uses database transactions to guarantee atomicity.
    """
    if request.method == 'OPTIONS':
        return '', 200

    data = request.get_json(silent=True) or {}

    transaction_id = data.get('transaction_id')
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    amount = data.get('amount')

    # Validate presence of required fields
    if not transaction_id or not sender_id or not receiver_id or amount is None:
        return jsonify({
            "error": "Missing required fields. Required: transaction_id, sender_id, receiver_id, amount"
        }), 400

    # Validate amount format and positive value
    try:
        amount_float = float(amount)
        amount_paise = int(round(amount_float * 100))
    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid amount format. Must be a positive numeric value."
        }), 400

    if amount_paise <= 0:
        return jsonify({
            "error": "Transfer amount must be greater than zero."
        }), 400

    # Prevent self-transfer
    if sender_id == receiver_id:
        return jsonify({
            "error": "Sender and receiver cannot be the same account."
        }), 400

    conn = get_db_connection()
    try:
        # Check for duplicate transaction ID (HTTP 409 Conflict)
        existing_txn = conn.execute(
            "SELECT transaction_id FROM transactions WHERE transaction_id = ?",
            (transaction_id,)
        ).fetchone()

        if existing_txn:
            conn.close()
            return jsonify({
                "error": "Duplicate transaction: A transaction with this transaction_id already exists.",
                "transaction_id": transaction_id
            }), 409

        # Check sender existence
        sender = conn.execute(
            "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
            (sender_id,)
        ).fetchone()

        if not sender:
            conn.close()
            return jsonify({
                "error": "Sender not found.",
                "sender_id": sender_id
            }), 404

        # Check receiver existence (HTTP 404 Not Found)
        receiver = conn.execute(
            "SELECT user_id, name, balance_paise FROM users WHERE user_id = ?",
            (receiver_id,)
        ).fetchone()

        if not receiver:
            conn.close()
            return jsonify({
                "error": "Receiver not found.",
                "receiver_id": receiver_id
            }), 404

        # Check sender available balance (HTTP 400 Bad Request)
        sender_balance = sender['balance_paise']
        if sender_balance < amount_paise:
            conn.close()
            return jsonify({
                "error": "Insufficient wallet balance.",
                "available_balance_rupees": round(sender_balance / 100.0, 2),
                "attempted_amount_rupees": amount_float
            }), 400

        # Atomic transaction execution
        timestamp_str = datetime.now().isoformat()

        # Begin transaction
        conn.execute("BEGIN IMMEDIATE")

        # Deduct from sender
        conn.execute(
            "UPDATE users SET balance_paise = balance_paise - ? WHERE user_id = ?",
            (amount_paise, sender_id)
        )

        # Credit to receiver
        conn.execute(
            "UPDATE users SET balance_paise = balance_paise + ? WHERE user_id = ?",
            (amount_paise, receiver_id)
        )

        # Record transaction
        conn.execute("""
            INSERT INTO transactions (transaction_id, sender_id, receiver_id, amount_paise, status, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (transaction_id, sender_id, receiver_id, amount_paise, "SUCCESS", timestamp_str))

        conn.commit()

        # Fetch updated balances
        new_sender_balance = sender_balance - amount_paise
        new_receiver_balance = receiver['balance_paise'] + amount_paise

        conn.close()

        return jsonify({
            "message": "Transfer completed successfully.",
            "transaction": {
                "transaction_id": transaction_id,
                "sender_id": sender_id,
                "sender_name": sender['name'],
                "receiver_id": receiver_id,
                "receiver_name": receiver['name'],
                "amount_paise": amount_paise,
                "amount_rupees": amount_float,
                "status": "SUCCESS",
                "timestamp": timestamp_str
            },
            "sender_new_balance_rupees": round(new_sender_balance / 100.0, 2),
            "receiver_new_balance_rupees": round(new_receiver_balance / 100.0, 2)
        }), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            "error": "Internal transaction failure.",
            "details": str(e)
        }), 500


# -------------------------------------------------------------
# 4. GET /api/transactions/<user_id>
# -------------------------------------------------------------
@app.route('/api/transactions/<user_id>', methods=['GET'])
def get_user_transactions(user_id):
    """Returns the user's transaction history (as sender or receiver)."""
    conn = get_db_connection()

    # Verify user exists
    user = conn.execute(
        "SELECT user_id, name FROM users WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({
            "error": "User not found",
            "user_id": user_id
        }), 404

    rows = conn.execute("""
        SELECT 
            t.transaction_id,
            t.sender_id,
            s.name AS sender_name,
            t.receiver_id,
            r.name AS receiver_name,
            t.amount_paise,
            t.status,
            t.timestamp
        FROM transactions t
        LEFT JOIN users s ON t.sender_id = s.user_id
        LEFT JOIN users r ON t.receiver_id = r.user_id
        WHERE t.sender_id = ? OR t.receiver_id = ?
        ORDER BY t.timestamp DESC
    """, (user_id, user_id)).fetchall()

    conn.close()

    transactions = []
    for row in rows:
        amount_paise = row['amount_paise']
        txn_type = "DEBIT" if row['sender_id'] == user_id else "CREDIT"
        transactions.append({
            "transaction_id": row['transaction_id'],
            "sender_id": row['sender_id'],
            "sender_name": row['sender_name'],
            "receiver_id": row['receiver_id'],
            "receiver_name": row['receiver_name'],
            "amount_paise": amount_paise,
            "amount_rupees": round(amount_paise / 100.0, 2),
            "type": txn_type,
            "status": row['status'],
            "timestamp": row['timestamp']
        })

    return jsonify({
        "user_id": user_id,
        "name": user['name'],
        "count": len(transactions),
        "transactions": transactions
    }), 200


# -------------------------------------------------------------
# User Management APIs (Support adding new users dynamically)
# -------------------------------------------------------------
@app.route('/api/users', methods=['GET'])
def list_users():
    """List all available wallet users for UI dropdown selection and balances."""
    conn = get_db_connection()
    users = conn.execute(
        "SELECT user_id, name, balance_paise FROM users ORDER BY user_id"
    ).fetchall()
    conn.close()

    result = []
    for u in users:
        result.append({
            "user_id": u['user_id'],
            "name": u['name'],
            "balance_paise": u['balance_paise'],
            "balance_rupees": round(u['balance_paise'] / 100.0, 2)
        })

    return jsonify(result), 200


@app.route('/api/users', methods=['POST'])
def create_user():
    """
    Create a new wallet user with custom name and initial balance.
    Allows testing with users beyond Alice and Bob.
    """
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    user_id = (data.get('user_id') or '').strip().upper()
    balance = data.get('initial_balance', data.get('balance', 0))

    if not name:
        return jsonify({"error": "User name is required."}), 400

    try:
        balance_float = float(balance)
        balance_paise = int(round(balance_float * 100))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid initial balance format. Must be numeric."}), 400

    if balance_paise < 0:
        return jsonify({"error": "Initial balance cannot be negative."}), 400

    conn = get_db_connection()
    try:
        if not user_id:
            # Auto-generate next user ID: U003, U004...
            max_row = conn.execute("SELECT user_id FROM users WHERE user_id LIKE 'U%' ORDER BY user_id DESC LIMIT 1").fetchone()
            if max_row and max_row['user_id'][1:].isdigit():
                next_num = int(max_row['user_id'][1:]) + 1
            else:
                next_num = 3
            user_id = f"U{next_num:03d}"
            while conn.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,)).fetchone():
                next_num += 1
                user_id = f"U{next_num:03d}"
        else:
            existing = conn.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,)).fetchone()
            if existing:
                conn.close()
                return jsonify({"error": f"User ID '{user_id}' already exists. Please choose a different ID."}), 409

        conn.execute(
            "INSERT INTO users (user_id, name, balance_paise) VALUES (?, ?, ?)",
            (user_id, name, balance_paise)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "message": "Wallet user created successfully.",
            "user": {
                "user_id": user_id,
                "name": name,
                "balance_paise": balance_paise,
                "balance_rupees": round(balance_paise / 100.0, 2)
            }
        }), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": f"Failed to create user: {str(e)}"}), 500


# -------------------------------------------------------------
# Helper: GET /api/test-summary (For Section D Dashboard Stats)
# -------------------------------------------------------------
@app.route('/api/test-summary', methods=['GET'])
def get_test_summary():
    """Returns parsed test statistics from the latest Newman test execution."""
    summary_path = os.path.join(REPORTS_DIR, 'test_summary.json')
    if os.path.exists(summary_path):
        try:
            with open(summary_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return jsonify(data), 200
        except Exception as e:
            return jsonify({"error": f"Failed to read test summary: {str(e)}"}), 500

    return jsonify({
        "executed": False,
        "total": 0,
        "passed": 0,
        "failed": 0,
        "message": "No test run recorded yet."
    }), 200


# -------------------------------------------------------------
# Helper: POST /api/run-tests (Trigger Actual Newman Run)
# -------------------------------------------------------------
@app.route('/api/run-tests', methods=['POST'])
def run_tests_endpoint():
    """
    Executes the Postman collection via Newman CLI against this running Flask backend.
    Restricted to local development environment.
    Generates fresh JSON and HTML reports with updated timestamps.
    """
    if request.remote_addr not in ('127.0.0.1', '::1', 'localhost'):
        return jsonify({"error": "Test execution restricted to local development environment."}), 403

    scripts_dir = os.path.join(BASE_DIR, 'scripts')
    execute_script = os.path.join(scripts_dir, 'execute_tests.py')

    if not os.path.exists(execute_script):
        return jsonify({"error": "Test runner script not found."}), 500

    import subprocess
    import sys

    try:
        # Run test execution script
        res = subprocess.run(
            [sys.executable, execute_script],
            capture_output=True,
            text=True,
            timeout=30
        )

        summary_path = os.path.join(REPORTS_DIR, 'test_summary.json')
        if os.path.exists(summary_path):
            with open(summary_path, 'r', encoding='utf-8') as f:
                summary_data = json.load(f)
                return jsonify(summary_data), 200

        return jsonify({
            "error": "Test execution finished but report was not generated.",
            "stdout": res.stdout,
            "stderr": res.stderr
        }), 500

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Test execution timed out after 30 seconds."}), 504
    except Exception as e:
        return jsonify({"error": f"Failed to execute tests: {str(e)}"}), 500


# -------------------------------------------------------------
# Helper: POST /api/reset-database (For Live Demo Reset)
# -------------------------------------------------------------
@app.route('/api/reset-database', methods=['POST'])
def reset_database_endpoint():
    """Resets users to initial sample balances and clears transactions."""
    from database import reset_to_initial_state
    reset_to_initial_state()
    return jsonify({
        "message": "Database reset successfully to initial state.",
        "accounts": [
            {"user_id": "U001", "name": "Alice", "balance_rupees": 5000.0},
            {"user_id": "U002", "name": "Bob", "balance_rupees": 2000.0}
        ]
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Starting WalletPay backend server on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
