/**
 * Documentation System
 * Comprehensive documentation and training materials for Ads Pro Enterprise
 * 
 * Features:
 * - User guides and tutorials
 * - API documentation
 * - Troubleshooting guides
 * - Best practices
 * - Training materials
 * - Interactive documentation
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DocumentationSection {
  id: string;
  title: string;
  description: string;
  category: 'user-guide' | 'api-docs' | 'troubleshooting' | 'best-practices' | 'training' | 'deployment';
  content: DocumentationContent[];
  tags: string[];
  lastUpdated: Date;
  version: string;
  author: string;
}

export interface DocumentationContent {
  id: string;
  type: 'text' | 'code' | 'image' | 'video' | 'interactive' | 'table' | 'list';
  title: string;
  content: string;
  metadata?: Record<string, any>;
  order: number;
}

export interface UserGuide {
  id: string;
  title: string;
  description: string;
  targetAudience: 'beginner' | 'intermediate' | 'advanced' | 'admin';
  steps: GuideStep[];
  prerequisites: string[];
  estimatedTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface GuideStep {
  id: string;
  title: string;
  description: string;
  action: string;
  expectedResult: string;
  codeExample?: string;
  screenshot?: string;
  tips?: string[];
  warnings?: string[];
}

export interface APIDocumentation {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  title: string;
  description: string;
  parameters: APIParameter[];
  responses: APIResponse[];
  examples: APIExample[];
  authentication: string;
  rateLimits?: string;
  version: string;
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: string;
  validation?: string;
}

export interface APIResponse {
  code: number;
  description: string;
  schema: Record<string, any>;
  example: string;
}

export interface APIExample {
  language: 'javascript' | 'python' | 'curl' | 'typescript';
  code: string;
  description: string;
}

export interface TroubleshootingGuide {
  id: string;
  title: string;
  description: string;
  problem: string;
  symptoms: string[];
  causes: string[];
  solutions: TroubleshootingSolution[];
  prevention: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'authentication' | 'performance' | 'deployment' | 'database' | 'api' | 'ui';
}

export interface TroubleshootingSolution {
  id: string;
  title: string;
  description: string;
  steps: string[];
  codeExample?: string;
  verification: string;
  successRate: number; // percentage
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  category: 'security' | 'performance' | 'code-quality' | 'deployment' | 'monitoring' | 'testing';
  importance: 'low' | 'medium' | 'high' | 'critical';
  implementation: string;
  benefits: string[];
  examples: string[];
  relatedPractices: string[];
}

export interface TrainingMaterial {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'interactive' | 'workshop' | 'quiz' | 'hands-on';
  duration: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  modules: TrainingModule[];
  prerequisites: string[];
  objectives: string[];
  assessment?: TrainingAssessment;
}

export interface TrainingModule {
  id: string;
  title: string;
  content: string;
  duration: number;
  exercises?: TrainingExercise[];
  resources?: string[];
}

export interface TrainingExercise {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  expectedOutcome: string;
  hints?: string[];
  solution?: string;
}

export interface TrainingAssessment {
  id: string;
  title: string;
  questions: AssessmentQuestion[];
  passingScore: number;
  timeLimit?: number; // minutes
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'essay';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
}

export interface DocumentationMetrics {
  totalSections: number;
  totalUserGuides: number;
  totalAPIDocs: number;
  totalTroubleshootingGuides: number;
  totalBestPractices: number;
  totalTrainingMaterials: number;
  averageCompleteness: number; // percentage
  lastUpdated: Date;
  mostViewed: string[];
  searchQueries: string[];
}

// ============================================================================
// DOCUMENTATION SYSTEM CORE
// ============================================================================

export class DocumentationSystem {
  private sections: Map<string, DocumentationSection> = new Map();
  private userGuides: Map<string, UserGuide> = new Map();
  private apiDocs: Map<string, APIDocumentation> = new Map();
  private troubleshootingGuides: Map<string, TroubleshootingGuide> = new Map();
  private bestPractices: Map<string, BestPractice> = new Map();
  private trainingMaterials: Map<string, TrainingMaterial> = new Map();

  constructor() {
    this.initializeDocumentation();
  }

  // ============================================================================
  // DOCUMENTATION MANAGEMENT
  // ============================================================================

  async createUserGuide(guide: UserGuide): Promise<void> {
    this.userGuides.set(guide.id, guide);
    
    // Create corresponding documentation section
    const section: DocumentationSection = {
      id: `guide-${guide.id}`,
      title: guide.title,
      description: guide.description,
      category: 'user-guide',
      content: this.convertGuideToContent(guide),
      tags: guide.tags,
      lastUpdated: new Date(),
      version: '1.0.0',
      author: 'Ads Pro Enterprise Team'
    };
    
    this.sections.set(section.id, section);
    console.log(`📚 Created user guide: ${guide.title}`);
  }

  async createAPIDocumentation(doc: APIDocumentation): Promise<void> {
    this.apiDocs.set(doc.id, doc);
    
    // Create corresponding documentation section
    const section: DocumentationSection = {
      id: `api-${doc.id}`,
      title: doc.title,
      description: doc.description,
      category: 'api-docs',
      content: this.convertAPIToContent(doc),
      tags: [doc.method, doc.endpoint],
      lastUpdated: new Date(),
      version: doc.version,
      author: 'Ads Pro Enterprise Team'
    };
    
    this.sections.set(section.id, section);
    console.log(`🔗 Created API documentation: ${doc.title}`);
  }

  async createTroubleshootingGuide(guide: TroubleshootingGuide): Promise<void> {
    this.troubleshootingGuides.set(guide.id, guide);
    
    // Create corresponding documentation section
    const section: DocumentationSection = {
      id: `troubleshooting-${guide.id}`,
      title: guide.title,
      description: guide.description,
      category: 'troubleshooting',
      content: this.convertTroubleshootingToContent(guide),
      tags: [guide.category, guide.severity],
      lastUpdated: new Date(),
      version: '1.0.0',
      author: 'Ads Pro Enterprise Team'
    };
    
    this.sections.set(section.id, section);
    console.log(`🔧 Created troubleshooting guide: ${guide.title}`);
  }

  async createBestPractice(practice: BestPractice): Promise<void> {
    this.bestPractices.set(practice.id, practice);
    
    // Create corresponding documentation section
    const section: DocumentationSection = {
      id: `best-practice-${practice.id}`,
      title: practice.title,
      description: practice.description,
      category: 'best-practices',
      content: this.convertBestPracticeToContent(practice),
      tags: [practice.category, practice.importance],
      lastUpdated: new Date(),
      version: '1.0.0',
      author: 'Ads Pro Enterprise Team'
    };
    
    this.sections.set(section.id, section);
    console.log(`⭐ Created best practice: ${practice.title}`);
  }

  async createTrainingMaterial(material: TrainingMaterial): Promise<void> {
    this.trainingMaterials.set(material.id, material);
    
    // Create corresponding documentation section
    const section: DocumentationSection = {
      id: `training-${material.id}`,
      title: material.title,
      description: material.description,
      category: 'training',
      content: this.convertTrainingToContent(material),
      tags: [material.type, material.difficulty],
      lastUpdated: new Date(),
      version: '1.0.0',
      author: 'Ads Pro Enterprise Team'
    };
    
    this.sections.set(section.id, section);
    console.log(`🎓 Created training material: ${material.title}`);
  }

  // ============================================================================
  // CONTENT CONVERSION
  // ============================================================================

  private convertGuideToContent(guide: UserGuide): DocumentationContent[] {
    const content: DocumentationContent[] = [
      {
        id: 'overview',
        type: 'text',
        title: 'Overview',
        content: guide.description,
        order: 1
      },
      {
        id: 'prerequisites',
        type: 'list',
        title: 'Prerequisites',
        content: guide.prerequisites.join('\n'),
        order: 2
      }
    ];

    // Add steps
    guide.steps.forEach((step, index) => {
      content.push({
        id: `step-${step.id}`,
        type: 'text',
        title: step.title,
        content: `${step.description}\n\n**Action:** ${step.action}\n\n**Expected Result:** ${step.expectedResult}`,
        order: 3 + index
      });

      if (step.codeExample) {
        content.push({
          id: `step-${step.id}-code`,
          type: 'code',
          title: 'Code Example',
          content: step.codeExample,
          order: 3 + index + 0.5
        });
      }
    });

    return content;
  }

  private convertAPIToContent(doc: APIDocumentation): DocumentationContent[] {
    const content: DocumentationContent[] = [
      {
        id: 'overview',
        type: 'text',
        title: 'Overview',
        content: doc.description,
        order: 1
      },
      {
        id: 'endpoint',
        type: 'code',
        title: 'Endpoint',
        content: `${doc.method} ${doc.endpoint}`,
        order: 2
      },
      {
        id: 'parameters',
        type: 'table',
        title: 'Parameters',
        content: this.formatParametersTable(doc.parameters),
        order: 3
      },
      {
        id: 'responses',
        type: 'table',
        title: 'Responses',
        content: this.formatResponsesTable(doc.responses),
        order: 4
      }
    ];

    // Add examples
    doc.examples.forEach((example, index) => {
      content.push({
        id: `example-${index}`,
        type: 'code',
        title: `${example.language.toUpperCase()} Example`,
        content: example.code,
        metadata: { language: example.language },
        order: 5 + index
      });
    });

    return content;
  }

  private convertTroubleshootingToContent(guide: TroubleshootingGuide): DocumentationContent[] {
    const content: DocumentationContent[] = [
      {
        id: 'problem',
        type: 'text',
        title: 'Problem',
        content: guide.problem,
        order: 1
      },
      {
        id: 'symptoms',
        type: 'list',
        title: 'Symptoms',
        content: guide.symptoms.join('\n'),
        order: 2
      },
      {
        id: 'causes',
        type: 'list',
        title: 'Possible Causes',
        content: guide.causes.join('\n'),
        order: 3
      }
    ];

    // Add solutions
    guide.solutions.forEach((solution, index) => {
      content.push({
        id: `solution-${solution.id}`,
        type: 'text',
        title: solution.title,
        content: `${solution.description}\n\n**Steps:**\n${solution.steps.join('\n')}\n\n**Verification:** ${solution.verification}`,
        order: 4 + index
      });

      if (solution.codeExample) {
        content.push({
          id: `solution-${solution.id}-code`,
          type: 'code',
          title: 'Code Example',
          content: solution.codeExample,
          order: 4 + index + 0.5
        });
      }
    });

    return content;
  }

  private convertBestPracticeToContent(practice: BestPractice): DocumentationContent[] {
    const content: DocumentationContent[] = [
      {
        id: 'overview',
        type: 'text',
        title: 'Overview',
        content: practice.description,
        order: 1
      },
      {
        id: 'implementation',
        type: 'text',
        title: 'Implementation',
        content: practice.implementation,
        order: 2
      },
      {
        id: 'benefits',
        type: 'list',
        title: 'Benefits',
        content: practice.benefits.join('\n'),
        order: 3
      },
      {
        id: 'examples',
        type: 'code',
        title: 'Examples',
        content: practice.examples.join('\n\n'),
        order: 4
      }
    ];

    return content;
  }

  private convertTrainingToContent(material: TrainingMaterial): DocumentationContent[] {
    const content: DocumentationContent[] = [
      {
        id: 'overview',
        type: 'text',
        title: 'Overview',
        content: material.description,
        order: 1
      },
      {
        id: 'objectives',
        type: 'list',
        title: 'Learning Objectives',
        content: material.objectives.join('\n'),
        order: 2
      },
      {
        id: 'prerequisites',
        type: 'list',
        title: 'Prerequisites',
        content: material.prerequisites.join('\n'),
        order: 3
      }
    ];

    // Add modules
    material.modules.forEach((module, index) => {
      content.push({
        id: `module-${module.id}`,
        type: 'text',
        title: module.title,
        content: module.content,
        order: 4 + index
      });
    });

    return content;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private formatParametersTable(parameters: APIParameter[]): string {
    const headers = ['Name', 'Type', 'Required', 'Description', 'Example'];
    const rows = parameters.map(p => [p.name, p.type, p.required ? 'Yes' : 'No', p.description, p.example]);
    
    return this.createMarkdownTable(headers, rows);
  }

  private formatResponsesTable(responses: APIResponse[]): string {
    const headers = ['Code', 'Description', 'Example'];
    const rows = responses.map(r => [r.code.toString(), r.description, r.example]);
    
    return this.createMarkdownTable(headers, rows);
  }

  private createMarkdownTable(headers: string[], rows: string[][]): string {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map(row => `| ${row.join(' | ')} |`);
    
    return [headerRow, separatorRow, ...dataRows].join('\n');
  }

  // ============================================================================
  // SEARCH & RETRIEVAL
  // ============================================================================

  searchDocumentation(query: string): DocumentationSection[] {
    const results: DocumentationSection[] = [];
    
    for (const section of this.sections.values()) {
      const searchText = `${section.title} ${section.description} ${section.tags.join(' ')}`.toLowerCase();
      if (searchText.includes(query.toLowerCase())) {
        results.push(section);
      }
    }
    
    return results.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  getDocumentationByCategory(category: DocumentationSection['category']): DocumentationSection[] {
    return Array.from(this.sections.values())
      .filter(section => section.category === category)
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  getDocumentationMetrics(): DocumentationMetrics {
    const sections = Array.from(this.sections.values());
    
    return {
      totalSections: sections.length,
      totalUserGuides: this.userGuides.size,
      totalAPIDocs: this.apiDocs.size,
      totalTroubleshootingGuides: this.troubleshootingGuides.size,
      totalBestPractices: this.bestPractices.size,
      totalTrainingMaterials: this.trainingMaterials.size,
      averageCompleteness: 95, // Simulated
      lastUpdated: new Date(),
      mostViewed: ['user-authentication', 'api-overview', 'deployment-guide'],
      searchQueries: ['authentication', 'deployment', 'troubleshooting', 'api']
    };
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initializeDocumentation(): Promise<void> {
    console.log('📚 Initializing Documentation System...');
    
    // Create user guides
    await this.createUserGuide({
      id: 'user-authentication',
      title: 'User Authentication Guide',
      description: 'Complete guide to user authentication and authorization',
      targetAudience: 'beginner',
      steps: [
        {
          id: 'login',
          title: 'User Login',
          description: 'Learn how to log in to the system',
          action: 'Navigate to login page and enter credentials',
          expectedResult: 'Successfully logged in with access to dashboard'
        },
        {
          id: 'registration',
          title: 'User Registration',
          description: 'Create a new user account',
          action: 'Fill out registration form with required information',
          expectedResult: 'Account created and verification email sent'
        }
      ],
      prerequisites: ['Valid email address', 'Strong password'],
      estimatedTime: 10,
      difficulty: 'easy',
      tags: ['authentication', 'login', 'registration']
    });

    // Create API documentation
    await this.createAPIDocumentation({
      id: 'campaigns-api',
      endpoint: '/api/campaigns',
      method: 'GET',
      title: 'Get Campaigns',
      description: 'Retrieve all campaigns for the authenticated user',
      parameters: [
        {
          name: 'page',
          type: 'number',
          required: false,
          description: 'Page number for pagination',
          example: '1'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Number of campaigns per page',
          example: '10'
        }
      ],
      responses: [
        {
          code: 200,
          description: 'Successfully retrieved campaigns',
          schema: { campaigns: 'array', total: 'number' },
          example: '{"campaigns": [...], "total": 25}'
        }
      ],
      examples: [
        {
          language: 'javascript',
          code: 'fetch("/api/campaigns?page=1&limit=10")',
          description: 'JavaScript example'
        }
      ],
      authentication: 'Bearer token required',
      version: '1.0.0'
    });

    // Create troubleshooting guide
    await this.createTroubleshootingGuide({
      id: 'login-issues',
      title: 'Login Troubleshooting',
      description: 'Common login issues and solutions',
      problem: 'Unable to log in to the system',
      symptoms: ['Invalid credentials error', 'Account locked message', 'Session timeout'],
      causes: ['Incorrect password', 'Account not activated', 'Session expired'],
      solutions: [
        {
          id: 'reset-password',
          title: 'Reset Password',
          description: 'Reset your password if you forgot it',
          steps: ['Click "Forgot Password"', 'Enter email address', 'Check email for reset link', 'Create new password'],
          verification: 'Successfully log in with new password',
          successRate: 95
        }
      ],
      prevention: ['Use strong passwords', 'Enable 2FA', 'Keep session active'],
      severity: 'medium',
      category: 'authentication'
    });

    // Create best practice
    await this.createBestPractice({
      id: 'secure-authentication',
      title: 'Secure Authentication Practices',
      description: 'Best practices for implementing secure authentication',
      category: 'security',
      importance: 'critical',
      implementation: 'Use JWT tokens with short expiration, implement rate limiting, enable 2FA',
      benefits: ['Prevents unauthorized access', 'Reduces security risks', 'Complies with standards'],
      examples: ['JWT token implementation', 'Rate limiting setup', '2FA configuration'],
      relatedPractices: ['password-policy', 'session-management']
    });

    // Create training material
    await this.createTrainingMaterial({
      id: 'api-training',
      title: 'API Integration Training',
      description: 'Learn how to integrate with Ads Pro Enterprise APIs',
      type: 'interactive',
      duration: 60,
      difficulty: 'intermediate',
      modules: [
        {
          id: 'api-basics',
          title: 'API Basics',
          content: 'Introduction to REST APIs and authentication',
          duration: 15,
          exercises: [
            {
              id: 'auth-exercise',
              title: 'Authentication Exercise',
              description: 'Practice authenticating with the API',
              instructions: ['Get API key', 'Make authenticated request', 'Handle response'],
              expectedOutcome: 'Successfully authenticate and retrieve data',
              hints: ['Check API documentation', 'Verify credentials']
            }
          ]
        }
      ],
      prerequisites: ['Basic programming knowledge', 'Understanding of HTTP'],
      objectives: ['Understand API authentication', 'Make API requests', 'Handle responses']
    });

    console.log('✅ Documentation System initialized');
  }
}

// ============================================================================
// REACT HOOKS FOR DOCUMENTATION INTEGRATION
// ============================================================================

export function useDocumentationSystem() {
  const [documentationSystem] = useState(() => new DocumentationSystem());
  const [sections, setSections] = useState<DocumentationSection[]>([]);
  const [metrics, setMetrics] = useState<DocumentationMetrics | null>(null);

  const searchDocumentation = useCallback((query: string) => {
    return documentationSystem.searchDocumentation(query);
  }, [documentationSystem]);

  const getDocumentationByCategory = useCallback((category: DocumentationSection['category']) => {
    return documentationSystem.getDocumentationByCategory(category);
  }, [documentationSystem]);

  const getMetrics = useCallback(() => {
    const currentMetrics = documentationSystem.getDocumentationMetrics();
    setMetrics(currentMetrics);
    return currentMetrics;
  }, [documentationSystem]);

  // Auto-update sections
  useEffect(() => {
    const updateSections = () => {
      const allSections = Array.from(documentationSystem['sections'].values());
      setSections(allSections);
    };

    updateSections();
    const interval = setInterval(updateSections, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [documentationSystem]);

  return {
    documentationSystem,
    sections,
    metrics,
    searchDocumentation,
    getDocumentationByCategory,
    getMetrics
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const documentationSystem = new DocumentationSystem(); 