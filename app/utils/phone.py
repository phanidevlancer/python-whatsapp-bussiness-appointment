"""
Phone number normalization utilities for consistent handling across the application.
"""

import re
from typing import List


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to a consistent format for storage and comparison.
    
    Removes leading '+' and '0' characters to create a canonical representation.
    
    Args:
        phone: Raw phone number string
        
    Returns:
        Normalized phone number without leading '+' or '0'
        
    Example:
        >>> normalize_phone("+919876543210")
        '919876543210'
        >>> normalize_phone("09876543210")
        '9876543210'
        >>> normalize_phone("9876543210")
        '9876543210'
    """
    if not phone:
        return phone
    
    # Strip whitespace
    phone = phone.strip()
    
    # Remove leading '+' and '0' characters
    normalized = phone.lstrip('+').lstrip('0')
    
    return normalized


def get_phone_variants(phone: str) -> List[str]:
    """
    Generate all possible variants of a phone number for comprehensive matching.
    
    Args:
        phone: Phone number (can be normalized or raw)
        
    Returns:
        List of phone variants including:
        - Normalized form
        - With '+' prefix
        - Original form
        
    Example:
        >>> get_phone_variants("919876543210")
        ['919876543210', '+919876543210', '919876543210']
    """
    normalized = normalize_phone(phone)
    
    variants = {
        normalized,  # Normalized form
        f"+{normalized}",  # With '+' prefix
        phone,  # Original form
    }
    
    # Also add variant with leading '0' if it doesn't already start with one
    if not normalized.startswith('0'):
        variants.add(f"0{normalized}")
    
    return list(variants)


def phones_match(phone1: str, phone2: str) -> bool:
    """
    Check if two phone numbers represent the same number.
    
    Args:
        phone1: First phone number
        phone2: Second phone number
        
    Returns:
        True if both phones match after normalization
        
    Example:
        >>> phones_match("+919876543210", "09876543210")
        True
    """
    if not phone1 or not phone2:
        return False
    
    return normalize_phone(phone1) == normalize_phone(phone2)


def format_phone_display(phone: str, country_code: str = "+91") -> str:
    """
    Format phone number for display purposes.
    
    Args:
        phone: Phone number
        country_code: Default country code to prepend if missing
        
    Returns:
        Formatted phone number with country code
    """
    normalized = normalize_phone(phone)
    
    # Add country code if not present
    if not normalized.startswith('+'):
        if not normalized.startswith(country_code.lstrip('+')):
            normalized = f"{country_code}{normalized}"
        normalized = f"+{normalized}"
    
    return normalized
