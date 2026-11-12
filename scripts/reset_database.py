#!/usr/bin/env python3
"""
Database reset script for WalletPay demonstration.
Restores initial sample balances:
- Alice (U001): ₹5,000.00
- Bob (U002): ₹2,000.00
Clears all transaction history.
"""

import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
sys.path.insert(0, backend_dir)

from database import reset_to_initial_state, get_db_connection

def main():
    print("=" * 60)
    print("Resetting WalletPay Database to Initial State...")
    print("=" * 60)

    reset_to_initial_state()

    conn = get_db_connection()
    users = conn.execute("SELECT user_id, name, balance_paise FROM users ORDER BY user_id").fetchall()
    tx_count = conn.execute("SELECT COUNT(*) as count FROM transactions").fetchone()['count']
    conn.close()

    print("\nInitial Accounts Restored:")
    for u in users:
        print(f"  • {u['name']} (ID: {u['user_id']}) -> Balance: ₹{u['balance_paise'] / 100:,.2f}")

    print(f"\nTransaction count: {tx_count}")
    print("\nDatabase is now clean and ready for demonstration and testing!")
    print("=" * 60)

if __name__ == '__main__':
    main()
