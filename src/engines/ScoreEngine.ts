/**
 * ScoreEngine v1.2
 *
 * Calculates the total setup score and provides
 * shared scoring methods used across all playbooks.
 */

export interface ScoreInput {

    trend: number;

    playbook: number;

    confirmation: number;

    risk: number;

    entry: number;

}

export class ScoreEngine {

    evaluate(input: ScoreInput): number {

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

    //--------------------------------------------------
    // Risk / Reward Score
    //--------------------------------------------------

    evaluateRisk(riskReward: number): number {

        if (

            !Number.isFinite(riskReward) ||
            riskReward <= 0

        ) {

            return 0;

        }

        if (riskReward >= 5.0) return 15;

        if (riskReward >= 4.0) return 14;

        if (riskReward >= 3.5) return 13;

        if (riskReward >= 3.0) return 12;

        if (riskReward >= 2.5) return 11;

        if (riskReward >= 2.0) return 10;

        if (riskReward >= 1.75) return 8;

        if (riskReward >= 1.50) return 7;

        if (riskReward >= 1.25) return 5;

        if (riskReward >= 1.00) return 3;

        return 1;

    }

    //--------------------------------------------------
    // Entry Freshness Score
    //--------------------------------------------------

    evaluateEntry(candlesAgo: number): number {

        if (candlesAgo <= 0) {

            return 10;

        }

        if (candlesAgo === 1) {

            return 8;

        }

        if (candlesAgo === 2) {

            return 6;

        }

        if (candlesAgo === 3) {

            return 4;

        }

        return 2;

    }

}