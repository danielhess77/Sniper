/**
 * Global BDK request throttle.
 *
 * Cloudflare KV rate-limits token writes when many parallel
 * schwabRequest → refreshAccessToken → KV PUT calls fire.
 * Serialize outbound BDK traffic with a minimum gap.
 */

const MIN_GAP_MS = 400;

let chain: Promise<void> = Promise.resolve();
let lastStart = 0;

export function bdkThrottle<T>(fn: () => Promise<T>): Promise<T> {

    const run = chain.then(async () => {

        const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastStart));

        if (wait > 0) {

            await new Promise(r => setTimeout(r, wait));

        }

        lastStart = Date.now();

        return fn();

    });

    // Keep queue alive even if one request fails
    chain = run.then(

        () => undefined,

        () => undefined

    );

    return run;

}
