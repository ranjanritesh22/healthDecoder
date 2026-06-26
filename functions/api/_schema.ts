// functions/api/_schema.ts
// -----------------------------------------------------------------------------
// WHAT: The JSON schema that describes a MedicalReport, used to FORCE the model
//       to return well-formed, predictable JSON (a.k.a. "structured output").
// WHY:  Without a schema, models occasionally return prose, markdown fences, or
//       missing fields — which would crash the UI. By passing this schema to the
//       provider, the model is constrained to emit exactly the fields the
//       frontend expects (mirrors src/types.ts `MedicalReport`).
//
//       This schema is written in the OpenAPI-subset format that BOTH Google
//       Gemini (`responseSchema`) and a tool/JSON-mode for Anthropic understand.
//       If you change src/types.ts, update this file to match.
// -----------------------------------------------------------------------------

/** A reusable schema fragment for one Finding object. */
const findingSchema = {
  type: 'object',
  properties: {
    parameter: { type: 'string' },
    value: { type: 'string' },
    unit: { type: 'string' },
    referenceRange: { type: 'string' },
    status: { type: 'string', enum: ['normal', 'high', 'low', 'watch'] },
    explanation: { type: 'string' },
  },
  required: ['parameter', 'value', 'unit', 'referenceRange', 'status', 'explanation'],
} as const;

/**
 * The complete report schema. `language` is intentionally NOT requested from the
 * model — the Function injects the known language afterward (the model should
 * not have to echo it back, and we already know it).
 */
export const reportSchema = {
  type: 'object',
  properties: {
    patient: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'string' },
        sex: { type: 'string' },
        reportDate: { type: 'string' },
        referredBy: { type: 'string' },
      },
    },
    overallSummary: { type: 'string' },
    overallStatus: { type: 'string', enum: ['good', 'attention', 'see-doctor'] },
    importantFindings: { type: 'array', items: findingSchema },
    allFindings: { type: 'array', items: findingSchema },
    foodRecommendations: { type: 'array', items: { type: 'string' } },
    foodsToLimit: { type: 'array', items: { type: 'string' } },
    lifestyleSuggestions: { type: 'array', items: { type: 'string' } },
    questionsForDoctor: { type: 'array', items: { type: 'string' } },
    whenToSeeDoctor: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: [
    'overallSummary',
    'overallStatus',
    'importantFindings',
    'allFindings',
    'foodRecommendations',
    'foodsToLimit',
    'lifestyleSuggestions',
    'questionsForDoctor',
    'whenToSeeDoctor',
    'disclaimer',
  ],
} as const;
