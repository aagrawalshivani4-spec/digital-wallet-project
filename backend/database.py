"""
Database module for WalletPay Digital Wallet Application.
Uses SQLite with integer paise representation for currency to eliminate rounding errors.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wallet.db')


def get_db_connection():
    """Create a database connection with row factory enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(reset=False):
    """
    Initialize SQLite database tables and seed sample accounts:
    - Alice (U001): ₹5,000 (500,000 paise)
    - Bob (U002): ₹2,000 (200,000 paise)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    if reset:
        cursor.execute("DROP TABLE IF EXISTS transactions")
        cursor.execute("DROP TABLE IF EXISTS users")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id TEXT PRIMARY KEY,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
            status TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (sender_id) REFERENCES users (user_id),
            FOREIGN KEY (receiver_id) REFERENCES users (user_id)
        )
    """)

    # Seed initial sample users if not already present
    sample_users = [
        ('U001', 'Alice', 500000),  # ₹5,000
        ('U002', 'Bob', 200000)     # ₹2,000
    ]

    for user_id, name, balance_paise in sample_users:
        cursor.execute("""
            INSERT OR IGNORE INTO users (user_id, name, balance_paise)
            VALUES (?, ?, ?)
        """, (user_id, name, balance_paise))

    if reset:
        # If explicitly resetting, ensure the balances are reset to exact defaults
        for user_id, name, balance_paise in sample_users:
            cursor.execute("""
                UPDATE users SET balance_paise = ? WHERE user_id = ?
            """, (balance_paise, user_id))

    conn.commit()
    conn.close()


def reset_to_initial_state():
    """Reset transactions and restore initial balances."""
    init_db(reset=True)


if __name__ == '__main__':
    init_db(reset=True)
    print(f"Database initialized successfully at {DB_PATH}")
