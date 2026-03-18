import re
import socket
import ipaddress
from urllib.parse import urlparse

def is_safe_url(url: str) -> bool:
    """
    🛡️ Centralized SSRF Prevention Utility.
    Checks if a URL is safe to fetch by the server.
    """
    return get_safe_ip(url) is not None

def get_safe_ip(url: str) -> str:
    """
    🛡️ Anti-DNS-Rebinding IP Resolver.
    Resolves the hostname and checks if the IP is safe (public).
    Returns the IP string if safe, otherwise returns None.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            return None
        
        hostname = parsed.hostname
        if not hostname:
            return None
            
        # 1. Block known local aliases directly
        hostname_lower = hostname.lower()
        if hostname_lower in ["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"]:
            return None
        
        # 2. Resolve hostname to check real IP
        # 🛡️ DNS Rebinding Protection: We resolve it ONCE here.
        try:
            ip_addr = socket.gethostbyname(hostname)
            ip = ipaddress.ip_address(ip_addr)
            
            # Block loopback, private, link-local, and multicast
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast:
                 return None
            
            return str(ip)
        except socket.gaierror:
            return None
             
    except Exception:
        return None
