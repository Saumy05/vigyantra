from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import re
import hashlib
from datetime import datetime
from typing import List, Dict, Any
import tempfile
import PyPDF2
import docx
import requests
from urllib.parse import urlparse

app = FastAPI(
    title="Vigyantra Python Microservice", 
    version="1.0.0",
    description="Resume vulnerability scanning and analysis service"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import our scanning modules
from scanners.malware_scanner import MalwareScanner
from scanners.privacy_scanner import PrivacyScanner
from scanners.link_scanner import LinkScanner
from parsers.resume_parser import ResumeParser

@app.get("/")
async def root():
    return {
        "message": "Vigyantra Python Microservice is running!",
        "version": "1.0.0",
        "capabilities": [
            "PDF parsing",
            "DOCX parsing", 
            "Malware detection",
            "Privacy analysis",
            "Link verification",
            "Content analysis"
        ]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "malware_scanner": "active",
            "privacy_scanner": "active", 
            "link_scanner": "active"
        }
    }

@app.post("/scan-resume/")
async def scan_resume(file: UploadFile = File(...)):
    try:
        # Validate file type
        allowed_types = ["application/pdf", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # Parse the resume
            parser = ResumeParser()
            parsed_content = parser.parse_file(temp_file_path, file.content_type)
            
            # Initialize scanners
            malware_scanner = MalwareScanner()
            privacy_scanner = PrivacyScanner()
            link_scanner = LinkScanner()
            
            # Perform scans
            malware_results = malware_scanner.scan(temp_file_path, parsed_content)
            privacy_results = privacy_scanner.scan(parsed_content)
            link_results = await link_scanner.scan(parsed_content)
            
            # Calculate overall risk
            risk_assessment = calculate_risk_score(malware_results, privacy_results, link_results)
            
            # Compile results
            scan_results = {
                "scanId": generate_scan_id(),
                "filename": file.filename,
                "fileSize": len(content),
                "contentType": file.content_type,
                "scanDate": datetime.now().isoformat(),
                "riskLevel": risk_assessment["level"],
                "riskScore": risk_assessment["score"],
                "vulnerabilities": malware_results["vulnerabilities"] + link_results["vulnerabilities"],
                "privacyIssues": privacy_results["issues"],
                "summary": {
                    "totalIssues": len(malware_results["vulnerabilities"]) + len(link_results["vulnerabilities"]),
                    "criticalIssues": len([v for v in malware_results["vulnerabilities"] + link_results["vulnerabilities"] if v["severity"] == "high"]),
                    "privacyRisk": privacy_results["risk_level"],
                    "extractedText": parsed_content.get("text", "")[:500] + "..." if len(parsed_content.get("text", "")) > 500 else parsed_content.get("text", "")
                }
            }
            
            return scan_results
            
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scanning failed: {str(e)}")

def calculate_risk_score(malware_results: Dict, privacy_results: Dict, link_results: Dict) -> Dict[str, Any]:
    """Calculate overall risk score and level"""
    base_score = 0
    
    # Malware contribution (0-40 points)
    malware_score = min(len(malware_results["vulnerabilities"]) * 15, 40)
    
    # Privacy contribution (0-30 points)  
    privacy_score = min(len(privacy_results["issues"]) * 5, 30)
    
    # Link contribution (0-30 points)
    link_score = min(len(link_results["vulnerabilities"]) * 10, 30)
    
    total_score = malware_score + privacy_score + link_score
    
    if total_score >= 70:
        level = "high"
    elif total_score >= 30:
        level = "medium"
    else:
        level = "low"
        
    return {
        "score": total_score,
        "level": level,
        "breakdown": {
            "malware": malware_score,
            "privacy": privacy_score,
            "links": link_score
        }
    }

def generate_scan_id() -> str:
    """Generate unique scan ID"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_hash = hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]
    return f"vigyantra_{timestamp}_{random_hash}"

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
