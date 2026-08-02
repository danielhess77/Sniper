import { Candle } from "../core/BDKClient.js";
import { ValidationResult } from "../engines/SignalValidationEngine.js";

export interface Playbook<T> {

    evaluate(
        candles: Candle[]
    ): T;

    validate(
        candles: Candle[],
        result: T
    ): ValidationResult;

}