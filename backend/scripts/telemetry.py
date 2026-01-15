import os
import sys
import datetime
import argparse
import time
import platform

# Determine platform for locking strategy
IS_WINDOWS = platform.system() == "Windows"

if IS_WINDOWS:
    import msvcrt
else:
    import fcntl

# Path config
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(CURRENT_DIR))
TELEMETRY_DIR = os.path.join(PROJECT_ROOT, ".agent", "telemetry")

# Ensure telemetry dir exists
os.makedirs(TELEMETRY_DIR, exist_ok=True)

DEFAULT_LOG_FILE = os.path.join(TELEMETRY_DIR, "tool_usage.log")

def acquire_lock(file_handle):
    """Acquire an exclusive lock on the file."""
    if IS_WINDOWS:
        # msvcrt.locking expects file descriptor, but here we might have a file object.
        # It's safer/easier on Windows Python to use a separate .lock file or just retry.
        # For simplicity in this script, we'll try a basic retry loop with atomic append,
        # but true 'lock' on Windows file handle requires lower level API.
        # Let's rely on atomic append for now, or implement a spin-lock.
        # Spin-lock implementation:
        pass 
    else:
        fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX)

def release_lock(file_handle):
    """Release the lock."""
    if IS_WINDOWS:
        pass
    else:
        fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)

def log_event(source, message, level="INFO", log_file=DEFAULT_LOG_FILE):
    timestamp = datetime.datetime.now().isoformat()
    log_entry = f"[{timestamp}] [{level}] [{source}] {message}\n"
    
    # Retry mechanism for simple concurrency safety
    max_retries = 5
    for attempt in range(max_retries):
        try:
            with open(log_file, "a", encoding="utf-8") as f:
                # On Windows, opening in 'a' mode is usually atomic for small writes at OS level
                # but explicit locking is better for strict correctness.
                # Given environment constraints, we use a simple append.
                f.write(log_entry)
            return True
        except PermissionError:
            # File might be locked by another process
            time.sleep(0.1)
            continue
        except Exception as e:
            print(f"Failed to write log: {e}")
            return False
            
    print(f"Failed to acquire lock after {max_retries} attempts.")
    return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Centralized Telemetry Logger")
    parser.add_argument("--source", required=True, help="Source of the event (e.g., 'Logic Audit')")
    parser.add_argument("--message", required=True, help="Log message content")
    parser.add_argument("--level", default="INFO", help="Log level (INFO, WARN, ERROR)")
    parser.add_argument("--file", default="tool_usage.log", help="Target log file name (in .agent/telemetry/)")
    
    args = parser.parse_args()
    
    target_file = os.path.join(TELEMETRY_DIR, args.file)
    
    success = log_event(args.source, args.message, args.level, target_file)
    if not success:
        sys.exit(1)
