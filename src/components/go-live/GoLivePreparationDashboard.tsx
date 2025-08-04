/**
 * Go-Live Preparation Dashboard
 * Ads Pro Enterprise - Production Launch Management
 * 
 * This component provides a comprehensive interface for managing
 * go-live preparation, checklist tracking, and rollback procedures.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  GoLivePreparationSystem, 
  useGoLivePreparation,
  GO_LIVE_CATEGORIES,
  type GoLiveChecklistItem,
  type RollbackProcedure,
  type ProductionEnvironment,
  validateProductionEnvironment,
  generateGoLiveTimeline,
  calculateRiskAssessment
} from '@/lib/production/go-live-preparation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Play, 
  Pause, 
  RotateCcw,
  Download,
  Upload,
  Eye,
  Settings,
  Shield,
  Database,
  Server,
  Monitor,
  FileText,
  TestTube,
  Zap
} from 'lucide-react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface GoLiveDashboardProps {
  environment: ProductionEnvironment;
  onStatusUpdate?: (itemId: string, status: GoLiveChecklistItem['status']) => void;
  onRollbackExecute?: (procedureId: string) => Promise<void>;
}

interface ChecklistItemProps {
  item: GoLiveChecklistItem;
  onStatusUpdate: (status: GoLiveChecklistItem['status'], notes?: string) => void;
  dependencies: GoLiveChecklistItem[];
}

interface RollbackProcedureProps {
  procedure: RollbackProcedure;
  onExecute: (procedureId: string) => Promise<void>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getStatusIcon = (status: GoLiveChecklistItem['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'in-progress':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: GoLiveChecklistItem['priority']) => {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getRiskColor = (risk: 'low' | 'medium' | 'high' | 'critical') => {
  switch (risk) {
    case 'critical':
      return 'bg-red-500';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    default:
      return 'bg-green-500';
  }
};

// ============================================================================
// CHECKLIST ITEM COMPONENT
// ============================================================================

const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onStatusUpdate, dependencies }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(item.notes || '');

  const canStart = dependencies.every(dep => dep.status === 'completed');
  const isBlocked = !canStart && dependencies.length > 0;

  return (
    <Card className={`mb-4 ${item.status === 'completed' ? 'border-green-200 bg-green-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(item.status)}
            <div>
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              <CardDescription className="text-xs">{item.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getPriorityColor(item.priority)}>
              {item.priority}
            </Badge>
            <Badge variant="outline">
              {item.estimatedTime}m
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Owner:</span> {item.owner}
              </div>
              <div>
                <span className="font-medium">Validation:</span> {item.validation}
              </div>
            </div>

            {dependencies.length > 0 && (
              <div>
                <span className="font-medium text-sm">Dependencies:</span>
                <div className="mt-1 space-y-1">
                  {dependencies.map(dep => (
                    <div key={dep.id} className="flex items-center space-x-2 text-xs">
                      {getStatusIcon(dep.status)}
                      <span>{dep.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isBlocked && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Blocked</AlertTitle>
                <AlertDescription>
                  This item is blocked by incomplete dependencies.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 text-sm border rounded-md"
                rows={2}
                placeholder="Add notes about this item..."
              />
            </div>

            <div className="flex space-x-2">
              {item.status !== 'completed' && canStart && (
                <Button
                  size="sm"
                  onClick={() => onStatusUpdate('in-progress', notes)}
                  disabled={item.status === 'in-progress'}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </Button>
              )}
              
              {item.status === 'in-progress' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate('completed', notes)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete
                </Button>
              )}

              {item.status === 'failed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate('pending', notes)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}

              {item.status !== 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate('pending', notes)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// ============================================================================
// ROLLBACK PROCEDURE COMPONENT
// ============================================================================

const RollbackProcedureCard: React.FC<RollbackProcedureProps> = ({ procedure, onExecute }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await onExecute(procedure.id);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">{procedure.name}</CardTitle>
            <CardDescription className="text-xs">{procedure.description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={`${getRiskColor(procedure.riskLevel)} text-white`}>
              {procedure.riskLevel}
            </Badge>
            <Badge variant="outline">
              {procedure.estimatedTime}m
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div>
              <span className="font-medium text-sm">Trigger Conditions:</span>
              <ul className="mt-1 space-y-1 text-xs">
                {procedure.triggerConditions.map((condition, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{condition}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <span className="font-medium text-sm">Steps:</span>
              <div className="mt-2 space-y-2">
                {procedure.steps.map((step) => (
                  <div key={step.order} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                    <Badge variant="outline" className="text-xs">
                      {step.order}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium text-xs">{step.action}</div>
                      <div className="text-xs text-gray-600">{step.command}</div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {step.estimatedTime}m
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleExecute}
              disabled={isExecuting}
              variant="destructive"
              size="sm"
              className="w-full"
            >
              {isExecuting ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-1 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Execute Rollback
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export const GoLivePreparationDashboard: React.FC<GoLiveDashboardProps> = ({
  environment,
  onStatusUpdate,
  onRollbackExecute
}) => {
  const {
    checklist,
    progress,
    readiness,
    updateItemStatus,
    getItemsByCategory,
    getItemsByStatus,
    getItemsByPriority,
    executeRollback,
    exportData,
    categories,
    rollbackProcedures
  } = useGoLivePreparation(environment);

  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Validation
  const environmentValidation = validateProductionEnvironment(environment);
  const timeline = generateGoLiveTimeline(checklist);
  const riskAssessment = calculateRiskAssessment(checklist);

  // Filter checklist items
  const filteredItems = checklist.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (selectedPriority !== 'all' && item.priority !== selectedPriority) return false;
    return true;
  });

  const handleStatusUpdate = (itemId: string, status: GoLiveChecklistItem['status'], notes?: string) => {
    updateItemStatus(itemId, status, notes);
    onStatusUpdate?.(itemId, status);
  };

  const handleRollbackExecute = async (procedureId: string) => {
    try {
      await executeRollback(procedureId);
      onRollbackExecute?.(procedureId);
    } catch (error) {
      console.error('Rollback execution failed:', error);
    }
  };

  const getDependencies = (item: GoLiveChecklistItem) => {
    return item.dependencies.map(depId => 
      checklist.find(i => i.id === depId)
    ).filter(Boolean) as GoLiveChecklistItem[];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Go-Live Preparation Dashboard</h1>
          <p className="text-gray-600">Manage production launch checklist and rollback procedures</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => {
            const data = exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'go-live-checklist.json';
            a.click();
          }}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Environment Validation */}
      {!environmentValidation.valid && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Environment Configuration Issues</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {environmentValidation.issues.map((issue, index) => (
                <li key={index} className="text-sm">• {issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Progress Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.total}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{progress.completed}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{progress.inProgress}</div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{progress.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{progress.percentage}%</div>
              <div className="text-sm text-gray-600">Complete</div>
            </div>
          </div>
          
          <Progress value={progress.percentage} className="mb-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-800">Estimated Time</div>
              <div className="text-lg font-bold text-blue-600">{Math.round(readiness.estimatedTime / 60)}h {readiness.estimatedTime % 60}m</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-sm font-medium text-orange-800">Critical Issues</div>
              <div className="text-lg font-bold text-orange-600">{readiness.criticalIssues.length}</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-sm font-medium text-purple-800">Risk Level</div>
              <div className="text-lg font-bold text-purple-600">{riskAssessment.overallRisk}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Readiness Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Go-Live Readiness</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <Badge className={readiness.ready ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
              {readiness.ready ? 'READY FOR GO-LIVE' : 'NOT READY'}
            </Badge>
            <span className="text-sm text-gray-600">
              {readiness.ready ? 'All critical items completed' : `${readiness.criticalIssues.length} critical items pending`}
            </span>
          </div>

          {readiness.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium text-sm">Recommendations:</div>
              <ul className="space-y-1">
                {readiness.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="rollback">Rollback</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categories Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categories Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categories.map(category => {
                    const categoryItems = getItemsByCategory(category.id);
                    const completed = categoryItems.filter(item => item.status === 'completed').length;
                    const percentage = categoryItems.length > 0 ? Math.round((completed / categoryItems.length) * 100) : 0;
                    
                    return (
                      <div key={category.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{category.name}</span>
                          <span className="text-sm text-gray-600">{completed}/{categoryItems.length}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getRiskColor(riskAssessment.overallRisk)}`} />
                    <span className="font-medium">Overall Risk: {riskAssessment.overallRisk}</span>
                  </div>
                  
                  {riskAssessment.riskFactors.length > 0 && (
                    <div>
                      <div className="font-medium text-sm mb-2">Risk Factors:</div>
                      <ul className="space-y-1">
                        {riskAssessment.riskFactors.map((factor, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedCategory('all');
                      setSelectedStatus('all');
                      setSelectedPriority('all');
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checklist Items */}
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    No items match the current filters.
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredItems.map(item => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  onStatusUpdate={(status, notes) => handleStatusUpdate(item.id, status, notes)}
                  dependencies={getDependencies(item)}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Rollback Tab */}
        <TabsContent value="rollback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>Rollback Procedures</span>
              </CardTitle>
              <CardDescription>
                Emergency procedures to revert changes in case of issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rollbackProcedures.map(procedure => (
                  <RollbackProcedureCard
                    key={procedure.id}
                    procedure={procedure}
                    onExecute={handleRollbackExecute}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Go-Live Timeline</span>
              </CardTitle>
              <CardDescription>
                Estimated timeline for completing all go-live activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.phases.map((phase, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{phase.name}</h3>
                      <Badge variant="outline">{Math.round(phase.duration / 60)}h {phase.duration % 60}m</Badge>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {phase.items.length} items
                    </div>
                    <Progress value={(phase.duration / timeline.totalDuration) * 100} className="h-2" />
                  </div>
                ))}
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Estimated Time</span>
                    <Badge variant="outline">
                      {Math.round(timeline.totalDuration / 60)}h {timeline.totalDuration % 60}m
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GoLivePreparationDashboard; 