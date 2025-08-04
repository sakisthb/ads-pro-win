/**
 * Feedback Collection System
 * Comprehensive feedback collection for UAT testing
 * 
 * Features:
 * - Real-time feedback capture
 * - User rating system
 * - Bug reporting mechanism
 * - User satisfaction tracking
 * - Performance monitoring
 * - Automated feedback analysis
 */

import { useState, useCallback, useEffect } from 'react';
import { UATFeedback, UATTestScenario } from './user-acceptance-testing';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FeedbackFormData {
  scenarioId: string;
  userId: string;
  rating: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  completionTime: number;
  success: boolean;
  issues: string[];
  suggestions: string[];
  performance: {
    pageLoadTime: number;
    interactionTime: number;
    errorCount: number;
  };
  userExperience: {
    intuitiveness: number;
    efficiency: number;
    satisfaction: number;
  };
  additionalNotes?: string;
  screenshots?: string[];
  browserInfo?: {
    userAgent: string;
    viewport: string;
    screenResolution: string;
  };
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  successRate: number;
  averageCompletionTime: number;
  commonIssues: string[];
  topSuggestions: string[];
  performanceMetrics: {
    averagePageLoadTime: number;
    averageInteractionTime: number;
    totalErrors: number;
  };
  userExperienceMetrics: {
    averageIntuitiveness: number;
    averageEfficiency: number;
    averageSatisfaction: number;
  };
}

export interface BugReport {
  id: string;
  scenarioId: string;
  userId: string;
  timestamp: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  browserInfo: {
    userAgent: string;
    viewport: string;
    screenResolution: string;
  };
  screenshots?: string[];
  consoleErrors?: string[];
  performanceData?: {
    pageLoadTime: number;
    interactionTime: number;
    memoryUsage: number;
  };
}

export interface UserSatisfactionMetrics {
  overallSatisfaction: number;
  featureSatisfaction: Record<string, number>;
  painPoints: string[];
  improvementSuggestions: string[];
  willingnessToRecommend: number; // 1-10 scale
  timeToValue: number; // in minutes
}

// ============================================================================
// FEEDBACK COLLECTION CORE
// ============================================================================

export class FeedbackCollectionSystem {
  private feedback: UATFeedback[] = [];
  private bugReports: BugReport[] = [];
  private performanceData: Map<string, number> = new Map();

  // ============================================================================
  // FEEDBACK COLLECTION
  // ============================================================================

  async collectFeedback(formData: FeedbackFormData): Promise<UATFeedback> {
    const feedback: UATFeedback = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scenarioId: formData.scenarioId,
      userId: formData.userId,
      timestamp: new Date(),
      rating: formData.rating,
      difficulty: formData.difficulty,
      completionTime: formData.completionTime,
      success: formData.success,
      issues: formData.issues,
      suggestions: formData.suggestions,
      performance: formData.performance,
      userExperience: formData.userExperience
    };

    this.feedback.push(feedback);
    
    // Store performance data for analytics
    this.performanceData.set(`${formData.scenarioId}-pageLoad`, formData.performance.pageLoadTime);
    this.performanceData.set(`${formData.scenarioId}-interaction`, formData.performance.interactionTime);
    this.performanceData.set(`${formData.scenarioId}-errors`, formData.performance.errorCount);

    // Trigger real-time analytics update
    await this.updateAnalytics();

    return feedback;
  }

  // ============================================================================
  // BUG REPORTING
  // ============================================================================

  async submitBugReport(bugData: Omit<BugReport, 'id' | 'timestamp'>): Promise<BugReport> {
    const bugReport: BugReport = {
      id: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...bugData
    };

    this.bugReports.push(bugReport);

    // Log critical bugs immediately
    if (bugReport.severity === 'critical') {
      console.error('CRITICAL BUG REPORTED:', bugReport);
      await this.notifyCriticalBug(bugReport);
    }

    return bugReport;
  }

  private async notifyCriticalBug(bugReport: BugReport): Promise<void> {
    // In a real implementation, this would send notifications
    console.warn('Critical bug notification would be sent here:', bugReport.title);
  }

  // ============================================================================
  // PERFORMANCE MONITORING
  // ============================================================================

  startPerformanceMonitoring(scenarioId: string): void {
    const startTime = performance.now();
    this.performanceData.set(`${scenarioId}-start`, startTime);
  }

  endPerformanceMonitoring(scenarioId: string): {
    pageLoadTime: number;
    interactionTime: number;
    errorCount: number;
  } {
    const startTime = this.performanceData.get(`${scenarioId}-start`);
    const pageLoadTime = startTime ? performance.now() - startTime : 0;
    
    // Simulate interaction time and error count
    const interactionTime = Math.random() * 2000 + 500; // 500-2500ms
    const errorCount = Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0;

    return {
      pageLoadTime,
      interactionTime,
      errorCount
    };
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  async updateAnalytics(): Promise<FeedbackAnalytics> {
    const totalFeedback = this.feedback.length;
    
    if (totalFeedback === 0) {
      return this.getEmptyAnalytics();
    }

    const averageRating = this.feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;
    const successRate = (this.feedback.filter(f => f.success).length / totalFeedback) * 100;
    const averageCompletionTime = this.feedback.reduce((sum, f) => sum + f.completionTime, 0) / totalFeedback;

    // Common issues analysis
    const allIssues = this.feedback.flatMap(f => f.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const commonIssues = Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);

    // Top suggestions analysis
    const allSuggestions = this.feedback.flatMap(f => f.suggestions);
    const suggestionCounts = allSuggestions.reduce((acc, suggestion) => {
      acc[suggestion] = (acc[suggestion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topSuggestions = Object.entries(suggestionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([suggestion]) => suggestion);

    // Performance metrics
    const performanceMetrics = {
      averagePageLoadTime: this.feedback.reduce((sum, f) => sum + f.performance.pageLoadTime, 0) / totalFeedback,
      averageInteractionTime: this.feedback.reduce((sum, f) => sum + f.performance.interactionTime, 0) / totalFeedback,
      totalErrors: this.feedback.reduce((sum, f) => sum + f.performance.errorCount, 0)
    };

    // User experience metrics
    const userExperienceMetrics = {
      averageIntuitiveness: this.feedback.reduce((sum, f) => sum + f.userExperience.intuitiveness, 0) / totalFeedback,
      averageEfficiency: this.feedback.reduce((sum, f) => sum + f.userExperience.efficiency, 0) / totalFeedback,
      averageSatisfaction: this.feedback.reduce((sum, f) => sum + f.userExperience.satisfaction, 0) / totalFeedback
    };

    return {
      totalFeedback,
      averageRating,
      successRate,
      averageCompletionTime,
      commonIssues,
      topSuggestions,
      performanceMetrics,
      userExperienceMetrics
    };
  }

  private getEmptyAnalytics(): FeedbackAnalytics {
    return {
      totalFeedback: 0,
      averageRating: 0,
      successRate: 0,
      averageCompletionTime: 0,
      commonIssues: [],
      topSuggestions: [],
      performanceMetrics: {
        averagePageLoadTime: 0,
        averageInteractionTime: 0,
        totalErrors: 0
      },
      userExperienceMetrics: {
        averageIntuitiveness: 0,
        averageEfficiency: 0,
        averageSatisfaction: 0
      }
    };
  }

  // ============================================================================
  // USER SATISFACTION ANALYSIS
  // ============================================================================

  calculateUserSatisfaction(): UserSatisfactionMetrics {
    if (this.feedback.length === 0) {
      return {
        overallSatisfaction: 0,
        featureSatisfaction: {},
        painPoints: [],
        improvementSuggestions: [],
        willingnessToRecommend: 0,
        timeToValue: 0
      };
    }

    const overallSatisfaction = this.feedback.reduce((sum, f) => 
      sum + (f.userExperience.intuitiveness + f.userExperience.efficiency + f.userExperience.satisfaction) / 3, 0
    ) / this.feedback.length;

    // Feature satisfaction by category
    const featureSatisfaction: Record<string, number> = {};
    const scenariosByCategory = this.feedback.reduce((acc, f) => {
      const category = f.scenarioId.split('-')[0]; // Extract category from scenario ID
      if (!acc[category]) acc[category] = [];
      acc[category].push(f);
      return acc;
    }, {} as Record<string, UATFeedback[]>);

    for (const [category, feedbacks] of Object.entries(scenariosByCategory)) {
      featureSatisfaction[category] = feedbacks.reduce((sum, f) => 
        sum + (f.userExperience.intuitiveness + f.userExperience.efficiency + f.userExperience.satisfaction) / 3, 0
      ) / feedbacks.length;
    }

    // Pain points (issues that appear frequently)
    const allIssues = this.feedback.flatMap(f => f.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const painPoints = Object.entries(issueCounts)
      .filter(([, count]) => count > 1) // Issues that appear more than once
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([issue]) => issue);

    // Improvement suggestions
    const allSuggestions = this.feedback.flatMap(f => f.suggestions);
    const improvementSuggestions = [...new Set(allSuggestions)].slice(0, 10);

    // Willingness to recommend (based on satisfaction scores)
    const willingnessToRecommend = Math.min(10, Math.max(1, overallSatisfaction * 2));

    // Time to value (average completion time for successful scenarios)
    const successfulScenarios = this.feedback.filter(f => f.success);
    const timeToValue = successfulScenarios.length > 0 
      ? successfulScenarios.reduce((sum, f) => sum + f.completionTime, 0) / successfulScenarios.length / 60
      : 0;

    return {
      overallSatisfaction,
      featureSatisfaction,
      painPoints,
      improvementSuggestions,
      willingnessToRecommend,
      timeToValue
    };
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  async generateFeedbackReport(): Promise<string> {
    const analytics = await this.updateAnalytics();
    const satisfaction = this.calculateUserSatisfaction();
    const criticalBugs = this.bugReports.filter(b => b.severity === 'critical').length;
    const highPriorityBugs = this.bugReports.filter(b => b.severity === 'high').length;

    return `
# Feedback Collection Report
**Generated:** ${new Date().toISOString()}
**Total Feedback:** ${analytics.totalFeedback}
**Total Bug Reports:** ${this.bugReports.length}

## User Satisfaction Metrics
- **Overall Satisfaction:** ${satisfaction.overallSatisfaction.toFixed(2)}/5
- **Willingness to Recommend:** ${satisfaction.willingnessToRecommend.toFixed(1)}/10
- **Time to Value:** ${satisfaction.timeToValue.toFixed(1)} minutes

## Performance Metrics
- **Average Page Load Time:** ${analytics.performanceMetrics.averagePageLoadTime.toFixed(0)}ms
- **Average Interaction Time:** ${analytics.performanceMetrics.averageInteractionTime.toFixed(0)}ms
- **Total Errors:** ${analytics.performanceMetrics.totalErrors}

## Success Metrics
- **Success Rate:** ${analytics.successRate.toFixed(1)}%
- **Average Rating:** ${analytics.averageRating.toFixed(2)}/5
- **Average Completion Time:** ${(analytics.averageCompletionTime / 60).toFixed(1)} minutes

## Critical Issues
- **Critical Bugs:** ${criticalBugs}
- **High Priority Bugs:** ${highPriorityBugs}
- **Common Issues:** ${analytics.commonIssues.join(', ') || 'None'}

## Top Suggestions
${analytics.topSuggestions.map(suggestion => `- ${suggestion}`).join('\n')}

## Feature Satisfaction
${Object.entries(satisfaction.featureSatisfaction).map(([feature, score]) => 
  `- **${feature}:** ${score.toFixed(2)}/5`
).join('\n')}

## Pain Points
${satisfaction.painPoints.map(point => `- ${point}`).join('\n')}

## Improvement Suggestions
${satisfaction.improvementSuggestions.map(suggestion => `- ${suggestion}`).join('\n')}
    `;
  }

  // ============================================================================
  // DATA EXPORT
  // ============================================================================

  exportFeedbackData(): string {
    return JSON.stringify({
      feedback: this.feedback,
      bugReports: this.bugReports,
      analytics: this.updateAnalytics(),
      satisfaction: this.calculateUserSatisfaction(),
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getFeedbackByScenario(scenarioId: string): UATFeedback[] {
    return this.feedback.filter(f => f.scenarioId === scenarioId);
  }

  getBugReportsBySeverity(severity: BugReport['severity']): BugReport[] {
    return this.bugReports.filter(b => b.severity === severity);
  }

  getRecentFeedback(limit: number = 10): UATFeedback[] {
    return this.feedback
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  clearAllData(): void {
    this.feedback = [];
    this.bugReports = [];
    this.performanceData.clear();
  }
}

// ============================================================================
// REACT HOOKS FOR FEEDBACK INTEGRATION
// ============================================================================

export function useFeedbackCollection() {
  const [feedbackSystem] = useState(() => new FeedbackCollectionSystem());
  const [currentAnalytics, setCurrentAnalytics] = useState<FeedbackAnalytics | null>(null);
  const [currentSatisfaction, setCurrentSatisfaction] = useState<UserSatisfactionMetrics | null>(null);

  const collectFeedback = useCallback(async (formData: FeedbackFormData) => {
    const feedback = await feedbackSystem.collectFeedback(formData);
    
    // Update analytics
    const analytics = await feedbackSystem.updateAnalytics();
    setCurrentAnalytics(analytics);
    
    // Update satisfaction metrics
    const satisfaction = feedbackSystem.calculateUserSatisfaction();
    setCurrentSatisfaction(satisfaction);
    
    return feedback;
  }, [feedbackSystem]);

  const submitBugReport = useCallback(async (bugData: Omit<BugReport, 'id' | 'timestamp'>) => {
    return await feedbackSystem.submitBugReport(bugData);
  }, [feedbackSystem]);

  const startPerformanceMonitoring = useCallback((scenarioId: string) => {
    feedbackSystem.startPerformanceMonitoring(scenarioId);
  }, [feedbackSystem]);

  const endPerformanceMonitoring = useCallback((scenarioId: string) => {
    return feedbackSystem.endPerformanceMonitoring(scenarioId);
  }, [feedbackSystem]);

  const generateReport = useCallback(() => {
    return feedbackSystem.generateFeedbackReport();
  }, [feedbackSystem]);

  const exportData = useCallback(() => {
    return feedbackSystem.exportFeedbackData();
  }, [feedbackSystem]);

  // Auto-update analytics when feedback changes
  useEffect(() => {
    const updateAnalytics = async () => {
      const analytics = await feedbackSystem.updateAnalytics();
      setCurrentAnalytics(analytics);
      
      const satisfaction = feedbackSystem.calculateUserSatisfaction();
      setCurrentSatisfaction(satisfaction);
    };

    updateAnalytics();
  }, [feedbackSystem]);

  return {
    feedbackSystem,
    currentAnalytics,
    currentSatisfaction,
    collectFeedback,
    submitBugReport,
    startPerformanceMonitoring,
    endPerformanceMonitoring,
    generateReport,
    exportData
  };
}

// ============================================================================
// FEEDBACK FORM COMPONENT
// ============================================================================

export interface FeedbackFormProps {
  scenario: UATTestScenario;
  userId: string;
  onSubmit: (feedback: UATFeedback) => void;
  onCancel: () => void;
}

export function useFeedbackForm(scenario: UATTestScenario, userId: string) {
  const [formData, setFormData] = useState<Partial<FeedbackFormData>>({
    scenarioId: scenario.id,
    userId,
    rating: 3,
    difficulty: 'medium',
    completionTime: 0,
    success: false,
    issues: [],
    suggestions: [],
    performance: {
      pageLoadTime: 0,
      interactionTime: 0,
      errorCount: 0
    },
    userExperience: {
      intuitiveness: 3,
      efficiency: 3,
      satisfaction: 3
    }
  });

  const updateFormData = useCallback((updates: Partial<FeedbackFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const addIssue = useCallback((issue: string) => {
    setFormData(prev => ({
      ...prev,
      issues: [...(prev.issues || []), issue]
    }));
  }, []);

  const removeIssue = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      issues: prev.issues?.filter((_, i) => i !== index) || []
    }));
  }, []);

  const addSuggestion = useCallback((suggestion: string) => {
    setFormData(prev => ({
      ...prev,
      suggestions: [...(prev.suggestions || []), suggestion]
    }));
  }, []);

  const removeSuggestion = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      suggestions: prev.suggestions?.filter((_, i) => i !== index) || []
    }));
  }, []);

  const isFormValid = useCallback(() => {
    return formData.rating && 
           formData.difficulty && 
           formData.completionTime && 
           formData.success !== undefined &&
           formData.performance &&
           formData.userExperience;
  }, [formData]);

  return {
    formData,
    updateFormData,
    addIssue,
    removeIssue,
    addSuggestion,
    removeSuggestion,
    isFormValid
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const feedbackCollectionSystem = new FeedbackCollectionSystem(); 