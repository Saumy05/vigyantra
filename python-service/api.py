from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import tempfile
import os
import re
import PyPDF2
import pdfplumber
from typing import Dict, List

app = FastAPI(title="Vigyantra Resume Scanner", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfplumber (better than PyPDF2)"""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        # Fallback to PyPDF2
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Could not extract text: {str(e2)}")

def extract_resume_info(text: str) -> Dict:
    """Extract key information from resume text"""
    # Email extraction
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(email_pattern, text)
    
    # Phone extraction
    phone_pattern = r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    phones = re.findall(phone_pattern, text)
    
    # Extract name (first few lines usually contain name)
    lines = text.split('\n')
    name = ""
    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if len(line) > 2 and not '@' in line and not any(char.isdigit() for char in line):
            if len(line.split()) <= 4:  # Names usually 1-4 words
                name = line
                break
    
    # Extract skills (look for common skill keywords)
    skill_keywords = [
        'python', 'javascript', 'java', 'react', 'angular', 'node', 'express',
        'mongodb', 'sql', 'mysql', 'postgresql', 'html', 'css', 'git',
        'aws', 'docker', 'kubernetes', 'machine learning', 'data analysis',
        'project management', 'leadership', 'communication', 'teamwork',
        'warehouse', 'logistics', 'supply chain', 'inventory', 'packing',
        'picking', 'shipping', 'cleaning', 'sanitation'
    ]
    
    found_skills = []
    text_lower = text.lower()
    for skill in skill_keywords:
        if skill in text_lower:
            found_skills.append(skill.title())
    
    # Experience extraction (look for years)
    experience_years = 0
    year_pattern = r'(\d{4})\s*[-–—]\s*(\d{4})'
    year_matches = re.findall(year_pattern, text)
    if year_matches:
        total_months = 0
        for start, end in year_matches:
            years_diff = int(end) - int(start)
            total_months += years_diff * 12
        experience_years = total_months // 12
    
    return {
        "candidate_info": {
            "name": name or "Name not found",
            "email": emails[0] if emails else "Email not found",
            "phone": phones[0] if phones else "Phone not found"
        },
        "extracted_skills": found_skills,
        "experience_years": experience_years,
        "full_text": text[:500] + "..." if len(text) > 500 else text  # Truncate for response
    }

@app.get("/")
async def root():
    return {"message": "Vigyantra Resume Scanner is ready!"}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "resume-scanner"}

@app.post("/scan-resume/")
async def scan_resume(file: UploadFile = File(...)):
    try:
        # Validate file type
        if not file.content_type in ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            raise HTTPException(status_code=400, detail="Only PDF, DOC, and DOCX files are supported")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # Extract text based on file type
            if file.content_type == 'application/pdf':
                extracted_text = extract_text_from_pdf(tmp_file_path)
            else:
                # For DOC/DOCX files, you'd use python-docx here
                extracted_text = "DOC/DOCX processing not implemented yet"
            
            # Extract resume information
            resume_data = extract_resume_info(extracted_text)
            
            # Calculate risk score (simple example)
            risk_score = 15  # Low risk for this example
            if len(resume_data["extracted_skills"]) < 3:
                risk_score += 10  # Higher risk if few skills
            
            risk_level = "low" if risk_score < 30 else "medium" if risk_score < 60 else "high"
            
            return {
                "success": True,
                "filename": file.filename,
                "file_type": file.content_type,
                "candidate_info": resume_data["candidate_info"],
                "extracted_skills": resume_data["extracted_skills"],
                "experience_years": resume_data["experience_years"],
                "risk_level": risk_level,
                "risk_score": risk_score,
                "vulnerabilities": [],  # No vulnerabilities found
                "privacy_issues": [
                    {"type": "Email", "count": 1 if resume_data["candidate_info"]["email"] != "Email not found" else 0},
                    {"type": "Phone", "count": 1 if resume_data["candidate_info"]["phone"] != "Phone not found" else 0}
                ],
                "summary": f"Successfully processed resume. Found {len(resume_data['extracted_skills'])} skills."
            }
            
        finally:
            # Clean up temporary file
            os.unlink(tmp_file_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
