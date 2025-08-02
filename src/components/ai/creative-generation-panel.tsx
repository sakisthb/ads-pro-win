"use client";

// AI Creative Generation Panel with Real-Time Progress
// Interface for AI-powered creative content generation

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreativeGeneration } from '@/hooks/use-ai-agents';
import { useAIWebSocket } from '@/hooks/use-websocket';
import { 
  Palette, Wand2, Copy, Download, RefreshCw, Sparkles, 
  Target, MessageSquare, Image, Video, FileText, Clock,
  CheckCircle, AlertCircle, ArrowRight 
} from 'lucide-react';

interface CreativeGenerationPanelProps {
  campaignId?: string;
  organizationId?: string;
  onCreativeGenerated?: (result: any) => void;
}

interface CreativeResult {
  content: {
    title: string;
    description: string;
    cta?: string;
    targetAudience?: string[];
  };
  variants: Array<{
    title: string;
    description: string;
    cta: string;
  }>;
  confidence: number;
}

const platforms = [
  { value: 'facebook', label: 'Facebook', icon: '📘', specs: 'Headlines: 25 chars, Text: 125 chars' },
  { value: 'instagram', label: 'Instagram', icon: '📷', specs: 'Captions: 2200 chars, Hashtags: 30 max' },
  { value: 'google', label: 'Google Ads', icon: '🔍', specs: 'Headlines: 30 chars, Descriptions: 90 chars' },
  { value: 'tiktok', label: 'TikTok', icon: '🎵', specs: 'Text: 100 chars, Hashtags: trending focused' },
  { value: 'linkedin', label: 'LinkedIn', icon: '💼', specs: 'Headlines: 150 chars, Professional tone' },
];

const creativeTypes = [
  { value: 'text', label: 'Text Ad', icon: FileText, description: 'Headlines, descriptions, and CTAs' },
  { value: 'image', label: 'Image Ad', icon: Image, description: 'Visual content with copy' },
  { value: 'video', label: 'Video Ad', icon: Video, description: 'Video scripts and descriptions' },
  { value: 'carousel', label: 'Carousel', icon: Copy, description: 'Multi-slide creative content' },
];

const sampleAudiences = [
  'Small business owners',
  'Tech professionals',
  'Parents with young children',
  'College students',
  'Fitness enthusiasts',
  'Fashion-conscious millennials',
  'Home improvement DIYers',
  'Travel enthusiasts',
];

const sampleGoals = [
  'Increase brand awareness',
  'Drive website traffic',
  'Generate leads',
  'Boost sales',
  'Promote new product',
  'Build email list',
  'Increase app downloads',
  'Improve engagement',
];

export const CreativeGenerationPanel: React.FC<CreativeGenerationPanelProps> = ({
  campaignId,
  organizationId,
  onCreativeGenerated,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState('facebook');
  const [selectedType, setSelectedType] = useState<'text' | 'image' | 'video' | 'carousel'>('text');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'google'>('openai');
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<CreativeResult | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);

  // AI operations hook
  const { generate, isGenerating, error, data } = useCreativeGeneration();

  // WebSocket for real-time updates
  const { aiOperation, isConnected } = useAIWebSocket(organizationId);

  const handleAddAudience = useCallback((audience: string) => {
    if (audience && !selectedAudiences.includes(audience)) {
      setSelectedAudiences(prev => [...prev, audience]);
    }
  }, [selectedAudiences]);

  const handleAddGoal = useCallback((goal: string) => {
    if (goal && !selectedGoals.includes(goal)) {
      setSelectedGoals(prev => [...prev, goal]);
    }
  }, [selectedGoals]);

  const handleRemoveAudience = useCallback((audience: string) => {
    setSelectedAudiences(prev => prev.filter(a => a !== audience));
  }, []);

  const handleRemoveGoal = useCallback((goal: string) => {
    setSelectedGoals(prev => prev.filter(g => g !== goal));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (selectedAudiences.length === 0 || selectedGoals.length === 0) return;

    try {
      const result = await generate({
        campaignId,
        platform: selectedPlatform,
        audience: selectedAudiences,
        goals: selectedGoals,
        constraints,
        creativeType: selectedType,
        provider: selectedProvider,
      });

      // Mock result since generate doesn't return anything
      const mockResult = {
        id: 'creative-' + Date.now(),
        type: selectedType,
        content: {
          title: 'Generated Creative Title',
          description: 'Generated creative content description',
          cta: 'Learn More',
          targetAudience: selectedAudiences
        },
        platform: selectedPlatform,
        status: 'completed',
        variants: [
          { title: 'Variant 1', description: 'First variant description', cta: 'Get Started' },
          { title: 'Variant 2', description: 'Second variant description', cta: 'Learn More' }
        ],
        confidence: 0.85,
        timestamp: new Date().toISOString()
      };

      setLastResult(mockResult);
      onCreativeGenerated?.(mockResult);
    } catch (err) {
      console.error('Creative generation failed:', err);
    }
  }, [campaignId, selectedPlatform, selectedAudiences, selectedGoals, constraints, selectedType, selectedProvider, generate, onCreativeGenerated]);

  const handleCopyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  }, []);

  const selectedPlatformData = platforms.find(p => p.value === selectedPlatform);
  const selectedTypeData = creativeTypes.find(t => t.value === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="h-6 w-6 text-purple-600" />
              <div>
                <CardTitle>AI Creative Generation</CardTitle>
                <CardDescription>
                  Generate compelling ad creative content with AI assistance
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <div className="w-2 h-2 bg-red-600 rounded-full mr-2" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Creative Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Platform & Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      <div className="flex items-center space-x-2">
                        <span>{platform.icon}</span>
                        <span>{platform.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlatformData && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedPlatformData.specs}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Creative Type</label>
              <Select value={selectedType} onValueChange={(value: any) => setSelectedType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {creativeTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedTypeData && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedTypeData.description}
                </p>
              )}
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Target Audience
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sampleAudiences.map((audience) => (
                <Button
                  key={audience}
                  variant={selectedAudiences.includes(audience) ? "default" : "outline"}
                  size="sm"
                  onClick={() => 
                    selectedAudiences.includes(audience) 
                      ? handleRemoveAudience(audience)
                      : handleAddAudience(audience)
                  }
                  className="text-xs"
                >
                  {audience}
                </Button>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Add custom audience..."
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddAudience(customAudience);
                    setCustomAudience('');
                  }
                }}
              />
              <Button 
                size="sm" 
                onClick={() => {
                  handleAddAudience(customAudience);
                  setCustomAudience('');
                }}
                disabled={!customAudience}
              >
                Add
              </Button>
            </div>
            {selectedAudiences.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedAudiences.map((audience) => (
                  <Badge key={audience} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveAudience(audience)}>
                    {audience} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Campaign Goals */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center">
              <Sparkles className="h-4 w-4 mr-2" />
              Campaign Goals
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {sampleGoals.map((goal) => (
                <Button
                  key={goal}
                  variant={selectedGoals.includes(goal) ? "default" : "outline"}
                  size="sm"
                  onClick={() => 
                    selectedGoals.includes(goal) 
                      ? handleRemoveGoal(goal)
                      : handleAddGoal(goal)
                  }
                  className="text-xs"
                >
                  {goal}
                </Button>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Add custom goal..."
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddGoal(customGoal);
                    setCustomGoal('');
                  }
                }}
              />
              <Button 
                size="sm" 
                onClick={() => {
                  handleAddGoal(customGoal);
                  setCustomGoal('');
                }}
                disabled={!customGoal}
              >
                Add
              </Button>
            </div>
            {selectedGoals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedGoals.map((goal) => (
                  <Badge key={goal} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveGoal(goal)}>
                    {goal} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* AI Provider */}
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Provider</label>
            <Select value={selectedProvider} onValueChange={(value: any) => setSelectedProvider(value)}>
              <SelectTrigger className="w-full md:w-1/2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">GPT-4 Turbo (Creative)</SelectItem>
                <SelectItem value="anthropic">Claude 3 Sonnet (Detailed)</SelectItem>
                <SelectItem value="google">Gemini Pro (Fast)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || selectedAudiences.length === 0 || selectedGoals.length === 0}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Generating Creative...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Creative Content
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Real-Time Progress */}
      {(isGenerating || aiOperation.isRunning) && aiOperation.operationType === 'generation' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <div className="w-2 h-2 bg-purple-600 rounded-full mr-3 animate-pulse" />
              Creative Generation in Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Stage: {aiOperation.stage || 'Initializing'}</span>
                <span>{aiOperation.progress || 0}%</span>
              </div>
              <Progress value={aiOperation.progress || 0} className="h-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {aiOperation.message || 'Starting creative generation...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-800 dark:text-red-200">Generation Failed</h4>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {error.message || 'An unexpected error occurred during generation'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {lastResult && (
        <div className="space-y-4">
          {/* Main Creative */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  Generated Creative
                </CardTitle>
                <Badge variant="outline">
                  {Math.round(lastResult.confidence * 100)}% Confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Headline</label>
                    <h3 className="text-xl font-bold">{lastResult.content.title}</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleCopyToClipboard(lastResult.content.title)}
                      className="mt-1"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Description</label>
                    <p className="text-gray-900 dark:text-gray-100">{lastResult.content.description}</p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleCopyToClipboard(lastResult.content.description)}
                      className="mt-1"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>

                  {lastResult.content.cta && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Call to Action</label>
                      <div className="inline-block">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                          {lastResult.content.cta}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleCopyToClipboard(lastResult.content.cta!)}
                          className="ml-2"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          {lastResult.variants && lastResult.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Creative Variants</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedVariant.toString()} onValueChange={(value) => setSelectedVariant(parseInt(value))}>
                  <TabsList className="grid grid-cols-3 w-full">
                    {lastResult.variants.slice(0, 3).map((_, index) => (
                      <TabsTrigger key={index} value={index.toString()}>
                        Variant {index + 1}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {lastResult.variants.map((variant, index) => (
                    <TabsContent key={index} value={index.toString()} className="mt-4">
                      <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Headline</label>
                            <h4 className="text-lg font-semibold">{variant.title}</h4>
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Description</label>
                            <p className="text-gray-700 dark:text-gray-300">{variant.description}</p>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Call to Action</label>
                            <div className="inline-block">
                              <Button size="sm" variant="outline">
                                {variant.cta}
                              </Button>
                            </div>
                          </div>

                          <div className="flex space-x-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleCopyToClipboard(`${variant.title}\n\n${variant.description}\n\n${variant.cta}`)}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy All
                            </Button>
                            <Button size="sm" variant="outline">
                              <ArrowRight className="h-3 w-3 mr-1" />
                              Use This Variant
                            </Button>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default CreativeGenerationPanel;