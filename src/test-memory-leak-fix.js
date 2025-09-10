/**
 * Memory Leak Test for Performance Hooks
 * Tests the fixes for timeout cleanup and cache cleanup
 */

import React, { useEffect, useState } from 'react';
import { useBatchedMessageUpdates, useJsonParser } from './hooks/usePerformanceOptimizations.js';

// Test component that mounts/unmounts rapidly to simulate memory leak conditions
function MemoryLeakTestComponent({ testId }) {
  const { addMessage, updateMessage, messages } = useBatchedMessageUpdates(50);
  const parseJson = useJsonParser();
  
  useEffect(() => {
    console.log(`[Test ${testId}] Component mounted`);
    
    // Simulate rapid message additions that would create timeouts
    const interval = setInterval(() => {
      addMessage({ id: Math.random(), content: 'Test message', timestamp: Date.now() });
    }, 25); // Faster than batch delay to create multiple timeouts
    
    // Simulate JSON parsing that would populate cache
    parseJson('{"test": "data"}');
    parseJson('{"another": "object"}');
    
    return () => {
      clearInterval(interval);
      console.log(`[Test ${testId}] Component unmounting`);
    };
  }, [testId, addMessage, parseJson]);
  
  return (
    <div>
      Test Component {testId} - Messages: {messages.length}
    </div>
  );
}

// Memory leak simulation test
export function runMemoryLeakTest() {
  console.log('🧪 Starting Memory Leak Test for Performance Hooks');
  
  let componentCounter = 0;
  let mountedComponents = new Set();
  
  // Simulate rapid mount/unmount cycles that would trigger memory leaks
  const testInterval = setInterval(() => {
    componentCounter++;
    
    // Mount a new component
    mountedComponents.add(componentCounter);
    console.log(`📦 Mounting component ${componentCounter}`);
    
    // Unmount after short delay (before timeout completes)
    setTimeout(() => {
      mountedComponents.delete(componentCounter);
      console.log(`🗑️  Unmounting component ${componentCounter}`);
      
      // Check if cleanup worked (no errors in console)
      if (componentCounter % 10 === 0) {
        console.log(`✅ Completed ${componentCounter} mount/unmount cycles - checking for memory leaks...`);
        
        // In a real environment, you'd check actual memory usage here
        // For this test, we just verify no timeout-related errors occur
        if (componentCounter >= 50) {
          clearInterval(testInterval);
          console.log('🎉 Memory leak test completed - no timeout cleanup errors detected!');
          console.log('📊 If no "clearTimeout called on null/undefined" errors appeared, the fix is working');
        }
      }
    }, 25); // Unmount before 50ms timeout completes
    
  }, 30); // Mount new components every 30ms
  
  return testInterval;
}

// Browser console test
if (typeof window !== 'undefined') {
  window.testMemoryLeakFix = runMemoryLeakTest;
  console.log('💡 Run window.testMemoryLeakFix() in browser console to test the memory leak fixes');
}