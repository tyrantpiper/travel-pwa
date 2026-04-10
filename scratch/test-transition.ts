// Scratch testing for View Transition API compatibility in 2026 environment

export const testTransition = () => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
        // Testing if the compiler accepts this without 'any' first
        // @ts-ignore - Some TS versions in 2026 might still need this if lib dom isn't updated
        document.startViewTransition(() => {
            console.log("Transitioning...");
        });
    }
};
