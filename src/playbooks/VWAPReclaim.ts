/**
 * Sniper
 * VWAP Reclaim Playbook
 *
 * Version: 1.0
 */

import { Candle } from "../core/BDKClient.js";
import { Playbook } from "./Playbook.js";

import {
    TrendQualification
} from "../core/TrendQualification.js";

import {
    VWAPReclaimEngine
} from "../engines/VWAPReclaimEngine.js";

import {
    ConfirmationEngine
} from "../engines/ConfirmationEngine.js";

import {
    RiskEngine
} from "../engines/RiskEngine.js";

type TrendResult =
    ReturnType<TrendQualification["evaluate"]>;

type ReclaimResult =
    ReturnType<VWAPReclaimEngine["evaluate"]>;

type ConfirmationResult =
    ReturnType<ConfirmationEngine["evaluate"]>;

type RiskResult =
    ReturnType<RiskEngine["evaluate"]>;

export interface VWAPReclaimResult {

    playbook: string;

    qualified: boolean;

    trend: TrendResult;

    reclaim: ReclaimResult;

    confirmation: ConfirmationResult;

    risk: RiskResult;

}

export class VWAPReclaim
implements Playbook<VWAPReclaimResult> {

    private trend =
        new TrendQualification();

    private reclaim =
        new VWAPReclaimEngine();

    private confirmation =
        new ConfirmationEngine();

    private risk =
        new RiskEngine();

    evaluate(
        candles: Candle[]
    ): VWAPReclaimResult {

        const trend =
            this.trend.evaluate(candles);

        const reclaim =
            this.reclaim.evaluate(
                candles,
                trend.vwap,
                trend.direction
            );

        const confirmation =
            this.confirmation.evaluate(candles);

        const defaultRisk: RiskResult = {

            valid: false,

            entry: 0,

            stop: 0,

            target: 0,

            riskReward: 0

        };

        if (

            trend.direction === "NONE" ||

            !reclaim.reclaimed ||

            !confirmation.confirmed

        ) {

            return {

                playbook: "VWAP Reclaim",

                qualified: false,

                trend,

                reclaim,

                confirmation,

                risk: defaultRisk

            };

        }

        const risk =
            this.risk.evaluate(

                candles,

                trend,

                confirmation

            );

        return {

            playbook: "VWAP Reclaim",

            qualified: risk.valid,

            trend,

            reclaim,

            confirmation,

            risk

        };

    }

}