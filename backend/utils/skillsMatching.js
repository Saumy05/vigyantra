// utils/skillsMatching.js
const natural = require('natural');

/**
 * Advanced skills matching algorithm
 * Uses fuzzy matching and synonyms for better accuracy
 */
class SkillsMatcher {
  constructor() {
    // Common skill synonyms for better matching
    this.skillSynonyms = {
      'javascript': ['js', 'node.js', 'nodejs', 'es6', 'es2015'],
      'python': ['py', 'django', 'flask'],
      'react': ['reactjs', 'react.js'],
      'angular': ['angularjs', 'angular.js'],
      'machine learning': ['ml', 'ai', 'artificial intelligence'],
      'database': ['db', 'sql', 'nosql', 'mongodb', 'mysql'],
      'frontend': ['front-end', 'ui', 'user interface'],
      'backend': ['back-end', 'server-side', 'api']
    };
  }

  /**
   * Calculate match score between resume skills and job requirements
   */
  calculateMatchScore(resumeSkills, jobSkills) {
    if (!resumeSkills || !jobSkills || jobSkills.length === 0) return 0;

    const normalizedResumeSkills = this.normalizeSkills(resumeSkills);
    const normalizedJobSkills = this.normalizeSkills(jobSkills);
    
    let matchedSkills = [];
    let totalMatches = 0;
    
    for (const jobSkill of normalizedJobSkills) {
      const match = this.findSkillMatch(jobSkill, normalizedResumeSkills);
      if (match.found) {
        matchedSkills.push(match.skill);
        totalMatches += match.confidence;
      }
    }
    
    // Calculate weighted score
    const baseScore = (totalMatches / normalizedJobSkills.length) * 100;
    const bonusScore = this.calculateBonusScore(normalizedResumeSkills, normalizedJobSkills);
    
    return Math.min(Math.round(baseScore + bonusScore), 100);
  }

  /**
   * Find detailed match information
   */
  getMatchDetails(resumeSkills, jobSkills) {
    const normalizedResumeSkills = this.normalizeSkills(resumeSkills);
    const normalizedJobSkills = this.normalizeSkills(jobSkills);
    
    const matched = [];
    const missing = [];
    
    for (const jobSkill of normalizedJobSkills) {
      const match = this.findSkillMatch(jobSkill, normalizedResumeSkills);
      if (match.found) {
        matched.push(jobSkill);
      } else {
        missing.push(jobSkill);
      }
    }
    
    return { matched, missing };
  }

  /**
   * Normalize skills (lowercase, trim, handle synonyms)
   */
  normalizeSkills(skills) {
    return skills.map(skill => {
      const normalized = skill.toLowerCase().trim();
      
      // Check for synonyms
      for (const [mainSkill, synonyms] of Object.entries(this.skillSynonyms)) {
        if (synonyms.includes(normalized)) {
          return mainSkill;
        }
      }
      
      return normalized;
    });
  }

  /**
   * Find if a job skill matches any resume skill (with fuzzy matching)
   */
  findSkillMatch(jobSkill, resumeSkills) {
    // Exact match first
    if (resumeSkills.includes(jobSkill)) {
      return { found: true, skill: jobSkill, confidence: 1.0 };
    }
    
    // Fuzzy match
    for (const resumeSkill of resumeSkills) {
      const similarity = natural.JaroWinklerDistance(jobSkill, resumeSkill);
      if (similarity > 0.8) { // 80% similarity threshold
        return { found: true, skill: resumeSkill, confidence: similarity };
      }
    }
    
    return { found: false, skill: null, confidence: 0 };
  }

  /**
   * Calculate bonus score for extra skills
   */
  calculateBonusScore(resumeSkills, jobSkills) {
    const extraSkills = resumeSkills.filter(skill => !jobSkills.includes(skill));
    return Math.min(extraSkills.length * 2, 15); // Max 15 bonus points
  }
}

module.exports = new SkillsMatcher();
