import { useState, useEffect, useCallback } from 'react';

// === CONSTANTS ===
const INTERVAL_ACTIVE = 30 * 1000;    // 30s
const INTERVAL_IDLE = 2 * 60 * 1000;  // 2m
const INTERVAL_SLEEP = 0;             // Paused
const TIMEOUT_IDLE = 5 * 60 * 1000;   // 5m inactivity -> Idle
const TIMEOUT_SLEEP = 30 * 60 * 1000; // 30m inactivity -> Sleep

/**
 * 🧠 Hyper-Heuristic Polling Hook
 * usage: const refreshInterval = useDynamicPolling()
 */
export function useDynamicPolling() {
    const [lastActivity, setLastActivity] = useState(() => Date.now());
    const [currentInterval, setCurrentInterval] = useState(INTERVAL_ACTIVE);

    const handleActivity = useCallback(() => {
        setLastActivity(Date.now());
    }, []);

    // 1. Activity Tracker
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        // Throttled handler
        let timeout: NodeJS.Timeout;
        const throttledHandler = () => {
            if (timeout) return;
            timeout = setTimeout(() => {
                handleActivity();
                timeout = undefined!;
            }, 1000);
        };

        events.forEach(e => window.addEventListener(e, throttledHandler));
        return () => events.forEach(e => window.removeEventListener(e, throttledHandler));
    }, [handleActivity]);

    // 2. Heuristic Logic (Decision Loop)
    useEffect(() => {
        const checkState = () => {
            const now = Date.now();
            const diff = now - lastActivity;

            if (diff > TIMEOUT_SLEEP) {
                if (currentInterval !== INTERVAL_SLEEP) {
                    console.log('💤 [PollingManager] Entering Deep Sleep Mode (Paused)');
                    setCurrentInterval(INTERVAL_SLEEP);
                }
            } else if (diff > TIMEOUT_IDLE) {
                if (currentInterval !== INTERVAL_IDLE) {
                    console.log('🌙 [PollingManager] Entering Idle Mode (2m)');
                    setCurrentInterval(INTERVAL_IDLE);
                }
            } else {
                if (currentInterval !== INTERVAL_ACTIVE) {
                    console.log('⚡ [PollingManager] Entering Active Mode (30s)');
                    setCurrentInterval(INTERVAL_ACTIVE);
                }
            }
        };

        const timer = setInterval(checkState, 10000); // Check every 10s
        return () => clearInterval(timer);
    }, [lastActivity, currentInterval]);

    return currentInterval;
}
