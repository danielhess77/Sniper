/**
 * Sniper
 * Signal Validation Engine
 *
 * Determines whether a playbook
 * signal is still actionable.
 *
 * Version: 1.0
 */

import { Candle } from "../core/BDKClient.js";

export interface ValidationResult {

    active: boolean;

    reason: string;

}

export class SignalValidationEngine {

    validate(

        candles: Candle[],

        result: any

    ): ValidationResult {

        // Every playbook should provide
        // its own validation callback.

        if (

            typeof result.isStillValid === "function"

        ) {

            return result.isStillValid(candles);

        }

        // Default behavior

        return {

            active: result.qualified,

            reason: result.qualified

                ? ""

                : "Not qualified"

        };

    }

}