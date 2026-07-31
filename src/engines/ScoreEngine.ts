/**
 * ScoreEngine v1.0
 *
 * Produces a 0–100 quality score
 * for qualified Sniper setups.
 */

export interface ScoreInput {

    trend: number;          // 0-30

    playbook: number;       // 0-25

    confirmation: number;   // 0-20

    risk: number;           // 0-15

    entry: number;          // 0-10

}

export class ScoreEngine {

    evaluate(
        input: ScoreInput
    ): number {

        const score =

            input.trend +

            input.playbook +

            input.confirmation +

            input.risk +

            input.entry;

        return Math.max(
            0,
            Math.min(100, score)
        );

    }

}