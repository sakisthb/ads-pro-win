"use client";

// WebSocket Connection Status Indicator
// Real-time connection status display with detailed connection info

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/use-websocket';
import { 
  Wifi, WifiOff, Activity, Clock, RefreshCw, 
  CheckCircle, AlertCircle, Info, Signal,
  Zap, Users, Globe
} from 'lucide-react';

interface WebSocketStatusProps {
  organizationId?: string;
  className?: string;
  showDetails?: boolean;
  minimal?: boolean;
}

export const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ 
  organizationId, 
  className = "",
  showDetails = false,
  minimal = false 
}) => {
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  
  const { 
    isConnected, 
    isConnecting, 
    error, 
    connectionId, 
    connect, 
    disconnect, 
    ping,
    lastMessage,
    aiOperation 
  } = useWebSocket({ 
    organizationId, 
    autoConnect: true 
  });

  const getStatusColor = () => {
    if (isConnecting) return 'yellow';
    if (isConnected) return 'green';
    return 'red';
  };

  const getStatusIcon = () => {
    if (isConnecting) return RefreshCw;
    if (isConnected) return Wifi;
    return WifiOff;
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    if (error) return 'Connection Error';
    return 'Disconnected';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Minimal version for compact display
  if (minimal) {
    const StatusIcon = getStatusIcon();
    const color = getStatusColor();
    
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <StatusIcon 
          className={`h-3 w-3 ${
            color === 'green' ? 'text-green-600' :
            color === 'yellow' ? 'text-yellow-600 animate-spin' :
            'text-red-600'
          }`} 
        />
        <span className={`text-xs ${
          color === 'green' ? 'text-green-600' :
          color === 'yellow' ? 'text-yellow-600' :
          'text-red-600'
        }`}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  // Full status component
  const StatusIcon = getStatusIcon();
  const color = getStatusColor();

  return (
    <div className={className}>
      <Card className={`border-${color}-200 ${showDetails ? 'bg-gray-50 dark:bg-gray-800' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <StatusIcon 
                  className={`h-5 w-5 ${
                    color === 'green' ? 'text-green-600' :
                    color === 'yellow' ? 'text-yellow-600 animate-spin' :
                    'text-red-600'
                  }`} 
                />
                {isConnected && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{getStatusText()}</span>
                  <Badge 
                    variant="outline" 
                    className={
                      color === 'green' ? 'text-green-600 border-green-600' :
                      color === 'yellow' ? 'text-yellow-600 border-yellow-600' :
                      'text-red-600 border-red-600'
                    }
                  >
                    WebSocket
                  </Badge>
                </div>
                
                {connectionId && (
                  <span className="text-xs text-gray-500">
                    ID: {connectionId.split('_').pop()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {aiOperation.isRunning && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span className="text-xs">AI Active</span>
                </div>
              )}

              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetailedInfo(!showDetailedInfo)}
              >
                <Info className="h-4 w-4" />
              </Button>

              {!isConnected && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={connect}
                  disabled={isConnecting}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isConnecting ? 'animate-spin' : ''}`} />
                  {isConnecting ? 'Connecting' : 'Reconnect'}
                </Button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
              </div>
            </div>
          )}

          {/* AI Operation Status */}
          {aiOperation.isRunning && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    AI Operation in Progress
                  </span>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  {aiOperation.progress}%
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Type:</strong> {aiOperation.operationType}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Stage:</strong> {aiOperation.stage}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Message:</strong> {aiOperation.message}
                </div>
                {aiOperation.campaignId && (
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>Campaign:</strong> {aiOperation.campaignId}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed Information */}
          {(showDetailedInfo || showDetails) && (
            <div className="mt-4 space-y-3">
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-1" />
                  Connection Details
                </h4>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <div className="font-medium">{getStatusText()}</div>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Connection ID:</span>
                    <div className="font-mono text-xs break-all">
                      {connectionId || 'Not assigned'}
                    </div>
                  </div>
                  
                  {organizationId && (
                    <div>
                      <span className="text-gray-500">Organization:</span>
                      <div className="font-mono text-xs break-all">{organizationId}</div>
                    </div>
                  )}
                  
                  {lastMessage && (
                    <div>
                      <span className="text-gray-500">Last Message:</span>
                      <div className="font-medium">{formatTimestamp(lastMessage.timestamp)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connection Actions */}
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={ping}
                  disabled={!isConnected}
                >
                  <Signal className="h-3 w-3 mr-1" />
                  Ping
                </Button>
                
                {isConnected ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={disconnect}
                  >
                    <WifiOff className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={connect}
                    disabled={isConnecting}
                  >
                    <Wifi className="h-3 w-3 mr-1" />
                    Connect
                  </Button>
                )}
              </div>

              {/* Last Message Details */}
              {lastMessage && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Last Message</h4>
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    <div><strong>Type:</strong> {lastMessage.type}</div>
                    <div><strong>Time:</strong> {formatTimestamp(lastMessage.timestamp)}</div>
                    {lastMessage.data && (
                      <div className="mt-1">
                        <strong>Data:</strong>
                        <pre className="text-xs mt-1 whitespace-pre-wrap break-all">
                          {JSON.stringify(lastMessage.data, null, 2).slice(0, 200)}
                          {JSON.stringify(lastMessage.data).length > 200 ? '...' : ''}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Simplified status badge for use in headers/navbars
export const WebSocketStatusBadge: React.FC<{ organizationId?: string }> = ({ organizationId }) => {
  const { isConnected, isConnecting } = useWebSocket({ organizationId, autoConnect: true });
  
  return (
    <Badge 
      variant="outline" 
      className={
        isConnecting ? 'text-yellow-600 border-yellow-600' :
        isConnected ? 'text-green-600 border-green-600' :
        'text-red-600 border-red-600'
      }
    >
      <div className={`w-2 h-2 rounded-full mr-2 ${
        isConnecting ? 'bg-yellow-600 animate-pulse' :
        isConnected ? 'bg-green-600 animate-pulse' :
        'bg-red-600'
      }`} />
      {isConnecting ? 'Connecting' : isConnected ? 'Live' : 'Offline'}
    </Badge>
  );
};

export default WebSocketStatus;