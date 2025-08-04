'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SimpleTestPage() {
  const [activeTab, setActiveTab] = useState('buttons')
  const [clickCount, setClickCount] = useState(0)

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Simple UI Test</h1>
          <p className="text-muted-foreground">Testing buttons and tabs functionality</p>
          <Badge>Clicks: {clickCount}</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buttons">Buttons</TabsTrigger>
            <TabsTrigger value="tabs">Tabs Test</TabsTrigger>
            <TabsTrigger value="counter">Counter</TabsTrigger>
          </TabsList>

          <TabsContent value="buttons" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Button Tests</CardTitle>
                <CardDescription>Click buttons to test functionality</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <Button onClick={() => setClickCount(c => c + 1)}>
                    Primary Button
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => setClickCount(c => c + 1)}
                  >
                    Secondary
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setClickCount(c => c + 1)}
                  >
                    Outline
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setClickCount(c => c + 1)}
                  >
                    Ghost
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tabs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tabs Functionality</CardTitle>
                <CardDescription>
                  If you can see this content, tabs are working!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  ✅ Tab switching is functional<br/>
                  ✅ Content shows/hides properly<br/>
                  ✅ Active state updates correctly
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="counter" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interactive Counter</CardTitle>
                <CardDescription>Test state management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-4">{clickCount}</div>
                  <div className="flex justify-center gap-4">
                    <Button 
                      variant="outline" 
                      onClick={() => setClickCount(c => Math.max(0, c - 1))}
                    >
                      -1
                    </Button>
                    <Button onClick={() => setClickCount(0)}>
                      Reset
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setClickCount(c => c + 1)}
                    >
                      +1
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">
            🎉 If you can interact with buttons and switch tabs, everything is working!
          </p>
        </div>
      </div>
    </div>
  )
}