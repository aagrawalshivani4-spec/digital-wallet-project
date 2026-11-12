#!/usr/bin/env python3
"""
Automated Test Runner for WalletPay
Runs the 5 Postman test scenarios using Newman CLI, generates genuine JSON and HTML reports,
and writes updated execution statistics.
"""

import os
import sys
import json
import time
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKSPACE_DIR = os.path.dirname(PROJECT_DIR)
NEWMAN_BIN = os.path.join(WORKSPACE_DIR, 'newman-runner', 'node_modules', '.bin', 'newman')
NODE_MODULES = os.path.join(WORKSPACE_DIR, 'newman-runner', 'node_modules')

COLLECTION_PATH = os.path.join(PROJECT_DIR, 'postman', 'Digital_Wallet_API_Tests.postman_collection.json')
ENVIRONMENT_PATH = os.path.join(PROJECT_DIR, 'postman', 'Digital_Wallet_Environment.postman_environment.json')
REPORTS_DIR = os.path.join(PROJECT_DIR, 'reports')
REPORT_HTML = os.path.join(REPORTS_DIR, 'postman_test_report.html')
REPORT_JSON = os.path.join(REPORTS_DIR, 'postman_run_result.json')
SUMMARY_TXT = os.path.join(REPORTS_DIR, 'test_execution_summary.txt')
SUMMARY_JSON = os.path.join(REPORTS_DIR, 'test_summary.json')

PORT = int(os.environ.get('PORT', 5001))
BACKEND_URL = f"http://127.0.0.1:{PORT}"


def check_backend():
    """Verify backend is healthy."""
    try:
        req = urllib.request.Request(f"{BACKEND_URL}/api/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                return True
    except Exception:
        return False
    return False


def reset_database():
    """Reset the database before testing."""
    sys.path.insert(0, os.path.join(PROJECT_DIR, 'backend'))
    from database import reset_to_initial_state
    reset_to_initial_state()


def run_newman():
    """Execute Newman and generate reports."""
    os.makedirs(REPORTS_DIR, exist_ok=True)

    env = os.environ.copy()
    env['NODE_PATH'] = f"{NODE_MODULES}:{os.path.join(PROJECT_DIR, 'node_modules')}"

    newman_cmd = "newman"
    if os.path.exists(NEWMAN_BIN):
        newman_cmd = NEWMAN_BIN

    cmd = [
        newman_cmd,
        "run",
        COLLECTION_PATH,
        "-e", ENVIRONMENT_PATH,
        "-r", "cli,htmlextra,json",
        "--reporter-htmlextra-export", REPORT_HTML,
        "--reporter-htmlextra-title", "WalletPay Automated API Test Execution Report",
        "--reporter-json-export", REPORT_JSON
    ]

    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Executing Newman Test Suite...")
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    
    print(result.stdout)
    if result.stderr:
        print("Newman Stderr:", result.stderr)

    return result.returncode


def generate_summaries():
    """Parse JSON run results and output genuine structured summaries."""
    if not os.path.exists(REPORT_JSON):
        print(f"Error: {REPORT_JSON} not found!")
        return None

    with open(REPORT_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    stats = data.get('run', {}).get('stats', {})
    assertions = stats.get('assertions', {})
    requests = stats.get('requests', {})
    timings = data.get('run', {}).get('timings', {})

    total_assertions = assertions.get('total', 0)
    failed_assertions = assertions.get('failed', 0)
    passed_assertions = total_assertions - failed_assertions

    total_requests = requests.get('total', 0)
    failed_requests = requests.get('failed', 0)

    started_at = timings.get('started', time.time() * 1000)
    completed_at = timings.get('completed', time.time() * 1000)
    duration_ms = round(completed_at - started_at, 2)

    # Analyze execution failures per scenario item from genuine Newman data
    failures = data.get('run', {}).get('failures', [])
    
    # Map the 5 scenario names
    scenario_meta = [
        {"id": 1, "name": "Valid money transfer – expected success", "match": "1. Valid"},
        {"id": 2, "name": "Insufficient balance – expected rejection", "match": "2. Insufficient"},
        {"id": 3, "name": "Zero amount – expected rejection", "match": "3. Zero"},
        {"id": 4, "name": "Invalid receiver – expected rejection", "match": "4. Invalid"},
        {"id": 5, "name": "Duplicate transaction ID – expected rejection", "match": "5. Duplicate"}
    ]

    scenario_results = []
    for meta in scenario_meta:
        # Check if any failure corresponds to this scenario
        matched_fails = [f for f in failures if meta["match"] in str(f)]
        if matched_fails:
            status = "FAILED"
            fail_reason = matched_fails[0].get("error", {}).get("message", "Assertion failed")
        else:
            status = "PASSED"
            fail_reason = None

        scenario_results.append({
            "id": meta["id"],
            "name": meta["name"],
            "status": status,
            "error": fail_reason
        })

    exec_time_str = datetime.now().strftime('%b %d, %Y, %I:%M:%S %p')

    # Save summary JSON for frontend
    summary_data = {
        "executed": True,
        "total": total_assertions,
        "passed": passed_assertions,
        "failed": failed_assertions,
        "requests_total": total_requests,
        "requests_failed": failed_requests,
        "duration_ms": duration_ms,
        "execution_time": exec_time_str,
        "report_file": "postman_test_report.html",
        "scenarios": scenario_results
    }

    with open(SUMMARY_JSON, 'w', encoding='utf-8') as f:
        json.dump(summary_data, f, indent=2)

    # Save summary TXT
    summary_text = f"""================================================================================
WALLETPAY AUTOMATED API TESTING EXECUTION SUMMARY
Project: Digital Wallet and Money Transfer System
Framework: Postman Collection (v2.1.0) & Newman CLI Runner
Execution Timestamp: {exec_time_str}
================================================================================

TEST EXECUTION STATISTICS:
--------------------------------------------------------------------------------
Total Requests Executed:    {total_requests}
Requests Failed:            {failed_requests}
Total Assertions:           {total_assertions}
Passed Assertions:          {passed_assertions}
Failed Assertions:          {failed_assertions}
Success Rate:               {(passed_assertions / total_assertions * 100) if total_assertions else 0:.1f}%
Total Run Duration:         {duration_ms} ms

VERIFIED FIVE TEST SCENARIOS:
--------------------------------------------------------------------------------
"""
    for sc in scenario_results:
        tag = "[PASS]" if sc["status"] == "PASSED" else "[FAIL]"
        summary_text += f"{tag} Scenario {sc['id']}: {sc['name']}\n"
        if sc.get("error"):
            summary_text += f"       Error Details: {sc['error']}\n"

    summary_text += f"""
REPORTS GENERATED:
--------------------------------------------------------------------------------
- Interactive HTML Report: reports/postman_test_report.html
- Machine Summary JSON:   reports/test_summary.json
- Human Summary Text:     reports/test_execution_summary.txt
================================================================================
"""

    with open(SUMMARY_TXT, 'w', encoding='utf-8') as f:
        f.write(summary_text)

    print(f"\nReports successfully generated:")
    print(f"  • HTML Report:  {REPORT_HTML}")
    print(f"  • Summary JSON: {SUMMARY_JSON}")
    print(f"  • Summary TXT:  {SUMMARY_TXT}")
    print(f"Result: {passed_assertions}/{total_assertions} Passed ({failed_assertions} Failed)")

    return summary_data


def execute_suite():
    """Main execution function callable from CLI or Flask endpoint."""
    reset_database()
    if not check_backend():
        return None, "Backend server is not running on " + BACKEND_URL

    code = run_newman()
    summary = generate_summaries()
    return summary, None


def main():
    print("=" * 70)
    print("Executing WalletPay Automated Postman Test Suite via Newman")
    print("=" * 70)

    summary, err = execute_suite()
    if err:
        print(f"Execution Error: {err}")
        return 1

    return 0 if summary and summary.get("failed") == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
