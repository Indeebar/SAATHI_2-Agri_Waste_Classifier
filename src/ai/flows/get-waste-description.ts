'use server';
/**
 * @fileOverview Provides a description for a given agricultural waste type using an AI model.
 *
 * - getWasteDescription - A function that retrieves a description for a specific waste type.
 * - GetWasteDescriptionInput - The input type for the getWasteDescription function.
 * - GetWasteDescriptionOutput - The return type for the getWasteDescription function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GetWasteDescriptionInputSchema = z.object({
  wasteType: z.string().describe('The type of agricultural waste to describe.'),
});
export type GetWasteDescriptionInput = z.infer<typeof GetWasteDescriptionInputSchema>;

const GetWasteDescriptionOutputSchema = z.object({
  description: z.string().describe('A brief description of the agricultural waste type.'),
});
export type GetWasteDescriptionOutput = z.infer<typeof GetWasteDescriptionOutputSchema>;

export async function getWasteDescription(input: GetWasteDescriptionInput): Promise<GetWasteDescriptionOutput> {
  return getWasteDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getWasteDescriptionPrompt',
  input: {
    schema: z.object({
      wasteType: z.string().describe('The type of agricultural waste to describe.'),
    }),
  },
  output: {
    schema: z.object({
      description: z.string().describe('A brief description of the agricultural waste type.'),
    }),
  },
  prompt: `Provide a short, informative description (1-2 sentences) for the following agricultural waste type: "{{wasteType}}". Focus on its common sources or uses.`,
});

const getWasteDescriptionFlow = ai.defineFlow<
  typeof GetWasteDescriptionInputSchema,
  typeof GetWasteDescriptionOutputSchema
>({
  name: 'getWasteDescriptionFlow',
  inputSchema: GetWasteDescriptionInputSchema,
  outputSchema: GetWasteDescriptionOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
