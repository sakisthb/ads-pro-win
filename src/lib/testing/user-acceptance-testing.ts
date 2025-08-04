/**
 * User Acceptance Testing Framework
 * Comprehensive UAT system for Ads Pro Enterprise
 * 
 * Features:
 * - Test scenario management
 * - User feedback collection
 * - Performance metrics tracking
 * - User experience validation
 * - Real-time monitoring
 * - Automated reporting
 */

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UATTestScenario {
  id: string;
  name: string;
  description: string;
  category: 'authentication' | 'dashboard' | 'campaigns' | 'analytics' | 'ai-features' | 'reporting';
  priority: 'critical' | 'high' | 'medium' | 'low';
  userType: 'new-user' | 'power-user' | 'admin' | 'analyst';
  steps: UATTestStep[];
  expectedOutcome: string;
  successCriteria: string[];
  estimatedDuration: number; // in minutes
  dependencies?: string[];
  tags: string[];
}

export interface UATTestStep {
  id: string;
  description: string;
  action: string;
  expectedResult: string;
  validationMethod: 'visual' | 'functional' | 'performance' | 'security';
  screenshot?: boolean;
  notes?: string;
}

export interface UATFeedback {
  id: string;
  scenarioId: string;
  userId: string;
  timestamp: Date;
  rating: number; // 1-5 scale
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  completionTime: number; // in seconds
  success: boolean;
  issues: string[];
  suggestions: string[];
  performance: {
    pageLoadTime: number;
    interactionTime: number;
    errorCount: number;
  };
  userExperience: {
    intuitiveness: number; // 1-5
    efficiency: number; // 1-5
    satisfaction: number; // 1-5
  };
}

export interface UATMetrics {
  totalScenarios: number;
  completedScenarios: number;
  successRate: number;
  averageCompletionTime: number;
  averageRating: number;
  criticalIssues: number;
  performanceIssues: number;
  userExperienceScore: number;
}

export interface UATSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  scenarios: UATTestScenario[];
  feedback: UATFeedback[];
  metrics: UATMetrics;
  status: 'active' | 'completed' | 'paused';
}

// ============================================================================
// UAT FRAMEWORK CORE
// ============================================================================

export class UATFramework {
  private scenarios: Map<string, UATTestScenario> = new Map();
  private sessions: Map<string, UATSession> = new Map();
  private feedback: UATFeedback[] = [];

  constructor() {
    this.initializeDefaultScenarios();
  }

  // ============================================================================
  // SCENARIO MANAGEMENT
  // ============================================================================

  addScenario(scenario: UATTestScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  getScenario(id: string): UATTestScenario | undefined {
    return this.scenarios.get(id);
  }

  getAllScenarios(): UATTestScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenariosByCategory(category: UATTestScenario['category']): UATTestScenario[] {
    return this.getAllScenarios().filter(s => s.category === category);
  }

  getScenariosByPriority(priority: UATTestScenario['priority']): UATTestScenario[] {
    return this.getAllScenarios().filter(s => s.priority === priority);
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  createSession(userId: string, scenarioIds: string[]): UATSession {
    const sessionId = `uat-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const scenarios = scenarioIds
      .map(id => this.scenarios.get(id))
      .filter((s): s is UATTestScenario => s !== undefined);

    const session: UATSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      scenarios,
      feedback: [],
      metrics: this.calculateInitialMetrics(scenarios),
      status: 'active'
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): UATSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<UATSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(sessionId, session);
    }
  }

  completeSession(sessionId: string): UATSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      session.status = 'completed';
      session.metrics = this.calculateSessionMetrics(session);
      this.sessions.set(sessionId, session);
      return session;
    }
    return undefined;
  }

  // ============================================================================
  // FEEDBACK COLLECTION
  // ============================================================================

  addFeedback(feedback: UATFeedback): void {
    this.feedback.push(feedback);
    
    // Update session if exists
    const session = Array.from(this.sessions.values())
      .find(s => s.id === feedback.scenarioId.split('-')[0]);
    
    if (session) {
      session.feedback.push(feedback);
      session.metrics = this.calculateSessionMetrics(session);
    }
  }

  getFeedbackForScenario(scenarioId: string): UATFeedback[] {
    return this.feedback.filter(f => f.scenarioId === scenarioId);
  }

  getFeedbackForSession(sessionId: string): UATFeedback[] {
    const session = this.sessions.get(sessionId);
    return session ? session.feedback : [];
  }

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  private calculateInitialMetrics(scenarios: UATTestScenario[]): UATMetrics {
    return {
      totalScenarios: scenarios.length,
      completedScenarios: 0,
      successRate: 0,
      averageCompletionTime: 0,
      averageRating: 0,
      criticalIssues: 0,
      performanceIssues: 0,
      userExperienceScore: 0
    };
  }

  private calculateSessionMetrics(session: UATSession): UATMetrics {
    const completedFeedback = session.feedback.filter(f => f.success);
    const totalFeedback = session.feedback.length;
    
    const successRate = totalFeedback > 0 ? (completedFeedback.length / totalFeedback) * 100 : 0;
    const averageCompletionTime = session.feedback.length > 0 
      ? session.feedback.reduce((sum, f) => sum + f.completionTime, 0) / session.feedback.length 
      : 0;
    const averageRating = session.feedback.length > 0 
      ? session.feedback.reduce((sum, f) => sum + f.rating, 0) / session.feedback.length 
      : 0;

    const criticalIssues = session.feedback.filter(f => 
      f.issues.some(issue => issue.toLowerCase().includes('critical') || issue.toLowerCase().includes('blocking'))
    ).length;

    const performanceIssues = session.feedback.filter(f => 
      f.performance.pageLoadTime > 3000 || f.performance.interactionTime > 2000
    ).length;

    const userExperienceScore = session.feedback.length > 0 
      ? session.feedback.reduce((sum, f) => 
          sum + (f.userExperience.intuitiveness + f.userExperience.efficiency + f.userExperience.satisfaction) / 3, 0
        ) / session.feedback.length 
      : 0;

    return {
      totalScenarios: session.scenarios.length,
      completedScenarios: totalFeedback,
      successRate,
      averageCompletionTime,
      averageRating,
      criticalIssues,
      performanceIssues,
      userExperienceScore
    };
  }

  // ============================================================================
  // REPORTING & ANALYTICS
  // ============================================================================

  generateSessionReport(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return 'Session not found';

    const report = `
# UAT Session Report
**Session ID:** ${session.id}
**User ID:** ${session.userId}
**Duration:** ${session.endTime ? this.formatDuration(session.startTime, session.endTime) : 'Active'}
**Status:** ${session.status}

## Metrics Summary
- **Total Scenarios:** ${session.metrics.totalScenarios}
- **Completed Scenarios:** ${session.metrics.completedScenarios}
- **Success Rate:** ${session.metrics.successRate.toFixed(1)}%
- **Average Completion Time:** ${(session.metrics.averageCompletionTime / 60).toFixed(1)} minutes
- **Average Rating:** ${session.metrics.averageRating.toFixed(1)}/5
- **Critical Issues:** ${session.metrics.criticalIssues}
- **Performance Issues:** ${session.metrics.performanceIssues}
- **User Experience Score:** ${session.metrics.userExperienceScore.toFixed(1)}/5

## Feedback Summary
${session.feedback.map(f => `
### ${f.scenarioId}
- **Rating:** ${f.rating}/5
- **Difficulty:** ${f.difficulty}
- **Completion Time:** ${(f.completionTime / 60).toFixed(1)} minutes
- **Success:** ${f.success ? 'Yes' : 'No'}
- **Issues:** ${f.issues.join(', ') || 'None'}
- **Suggestions:** ${f.suggestions.join(', ') || 'None'}
`).join('')}
    `;

    return report;
  }

  generateOverallReport(): string {
    const allSessions = Array.from(this.sessions.values());
    const completedSessions = allSessions.filter(s => s.status === 'completed');
    
    const totalScenarios = allSessions.reduce((sum, s) => sum + s.metrics.totalScenarios, 0);
    const totalCompleted = allSessions.reduce((sum, s) => sum + s.metrics.completedScenarios, 0);
    const averageSuccessRate = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + s.metrics.successRate, 0) / completedSessions.length 
      : 0;
    const averageRating = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + s.metrics.averageRating, 0) / completedSessions.length 
      : 0;

    const report = `
# Overall UAT Report
**Total Sessions:** ${allSessions.length}
**Completed Sessions:** ${completedSessions.length}
**Total Scenarios:** ${totalScenarios}
**Completed Scenarios:** ${totalCompleted}

## Overall Metrics
- **Average Success Rate:** ${averageSuccessRate.toFixed(1)}%
- **Average Rating:** ${averageRating.toFixed(1)}/5
- **Total Critical Issues:** ${allSessions.reduce((sum, s) => sum + s.metrics.criticalIssues, 0)}
- **Total Performance Issues:** ${allSessions.reduce((sum, s) => sum + s.metrics.performanceIssues, 0)}

## Category Breakdown
${this.getCategoryBreakdown()}

## Priority Breakdown
${this.getPriorityBreakdown()}
    `;

    return report;
  }

  private getCategoryBreakdown(): string {
    const categories = ['authentication', 'dashboard', 'campaigns', 'analytics', 'ai-features', 'reporting'] as const;
    return categories.map(category => {
      const scenarios = this.getScenariosByCategory(category);
      const feedback = scenarios.flatMap(s => this.getFeedbackForScenario(s.id));
      const successRate = feedback.length > 0 
        ? (feedback.filter(f => f.success).length / feedback.length) * 100 
        : 0;
      const averageRating = feedback.length > 0 
        ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length 
        : 0;

      return `
### ${category.charAt(0).toUpperCase() + category.slice(1)}
- **Scenarios:** ${scenarios.length}
- **Feedback Count:** ${feedback.length}
- **Success Rate:** ${successRate.toFixed(1)}%
- **Average Rating:** ${averageRating.toFixed(1)}/5
      `;
    }).join('');
  }

  private getPriorityBreakdown(): string {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;
    return priorities.map(priority => {
      const scenarios = this.getScenariosByPriority(priority);
      const feedback = scenarios.flatMap(s => this.getFeedbackForScenario(s.id));
      const successRate = feedback.length > 0 
        ? (feedback.filter(f => f.success).length / feedback.length) * 100 
        : 0;

      return `
### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
- **Scenarios:** ${scenarios.length}
- **Feedback Count:** ${feedback.length}
- **Success Rate:** ${successRate.toFixed(1)}%
      `;
    }).join('');
  }

  private formatDuration(start: Date, end: Date): string {
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  // ============================================================================
  // DEFAULT SCENARIOS INITIALIZATION
  // ============================================================================

  private initializeDefaultScenarios(): void {
    // Authentication Scenarios
    this.addScenario({
      id: 'auth-registration',
      name: 'User Registration Flow',
      description: 'Test the complete user registration process',
      category: 'authentication',
      priority: 'critical',
      userType: 'new-user',
      steps: [
        {
          id: 'auth-reg-1',
          description: 'Navigate to registration page',
          action: 'Click "Sign Up" button',
          expectedResult: 'Registration form loads',
          validationMethod: 'visual'
        },
        {
          id: 'auth-reg-2',
          description: 'Fill registration form',
          action: 'Enter valid user information',
          expectedResult: 'Form accepts input without errors',
          validationMethod: 'functional'
        },
        {
          id: 'auth-reg-3',
          description: 'Submit registration',
          action: 'Click "Create Account"',
          expectedResult: 'Account created successfully',
          validationMethod: 'functional'
        }
      ],
      expectedOutcome: 'User account created and logged in',
      successCriteria: [
        'Registration form loads correctly',
        'Form validation works properly',
        'Account creation succeeds',
        'User is automatically logged in'
      ],
      estimatedDuration: 3,
      tags: ['registration', 'authentication', 'critical']
    });

    // Dashboard Scenarios
    this.addScenario({
      id: 'dashboard-navigation',
      name: 'Dashboard Navigation',
      description: 'Test dashboard loading and navigation',
      category: 'dashboard',
      priority: 'high',
      userType: 'power-user',
      steps: [
        {
          id: 'dashboard-nav-1',
          description: 'Load dashboard',
          action: 'Navigate to dashboard page',
          expectedResult: 'Dashboard loads within 2 seconds',
          validationMethod: 'performance'
        },
        {
          id: 'dashboard-nav-2',
          description: 'View analytics widgets',
          action: 'Scroll through dashboard sections',
          expectedResult: 'All widgets load and display data',
          validationMethod: 'visual'
        },
        {
          id: 'dashboard-nav-3',
          description: 'Test responsive design',
          action: 'Resize browser window',
          expectedResult: 'Layout adapts properly',
          validationMethod: 'visual'
        }
      ],
      expectedOutcome: 'Dashboard loads quickly and displays all components correctly',
      successCriteria: [
        'Page loads within 2 seconds',
        'All widgets display correctly',
        'Responsive design works',
        'No console errors'
      ],
      estimatedDuration: 5,
      tags: ['dashboard', 'performance', 'responsive']
    });

    // Campaign Management Scenarios
    this.addScenario({
      id: 'campaign-creation',
      name: 'Campaign Creation Workflow',
      description: 'Test the complete campaign creation process',
      category: 'campaigns',
      priority: 'critical',
      userType: 'admin',
      steps: [
        {
          id: 'campaign-create-1',
          description: 'Access campaign creation',
          action: 'Click "Create Campaign"',
          expectedResult: 'Campaign creation form opens',
          validationMethod: 'functional'
        },
        {
          id: 'campaign-create-2',
          description: 'Fill campaign details',
          action: 'Enter campaign information',
          expectedResult: 'Form accepts all inputs',
          validationMethod: 'functional'
        },
        {
          id: 'campaign-create-3',
          description: 'Configure targeting',
          action: 'Set target audience parameters',
          expectedResult: 'Targeting options work correctly',
          validationMethod: 'functional'
        },
        {
          id: 'campaign-create-4',
          description: 'Save campaign',
          action: 'Click "Create Campaign"',
          expectedResult: 'Campaign created successfully',
          validationMethod: 'functional'
        }
      ],
      expectedOutcome: 'Campaign created and appears in campaign list',
      successCriteria: [
        'Form loads without errors',
        'All fields accept input',
        'Validation works properly',
        'Campaign saves successfully'
      ],
      estimatedDuration: 8,
      tags: ['campaigns', 'creation', 'critical']
    });

    // Analytics Scenarios
    this.addScenario({
      id: 'analytics-viewing',
      name: 'Analytics Dashboard Viewing',
      description: 'Test analytics data display and interaction',
      category: 'analytics',
      priority: 'high',
      userType: 'analyst',
      steps: [
        {
          id: 'analytics-view-1',
          description: 'Load analytics page',
          action: 'Navigate to analytics section',
          expectedResult: 'Analytics dashboard loads',
          validationMethod: 'performance'
        },
        {
          id: 'analytics-view-2',
          description: 'View performance metrics',
          action: 'Review different metric cards',
          expectedResult: 'All metrics display correctly',
          validationMethod: 'visual'
        },
        {
          id: 'analytics-view-3',
          description: 'Interact with charts',
          action: 'Click on chart elements',
          expectedResult: 'Charts respond to interactions',
          validationMethod: 'functional'
        }
      ],
      expectedOutcome: 'Analytics data displays correctly and is interactive',
      successCriteria: [
        'Page loads within 3 seconds',
        'All metrics display data',
        'Charts are interactive',
        'No data loading errors'
      ],
      estimatedDuration: 6,
      tags: ['analytics', 'charts', 'performance']
    });

    // AI Features Scenarios
    this.addScenario({
      id: 'ai-optimization',
      name: 'AI Campaign Optimization',
      description: 'Test AI-powered campaign optimization features',
      category: 'ai-features',
      priority: 'high',
      userType: 'power-user',
      steps: [
        {
          id: 'ai-opt-1',
          description: 'Access AI optimization',
          action: 'Click "AI Optimize" on campaign',
          expectedResult: 'AI optimization interface opens',
          validationMethod: 'functional'
        },
        {
          id: 'ai-opt-2',
          description: 'Review AI suggestions',
          action: 'View AI recommendations',
          expectedResult: 'Suggestions are relevant and clear',
          validationMethod: 'visual'
        },
        {
          id: 'ai-opt-3',
          description: 'Apply AI optimization',
          action: 'Click "Apply Optimization"',
          expectedResult: 'Optimization applied successfully',
          validationMethod: 'functional'
        }
      ],
      expectedOutcome: 'AI optimization provides relevant suggestions and applies them correctly',
      successCriteria: [
        'AI interface loads quickly',
        'Suggestions are relevant',
        'Optimization applies successfully',
        'Performance improves'
      ],
      estimatedDuration: 7,
      tags: ['ai', 'optimization', 'machine-learning']
    });

    // Reporting Scenarios
    this.addScenario({
      id: 'report-generation',
      name: 'Report Generation and Export',
      description: 'Test report creation and export functionality',
      category: 'reporting',
      priority: 'medium',
      userType: 'analyst',
      steps: [
        {
          id: 'report-gen-1',
          description: 'Create custom report',
          action: 'Configure report parameters',
          expectedResult: 'Report configuration interface works',
          validationMethod: 'functional'
        },
        {
          id: 'report-gen-2',
          description: 'Generate report',
          action: 'Click "Generate Report"',
          expectedResult: 'Report generates within 30 seconds',
          validationMethod: 'performance'
        },
        {
          id: 'report-gen-3',
          description: 'Export report',
          action: 'Click "Export PDF"',
          expectedResult: 'PDF downloads successfully',
          validationMethod: 'functional'
        }
      ],
      expectedOutcome: 'Report generates and exports correctly',
      successCriteria: [
        'Report configuration works',
        'Generation completes within 30s',
        'Export functionality works',
        'PDF format is correct'
      ],
      estimatedDuration: 10,
      tags: ['reporting', 'export', 'pdf']
    });
  }
}

// ============================================================================
// REACT HOOKS FOR UAT INTEGRATION
// ============================================================================

export function useUATFramework() {
  const [framework] = useState(() => new UATFramework());
  const [currentSession, setCurrentSession] = useState<UATSession | null>(null);
  const [currentScenario, setCurrentScenario] = useState<UATTestScenario | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  const startSession = useCallback((userId: string, scenarioIds: string[]) => {
    const session = framework.createSession(userId, scenarioIds);
    setCurrentSession(session);
    setSessionStartTime(new Date());
    return session;
  }, [framework]);

  const completeScenario = useCallback((scenarioId: string, feedback: Omit<UATFeedback, 'id' | 'timestamp'>) => {
    const fullFeedback: UATFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    framework.addFeedback(fullFeedback);
    
    if (currentSession) {
      const updatedSession = framework.getSession(currentSession.id);
      if (updatedSession) {
        setCurrentSession(updatedSession);
      }
    }
  }, [framework, currentSession]);

  const endSession = useCallback(() => {
    if (currentSession) {
      const completedSession = framework.completeSession(currentSession.id);
      setCurrentSession(null);
      setCurrentScenario(null);
      setSessionStartTime(null);
      return completedSession;
    }
    return null;
  }, [framework, currentSession]);

  const getSessionReport = useCallback((sessionId: string) => {
    return framework.generateSessionReport(sessionId);
  }, [framework]);

  const getOverallReport = useCallback(() => {
    return framework.generateOverallReport();
  }, [framework]);

  return {
    framework,
    currentSession,
    currentScenario,
    sessionStartTime,
    startSession,
    completeScenario,
    endSession,
    getSessionReport,
    getOverallReport,
    setCurrentScenario
  };
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export class UATPerformanceMonitor {
  private metrics: Map<string, number> = new Map();

  startTimer(operation: string): void {
    this.metrics.set(`${operation}-start`, performance.now());
  }

  endTimer(operation: string): number {
    const startTime = this.metrics.get(`${operation}-start`);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.metrics.set(`${operation}-duration`, duration);
      return duration;
    }
    return 0;
  }

  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.metrics.entries()) {
      if (key.endsWith('-duration')) {
        result[key] = value;
      }
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const uatFramework = new UATFramework();
export const uatPerformanceMonitor = new UATPerformanceMonitor();