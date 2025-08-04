'use client'

import { ProtectedLayout } from '@/components/layouts/protected-layout'
import { UITestComponent } from '@/components/test/ui-test'
import { ErrorBoundary, ConsoleLogger } from '@/components/debug/error-boundary'

export default function UITestPage() {
  return (
    <ProtectedLayout>
      <ConsoleLogger>
        <ErrorBoundary>
          <UITestComponent />
        </ErrorBoundary>
      </ConsoleLogger>
    </ProtectedLayout>
  )
}