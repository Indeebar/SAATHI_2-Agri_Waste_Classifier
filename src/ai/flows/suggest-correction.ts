// File: src/ai/flows/suggest-correction.ts
'use server';
/**
 * @fileOverview This file defines a Genkit flow for suggesting alternative agricultural waste types
 * if the initial prediction is incorrect. It takes an image and the initially selected waste type
 * as input and returns a list of suggested corrections.
 *
 * - suggestCorrection - A function that handles the suggestion of alternative waste types.
 * - SuggestCorrectionInput - The input type for the suggestCorrection function.
 * - SuggestCorrectionOutput - The return type for the suggestCorrection function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SuggestCorrectionInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of agricultural waste, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  initialSelection: z.string().describe('The initially selected waste type.'),
});
export type SuggestCorrectionInput = z.infer<typeof SuggestCorrectionInputSchema>;

const SuggestCorrectionOutputSchema = z.object({
  suggestedCorrections: z
    .array(z.string())
    .describe('A list of suggested alternative waste types.'),
});
export type SuggestCorrectionOutput = z.infer<typeof SuggestCorrectionOutputSchema>;

export async function suggestCorrection(input: SuggestCorrectionInput): Promise<SuggestCorrectionOutput> {
  return suggestCorrectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCorrectionPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo of agricultural waste, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
      initialSelection: z.string().describe('The initially selected waste type.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedCorrections: z
        .array(z.string())
        .describe('A list of suggested alternative waste types.'),
    }),
  },
  prompt: `You are an expert in agricultural waste classification.

  The user has uploaded a photo of agricultural waste and initially selected "{{initialSelection}}" as the waste type.
  However, they believe this prediction is incorrect.

  Based on the image ({{media url=photoDataUri}}), suggest a list of alternative waste types that might be more accurate.
  Only include waste types that are plausible given the image.
  Return the suggestions as a JSON array of strings.
  `,
});

const suggestCorrectionFlow = ai.defineFlow<
  typeof SuggestCorrectionInputSchema,
  typeof SuggestCorrectionOutputSchema
>(
  {
    name: 'suggestCorrectionFlow',
    inputSchema: SuggestCorrectionInputSchema,
    outputSchema: SuggestCorrectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
