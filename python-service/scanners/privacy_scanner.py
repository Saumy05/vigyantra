import re
from typing import Dict, List, Any

class PrivacyScanner:
    def __init__(self):
        # Personal information patterns
        self.patterns = {
            'email': re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
            'phone': re.compile(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'),
            'ssn': re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
            'credit_card': re.compile(r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'),
            'address': re.compile(r'\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)'),
            'date_of_birth': re.compile(r'\b(?:\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{4}[/\-]\d{1,2}[/\-]\d{1,2})\b'),
        }
        
        # Privacy risk levels
        self.risk_levels = {
            'ssn': 'high',
            'credit_card': 'high',
            'date_of_birth': 'medium',
            'address': 'medium',
            'phone': 'low',
            'email': 'low'
        }
    
    def scan(self, parsed_content: Dict[str, Any]) -> Dict[str, Any]:
        """Scan for privacy-related information"""
        text = parsed_content.get('text', '')
        issues = []
        
        for info_type, pattern in self.patterns.items():
            matches = pattern.findall(text)
            if matches:
                issues.append({
                    'type': info_type.replace('_', ' ').title(),
                    'count': len(matches),
                    'risk_level': self.risk_levels.get(info_type, 'low'),
                    'examples': matches[:3],  # Show first 3 examples
                    'recommendation': self._get_recommendation(info_type)
                })
        
        # Calculate overall privacy risk
        risk_level = self._calculate_privacy_risk(issues)
        
        return {
            'issues': issues,
            'risk_level': risk_level,
            'summary': {
                'total_types': len(issues),
                'high_risk_items': len([i for i in issues if i['risk_level'] == 'high']),
                'total_exposures': sum(issue['count'] for issue in issues)
            }
        }
    
    def _calculate_privacy_risk(self, issues: List[Dict[str, Any]]) -> str:
        """Calculate overall privacy risk level"""
        if any(issue['risk_level'] == 'high' for issue in issues):
            return 'high'
        elif any(issue['risk_level'] == 'medium' for issue in issues):
            return 'medium'
        elif issues:
            return 'low'
        else:
            return 'none'
    
    def _get_recommendation(self, info_type: str) -> str:
        """Get privacy recommendation for specific information type"""
        recommendations = {
            'email': 'Consider using a professional email address only. Avoid personal email addresses.',
            'phone': 'Include only necessary contact information. Consider using a professional phone number.',
            'ssn': 'CRITICAL: Remove Social Security Number immediately. Never include SSN in resumes.',
            'credit_card': 'CRITICAL: Remove credit card information immediately. This should never be in a resume.',
            'address': 'Consider including only city and state. Full home address may not be necessary.',
            'date_of_birth': 'Remove date of birth. This information can lead to age discrimination.'
        }
        return recommendations.get(info_type, 'Consider if this information is necessary for the resume.')
