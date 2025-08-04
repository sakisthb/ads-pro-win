'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Play, Pause, Settings, Zap } from 'lucide-react'

export function UITestComponent() {
  const [activeTab, setActiveTab] = useState('buttons')
  const [buttonState, setButtonState] = useState('default')
  const [clickCount, setClickCount] = useState(0)

  const handleButtonClick = (variant: string) => {
    setButtonState(variant)
    setClickCount(prev => prev + 1)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">UI Components Test</h1>
        <p className="text-muted-foreground">
          Testing buttons and tabs functionality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
            Interactive Test Status
          </CardTitle>
          <CardDescription>
            Current state: <Badge variant="outline">{buttonState}</Badge> | 
            Clicks: <Badge>{clickCount}</Badge>
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="buttons">Buttons</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="states">States</TabsTrigger>
          <TabsTrigger value="interactive">Interactive</TabsTrigger>
        </TabsList>

        <TabsContent value="buttons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Button Tests</CardTitle>
              <CardDescription>
                Testing standard button functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={() => handleButtonClick('primary')}
                  className="min-w-32"
                >
                  Primary Button
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => handleButtonClick('secondary')}
                  className="min-w-32"
                >
                  Secondary Button
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleButtonClick('outline')}
                  className="min-w-32"
                >
                  Outline Button
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => handleButtonClick('ghost')}
                  className="min-w-32"
                >
                  Ghost Button
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Button Variants</CardTitle>
              <CardDescription>
                Different button styles and sizes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium mb-3">Sizes</h4>
                <div className="flex items-center gap-4">
                  <Button size="sm" onClick={() => handleButtonClick('small')}>
                    Small
                  </Button>
                  <Button size="default" onClick={() => handleButtonClick('default')}>
                    Default
                  </Button>
                  <Button size="lg" onClick={() => handleButtonClick('large')}>
                    Large
                  </Button>
                  <Button size="icon" onClick={() => handleButtonClick('icon')}>
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">With Icons</h4>
                <div className="flex gap-4">
                  <Button onClick={() => handleButtonClick('play')}>
                    <Play className="w-4 h-4 mr-2" />
                    Play
                  </Button>
                  <Button variant="outline" onClick={() => handleButtonClick('pause')}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                  <Button variant="secondary" onClick={() => handleButtonClick('zap')}>
                    <Zap className="w-4 h-4 mr-2" />
                    Action
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Button States</CardTitle>
              <CardDescription>
                Testing different button states
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button onClick={() => handleButtonClick('normal')}>
                  Normal State
                </Button>
                <Button disabled>
                  Disabled State
                </Button>
                <Button variant="destructive" onClick={() => handleButtonClick('destructive')}>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Destructive
                </Button>
                <Button variant="link" onClick={() => handleButtonClick('link')}>
                  Link Button
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Last clicked: <strong>{buttonState}</strong> button
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Total clicks: <strong>{clickCount}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Interactive Test</CardTitle>
              <CardDescription>
                Advanced interaction tests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Click Counter</h4>
                  <div className="flex items-center space-x-3">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setClickCount(prev => Math.max(0, prev - 1))}
                    >
                      -
                    </Button>
                    <span className="min-w-12 text-center text-lg font-mono">
                      {clickCount}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setClickCount(prev => prev + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Reset Actions</h4>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="secondary"
                      onClick={() => setClickCount(0)}
                    >
                      Reset Counter
                    </Button>
                    <Button 
                      size="sm"
                      variant="ghost"
                      onClick={() => setButtonState('default')}
                    >
                      Reset State
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => {
                    setClickCount(0)
                    setButtonState('reset')
                    // Show success message
                    console.log('Full reset completed!')
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Full Reset Test
                </Button>
              </div>
              
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  ✅ If you can see this message and interact with all buttons and tabs above, 
                  the UI components are working correctly!
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}