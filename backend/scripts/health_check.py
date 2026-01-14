import os
import sys
import importlib
import pkgutil
import traceback

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

def check_modules(package_name):
    """Recursively check all modules in a package."""
    print(f"🔍 Checking package: {package_name}...")
    
    package_path = os.path.join(backend_dir, package_name.replace('.', '/'))
    if not os.path.exists(package_path):
        print(f"⚠️ Package path not found: {package_path}")
        return True

    failed = False
    
    # Iterate through all modules in the package
    for _, name, is_pkg in pkgutil.iter_modules([package_path]):
        full_name = f"{package_name}.{name}"
        try:
            print(f"   Testing import: {full_name}...", end="")
            importlib.import_module(full_name)
            print(" ✅")
        except Exception as e:
            print(" ❌ FAILED")
            print(f"🔥 Error importing {full_name}:")
            traceback.print_exc()
            failed = True
            
    return not failed

def main():
    print("🛡️ Starting Backend Health Check...")
    print("====================================")
    
    success = True
    
    # 1. Check Core Packages
    packages_to_check = ['routers', 'models', 'utils', 'services']
    
    for pkg in packages_to_check:
        if not check_modules(pkg):
            success = False
            
    # 2. Check main.py
    print("\n🔍 Checking main.py...")
    try:
        import main
        print("   ✅ main.py imported successfully")
    except Exception as e:
        print("   ❌ main.py FAILED")
        traceback.print_exc()
        success = False
        
    print("\n====================================")
    if success:
        print("✅ Health Check Passed! Codebase integrity looks good.")
        sys.exit(0)
    else:
        print("❌ Health Check Failed! Please fix the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
