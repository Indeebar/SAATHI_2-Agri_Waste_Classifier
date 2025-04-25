'use server';
/**
 * @fileOverview An agricultural waste classifier AI agent.
 *
 * - classifyWaste - A function that handles the waste classification process.
 * - ClassifyWasteInput - The input type for the classifyWaste function.
 * - ClassifyWasteOutput - The return type for the classifyWaste function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ClassifyWasteInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of agricultural waste, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ClassifyWasteInput = z.infer<typeof ClassifyWasteInputSchema>;

const ClassifyWasteOutputSchema = z.object({
  wasteType: z.string().describe('The predicted type of agricultural waste.'),
  confidence: z
    .number()
    .describe(
      'The confidence level of the prediction, as a number between 0 and 1.'
    ),
});
export type ClassifyWasteOutput = z.infer<typeof ClassifyWasteOutputSchema>;

export async function classifyWaste(input: ClassifyWasteInput): Promise<ClassifyWasteOutput> {
  return classifyWasteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyWastePrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo of agricultural waste, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      wasteType: z.string().describe('The predicted type of agricultural waste.'),
      confidence: z
        .number()
        .describe(
          'The confidence level of the prediction, as a number between 0 and 1.'
        ),
    }),
  },
  prompt: `You are an expert in agricultural waste classification.

  Analyze the provided image of agricultural waste and determine the type of waste.

  Return the waste type and a confidence level for your prediction.

  Photo: {{media url=photoDataUri}}
  `,
});

const classifyWasteFlow = ai.defineFlow<
  typeof ClassifyWasteInputSchema,
  typeof ClassifyWasteOutputSchema
>({
  name: 'classifyWasteFlow',
  inputSchema: ClassifyWasteInputSchema,
  outputSchema: ClassifyWasteOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
