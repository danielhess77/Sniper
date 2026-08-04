/**
 * Sniper
 * Decision Trace Engine
 *
 * Version: 4.0
 *
 * Shared decision tracing for every engine.
 */

import {
    DecisionStep,
    DecisionTrace
} from "../types/DecisionTrace.js";

export class DecisionTraceEngine {

    private steps: DecisionStep[] = [];

    //--------------------------------------------------
    // Add decision step
    //--------------------------------------------------

    add(

        name: string,

        passed: boolean,

        value?: string,

        reason?: string

    ): void {

        this.steps.push({

            type: "decision",

            name,

            passed,

            value,

            reason

        });

    }

    //--------------------------------------------------
    // Add informational step
    //--------------------------------------------------

    addInfo(

        name: string,

        value?: string,

        reason?: string

    ): void {

        this.steps.push({

            type: "info",

            name,

            passed: true,

            value,

            reason

        });

    }

    //--------------------------------------------------
    // Merge another engine's trace
    //--------------------------------------------------

    addSteps(
        steps: DecisionStep[]
    ): void {

        this.steps.push(...steps);

    }

    //--------------------------------------------------
    // Clear trace
    //--------------------------------------------------

    reset(): void {

        this.steps = [];

    }

    //--------------------------------------------------
    // Build final trace
    //--------------------------------------------------

    build(): DecisionTrace {

        return {

            passed:

                this.steps

                    .filter(

                        step =>

                            step.type === "decision"

                    )

                    .every(

                        step => step.passed

                    ),

            steps:

                [...this.steps]

        };

    }

    //--------------------------------------------------
    // Convenience Helpers
    //--------------------------------------------------

    static pass(

        name: string,

        value?: string,

        reason?: string

    ): DecisionStep {

        return {

            type: "decision",

            name,

            passed: true,

            value,

            reason

        };

    }

    static fail(

        name: string,

        reason: string,

        value?: string

    ): DecisionStep {

        return {

            type: "decision",

            name,

            passed: false,

            value,

            reason

        };

    }

    static info(

        name: string,

        value?: string,

        reason?: string

    ): DecisionStep {

        return {

            type: "info",

            name,

            passed: true,

            value,

            reason

        };

    }

}