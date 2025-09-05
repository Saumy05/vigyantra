import re
import asyncio
import aiohttp
from urllib.parse import urlparse
from typing import Dict, List, Any

class LinkScanner:
    def __init__(self):
        self.url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        
        # Known malicious/suspicious domains (basic list)
        self.suspicious_domains = [
            'bit.ly',
            'tinyurl.com',
            'short.link',
            'malware-test.com',
            'phishing-test.com'
        ]
        
        # Known safe domains
        self.safe_domains = [
            'linkedin.com',
            'github.com',
            'google.com',
            'stackoverflow.com',
            'medium.com'
        ]
    
    async def scan(self, parsed_content: Dict[str, Any]) -> Dict[str, Any]:
        """Scan URLs for security issues"""
        text = parsed_content.get('text', '')
        urls = self.url_pattern.findall(text)
        
        vulnerabilities = []
        
        if not urls:
            return {'vulnerabilities': []}
        
        # Analyze each URL
        for url in urls:
            url_analysis = await self._analyze_url(url)
            if url_analysis['is_suspicious']:
                vulnerabilities.append({
                    'type': 'Suspicious URL',
                    'severity': url_analysis['severity'],
                    'description': f'Potentially malicious URL detected: {url}',
                    'details': url_analysis['reason'],
                    'recommendation': 'Verify URL safety before including in resume. Consider using official website links instead.'
                })
        
        return {
            'vulnerabilities': vulnerabilities,
            'url_summary': {
                'total_urls': len(urls),
                'suspicious_urls': len(vulnerabilities),
                'analyzed_urls': urls
            }
        }
    
    async def _analyze_url(self, url: str) -> Dict[str, Any]:
        """Analyze individual URL for security issues"""
        try:
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            
            # Check against known suspicious domains
            if any(suspicious in domain for suspicious in self.suspicious_domains):
                return {
                    'is_suspicious': True,
                    'severity': 'high',
                    'reason': f'URL uses suspicious domain: {domain}'
                }
            
            # Check for URL shorteners
            shortener_domains = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'short.link']
            if any(shortener in domain for shortener in shortener_domains):
                return {
                    'is_suspicious': True,
                    'severity': 'medium',
                    'reason': 'URL uses link shortener which could hide malicious destination'
                }
            
            # Check for suspicious URL patterns
            if re.search(r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}', domain):
                return {
                    'is_suspicious': True,
                    'severity': 'medium',
                    'reason': 'URL uses IP address instead of domain name'
                }
            
            # Check for safe domains
            if any(safe in domain for safe in self.safe_domains):
                return {
                    'is_suspicious': False,
                    'severity': 'none',
                    'reason': 'URL uses known safe domain'
                }
            
            # Try to verify URL accessibility (with timeout)
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                    async with session.head(url) as response:
                        if response.status >= 400:
                            return {
                                'is_suspicious': True,
                                'severity': 'low',
                                'reason': f'URL returns error status: {response.status}'
                            }
            except:
                return {
                    'is_suspicious': True,
                    'severity': 'low',
                    'reason': 'URL is not accessible or takes too long to respond'
                }
            
            return {
                'is_suspicious': False,
                'severity': 'none',
                'reason': 'URL appears to be safe'
            }
            
        except Exception as e:
            return {
                'is_suspicious': True,
                'severity': 'low',
                'reason': f'URL analysis failed: {str(e)}'
            }
