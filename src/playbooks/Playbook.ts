/**
 * Sniper
 * Playbook Interface
 *
 * Version: 3.0
 */

import { Candle } from "../core/BDKClient.js";
import { DecisionTrace } from "../types/DecisionTrace.js";

export interface ValidationResult {

    active: boolean;

    reason: string;

}

//--------------------------------------------------
// Every playbook can explain its decisions
//--------------------------------------------------

export interface Traceable<T> {

    trace(
        result: T
    ): DecisionTrace;

}

//--------------------------------------------------
// Base Playbook Interface
//--------------------------------------------------

export interface Playbook<T>
    extends Traceable<T> {

    evaluate(
        candles: Candle[]
    ): T;

    validate(
        candles: Candle[],
        result: T
    ): ValidationResult;

}