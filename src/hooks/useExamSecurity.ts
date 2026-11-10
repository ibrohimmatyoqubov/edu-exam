/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { SecurityViolation } from '../types';

export interface UseExamSecurityOptions {
  enabled: boolean;
  maxWarnings?: number;
  onViolation?: (violation: SecurityViolation, currentCount: number) => void;
  onTerminated?: (reason: string, violations: SecurityViolation[]) => void;
}

export function useExamSecurity({
  enabled,
  maxWarnings = 3,
  onViolation,
  onTerminated,
}: UseExamSecurityOptions) {
  const [warningCount, setWarningCount] = useState<number>(0);
  const [violations, setViolations] = useState<SecurityViolation[]>([]);
  const [isTerminated, setIsTerminated] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeWarning, setActiveWarning] = useState<SecurityViolation | null>(null);

  // Use refs to avoid stale closures inside event listeners
  const warningCountRef = useRef<number>(0);
  const isTerminatedRef = useRef<boolean>(false);
  const lastViolationTimeRef = useRef<number>(0);

  // Sync refs
  useEffect(() => {
    warningCountRef.current = warningCount;
  }, [warningCount]);

  useEffect(() => {
    isTerminatedRef.current = isTerminated;
  }, [isTerminated]);

  // Handle a new violation
  const recordViolation = useCallback(
    (type: SecurityViolation['type'], details: string) => {
      if (!enabled || isTerminatedRef.current) return;

      // Throttle rapid repeated events (e.g. blur followed immediately by visibilitychange within 600ms)
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 600) {
        return;
      }
      lastViolationTimeRef.current = now;

      const newCount = warningCountRef.current + 1;
      const violation: SecurityViolation = {
        id: `viol-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        timestamp: new Date().toISOString(),
        details,
      };

      setWarningCount(newCount);
      warningCountRef.current = newCount;

      setViolations((prev) => {
        const updated = [...prev, violation];
        return updated;
      });

      setActiveWarning(violation);
      onViolation?.(violation, newCount);

      // Check if threshold reached
      if (newCount >= maxWarnings) {
        const reason = `Anti-Cheat qoidabuzarligi: ${maxWarnings} marta ruxsatsiz harakat qayd etildi (${details}). Imtihon to'xtatildi!`;
        setIsTerminated(true);
        isTerminatedRef.current = true;
        setTerminationReason(reason);
        onTerminated?.(reason, [...violations, violation]);
      }
    },
    [enabled, maxWarnings, onViolation, onTerminated, violations]
  );

  // Acknowledge the warning popup
  const acknowledgeWarning = useCallback(() => {
    setActiveWarning(null);
  }, []);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if ((docEl as any).webkitRequestFullscreen) {
        await (docEl as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('Fullscreen ruxsati berilmadi yoki foydalanuvchi bekor qildi:', err);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn('Fullscreen chiqishda xatolik:', err);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Check initial fullscreen
    setIsFullscreen(!!document.fullscreenElement);

    // 1. Tab visibility detection
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        recordViolation(
          'tab_switch',
          'Brauzer yorlig\'i yashirildi yoki boshqa tab ochildi'
        );
      }
    };

    // 2. Window blur detection (switching apps or clicking outside window)
    const handleWindowBlur = () => {
      recordViolation(
        'window_blur',
        'Imtihon oynasidan chiqib ketildi (boshqa dastur/oyna faollashdi)'
      );
    };

    // 3. Fullscreen change detection
    const handleFullscreenChange = () => {
      const isInFs = !!document.fullscreenElement;
      setIsFullscreen(isInFs);
      if (!isInFs && !isTerminatedRef.current) {
        recordViolation(
          'fullscreen_exit',
          'To\'liq ekran (Fullscreen) rejimidan chiqib ketildi'
        );
      }
    };

    // 4. Keyboard shortcuts & copy/paste prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        recordViolation('forbidden_key', 'Ekran rasmini olish (PrintScreen) taqiqlandi');
        return;
      }

      // Ctrl or Meta (Command on Mac) shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (
          key === 'c' || // Copy
          key === 'v' || // Paste
          key === 'x' || // Cut
          key === 'u' || // View Source
          key === 's' || // Save
          key === 'p' || // Print
          key === 'a'    // Select All
        ) {
          e.preventDefault();
          recordViolation('forbidden_key', `Klaviatura kombinatsiyasi (Ctrl+${key.toUpperCase()}) taqiqlandi`);
          return;
        }

        // DevTools shortcuts (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
        if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
          e.preventDefault();
          recordViolation('forbidden_key', 'Dasturchi asboblarini (DevTools) ochish taqiqlandi');
          return;
        }
      }

      // F12 key (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        recordViolation('forbidden_key', 'F12 tugmasi taqiqlandi');
        return;
      }

      // Alt+Tab simulation guard
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        recordViolation('forbidden_key', 'Alt+Tab taqiqlandi');
        return;
      }
    };

    // 5. Right Click (Context Menu) block
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      recordViolation('context_menu', 'Sichqonchaning o\'ng tugmasi (Context Menu) bloklandi');
    };

    // 6. Copy / Cut / Paste event block
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // Attach listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('cut', handleClipboard);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
    };
  }, [enabled, recordViolation]);

  return {
    warningCount,
    maxWarnings,
    warningsRemaining: Math.max(0, maxWarnings - warningCount),
    violations,
    isTerminated,
    terminationReason,
    isFullscreen,
    activeWarning,
    acknowledgeWarning,
    requestFullscreen,
    exitFullscreen,
  };
}
