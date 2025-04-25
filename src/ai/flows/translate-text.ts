'use server';
/**
 * @fileOverview Translates text to a specified target language using an AI model.
 *
 * - translateText - A function that handles text translation.
 * - TranslateTextInput - The input type for the translateText function.
 * - TranslateTextOutput - The return type for the translateText function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const TranslateTextInputSchema = z.object({
  text: z.string().describe('The text to be translated.'),
  targetLanguageCode: z
    .string()
    .describe(
      'The ISO 639-1 code of the target language (e.g., "en", "hi", "bn", "mr", "ur", "ta").'
    ),
  sourceLanguageCode: z
    .string()
    .optional()
    .describe('Optional: The ISO 639-1 code of the source language.'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

const TranslateTextOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {
    schema: z.object({
      text: z.string().describe('The text to be translated.'),
      targetLanguageCode: z
        .string()
        .describe('The ISO 639-1 code of the target language.'),
      sourceLanguageCode: z
        .string()
        .optional()
        .describe('Optional: The ISO 639-1 code of the source language.'),
    }),
  },
  output: {
    schema: z.object({
      translatedText: z.string().describe('The translated text.'),
    }),
  },
  prompt: `Translate the following text{{#if sourceLanguageCode}} from {{sourceLanguageCode}}{{/if}} to {{targetLanguageCode}}. Only return the translated text, without any introductory phrases or explanations.

Text:
"{{text}}"
`,
});

const translateTextFlow = ai.defineFlow<
  typeof TranslateTextInputSchema,
  typeof TranslateTextOutputSchema
>(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
