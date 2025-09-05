import PyPDF2
import docx
import re
from typing import Dict, List, Any

class ResumeParser:
    def __init__(self):
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        self.phone_pattern = re.compile(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
        self.url_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
        
    def parse_file(self, file_path: str, content_type: str) -> Dict[str, Any]:
        """Parse resume file and extract content"""
        if content_type == "application/pdf":
            return self._parse_pdf(file_path)
        elif content_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
            return self._parse_docx(file_path)
        else:
            raise ValueError(f"Unsupported file type: {content_type}")
    
    def _parse_pdf(self, file_path: str) -> Dict[str, Any]:
        """Parse PDF file"""
        text = ""
        metadata = {}
        
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Extract metadata
                if pdf_reader.metadata:
                    metadata = {
                        'title': pdf_reader.metadata.get('/Title', ''),
                        'author': pdf_reader.metadata.get('/Author', ''),
                        'creator': pdf_reader.metadata.get('/Creator', ''),
                        'producer': pdf_reader.metadata.get('/Producer', ''),
                        'creation_date': str(pdf_reader.metadata.get('/CreationDate', '')),
                        'modification_date': str(pdf_reader.metadata.get('/ModDate', ''))
                    }
                
                # Extract text from all pages
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
                    
        except Exception as e:
            raise Exception(f"PDF parsing failed: {str(e)}")
        
        return self._analyze_content(text, metadata)
    
    def _parse_docx(self, file_path: str) -> Dict[str, Any]:
        """Parse DOCX file"""
        text = ""
        metadata = {}
        
        try:
            doc = docx.Document(file_path)
            
            # Extract metadata
            core_props = doc.core_properties
            metadata = {
                'title': core_props.title or '',
                'author': core_props.author or '',
                'creator': core_props.author or '',
                'last_modified_by': core_props.last_modified_by or '',
                'created': str(core_props.created) if core_props.created else '',
                'modified': str(core_props.modified) if core_props.modified else ''
            }
            
            # Extract text from paragraphs
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
                
        except Exception as e:
            raise Exception(f"DOCX parsing failed: {str(e)}")
        
        return self._analyze_content(text, metadata)
    
    def _analyze_content(self, text: str, metadata: Dict) -> Dict[str, Any]:
        """Analyze extracted content"""
        emails = self.email_pattern.findall(text)
        phones = self.phone_pattern.findall(text)
        urls = self.url_pattern.findall(text)
        
        return {
            'text': text,
            'metadata': metadata,
            'extracted_data': {
                'emails': emails,
                'phone_numbers': phones,
                'urls': urls
            },
            'statistics': {
                'character_count': len(text),
                'word_count': len(text.split()),
                'line_count': len(text.split('\n'))
            }
        }
