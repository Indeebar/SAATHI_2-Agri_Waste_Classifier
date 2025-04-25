'use server';
/**
 * @fileOverview Translates text or an array of texts to a specified target language using an AI model.
 *
 * - translateText - A function that handles text translation for single strings or arrays.
 * - TranslateTextInput - The input type for the translateText function.
 * - TranslateTextOutput - The return type for the translateText function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

// Allow either a single string or an array of strings
const TranslateTextInputSchema = z.object({
  texts: z.union([z.string(), z.array(z.string())]).describe('The text or array of texts to be translated.'),
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

// Return either a single string or an array of strings, matching the input type
const TranslateTextOutputSchema = z.object({
    translatedTexts: z.union([z.string(), z.array(z.string())]).describe('The translated text or array of translated texts.')
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;

// Main function remains the same interface, calling the flow
export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlowRevised(input); // Ensure we are calling the revised flow
}

// --- Define Prompt with revised input schema ---
const prompt = ai.definePrompt({
  name: 'translateTextPrompt',
  input: {
    schema: z.object({
       texts: z.string().describe('The text string OR a JSON string representation of an array of texts.'),
       targetLanguageCode: z.string().describe('The ISO 639-1 code of the target language.'),
       sourceLanguageCode: z.string().optional().describe('Optional: The ISO 639-1 code of the source language.'),
       isArray: z.boolean().describe('Flag indicating if the texts input is a JSON array string.')
    }),
  },
  output: {
    // Output schema remains a union, but the flow logic ensures it matches input type
    schema: z.object({
      // Ensure the output schema can handle both string and array based on the actual return
      translatedTexts: z.union([z.string(), z.array(z.string())]).describe('The translated text or JSON array of translated strings.')
    }),
  },
  prompt: `Translate the following text(s){{#if sourceLanguageCode}} from {{sourceLanguageCode}}{{/if}} to {{targetLanguageCode}}.

{{#if isArray}}
Input is a JSON array string. Translate each text in the array individually. Return the results *only* as a JSON array of strings, maintaining the original order. Do not add any explanations or markdown formatting like \`\`\`json or \`\`\`.
Input JSON Array String:
{{texts}}
{{else}}
Input is a single text string. Return *only* the translated text. Do not add any explanations.
Input Text: "{{texts}}"
{{/if}}
`,
});


// --- Define the Revised Flow ---
const translateTextFlowRevised = ai.defineFlow<
  typeof TranslateTextInputSchema, // Flow still accepts the original union type { texts: string | string[], ... }
  typeof TranslateTextOutputSchema // Flow still returns the original union type { translatedTexts: string | string[] }
>(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input: TranslateTextInput): Promise<TranslateTextOutput> => {
      const isArray = Array.isArray(input.texts);
       // Prepare the input for the *prompt call* based on whether it's an array
      const promptInputPayload = {
          texts: isArray ? JSON.stringify(input.texts) : input.texts as string,
          targetLanguageCode: input.targetLanguageCode,
          sourceLanguageCode: input.sourceLanguageCode,
          isArray: isArray
      };

      // Log the input being sent to the prompt
      // console.log("Sending to prompt:", JSON.stringify(promptInputPayload, null, 2));

       const promptResult = await ai.run(prompt, promptInputPayload);

       // Log the raw output received from the prompt
      // console.log("Received from prompt:", JSON.stringify(promptResult.output, null, 2));


      let finalOutput: string | string[];
      if (isArray) {
          let rawOutput = promptResult.output?.translatedTexts;
          // console.log("Raw output for array:", rawOutput);
          try {
              if (typeof rawOutput === 'string') {
                  // Clean potential markdown fences and extra characters before parsing
                  rawOutput = rawOutput.replace(/^```json\s*|\s*```$/g, '').trim();
                  rawOutput = rawOutput.replace(/^json\s*/i, '').trim(); // Remove leading 'json' if present
                  finalOutput = JSON.parse(rawOutput);
                  if (!Array.isArray(finalOutput) || !finalOutput.every((item): item is string => typeof item === 'string')) {
                      throw new Error(`Parsed output is not an array of strings. Got: ${JSON.stringify(finalOutput)}`);
                  }
              } else if (Array.isArray(rawOutput) && rawOutput.every((item): item is string => typeof item === 'string')) {
                  finalOutput = rawOutput; // Genkit might handle parsing
              } else {
                   throw new Error(`Output is not a valid JSON array string or array of strings. Received type: ${typeof rawOutput}, Value: ${JSON.stringify(rawOutput)}`);
              }
          } catch (parseError: any) {
               console.error("Failed to parse batch translation output:", parseError, "Raw output:", rawOutput);
               // If parsing fails, it's likely the LLM didn't return valid JSON.
               // Include raw output in the error message for easier debugging.
               throw new Error(`Translation failed: LLM did not return a valid JSON array. Raw output: ${JSON.stringify(rawOutput)}. Error: ${parseError.message}`);
          }
      } else {
          // Handle single string output
           // console.log("Raw output for single string:", promptResult.output?.translatedTexts);
          if (typeof promptResult.output?.translatedTexts === 'string') {
              finalOutput = promptResult.output.translatedTexts;
          } else {
               console.error("Expected string output for single text translation, received:", promptResult.output?.translatedTexts);
               throw new Error(`Translation failed: Unexpected output type for single text translation. Expected string, got: ${typeof promptResult.output?.translatedTexts}`);
          }
      }

      // console.log("Final processed output:", finalOutput);
      return { translatedTexts: finalOutput };
  }
);

// The export async function translateText already points to translateTextFlowRevised at the top.
// No need for reassignment here.
// Remove any potential duplicate/old flow definitions or reassignments.
