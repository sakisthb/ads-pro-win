/**
 * UAT Metrics System
 * Comprehensive metrics tracking for User Acceptance Testing
 * 
 * Features:
 * - User experience metrics
 * - Performance validation
 * - Error rate monitoring
 * - Success rate tracking
 * - Real-time analytics
 * - Automated reporting
 */

import { useState, useCallback, useEffect } from 'react';
import { UATFeedback, UATTestScenario } from './user-acceptance-testing';
import { ScenarioExecution, UserScenario } from './user-scenarios';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UATMetrics {
  // Overall Metrics
  totalScenarios: number;
  completedScenarios: number;
  successRate: number;
  averageCompletionTime: number;
  totalExecutionTime: number;
  
  // User Experience Metrics
  averageRating: number;
  averageDifficulty: number;
  userSatisfactionScore: number;
  intuitivenessScore: number;
  efficiencyScore: number;
  
  // Performance Metrics
  averagePageLoadTime: number;
  averageInteractionTime: number;
  totalErrors: number;
  errorRate: number;
  performanceScore: number;
  
  // Quality Metrics
  criticalIssues: number;
  highPriorityIssues: number;
  bugReportCount: number;
  qualityScore: number;
  
  // Category Breakdown
  categoryMetrics: Record<string, CategoryMetrics>;
  
  // User Type Breakdown
  userTypeMetrics: Record<string, UserTypeMetrics>;
  
  // Time-based Metrics
  timeMetrics: TimeMetrics;
  
  // Trend Analysis
  trends: TrendAnalysis;
}

export interface CategoryMetrics {
  category: string;
  totalScenarios: number;
  completedScenarios: number;
  successRate: number;
  averageRating: number;
  averageCompletionTime: number;
  commonIssues: string[];
  performanceScore: number;
}

export interface UserTypeMetrics {
  userType: string;
  totalScenarios: number;
  completedScenarios: number;
  successRate: number;
  averageRating: number;
  averageCompletionTime: number;
  difficultyDistribution: Record<string, number>;
  satisfactionScore: number;
}

export interface TimeMetrics {
  averageTimePerStep: number;
  timeDistribution: Record<string, number>;
  slowestSteps: string[];
  fastestSteps: string[];
  timeEfficiencyScore: number;
}

export interface TrendAnalysis {
  successRateTrend: number; // percentage change
  ratingTrend: number; // percentage change
  completionTimeTrend: number; // percentage change
  errorRateTrend: number; // percentage change
  userSatisfactionTrend: number; // percentage change
}

export interface MetricsThresholds {
  successRate: {
    excellent: number; // 95%+
    good: number; // 85-94%
    acceptable: number; // 70-84%
    poor: number; // <70%
  };
  rating: {
    excellent: number; // 4.5+
    good: number; // 4.0-4.4
    acceptable: number; // 3.5-3.9
    poor: number; // <3.5
  };
  completionTime: {
    excellent: number; // <5 minutes
    good: number; // 5-10 minutes
    acceptable: number; // 10-15 minutes
    poor: number; // >15 minutes
  };
  errorRate: {
    excellent: number; // <5%
    good: number; // 5-10%
    acceptable: number; // 10-20%
    poor: number; // >20%
  };
}

export interface MetricsReport {
  summary: MetricsSummary;
  detailedMetrics: UATMetrics;
  recommendations: string[];
  riskAssessment: RiskAssessment;
  nextSteps: string[];
}

export interface MetricsSummary {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  overallScore: number; // 0-100
  keyStrengths: string[];
  keyWeaknesses: string[];
  readinessForProduction: boolean;
  confidenceLevel: number; // 0-100
}

export interface RiskAssessment {
  highRiskAreas: string[];
  mediumRiskAreas: string[];
  lowRiskAreas: string[];
  criticalIssues: string[];
  recommendedActions: string[];
}

// ============================================================================
// UAT METRICS CORE
// ============================================================================

export class UATMetricsSystem {
  private feedback: UATFeedback[] = [];
  private scenarios: UATTestScenario[] = [];
  private executions: ScenarioExecution[] = [];
  private thresholds: MetricsThresholds;

  constructor() {
    this.thresholds = this.getDefaultThresholds();
  }

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  addFeedback(feedback: UATFeedback): void {
    this.feedback.push(feedback);
  }

  addScenario(scenario: UATTestScenario): void {
    this.scenarios.push(scenario);
  }

  addExecution(execution: ScenarioExecution): void {
    this.executions.push(execution);
  }

  clearData(): void {
    this.feedback = [];
    this.scenarios = [];
    this.executions = [];
  }

  // ============================================================================
  // METRICS CALCULATION
  // ============================================================================

  calculateMetrics(): UATMetrics {
    if (this.feedback.length === 0) {
      return this.getEmptyMetrics();
    }

    // Overall Metrics
    const totalScenarios = this.scenarios.length;
    const completedScenarios = this.feedback.length;
    const successRate = (this.feedback.filter(f => f.success).length / completedScenarios) * 100;
    const averageCompletionTime = this.feedback.reduce((sum, f) => sum + f.completionTime, 0) / completedScenarios;
    const totalExecutionTime = this.feedback.reduce((sum, f) => sum + f.completionTime, 0);

    // User Experience Metrics
    const averageRating = this.feedback.reduce((sum, f) => sum + f.rating, 0) / completedScenarios;
    const averageDifficulty = this.calculateAverageDifficulty();
    const userSatisfactionScore = this.calculateUserSatisfactionScore();
    const intuitivenessScore = this.feedback.reduce((sum, f) => sum + f.userExperience.intuitiveness, 0) / completedScenarios;
    const efficiencyScore = this.feedback.reduce((sum, f) => sum + f.userExperience.efficiency, 0) / completedScenarios;

    // Performance Metrics
    const averagePageLoadTime = this.feedback.reduce((sum, f) => sum + f.performance.pageLoadTime, 0) / completedScenarios;
    const averageInteractionTime = this.feedback.reduce((sum, f) => sum + f.performance.interactionTime, 0) / completedScenarios;
    const totalErrors = this.feedback.reduce((sum, f) => sum + f.performance.errorCount, 0);
    const errorRate = (totalErrors / completedScenarios) * 100;
    const performanceScore = this.calculatePerformanceScore();

    // Quality Metrics
    const criticalIssues = this.feedback.filter(f => 
      f.issues.some(issue => issue.toLowerCase().includes('critical'))
    ).length;
    const highPriorityIssues = this.feedback.filter(f => 
      f.issues.some(issue => issue.toLowerCase().includes('high') || issue.toLowerCase().includes('blocking'))
    ).length;
    const bugReportCount = this.feedback.filter(f => f.issues.length > 0).length;
    const qualityScore = this.calculateQualityScore();

    // Category Breakdown
    const categoryMetrics = this.calculateCategoryMetrics();

    // User Type Breakdown
    const userTypeMetrics = this.calculateUserTypeMetrics();

    // Time Metrics
    const timeMetrics = this.calculateTimeMetrics();

    // Trend Analysis
    const trends = this.calculateTrends();

    return {
      totalScenarios,
      completedScenarios,
      successRate,
      averageCompletionTime,
      totalExecutionTime,
      averageRating,
      averageDifficulty,
      userSatisfactionScore,
      intuitivenessScore,
      efficiencyScore,
      averagePageLoadTime,
      averageInteractionTime,
      totalErrors,
      errorRate,
      performanceScore,
      criticalIssues,
      highPriorityIssues,
      bugReportCount,
      qualityScore,
      categoryMetrics,
      userTypeMetrics,
      timeMetrics,
      trends
    };
  }

  // ============================================================================
  // DETAILED CALCULATIONS
  // ============================================================================

  private calculateAverageDifficulty(): number {
    const difficultyMap = { 'easy': 1, 'medium': 2, 'hard': 3, 'impossible': 4 };
    const totalDifficulty = this.feedback.reduce((sum, f) => sum + difficultyMap[f.difficulty], 0);
    return totalDifficulty / this.feedback.length;
  }

  private calculateUserSatisfactionScore(): number {
    return this.feedback.reduce((sum, f) => 
      sum + (f.userExperience.intuitiveness + f.userExperience.efficiency + f.userExperience.satisfaction) / 3, 0
    ) / this.feedback.length;
  }

  private calculatePerformanceScore(): number {
    const maxPageLoadTime = 5000; // 5 seconds
    const maxInteractionTime = 3000; // 3 seconds
    
    const pageLoadScore = Math.max(0, 100 - (this.feedback.reduce((sum, f) => sum + f.performance.pageLoadTime, 0) / this.feedback.length / maxPageLoadTime) * 100);
    const interactionScore = Math.max(0, 100 - (this.feedback.reduce((sum, f) => sum + f.performance.interactionTime, 0) / this.feedback.length / maxInteractionTime) * 100);
    const errorScore = Math.max(0, 100 - (this.feedback.reduce((sum, f) => sum + f.performance.errorCount, 0) / this.feedback.length) * 20);
    
    return (pageLoadScore + interactionScore + errorScore) / 3;
  }

  private calculateQualityScore(): number {
    const totalIssues = this.feedback.reduce((sum, f) => sum + f.issues.length, 0);
    const maxIssuesPerScenario = 5; // Assume max 5 issues per scenario is poor quality
    const issueScore = Math.max(0, 100 - (totalIssues / this.feedback.length / maxIssuesPerScenario) * 100);
    
    const successScore = this.feedback.filter(f => f.success).length / this.feedback.length * 100;
    
    return (issueScore + successScore) / 2;
  }

  private calculateCategoryMetrics(): Record<string, CategoryMetrics> {
    const categories = ['authentication', 'dashboard', 'campaigns', 'analytics', 'ai-features', 'reporting'];
    const categoryMetrics: Record<string, CategoryMetrics> = {};

    for (const category of categories) {
      const categoryScenarios = this.scenarios.filter(s => s.category === category);
      const categoryFeedback = this.feedback.filter(f => {
        const scenario = this.scenarios.find(s => s.id === f.scenarioId);
        return scenario?.category === category;
      });

      if (categoryFeedback.length === 0) continue;

      const successRate = (categoryFeedback.filter(f => f.success).length / categoryFeedback.length) * 100;
      const averageRating = categoryFeedback.reduce((sum, f) => sum + f.rating, 0) / categoryFeedback.length;
      const averageCompletionTime = categoryFeedback.reduce((sum, f) => sum + f.completionTime, 0) / categoryFeedback.length;
      
      const commonIssues = this.getCommonIssues(categoryFeedback);
      const performanceScore = this.calculateCategoryPerformanceScore(categoryFeedback);

      categoryMetrics[category] = {
        category,
        totalScenarios: categoryScenarios.length,
        completedScenarios: categoryFeedback.length,
        successRate,
        averageRating,
        averageCompletionTime,
        commonIssues,
        performanceScore
      };
    }

    return categoryMetrics;
  }

  private calculateUserTypeMetrics(): Record<string, UserTypeMetrics> {
    const userTypes = ['new-user', 'power-user', 'admin', 'analyst'];
    const userTypeMetrics: Record<string, UserTypeMetrics> = {};

    for (const userType of userTypes) {
      const userTypeScenarios = this.scenarios.filter(s => s.userType === userType);
      const userTypeFeedback = this.feedback.filter(f => {
        const scenario = this.scenarios.find(s => s.id === f.scenarioId);
        return scenario?.userType === userType;
      });

      if (userTypeFeedback.length === 0) continue;

      const successRate = (userTypeFeedback.filter(f => f.success).length / userTypeFeedback.length) * 100;
      const averageRating = userTypeFeedback.reduce((sum, f) => sum + f.rating, 0) / userTypeFeedback.length;
      const averageCompletionTime = userTypeFeedback.reduce((sum, f) => sum + f.completionTime, 0) / userTypeFeedback.length;
      
      const difficultyDistribution = this.calculateDifficultyDistribution(userTypeFeedback);
      const satisfactionScore = this.calculateUserTypeSatisfactionScore(userTypeFeedback);

      userTypeMetrics[userType] = {
        userType,
        totalScenarios: userTypeScenarios.length,
        completedScenarios: userTypeFeedback.length,
        successRate,
        averageRating,
        averageCompletionTime,
        difficultyDistribution,
        satisfactionScore
      };
    }

    return userTypeMetrics;
  }

  private calculateTimeMetrics(): TimeMetrics {
    const stepTimes = this.executions.flatMap(e => Object.values(e.performanceMetrics.stepTimes));
    const averageTimePerStep = stepTimes.length > 0 ? stepTimes.reduce((sum, time) => sum + time, 0) / stepTimes.length : 0;
    
    const timeDistribution = this.calculateTimeDistribution();
    const slowestSteps = this.getSlowestSteps();
    const fastestSteps = this.getFastestSteps();
    const timeEfficiencyScore = this.calculateTimeEfficiencyScore();

    return {
      averageTimePerStep,
      timeDistribution,
      slowestSteps,
      fastestSteps,
      timeEfficiencyScore
    };
  }

  private calculateTrends(): TrendAnalysis {
    // This would typically compare current metrics with historical data
    // For now, we'll return neutral trends
    return {
      successRateTrend: 0,
      ratingTrend: 0,
      completionTimeTrend: 0,
      errorRateTrend: 0,
      userSatisfactionTrend: 0
    };
  }

  // ============================================================================
  // UTILITY CALCULATIONS
  // ============================================================================

  private getCommonIssues(feedback: UATFeedback[]): string[] {
    const allIssues = feedback.flatMap(f => f.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  private calculateCategoryPerformanceScore(feedback: UATFeedback[]): number {
    const maxPageLoadTime = 5000;
    const maxInteractionTime = 3000;
    
    const avgPageLoadTime = feedback.reduce((sum, f) => sum + f.performance.pageLoadTime, 0) / feedback.length;
    const avgInteractionTime = feedback.reduce((sum, f) => sum + f.performance.interactionTime, 0) / feedback.length;
    
    const pageLoadScore = Math.max(0, 100 - (avgPageLoadTime / maxPageLoadTime) * 100);
    const interactionScore = Math.max(0, 100 - (avgInteractionTime / maxInteractionTime) * 100);
    
    return (pageLoadScore + interactionScore) / 2;
  }

  private calculateDifficultyDistribution(feedback: UATFeedback[]): Record<string, number> {
    const distribution: Record<string, number> = { 'easy': 0, 'medium': 0, 'hard': 0, 'impossible': 0 };
    
    for (const f of feedback) {
      distribution[f.difficulty]++;
    }
    
    // Convert to percentages
    const total = feedback.length;
    for (const key in distribution) {
      distribution[key] = (distribution[key] / total) * 100;
    }
    
    return distribution;
  }

  private calculateUserTypeSatisfactionScore(feedback: UATFeedback[]): number {
    return feedback.reduce((sum, f) => 
      sum + (f.userExperience.intuitiveness + f.userExperience.efficiency + f.userExperience.satisfaction) / 3, 0
    ) / feedback.length;
  }

  private calculateTimeDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {
      '0-30s': 0,
      '30s-1m': 0,
      '1m-2m': 0,
      '2m-5m': 0,
      '5m+': 0
    };
    
    for (const f of this.feedback) {
      const timeInSeconds = f.completionTime;
      if (timeInSeconds <= 30) distribution['0-30s']++;
      else if (timeInSeconds <= 60) distribution['30s-1m']++;
      else if (timeInSeconds <= 120) distribution['1m-2m']++;
      else if (timeInSeconds <= 300) distribution['2m-5m']++;
      else distribution['5m+']++;
    }
    
    // Convert to percentages
    const total = this.feedback.length;
    for (const key in distribution) {
      distribution[key] = (distribution[key] / total) * 100;
    }
    
    return distribution;
  }

  private getSlowestSteps(): string[] {
    const stepTimes = this.executions.flatMap(e => 
      Object.entries(e.performanceMetrics.stepTimes).map(([stepId, time]) => ({ stepId, time }))
    );
    
    return stepTimes
      .sort((a, b) => b.time - a.time)
      .slice(0, 5)
      .map(s => s.stepId);
  }

  private getFastestSteps(): string[] {
    const stepTimes = this.executions.flatMap(e => 
      Object.entries(e.performanceMetrics.stepTimes).map(([stepId, time]) => ({ stepId, time }))
    );
    
    return stepTimes
      .sort((a, b) => a.time - b.time)
      .slice(0, 5)
      .map(s => s.stepId);
  }

  private calculateTimeEfficiencyScore(): number {
    const targetTimePerStep = 60; // 60 seconds target
    const stepTimes = this.executions.flatMap(e => Object.values(e.performanceMetrics.stepTimes));
    
    if (stepTimes.length === 0) return 100;
    
    const averageTimePerStep = stepTimes.reduce((sum, time) => sum + time, 0) / stepTimes.length;
    return Math.max(0, 100 - (averageTimePerStep / targetTimePerStep) * 100);
  }

  // ============================================================================
  // REPORTING
  // ============================================================================

  generateMetricsReport(): MetricsReport {
    const metrics = this.calculateMetrics();
    const summary = this.calculateSummary(metrics);
    const recommendations = this.generateRecommendations(metrics);
    const riskAssessment = this.assessRisks(metrics);
    const nextSteps = this.generateNextSteps(metrics);

    return {
      summary,
      detailedMetrics: metrics,
      recommendations,
      riskAssessment,
      nextSteps
    };
  }

  private calculateSummary(metrics: UATMetrics): MetricsSummary {
    const overallScore = this.calculateOverallScore(metrics);
    const overallGrade = this.calculateGrade(overallScore);
    const keyStrengths = this.identifyStrengths(metrics);
    const keyWeaknesses = this.identifyWeaknesses(metrics);
    const readinessForProduction = this.assessProductionReadiness(metrics);
    const confidenceLevel = this.calculateConfidenceLevel(metrics);

    return {
      overallGrade,
      overallScore,
      keyStrengths,
      keyWeaknesses,
      readinessForProduction,
      confidenceLevel
    };
  }

  private calculateOverallScore(metrics: UATMetrics): number {
    const weights = {
      successRate: 0.25,
      averageRating: 0.20,
      performanceScore: 0.20,
      qualityScore: 0.20,
      userSatisfactionScore: 0.15
    };

    return (
      metrics.successRate * weights.successRate +
      (metrics.averageRating / 5) * 100 * weights.averageRating +
      metrics.performanceScore * weights.performanceScore +
      metrics.qualityScore * weights.qualityScore +
      (metrics.userSatisfactionScore / 5) * 100 * weights.userSatisfactionScore
    );
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private identifyStrengths(metrics: UATMetrics): string[] {
    const strengths: string[] = [];
    
    if (metrics.successRate >= 90) strengths.push('High success rate');
    if (metrics.averageRating >= 4.0) strengths.push('Excellent user ratings');
    if (metrics.performanceScore >= 80) strengths.push('Good performance');
    if (metrics.qualityScore >= 80) strengths.push('High quality');
    if (metrics.userSatisfactionScore >= 4.0) strengths.push('High user satisfaction');
    
    return strengths;
  }

  private identifyWeaknesses(metrics: UATMetrics): string[] {
    const weaknesses: string[] = [];
    
    if (metrics.successRate < 70) weaknesses.push('Low success rate');
    if (metrics.averageRating < 3.0) weaknesses.push('Poor user ratings');
    if (metrics.performanceScore < 60) weaknesses.push('Performance issues');
    if (metrics.qualityScore < 60) weaknesses.push('Quality concerns');
    if (metrics.userSatisfactionScore < 3.0) weaknesses.push('Low user satisfaction');
    if (metrics.criticalIssues > 0) weaknesses.push('Critical issues present');
    
    return weaknesses;
  }

  private assessProductionReadiness(metrics: UATMetrics): boolean {
    return (
      metrics.successRate >= 85 &&
      metrics.averageRating >= 4.0 &&
      metrics.performanceScore >= 75 &&
      metrics.qualityScore >= 75 &&
      metrics.criticalIssues === 0
    );
  }

  private calculateConfidenceLevel(metrics: UATMetrics): number {
    const factors = [
      metrics.successRate / 100,
      metrics.averageRating / 5,
      metrics.performanceScore / 100,
      metrics.qualityScore / 100,
      metrics.userSatisfactionScore / 5
    ];
    
    const averageConfidence = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
    return Math.min(100, averageConfidence * 100);
  }

  private generateRecommendations(metrics: UATMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.successRate < 85) {
      recommendations.push('Improve success rate by addressing common failure points');
    }
    
    if (metrics.averageRating < 4.0) {
      recommendations.push('Enhance user experience to improve ratings');
    }
    
    if (metrics.performanceScore < 75) {
      recommendations.push('Optimize performance for better user experience');
    }
    
    if (metrics.criticalIssues > 0) {
      recommendations.push('Address critical issues before production launch');
    }
    
    if (metrics.errorRate > 10) {
      recommendations.push('Reduce error rate through better error handling');
    }
    
    return recommendations;
  }

  private assessRisks(metrics: UATMetrics): RiskAssessment {
    const highRiskAreas: string[] = [];
    const mediumRiskAreas: string[] = [];
    const lowRiskAreas: string[] = [];
    const criticalIssues: string[] = [];
    const recommendedActions: string[] = [];

    // Assess risks based on metrics
    if (metrics.successRate < 70) {
      highRiskAreas.push('Low success rate');
      recommendedActions.push('Investigate and fix common failure points');
    }
    
    if (metrics.criticalIssues > 0) {
      criticalIssues.push(`${metrics.criticalIssues} critical issues detected`);
      recommendedActions.push('Address critical issues immediately');
    }
    
    if (metrics.averageRating < 3.5) {
      mediumRiskAreas.push('Poor user ratings');
      recommendedActions.push('Improve user experience design');
    }
    
    if (metrics.performanceScore < 70) {
      mediumRiskAreas.push('Performance issues');
      recommendedActions.push('Optimize application performance');
    }
    
    if (metrics.errorRate > 15) {
      highRiskAreas.push('High error rate');
      recommendedActions.push('Implement better error handling');
    }

    return {
      highRiskAreas,
      mediumRiskAreas,
      lowRiskAreas,
      criticalIssues,
      recommendedActions
    };
  }

  private generateNextSteps(metrics: UATMetrics): string[] {
    const nextSteps: string[] = [];
    
    if (metrics.criticalIssues > 0) {
      nextSteps.push('1. Address all critical issues immediately');
    }
    
    if (metrics.successRate < 85) {
      nextSteps.push('2. Analyze and fix common failure scenarios');
    }
    
    if (metrics.averageRating < 4.0) {
      nextSteps.push('3. Improve user interface and experience');
    }
    
    if (metrics.performanceScore < 75) {
      nextSteps.push('4. Optimize application performance');
    }
    
    nextSteps.push('5. Conduct additional user testing');
    nextSteps.push('6. Prepare for production deployment');
    
    return nextSteps;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getEmptyMetrics(): UATMetrics {
    return {
      totalScenarios: 0,
      completedScenarios: 0,
      successRate: 0,
      averageCompletionTime: 0,
      totalExecutionTime: 0,
      averageRating: 0,
      averageDifficulty: 0,
      userSatisfactionScore: 0,
      intuitivenessScore: 0,
      efficiencyScore: 0,
      averagePageLoadTime: 0,
      averageInteractionTime: 0,
      totalErrors: 0,
      errorRate: 0,
      performanceScore: 0,
      criticalIssues: 0,
      highPriorityIssues: 0,
      bugReportCount: 0,
      qualityScore: 0,
      categoryMetrics: {},
      userTypeMetrics: {},
      timeMetrics: {
        averageTimePerStep: 0,
        timeDistribution: {},
        slowestSteps: [],
        fastestSteps: [],
        timeEfficiencyScore: 0
      },
      trends: {
        successRateTrend: 0,
        ratingTrend: 0,
        completionTimeTrend: 0,
        errorRateTrend: 0,
        userSatisfactionTrend: 0
      }
    };
  }

  private getDefaultThresholds(): MetricsThresholds {
    return {
      successRate: {
        excellent: 95,
        good: 85,
        acceptable: 70,
        poor: 70
      },
      rating: {
        excellent: 4.5,
        good: 4.0,
        acceptable: 3.5,
        poor: 3.5
      },
      completionTime: {
        excellent: 300, // 5 minutes
        good: 600, // 10 minutes
        acceptable: 900, // 15 minutes
        poor: 900
      },
      errorRate: {
        excellent: 5,
        good: 10,
        acceptable: 20,
        poor: 20
      }
    };
  }
}

// ============================================================================
// REACT HOOKS FOR METRICS INTEGRATION
// ============================================================================

export function useUATMetrics() {
  const [metricsSystem] = useState(() => new UATMetricsSystem());
  const [currentMetrics, setCurrentMetrics] = useState<UATMetrics | null>(null);
  const [currentReport, setCurrentReport] = useState<MetricsReport | null>(null);

  const addFeedback = useCallback((feedback: UATFeedback) => {
    metricsSystem.addFeedback(feedback);
    const metrics = metricsSystem.calculateMetrics();
    setCurrentMetrics(metrics);
  }, [metricsSystem]);

  const addScenario = useCallback((scenario: UATTestScenario) => {
    metricsSystem.addScenario(scenario);
  }, [metricsSystem]);

  const addExecution = useCallback((execution: ScenarioExecution) => {
    metricsSystem.addExecution(execution);
  }, [metricsSystem]);

  const generateReport = useCallback(() => {
    const report = metricsSystem.generateMetricsReport();
    setCurrentReport(report);
    return report;
  }, [metricsSystem]);

  const clearData = useCallback(() => {
    metricsSystem.clearData();
    setCurrentMetrics(null);
    setCurrentReport(null);
  }, [metricsSystem]);

  return {
    metricsSystem,
    currentMetrics,
    currentReport,
    addFeedback,
    addScenario,
    addExecution,
    generateReport,
    clearData
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const uatMetricsSystem = new UATMetricsSystem(); 