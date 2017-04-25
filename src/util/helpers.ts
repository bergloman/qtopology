

/**
 * Simple functio that delay execution for specified amount of milliseconds.
 * @param t - delay in milliseconds
 */
export function delay(t: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, t);
    });
}
