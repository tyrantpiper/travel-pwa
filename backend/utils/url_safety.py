import re
import socket
import ipaddress
from urllib.parse import urlparse

def is_safe_url(url: str) -> bool:
    """
    🛡️ Centralized SSRF Prevention Utility.
    Checks if a URL is safe to fetch by the server.
    Blocks local and private network addresses (localhost, 127.0.0.1, 192.168.x.x, etc.)
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            return False
        
        hostname = parsed.hostname
        if not hostname:
            return False
            
        # 1. Block known local aliases directly
        hostname_lower = hostname.lower()
        if hostname_lower in ["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"]:
            return False
        
        # 2. Resolve hostname to check real IP
        # This prevents DNS rebinding attacks where a domain points to a local IP
        try:
            ip_addr = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_addr)
            
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast:
                 return False
        except socket.gaierror:
            # If resolution fails, it might be an internal-only name we can't resolve
            # In most cases, if we can't resolve it, we shouldn't attempt to fetch it
            return False
             
        return True
    except Exception:
        # Fallback to unsafe for any parsing errors
        return False
