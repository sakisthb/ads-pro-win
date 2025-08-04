/**
 * User Scenarios System
 * Comprehensive user testing scenarios for UAT
 * 
 * Features:
 * - Comprehensive user scenarios
 * - Workflow testing cases
 * - Performance benchmarks
 * - Success criteria definition
 * - Scenario execution tracking
 * - Automated scenario validation
 */

import { useState, useCallback, useEffect } from 'react';
import { UATTestScenario, UATTestStep } from './user-acceptance-testing';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UserScenario {
  id: string;
  name: string;
  description: string;
  userType: 'new-user' | 'power-user' | 'admin' | 'analyst';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  estimatedDuration: number; // in minutes
  prerequisites: string[];
  steps: UserScenarioStep[];
  expectedOutcomes: string[];
  successCriteria: UserSuccessCriteria[];
  performanceBenchmarks: PerformanceBenchmark[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  category: 'authentication' | 'dashboard' | 'campaigns' | 'analytics' | 'ai-features' | 'reporting' | 'admin' | 'integration';
}

export interface UserScenarioStep {
  id: string;
  order: number;
  description: string;
  action: string;
  expectedResult: string;
  validationMethod: 'visual' | 'functional' | 'performance' | 'security' | 'accessibility';
  screenshot?: boolean;
  notes?: string;
  estimatedTime: number; // in seconds
  critical: boolean;
  dependencies?: string[];
}

export interface UserSuccessCriteria {
  id: string;
  description: string;
  type: 'functional' | 'performance' | 'usability' | 'security';
  measurement: 'boolean' | 'numeric' | 'time' | 'rating';
  threshold: number | string;
  weight: number; // 1-10 importance
}

export interface PerformanceBenchmark {
  metric: string;
  target: number;
  unit: string;
  tolerance: number; // percentage
  critical: boolean;
}

export interface ScenarioExecution {
  id: string;
  scenarioId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused';
  stepResults: StepExecutionResult[];
  performanceMetrics: PerformanceMetrics;
  issues: string[];
  notes: string;
}

export interface StepExecutionResult {
  stepId: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  actualResult: string;
  timeSpent: number; // in seconds
  issues: string[];
  screenshots?: string[];
}

export interface PerformanceMetrics {
  totalTime: number;
  stepTimes: Record<string, number>;
  pageLoadTimes: Record<string, number>;
  interactionTimes: Record<string, number>;
  errorCount: number;
  successRate: number;
}

export interface ScenarioTemplate {
  name: string;
  description: string;
  userType: UserScenario['userType'];
  complexity: UserScenario['complexity'];
  steps: Omit<UserScenarioStep, 'id'>[];
  successCriteria: Omit<UserSuccessCriteria, 'id'>[];
  performanceBenchmarks: PerformanceBenchmark[];
}

// ============================================================================
// USER SCENARIOS CORE
// ============================================================================

export class UserScenariosSystem {
  private scenarios: Map<string, UserScenario> = new Map();
  private executions: Map<string, ScenarioExecution> = new Map();
  private templates: Map<string, ScenarioTemplate> = new Map();

  constructor() {
    this.initializeDefaultScenarios();
    this.initializeTemplates();
  }

  // ============================================================================
  // SCENARIO MANAGEMENT
  // ============================================================================

  addScenario(scenario: UserScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  getScenario(id: string): UserScenario | undefined {
    return this.scenarios.get(id);
  }

  getAllScenarios(): UserScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenariosByUserType(userType: UserScenario['userType']): UserScenario[] {
    return this.getAllScenarios().filter(s => s.userType === userType);
  }

  getScenariosByComplexity(complexity: UserScenario['complexity']): UserScenario[] {
    return this.getAllScenarios().filter(s => s.complexity === complexity);
  }

  getScenariosByCategory(category: UserScenario['category']): UserScenario[] {
    return this.getAllScenarios().filter(s => s.category === category);
  }

  // ============================================================================
  // SCENARIO EXECUTION
  // ============================================================================

  startScenarioExecution(scenarioId: string, userId: string): ScenarioExecution {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const executionId = `execution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const execution: ScenarioExecution = {
      id: executionId,
      scenarioId,
      userId,
      startTime: new Date(),
      status: 'in-progress',
      stepResults: scenario.steps.map(step => ({
        stepId: step.id,
        status: 'pending',
        actualResult: '',
        timeSpent: 0,
        issues: []
      })),
      performanceMetrics: {
        totalTime: 0,
        stepTimes: {},
        pageLoadTimes: {},
        interactionTimes: {},
        errorCount: 0,
        successRate: 0
      },
      issues: [],
      notes: ''
    };

    this.executions.set(executionId, execution);
    return execution;
  }

  updateStepExecution(executionId: string, stepId: string, result: Partial<StepExecutionResult>): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const stepResult = execution.stepResults.find(sr => sr.stepId === stepId);
    if (stepResult) {
      Object.assign(stepResult, result);
      this.executions.set(executionId, execution);
    }
  }

  getExecution(executionId: string): ScenarioExecution | undefined {
    return this.executions.get(executionId);
  }

  completeScenarioExecution(executionId: string): ScenarioExecution | undefined {
    const execution = this.executions.get(executionId);
    if (!execution) return undefined;

    execution.endTime = new Date();
    execution.status = 'completed';
    
    // Calculate final metrics
    const totalTime = execution.endTime.getTime() - execution.startTime.getTime();
    const completedSteps = execution.stepResults.filter(sr => sr.status === 'completed');
    const successRate = (completedSteps.length / execution.stepResults.length) * 100;

    execution.performanceMetrics = {
      totalTime,
      stepTimes: execution.stepResults.reduce((acc, sr) => {
        acc[sr.stepId] = sr.timeSpent;
        return acc;
      }, {} as Record<string, number>),
      pageLoadTimes: {}, // Would be populated from actual monitoring
      interactionTimes: {}, // Would be populated from actual monitoring
      errorCount: execution.stepResults.filter(sr => sr.issues.length > 0).length,
      successRate
    };

    this.executions.set(executionId, execution);
    return execution;
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  addTemplate(template: ScenarioTemplate): void {
    this.templates.set(template.name, template);
  }

  createScenarioFromTemplate(templateName: string, customizations: Partial<UserScenario>): UserScenario {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const scenarioId = `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const scenario: UserScenario = {
      id: scenarioId,
      name: customizations.name || template.name,
      description: customizations.description || template.description,
      userType: customizations.userType || template.userType,
      complexity: customizations.complexity || template.complexity,
      estimatedDuration: customizations.estimatedDuration || 10,
      prerequisites: customizations.prerequisites || [],
      steps: template.steps.map((step, index) => ({
        ...step,
        id: `${scenarioId}-step-${index + 1}`
      })),
      expectedOutcomes: customizations.expectedOutcomes || [],
      successCriteria: template.successCriteria.map((criteria, index) => ({
        ...criteria,
        id: `${scenarioId}-criteria-${index + 1}`
      })),
      performanceBenchmarks: customizations.performanceBenchmarks || template.performanceBenchmarks,
      riskLevel: customizations.riskLevel || 'medium',
      tags: customizations.tags || [],
      category: customizations.category || 'dashboard'
    };

    this.addScenario(scenario);
    return scenario;
  }

  // ============================================================================
  // PERFORMANCE BENCHMARKING
  // ============================================================================

  validatePerformanceBenchmarks(execution: ScenarioExecution): PerformanceBenchmark[] {
    const scenario = this.scenarios.get(execution.scenarioId);
    if (!scenario) return [];

    const failedBenchmarks: PerformanceBenchmark[] = [];

    for (const benchmark of scenario.performanceBenchmarks) {
      const actualValue = this.getBenchmarkValue(execution, benchmark.metric);
      const tolerance = benchmark.target * (benchmark.tolerance / 100);
      const minAcceptable = benchmark.target - tolerance;
      const maxAcceptable = benchmark.target + tolerance;

      if (actualValue < minAcceptable || actualValue > maxAcceptable) {
        failedBenchmarks.push(benchmark);
      }
    }

    return failedBenchmarks;
  }

  private getBenchmarkValue(execution: ScenarioExecution, metric: string): number {
    switch (metric) {
      case 'totalTime':
        return execution.performanceMetrics.totalTime / 1000; // Convert to seconds
      case 'successRate':
        return execution.performanceMetrics.successRate;
      case 'errorCount':
        return execution.performanceMetrics.errorCount;
      default:
        return 0;
    }
  }

  // ============================================================================
  // SUCCESS CRITERIA VALIDATION
  // ============================================================================

  validateSuccessCriteria(execution: ScenarioExecution): UserSuccessCriteria[] {
    const scenario = this.scenarios.get(execution.scenarioId);
    if (!scenario) return [];

    const failedCriteria: UserSuccessCriteria[] = [];

    for (const criteria of scenario.successCriteria) {
      const actualValue = this.getCriteriaValue(execution, criteria);
      const expectedValue = criteria.threshold;

      let passed = false;
      switch (criteria.measurement) {
        case 'boolean':
          passed = actualValue === expectedValue;
          break;
        case 'numeric':
          passed = typeof actualValue === 'number' && actualValue >= (expectedValue as number);
          break;
        case 'time':
          passed = typeof actualValue === 'number' && actualValue <= (expectedValue as number);
          break;
        case 'rating':
          passed = typeof actualValue === 'number' && actualValue >= (expectedValue as number);
          break;
      }

      if (!passed) {
        failedCriteria.push(criteria);
      }
    }

    return failedCriteria;
  }

  private getCriteriaValue(execution: ScenarioExecution, criteria: UserSuccessCriteria): any {
    switch (criteria.type) {
      case 'functional':
        return execution.stepResults.every(sr => sr.status === 'completed') ? 1 : 0;
      case 'performance':
        return execution.performanceMetrics.totalTime / 1000; // Convert to seconds
      case 'usability':
        return execution.performanceMetrics.successRate;
      case 'security':
        return execution.issues.filter(issue => issue.toLowerCase().includes('security')).length === 0 ? 1 : 0;
      default:
        return 0;
    }
  }

  // ============================================================================
  // REPORTING & ANALYTICS
  // ============================================================================

  generateScenarioReport(scenarioId: string): string {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return 'Scenario not found';

    const executions = Array.from(this.executions.values()).filter(e => e.scenarioId === scenarioId);
    const completedExecutions = executions.filter(e => e.status === 'completed');

    const successRate = completedExecutions.length > 0 
      ? (completedExecutions.filter(e => e.performanceMetrics.successRate >= 80).length / completedExecutions.length) * 100 
      : 0;

    const averageExecutionTime = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, e) => sum + e.performanceMetrics.totalTime, 0) / completedExecutions.length 
      : 0;

    const commonIssues = this.getCommonIssues(executions);

    return `
# Scenario Report: ${scenario.name}
**Scenario ID:** ${scenario.id}
**Category:** ${scenario.category}
**User Type:** ${scenario.userType}
**Complexity:** ${scenario.complexity}

## Execution Statistics
- **Total Executions:** ${executions.length}
- **Completed Executions:** ${completedExecutions.length}
- **Success Rate:** ${successRate.toFixed(1)}%
- **Average Execution Time:** ${(averageExecutionTime / 1000 / 60).toFixed(1)} minutes

## Performance Benchmarks
${scenario.performanceBenchmarks.map(benchmark => 
  `- **${benchmark.metric}:** Target ${benchmark.target}${benchmark.unit} (±${benchmark.tolerance}%)`
).join('\n')}

## Success Criteria
${scenario.successCriteria.map(criteria => 
  `- **${criteria.description}:** ${criteria.type} (${criteria.measurement}) - Target: ${criteria.threshold}`
).join('\n')}

## Common Issues
${commonIssues.map(issue => `- ${issue}`).join('\n')}

## Steps Overview
${scenario.steps.map(step => 
  `- **${step.order}.** ${step.description} (${step.estimatedTime}s)`
).join('\n')}
    `;
  }

  private getCommonIssues(executions: ScenarioExecution[]): string[] {
    const allIssues = executions.flatMap(e => e.issues);
    const issueCounts = allIssues.reduce((acc, issue) => {
      acc[issue] = (acc[issue] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);
  }

  // ============================================================================
  // DEFAULT SCENARIOS INITIALIZATION
  // ============================================================================

  private initializeDefaultScenarios(): void {
    // New User Onboarding Scenario
    this.addScenario({
      id: 'new-user-onboarding',
      name: 'New User Onboarding Flow',
      description: 'Complete onboarding process for new users',
      userType: 'new-user',
      complexity: 'simple',
      estimatedDuration: 15,
      prerequisites: ['User has valid email'],
      steps: [
        {
          id: 'onboarding-1',
          order: 1,
          description: 'Access registration page',
          action: 'Navigate to /signup',
          expectedResult: 'Registration form loads',
          validationMethod: 'visual',
          estimatedTime: 30,
          critical: true
        },
        {
          id: 'onboarding-2',
          order: 2,
          description: 'Fill registration form',
          action: 'Enter user information',
          expectedResult: 'Form accepts input',
          validationMethod: 'functional',
          estimatedTime: 60,
          critical: true
        },
        {
          id: 'onboarding-3',
          order: 3,
          description: 'Verify email',
          action: 'Click verification link',
          expectedResult: 'Email verified successfully',
          validationMethod: 'functional',
          estimatedTime: 45,
          critical: true
        },
        {
          id: 'onboarding-4',
          order: 4,
          description: 'Complete profile setup',
          action: 'Fill profile information',
          expectedResult: 'Profile created',
          validationMethod: 'functional',
          estimatedTime: 90,
          critical: false
        },
        {
          id: 'onboarding-5',
          order: 5,
          description: 'Access dashboard',
          action: 'Navigate to dashboard',
          expectedResult: 'Dashboard loads with welcome message',
          validationMethod: 'visual',
          estimatedTime: 30,
          critical: true
        }
      ],
      expectedOutcomes: [
        'User account created successfully',
        'Email verification completed',
        'Profile setup finished',
        'Dashboard accessible'
      ],
      successCriteria: [
        {
          id: 'onboarding-success-1',
          description: 'Registration form loads within 3 seconds',
          type: 'performance',
          measurement: 'time',
          threshold: 3000,
          weight: 8
        },
        {
          id: 'onboarding-success-2',
          description: 'All form fields accept input',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 10
        },
        {
          id: 'onboarding-success-3',
          description: 'Email verification works',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 9
        },
        {
          id: 'onboarding-success-4',
          description: 'Dashboard loads successfully',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 10
        }
      ],
      performanceBenchmarks: [
        {
          metric: 'totalTime',
          target: 900, // 15 minutes in seconds
          unit: 'seconds',
          tolerance: 20,
          critical: false
        },
        {
          metric: 'successRate',
          target: 100,
          unit: '%',
          tolerance: 5,
          critical: true
        }
      ],
      riskLevel: 'low',
      tags: ['onboarding', 'registration', 'new-user'],
      category: 'authentication'
    });

    // Power User Campaign Creation
    this.addScenario({
      id: 'power-user-campaign-creation',
      name: 'Advanced Campaign Creation',
      description: 'Create complex campaign with advanced targeting',
      userType: 'power-user',
      complexity: 'complex',
      estimatedDuration: 25,
      prerequisites: ['User logged in', 'Basic campaign knowledge'],
      steps: [
        {
          id: 'campaign-1',
          order: 1,
          description: 'Access campaign creation',
          action: 'Navigate to campaigns section',
          expectedResult: 'Campaign management interface loads',
          validationMethod: 'visual',
          estimatedTime: 30,
          critical: true
        },
        {
          id: 'campaign-2',
          order: 2,
          description: 'Create new campaign',
          action: 'Click "Create Campaign"',
          expectedResult: 'Campaign creation form opens',
          validationMethod: 'functional',
          estimatedTime: 45,
          critical: true
        },
        {
          id: 'campaign-3',
          order: 3,
          description: 'Configure basic settings',
          action: 'Fill campaign name, budget, dates',
          expectedResult: 'Basic settings saved',
          validationMethod: 'functional',
          estimatedTime: 120,
          critical: true
        },
        {
          id: 'campaign-4',
          order: 4,
          description: 'Set advanced targeting',
          action: 'Configure audience targeting parameters',
          expectedResult: 'Targeting options applied',
          validationMethod: 'functional',
          estimatedTime: 180,
          critical: true
        },
        {
          id: 'campaign-5',
          order: 5,
          description: 'Configure ad creatives',
          action: 'Upload and configure ad materials',
          expectedResult: 'Ad creatives uploaded',
          validationMethod: 'functional',
          estimatedTime: 240,
          critical: true
        },
        {
          id: 'campaign-6',
          order: 6,
          description: 'Review and launch',
          action: 'Review campaign settings and launch',
          expectedResult: 'Campaign launched successfully',
          validationMethod: 'functional',
          estimatedTime: 90,
          critical: true
        }
      ],
      expectedOutcomes: [
        'Campaign created with advanced targeting',
        'Ad creatives configured properly',
        'Campaign launched successfully',
        'Performance tracking enabled'
      ],
      successCriteria: [
        {
          id: 'campaign-success-1',
          description: 'Campaign creation form loads within 5 seconds',
          type: 'performance',
          measurement: 'time',
          threshold: 5000,
          weight: 7
        },
        {
          id: 'campaign-success-2',
          description: 'All targeting options work',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 9
        },
        {
          id: 'campaign-success-3',
          description: 'Ad creatives upload successfully',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 8
        },
        {
          id: 'campaign-success-4',
          description: 'Campaign launches without errors',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 10
        }
      ],
      performanceBenchmarks: [
        {
          metric: 'totalTime',
          target: 1500, // 25 minutes in seconds
          unit: 'seconds',
          tolerance: 25,
          critical: false
        },
        {
          metric: 'successRate',
          target: 95,
          unit: '%',
          tolerance: 5,
          critical: true
        }
      ],
      riskLevel: 'medium',
      tags: ['campaigns', 'targeting', 'power-user'],
      category: 'campaigns'
    });

    // Admin Analytics Dashboard
    this.addScenario({
      id: 'admin-analytics-dashboard',
      name: 'Admin Analytics Dashboard',
      description: 'Access and analyze comprehensive analytics data',
      userType: 'admin',
      complexity: 'moderate',
      estimatedDuration: 20,
      prerequisites: ['Admin privileges', 'Analytics data available'],
      steps: [
        {
          id: 'analytics-1',
          order: 1,
          description: 'Access analytics dashboard',
          action: 'Navigate to analytics section',
          expectedResult: 'Analytics dashboard loads',
          validationMethod: 'visual',
          estimatedTime: 30,
          critical: true
        },
        {
          id: 'analytics-2',
          order: 2,
          description: 'View performance metrics',
          action: 'Review key performance indicators',
          expectedResult: 'Metrics display correctly',
          validationMethod: 'visual',
          estimatedTime: 60,
          critical: true
        },
        {
          id: 'analytics-3',
          order: 3,
          description: 'Generate custom report',
          action: 'Configure and generate report',
          expectedResult: 'Report generated successfully',
          validationMethod: 'functional',
          estimatedTime: 120,
          critical: true
        },
        {
          id: 'analytics-4',
          order: 4,
          description: 'Export data',
          action: 'Export report in different formats',
          expectedResult: 'Data exported successfully',
          validationMethod: 'functional',
          estimatedTime: 90,
          critical: false
        },
        {
          id: 'analytics-5',
          order: 5,
          description: 'Share insights',
          action: 'Share report with team',
          expectedResult: 'Report shared successfully',
          validationMethod: 'functional',
          estimatedTime: 60,
          critical: false
        }
      ],
      expectedOutcomes: [
        'Analytics dashboard accessible',
        'Performance metrics visible',
        'Custom reports generated',
        'Data exported successfully'
      ],
      successCriteria: [
        {
          id: 'analytics-success-1',
          description: 'Dashboard loads within 3 seconds',
          type: 'performance',
          measurement: 'time',
          threshold: 3000,
          weight: 8
        },
        {
          id: 'analytics-success-2',
          description: 'All metrics display correctly',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 9
        },
        {
          id: 'analytics-success-3',
          description: 'Report generation works',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 8
        },
        {
          id: 'analytics-success-4',
          description: 'Export functionality works',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 7
        }
      ],
      performanceBenchmarks: [
        {
          metric: 'totalTime',
          target: 1200, // 20 minutes in seconds
          unit: 'seconds',
          tolerance: 20,
          critical: false
        },
        {
          metric: 'successRate',
          target: 90,
          unit: '%',
          tolerance: 10,
          critical: true
        }
      ],
      riskLevel: 'low',
      tags: ['analytics', 'admin', 'reporting'],
      category: 'analytics'
    });
  }

  private initializeTemplates(): void {
    // Template for authentication scenarios
    this.addTemplate({
      name: 'Authentication Flow Template',
      description: 'Standard authentication flow testing',
      userType: 'new-user',
      complexity: 'simple',
      steps: [
        {
          order: 1,
          description: 'Access login page',
          action: 'Navigate to login',
          expectedResult: 'Login form loads',
          validationMethod: 'visual',
          estimatedTime: 30,
          critical: true
        },
        {
          order: 2,
          description: 'Enter credentials',
          action: 'Fill username/password',
          expectedResult: 'Form accepts input',
          validationMethod: 'functional',
          estimatedTime: 45,
          critical: true
        },
        {
          order: 3,
          description: 'Submit login',
          action: 'Click login button',
          expectedResult: 'Authentication successful',
          validationMethod: 'functional',
          estimatedTime: 30,
          critical: true
        }
      ],
      successCriteria: [
        {
          description: 'Login form loads within 2 seconds',
          type: 'performance',
          measurement: 'time',
          threshold: 2000,
          weight: 8
        },
        {
          description: 'Authentication works correctly',
          type: 'functional',
          measurement: 'boolean',
          threshold: 1,
          weight: 10
        }
      ],
      performanceBenchmarks: [
        {
          metric: 'totalTime',
          target: 105,
          unit: 'seconds',
          tolerance: 20,
          critical: false
        },
        {
          metric: 'successRate',
          target: 100,
          unit: '%',
          tolerance: 5,
          critical: true
        }
      ]
    });
  }
}

// ============================================================================
// REACT HOOKS FOR SCENARIO INTEGRATION
// ============================================================================

export function useUserScenarios() {
  const [scenariosSystem] = useState(() => new UserScenariosSystem());
  const [currentExecution, setCurrentExecution] = useState<ScenarioExecution | null>(null);

  const startScenario = useCallback((scenarioId: string, userId: string) => {
    const execution = scenariosSystem.startScenarioExecution(scenarioId, userId);
    setCurrentExecution(execution);
    return execution;
  }, [scenariosSystem]);

  const updateStep = useCallback((stepId: string, result: Partial<StepExecutionResult>) => {
    if (currentExecution) {
      scenariosSystem.updateStepExecution(currentExecution.id, stepId, result);
      const updatedExecution = scenariosSystem.getExecution(currentExecution.id);
      if (updatedExecution) {
        setCurrentExecution(updatedExecution);
      }
    }
  }, [scenariosSystem, currentExecution]);

  const completeScenario = useCallback(() => {
    if (currentExecution) {
      const completedExecution = scenariosSystem.completeScenarioExecution(currentExecution.id);
      setCurrentExecution(null);
      return completedExecution;
    }
    return null;
  }, [scenariosSystem, currentExecution]);

  const getScenario = useCallback((scenarioId: string) => {
    return scenariosSystem.getScenario(scenarioId);
  }, [scenariosSystem]);

  const getAllScenarios = useCallback(() => {
    return scenariosSystem.getAllScenarios();
  }, [scenariosSystem]);

  const createFromTemplate = useCallback((templateName: string, customizations: Partial<UserScenario>) => {
    return scenariosSystem.createScenarioFromTemplate(templateName, customizations);
  }, [scenariosSystem]);

  return {
    scenariosSystem,
    currentExecution,
    startScenario,
    updateStep,
    completeScenario,
    getScenario,
    getAllScenarios,
    createFromTemplate
  };
}

// ============================================================================
// EXPORT DEFAULT INSTANCE
// ============================================================================

export const userScenariosSystem = new UserScenariosSystem(); 